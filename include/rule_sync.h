#ifndef DPI_RULE_SYNC_H
#define DPI_RULE_SYNC_H

#include <string>
#include <vector>
#include <thread>
#include <atomic>
#include <functional>
#include <cstdint>

namespace DPI {

// ============================================================================
// RuleSync — polls the backend's plain-text GET /rules/active feed and pushes
// the parsed blocklist into the engine, so the dashboard hot-reloads the
// engine's rules without a restart.
//
// The feed is one rule per line: "<type> <value>", e.g.
//     ip 10.0.0.5
//     app YouTube
//     domain youtube.com
//
// RuleSync is decoupled from the Rules class via an apply callback, so it has
// no dependency on the engine's internal types.
// ============================================================================

class RuleSync {
public:
    // apply(ips, apps, domains) — invoked only when the feed changes.
    using ApplyFn = std::function<void(const std::vector<std::string>& ips,
                                       const std::vector<std::string>& apps,
                                       const std::vector<std::string>& domains)>;

    RuleSync(const std::string& backend_url, ApplyFn apply, int poll_interval_ms = 5000);
    ~RuleSync();

    RuleSync(const RuleSync&) = delete;
    RuleSync& operator=(const RuleSync&) = delete;

    void start();
    void stop();

    uint64_t syncCount() const { return sync_count_.load(std::memory_order_relaxed); }

private:
    void loop();
    bool fetchActive(std::string& out);
    void parseAndApply(const std::string& payload);

    std::string endpoint_;      // backend_url + "/rules/active"
    ApplyFn apply_;
    int poll_interval_ms_;

    std::thread thread_;
    std::atomic<bool> running_{false};
    std::atomic<uint64_t> sync_count_{0};
    std::string last_payload_;  // skip re-apply when the feed is unchanged
};

}  // namespace DPI

#endif  // DPI_RULE_SYNC_H
