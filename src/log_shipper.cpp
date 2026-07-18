#include "log_shipper.h"
#include <iostream>
#include <curl/curl.h>

namespace DPI {

// ============================================================================
// libcurl write callback — discard response body
// ============================================================================
static size_t curlDiscardCallback(char* /*ptr*/, size_t size, size_t nmemb, void* /*userdata*/) {
    return size * nmemb;
}

// ============================================================================
// Constructor / Destructor
// ============================================================================

LogShipper::LogShipper(const std::string& backend_url, int batch_size, int flush_interval_ms)
    : endpoint_(backend_url + "/logs"),
      batch_size_(batch_size),
      flush_interval_ms_(flush_interval_ms) {
    // Global curl init (safe to call multiple times)
    curl_global_init(CURL_GLOBAL_DEFAULT);
}

LogShipper::~LogShipper() {
    stop();
    curl_global_cleanup();
}

// ============================================================================
// start() / stop()
// ============================================================================

void LogShipper::start() {
    if (running_.load()) return;
    running_ = true;
    last_error_log_time_ = std::chrono::steady_clock::now();
    flush_thread_ = std::thread(&LogShipper::flushLoop, this);
    std::cout << "[LogShipper] Started — shipping to " << endpoint_ << "\n";
}

void LogShipper::stop() {
    if (!running_.load()) return;
    running_ = false;
    buffer_cv_.notify_all();
    if (flush_thread_.joinable()) {
        flush_thread_.join();
    }
    // Drain any remaining logs
    drain();
    std::cout << "[LogShipper] Stopped — sent: " << sent_.load()
              << "  failed: " << failed_.load() << "\n";
}

// ============================================================================
// enqueue() — thread-safe
// ============================================================================

void LogShipper::enqueue(const std::string& json_line) {
    {
        std::lock_guard<std::mutex> lock(buffer_mutex_);
        buffer_.push(json_line);
    }
    // Wake the flush thread if we've hit the batch threshold
    if (static_cast<int>(buffer_.size()) >= batch_size_) {
        buffer_cv_.notify_one();
    }
}

// ============================================================================
// flushLoop() — background thread
// ============================================================================

void LogShipper::flushLoop() {
    while (running_.load()) {
        std::vector<std::string> batch;

        {
            std::unique_lock<std::mutex> lock(buffer_mutex_);
            // Wait until batch threshold or timeout
            buffer_cv_.wait_for(lock, std::chrono::milliseconds(flush_interval_ms_), [this] {
                return static_cast<int>(buffer_.size()) >= batch_size_ || !running_.load();
            });

            // Drain up to batch_size_ entries
            while (!buffer_.empty() && static_cast<int>(batch.size()) < batch_size_) {
                batch.push_back(std::move(buffer_.front()));
                buffer_.pop();
            }
        }

        // Send each log individually (matches backend POST /logs contract)
        for (const auto& log : batch) {
            if (sendLog(log)) {
                // On success after errors, print recovery message
                uint64_t prev_errors = consecutive_errors_.exchange(0);
                if (prev_errors > 0) {
                    std::cout << "[LogShipper] Backend connection restored (" 
                              << prev_errors << " errors recovered)\n";
                }
                sent_++;
            } else {
                consecutive_errors_++;
                failed_++;
            }
        }
    }
}

// ============================================================================
// sendLog() — HTTP POST via libcurl
// ============================================================================

bool LogShipper::sendLog(const std::string& json_body) {
    CURL* curl = curl_easy_init();
    if (!curl) {
        std::cerr << "[LogShipper] curl_easy_init failed\n";
        return false;
    }

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");

    curl_easy_setopt(curl, CURLOPT_URL, endpoint_.c_str());
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_body.c_str());
    curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(json_body.size()));
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, curlDiscardCallback);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);           // 5-second timeout
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 3L);     // 3-second connect timeout
    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);           // thread-safe

    CURLcode res = curl_easy_perform(curl);

    bool success = false;
    if (res == CURLE_OK) {
        long http_code = 0;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);
        success = (http_code >= 200 && http_code < 300);
        if (!success) {
            std::cerr << "[LogShipper] HTTP " << http_code
                      << " from " << endpoint_ << "\n";
        }
    } else {
        // Rate-limit error logging: first error immediately, then every 30s
        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(now - last_error_log_time_).count();
        uint64_t errs = consecutive_errors_.load();

        if (errs == 0) {
            // First error — print immediately
            std::cerr << "[LogShipper] Backend unavailable: " << curl_easy_strerror(res)
                      << " (" << endpoint_ << ") -- will retry silently\n";
            last_error_log_time_ = now;
        } else if (elapsed >= 30) {
            // Periodic summary
            std::cerr << "[LogShipper] Still unable to reach backend (" 
                      << errs << " consecutive failures)\n";
            last_error_log_time_ = now;
        }
        // Otherwise: suppress
    }

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    return success;
}

// ============================================================================
// drain() — flush remaining logs on shutdown
// ============================================================================

void LogShipper::drain() {
    std::lock_guard<std::mutex> lock(buffer_mutex_);
    while (!buffer_.empty()) {
        if (sendLog(buffer_.front())) {
            sent_++;
        } else {
            failed_++;
        }
        buffer_.pop();
    }
}

} // namespace DPI
