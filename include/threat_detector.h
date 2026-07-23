#ifndef DPI_THREAT_DETECTOR_H
#define DPI_THREAT_DETECTOR_H

#include <cstdint>
#include <string>
#include <mutex>
#include <unordered_map>
#include <unordered_set>
#include <chrono>
#include <atomic>
#include <optional>

namespace DPI {

class LogShipper;  // forward declaration (async alert delivery)

// ============================================================================
// ThreatDetector — Heuristic intrusion / anomaly detection
// ============================================================================
//
// Runs inline in the DPI fast path and raises security alerts for:
//   - Port scans      : one source hitting many distinct destination ports
//   - DNS tunneling    : abnormally long / high-entropy DNS query names
//   - Data exfiltration: a source pushing a large byte volume in a short window
//
// A single detector instance is shared by every FastPath thread (a source's
// flows are sharded across threads by 5-tuple hash), so all methods are
// internally synchronised by one mutex. Detection work per packet is a couple
// of hash-map lookups, which is cheap relative to capture + parsing.
//
// Alerts are rate-limited per (source, type) by a cooldown and, when a
// LogShipper is supplied, delivered asynchronously to the backend POST /alerts
// endpoint. In file mode (no shipper) alerts are still printed to the console,
// which makes detection testable against a crafted malicious pcap.
// ============================================================================

class ThreatDetector {
public:
    struct Thresholds {
        int      portscan_distinct_ports = 20;                 // ports within window → scan
        int      portscan_window_ms      = 10000;              // sliding window (10s)
        size_t   dns_min_qname_len       = 45;                 // suspiciously long QNAME
        double   dns_min_entropy         = 3.5;                // bits/char (encoded data)
        uint64_t exfil_bytes             = 50ull * 1024 * 1024;// 50 MB in window → exfil
        int      exfil_window_ms         = 30000;              // sliding window (30s)
        int      alert_cooldown_ms       = 60000;              // per (source, type) suppression
    };

    explicit ThreatDetector(LogShipper* shipper = nullptr);
    ThreatDetector(LogShipper* shipper, Thresholds thresholds);

    // TCP connection attempt (SYN without ACK) — feeds port-scan detection.
    void onConnectionAttempt(uint32_t src_ip, uint16_t dst_port);

    // A DNS query name observed from a source — feeds tunneling detection.
    void onDnsQuery(uint32_t src_ip, const std::string& qname);

    // Bytes observed from a source — feeds data-exfil detection.
    void onBytes(uint32_t src_ip, uint64_t bytes);

    uint64_t alertsRaised() const { return alerts_raised_.load(std::memory_order_relaxed); }

    // Parse a DNS QNAME (dotted, lowercase) from a UDP DNS payload.
    // Returns nullopt if the payload is too short, truncated, or uses name
    // compression (never present in a question section). Static + pure so it
    // can be unit-tested independently.
    static std::optional<std::string> extractDnsQName(const uint8_t* payload, size_t len);

private:
    using Clock = std::chrono::steady_clock;

    struct PortScanState {
        Clock::time_point window_start;
        std::unordered_set<uint16_t> ports;
    };
    struct VolumeState {
        Clock::time_point window_start;
        uint64_t bytes = 0;
    };

    // The following two helpers assume mutex_ is already held by the caller.
    void raiseAlert(uint32_t src_ip, const std::string& type,
                    const std::string& severity, const std::string& description);
    bool cooldownElapsed(uint32_t src_ip, const std::string& type, Clock::time_point now);

    static double shannonEntropy(const std::string& s);

    LogShipper* shipper_;
    Thresholds  th_;

    std::mutex mutex_;
    std::unordered_map<uint32_t, PortScanState> portscan_;   // by source IP
    std::unordered_map<uint32_t, VolumeState>   volume_;     // by source IP
    std::unordered_map<std::string, Clock::time_point> last_alert_;  // "ip|type" → last fire

    std::atomic<uint64_t> alerts_raised_{0};
};

}  // namespace DPI

#endif  // DPI_THREAT_DETECTOR_H
