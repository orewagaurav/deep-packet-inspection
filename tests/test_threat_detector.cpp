// ============================================================================
// Unit test — ThreatDetector heuristics (no network required).
// Built and run by scripts/test_local.sh.
// ============================================================================
#include "threat_detector.h"
#include <iostream>
#include <vector>
#include <string>
#include <cstdint>

using namespace DPI;

static int failures = 0;
#define CHECK(cond, msg)                                            \
  do {                                                              \
    if (!(cond)) { std::cerr << "  FAIL: " << msg << "\n"; failures++; } \
    else { std::cout << "  ok: " << msg << "\n"; }                  \
  } while (0)

// Build a minimal DNS query payload (header + one question) for a dotted name.
static std::vector<uint8_t> dnsQuery(const std::string& dotted) {
  std::vector<uint8_t> p(12, 0);
  p[5] = 1; // QDCOUNT = 1
  size_t start = 0;
  for (size_t i = 0; i <= dotted.size(); i++) {
    if (i == dotted.size() || dotted[i] == '.') {
      p.push_back(static_cast<uint8_t>(i - start));
      for (size_t k = start; k < i; k++) p.push_back(dotted[k]);
      start = i + 1;
    }
  }
  p.push_back(0);
  p.push_back(0); p.push_back(1);
  p.push_back(0); p.push_back(1);
  return p;
}

int main() {
  // DNS QNAME parsing
  {
    auto pkt = dnsQuery("www.google.com");
    auto q = ThreatDetector::extractDnsQName(pkt.data(), pkt.size());
    CHECK(q.has_value() && *q == "www.google.com", "extractDnsQName parses www.google.com");
  }
  {
    std::vector<uint8_t> bad(12, 0);
    bad.push_back(10); // claims 10-byte label but no data
    CHECK(!ThreatDetector::extractDnsQName(bad.data(), bad.size()).has_value(),
          "extractDnsQName rejects truncated label");
  }
  {
    std::vector<uint8_t> ptr(12, 0);
    ptr.push_back(0xC0); ptr.push_back(0x0C); // compression pointer
    CHECK(!ThreatDetector::extractDnsQName(ptr.data(), ptr.size()).has_value(),
          "extractDnsQName rejects compression pointer");
  }

  ThreatDetector::Thresholds th;
  th.portscan_distinct_ports = 5;
  th.exfil_bytes = 1000;
  th.dns_min_qname_len = 30;
  th.alert_cooldown_ms = 100000;

  // Port scan
  {
    ThreatDetector d(nullptr, th);
    for (uint16_t port = 1000; port < 1005; port++) d.onConnectionAttempt(0x0A0A0A0A, port);
    CHECK(d.alertsRaised() == 1, "port_scan fires at 5 distinct ports");
    for (uint16_t port = 2000; port < 2010; port++) d.onConnectionAttempt(0x0A0A0A0A, port);
    CHECK(d.alertsRaised() == 1, "port_scan deduped within cooldown");
  }
  // DNS tunneling
  {
    ThreatDetector d(nullptr, th);
    d.onDnsQuery(0x0B0B0B0B, "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0.evil.com");
    CHECK(d.alertsRaised() == 1, "dns_tunnel fires on long high-entropy qname");
    d.onDnsQuery(0x0C0C0C0C, "www.google.com");
    CHECK(d.alertsRaised() == 1, "dns_tunnel ignores a normal qname");
  }
  // Data exfil
  {
    ThreatDetector d(nullptr, th);
    d.onBytes(0x0D0D0D0D, 600);
    CHECK(d.alertsRaised() == 0, "data_exfil below threshold: no alert");
    d.onBytes(0x0D0D0D0D, 600);
    CHECK(d.alertsRaised() == 1, "data_exfil fires when window volume exceeds threshold");
  }

  std::cout << (failures ? "\nDETECTOR TESTS FAILED\n" : "\nDETECTOR TESTS PASSED\n");
  return failures ? 1 : 0;
}
