#ifndef LOG_SHIPPER_H
#define LOG_SHIPPER_H

#include <string>
#include <vector>
#include <chrono>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <atomic>

namespace DPI {

// ============================================================================
// LogShipper — Async HTTP log delivery to the Node.js backend
// ============================================================================
//
// Accepts JSON log strings from FastPath threads and ships them to the
// backend via POST /logs in a background thread.  Logs are batched and
// flushed periodically or when the batch buffer fills up.
//
// Thread-safety: enqueue() can be called from any number of threads.
//
// Usage:
//   LogShipper shipper("http://localhost:3000");
//   shipper.start();
//   shipper.enqueue(R"({"src_ip":"1.2.3.4", ...})");
//   ...
//   shipper.stop();   // drains remaining logs before returning
//
// ============================================================================

class LogShipper {
public:
    // -----------------------------------------------------------------------
    // Constructor
    //   backend_url      : base URL (e.g. "http://localhost:3000")
    //   batch_size       : flush when this many logs are buffered
    //   flush_interval_ms: flush at least this often (milliseconds)
    // -----------------------------------------------------------------------
    explicit LogShipper(const std::string& backend_url,
                        int batch_size = 10,
                        int flush_interval_ms = 2000);

    ~LogShipper();

    // Non-copyable
    LogShipper(const LogShipper&) = delete;
    LogShipper& operator=(const LogShipper&) = delete;

    // -----------------------------------------------------------------------
    // Start the background flush thread.
    // -----------------------------------------------------------------------
    void start();

    // -----------------------------------------------------------------------
    // Stop the shipper.  Drains any remaining buffered logs before returning.
    // -----------------------------------------------------------------------
    void stop();

    // -----------------------------------------------------------------------
    // Enqueue a single JSON log string (thread-safe).
    // -----------------------------------------------------------------------
    void enqueue(const std::string& json_line);

    // -----------------------------------------------------------------------
    // Enqueue a single JSON security-alert string (thread-safe).
    // Delivered to the backend POST /alerts endpoint by the same flush thread.
    // -----------------------------------------------------------------------
    void enqueueAlert(const std::string& json_line);

    // -----------------------------------------------------------------------
    // Statistics
    // -----------------------------------------------------------------------
    uint64_t sentCount()   const { return sent_.load(std::memory_order_relaxed); }
    uint64_t failedCount() const { return failed_.load(std::memory_order_relaxed); }

private:
    std::string endpoint_;        // full URL: backend_url + "/logs"
    std::string alert_endpoint_;  // full URL: backend_url + "/alerts"
    int batch_size_;
    int flush_interval_ms_;

    // Thread-safe buffers (both guarded by buffer_mutex_)
    std::queue<std::string> buffer_;
    std::queue<std::string> alert_buffer_;
    std::mutex buffer_mutex_;
    std::condition_variable buffer_cv_;

    // Background thread
    std::thread flush_thread_;
    std::atomic<bool> running_{false};

    // Stats
    std::atomic<uint64_t> sent_{0};
    std::atomic<uint64_t> failed_{0};

    // Error suppression — avoid spamming console with repeated connection errors
    std::atomic<uint64_t> consecutive_errors_{0};
    std::chrono::steady_clock::time_point last_error_log_time_;

    // -----------------------------------------------------------------------
    // Background flush loop
    // -----------------------------------------------------------------------
    void flushLoop();

    // -----------------------------------------------------------------------
    // POST a single JSON body to a backend URL via libcurl.
    // Returns true on success (HTTP 2xx).
    // -----------------------------------------------------------------------
    bool postJson(const std::string& url, const std::string& json_body);

    // -----------------------------------------------------------------------
    // Drain: flush all remaining buffered logs (called during stop()).
    // -----------------------------------------------------------------------
    void drain();
};

} // namespace DPI

#endif // LOG_SHIPPER_H
