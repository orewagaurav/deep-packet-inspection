#include "threat_detector.h"
#include "log_shipper.h"

#include <iostream>
#include <sstream>
#include <cmath>
#include <cctype>

namespace DPI {

// ============================================================================
// Local helpers
// ============================================================================

// uint32_t (host-order, first octet in low byte) -> dotted string.
// Matches the ipToString() used when building traffic-log JSON so the same
// source renders identically in the traffic and alert views.
static std::string ipToString(uint32_t ip) {
    return std::to_string(ip & 0xFF) + "." +
           std::to_string((ip >> 8) & 0xFF) + "." +
           std::to_string((ip >> 16) & 0xFF) + "." +
           std::to_string((ip >> 24) & 0xFF);
}

static std::string jsonEscape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 8);
    for (char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:   out += c;
        }
    }
    return out;
}

// ============================================================================
// Constructor
// ============================================================================

ThreatDetector::ThreatDetector(LogShipper* shipper)
    : ThreatDetector(shipper, Thresholds{}) {}

ThreatDetector::ThreatDetector(LogShipper* shipper, Thresholds thresholds)
    : shipper_(shipper), th_(thresholds) {}

// ============================================================================
// Shannon entropy (bits/char) — used to flag encoded DNS labels
// ============================================================================

double ThreatDetector::shannonEntropy(const std::string& s) {
    if (s.empty()) return 0.0;
    int counts[256] = {0};
    for (unsigned char c : s) counts[c]++;
    double entropy = 0.0;
    const double n = static_cast<double>(s.size());
    for (int i = 0; i < 256; i++) {
        if (counts[i] == 0) continue;
        double p = counts[i] / n;
        entropy -= p * std::log2(p);
    }
    return entropy;
}

// ============================================================================
// DNS QNAME extraction
// ============================================================================

std::optional<std::string> ThreatDetector::extractDnsQName(const uint8_t* payload, size_t len) {
    // 12-byte DNS header, then the question's QNAME. Need at least header + a
    // root label to be a well-formed query.
    if (!payload || len < 13) return std::nullopt;

    size_t pos = 12;
    std::string name;
    int labels = 0;

    while (pos < len && labels < 64) {
        uint8_t label_len = payload[pos];
        if (label_len == 0) break;                    // end of name
        if ((label_len & 0xC0) != 0) return std::nullopt;  // compression pointer — not in a question
        pos++;
        if (pos + label_len > len) return std::nullopt;    // truncated label
        if (!name.empty()) name += '.';
        for (uint8_t k = 0; k < label_len; k++) {
            unsigned char c = payload[pos + k];
            // Keep printable ASCII (lowercased); replace the rest so encoded
            // binary still contributes length/entropy without corrupting JSON.
            name += (c > 32 && c < 127)
                        ? static_cast<char>(std::tolower(c))
                        : '?';
        }
        pos += label_len;
        labels++;
    }

    if (name.empty()) return std::nullopt;
    return name;
}

// ============================================================================
// Cooldown — assumes mutex_ held
// ============================================================================

bool ThreatDetector::cooldownElapsed(uint32_t src_ip, const std::string& type, Clock::time_point now) {
    const std::string key = std::to_string(src_ip) + "|" + type;
    auto it = last_alert_.find(key);
    if (it != last_alert_.end()) {
        auto since = std::chrono::duration_cast<std::chrono::milliseconds>(now - it->second).count();
        if (since < th_.alert_cooldown_ms) return false;
    }
    last_alert_[key] = now;
    return true;
}

// ============================================================================
// raiseAlert — assumes mutex_ held
// ============================================================================

void ThreatDetector::raiseAlert(uint32_t src_ip, const std::string& type,
                                const std::string& severity, const std::string& description) {
    const std::string ip = ipToString(src_ip);

    std::cout << "[Threat] " << type << " (" << severity << ") from " << ip
              << " — " << description << "\n";

    alerts_raised_.fetch_add(1, std::memory_order_relaxed);

    if (shipper_) {
        std::ostringstream js;
        js << "{\"src_ip\":\"" << jsonEscape(ip)
           << "\",\"alert_type\":\"" << jsonEscape(type)
           << "\",\"severity\":\"" << jsonEscape(severity)
           << "\",\"description\":\"" << jsonEscape(description)
           << "\"}";
        shipper_->enqueueAlert(js.str());
    }
}

// ============================================================================
// Port-scan detection
// ============================================================================

void ThreatDetector::onConnectionAttempt(uint32_t src_ip, uint16_t dst_port) {
    const auto now = Clock::now();
    std::lock_guard<std::mutex> lock(mutex_);

    PortScanState& st = portscan_[src_ip];
    if (st.ports.empty()) {
        st.window_start = now;
    } else {
        auto age = std::chrono::duration_cast<std::chrono::milliseconds>(now - st.window_start).count();
        if (age > th_.portscan_window_ms) {
            st.ports.clear();
            st.window_start = now;
        }
    }

    st.ports.insert(dst_port);

    if (static_cast<int>(st.ports.size()) >= th_.portscan_distinct_ports &&
        cooldownElapsed(src_ip, "port_scan", now)) {
        std::ostringstream desc;
        desc << st.ports.size() << " distinct ports probed within "
             << (th_.portscan_window_ms / 1000) << "s";
        raiseAlert(src_ip, "port_scan", "high", desc.str());
        // Reset the window so the next alert requires a fresh burst.
        st.ports.clear();
        st.window_start = now;
    }
}

// ============================================================================
// DNS-tunneling detection
// ============================================================================

void ThreatDetector::onDnsQuery(uint32_t src_ip, const std::string& qname) {
    if (qname.size() < th_.dns_min_qname_len) return;
    if (shannonEntropy(qname) < th_.dns_min_entropy) return;

    const auto now = Clock::now();
    std::lock_guard<std::mutex> lock(mutex_);
    if (!cooldownElapsed(src_ip, "dns_tunnel", now)) return;

    // Truncate the sample so a huge QNAME can't bloat the alert payload.
    std::string sample = qname.size() > 80 ? qname.substr(0, 80) + "…" : qname;
    std::ostringstream desc;
    desc << "Long high-entropy DNS query (" << qname.size() << " chars): " << sample;
    raiseAlert(src_ip, "dns_tunnel", "medium", desc.str());
}

// ============================================================================
// Data-exfil detection
// ============================================================================

void ThreatDetector::onBytes(uint32_t src_ip, uint64_t bytes) {
    const auto now = Clock::now();
    std::lock_guard<std::mutex> lock(mutex_);

    VolumeState& st = volume_[src_ip];
    if (st.bytes == 0) {
        st.window_start = now;
    } else {
        auto age = std::chrono::duration_cast<std::chrono::milliseconds>(now - st.window_start).count();
        if (age > th_.exfil_window_ms) {
            st.bytes = 0;
            st.window_start = now;
        }
    }

    st.bytes += bytes;

    if (st.bytes >= th_.exfil_bytes && cooldownElapsed(src_ip, "data_exfil", now)) {
        std::ostringstream desc;
        desc << (st.bytes / (1024 * 1024)) << " MB transferred within "
             << (th_.exfil_window_ms / 1000) << "s";
        raiseAlert(src_ip, "data_exfil", "high", desc.str());
        st.bytes = 0;
        st.window_start = now;
    }
}

}  // namespace DPI
