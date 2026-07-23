// ============================================================================
// Integration test — RuleSync fetches the backend's /rules/active feed once
// and prints what it parsed. Built and run by scripts/test_local.sh.
//
// Usage: test_rule_sync <backend_url>
// Prints one "RULE <type> <value>" line per applied rule, then "SYNCS <n>".
// ============================================================================
#include "rule_sync.h"
#include <curl/curl.h>
#include <iostream>
#include <thread>
#include <chrono>
#include <string>

using namespace DPI;

int main(int argc, char** argv) {
  const std::string url = argc > 1 ? argv[1] : "http://localhost:8000";

  curl_global_init(CURL_GLOBAL_DEFAULT);
  RuleSync rs(
      url,
      [](const std::vector<std::string>& ips,
         const std::vector<std::string>& apps,
         const std::vector<std::string>& domains) {
        for (auto& v : ips) std::cout << "RULE ip " << v << "\n";
        for (auto& v : apps) std::cout << "RULE app " << v << "\n";
        for (auto& v : domains) std::cout << "RULE domain " << v << "\n";
      },
      500);
  rs.start();
  std::this_thread::sleep_for(std::chrono::milliseconds(1800));
  rs.stop();
  std::cout << "SYNCS " << rs.syncCount() << "\n";
  curl_global_cleanup();
  return 0;
}
