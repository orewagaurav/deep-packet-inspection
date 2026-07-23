#include "rule_sync.h"

#include <curl/curl.h>
#include <iostream>
#include <sstream>
#include <chrono>

namespace DPI {

// libcurl write callback — accumulate the response body into a std::string.
static size_t curlAppendCallback(char* ptr, size_t size, size_t nmemb, void* userdata) {
    auto* out = static_cast<std::string*>(userdata);
    out->append(ptr, size * nmemb);
    return size * nmemb;
}

RuleSync::RuleSync(const std::string& backend_url, ApplyFn apply, int poll_interval_ms)
    : endpoint_(backend_url + "/rules/active"),
      apply_(std::move(apply)),
      poll_interval_ms_(poll_interval_ms) {}

RuleSync::~RuleSync() {
    stop();
}

void RuleSync::start() {
    if (running_.load()) return;
    running_ = true;
    thread_ = std::thread(&RuleSync::loop, this);
    std::cout << "[RuleSync] Started — polling " << endpoint_
              << " every " << (poll_interval_ms_ / 1000.0) << "s\n";
}

void RuleSync::stop() {
    if (!running_.load()) return;
    running_ = false;
    if (thread_.joinable()) thread_.join();
    std::cout << "[RuleSync] Stopped (syncs applied: " << sync_count_.load() << ")\n";
}

void RuleSync::loop() {
    bool first = true;
    auto next = std::chrono::steady_clock::now();

    while (running_.load()) {
        std::string payload;
        if (fetchActive(payload)) {
            if (first || payload != last_payload_) {
                last_payload_ = payload;
                parseAndApply(payload);
                sync_count_.fetch_add(1, std::memory_order_relaxed);
            }
            first = false;
        }

        // Sleep the poll interval in small slices so stop() is responsive.
        next += std::chrono::milliseconds(poll_interval_ms_);
        while (running_.load() && std::chrono::steady_clock::now() < next) {
            std::this_thread::sleep_for(std::chrono::milliseconds(150));
        }
    }
}

bool RuleSync::fetchActive(std::string& out) {
    CURL* curl = curl_easy_init();
    if (!curl) return false;

    out.clear();
    curl_easy_setopt(curl, CURLOPT_URL, endpoint_.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, curlAppendCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &out);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 3L);
    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);

    CURLcode res = curl_easy_perform(curl);
    bool ok = false;
    if (res == CURLE_OK) {
        long code = 0;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &code);
        ok = (code >= 200 && code < 300);
    }
    curl_easy_cleanup(curl);
    return ok;
}

void RuleSync::parseAndApply(const std::string& payload) {
    std::vector<std::string> ips, apps, domains;

    std::istringstream ss(payload);
    std::string line;
    while (std::getline(ss, line)) {
        // strip trailing CR / whitespace
        while (!line.empty() && (line.back() == '\r' || line.back() == ' ')) line.pop_back();
        if (line.empty()) continue;

        auto sp = line.find(' ');
        if (sp == std::string::npos) continue;
        std::string type = line.substr(0, sp);
        std::string value = line.substr(sp + 1);
        // trim leading spaces on value
        size_t start = value.find_first_not_of(' ');
        if (start == std::string::npos) continue;
        value = value.substr(start);

        if (type == "ip") ips.push_back(value);
        else if (type == "app") apps.push_back(value);
        else if (type == "domain") domains.push_back(value);
    }

    if (apply_) apply_(ips, apps, domains);
    std::cout << "[RuleSync] Applied " << ips.size() << " ip, " << apps.size()
              << " app, " << domains.size() << " domain rule(s)\n";
}

}  // namespace DPI
