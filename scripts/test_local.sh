#!/usr/bin/env bash
# ============================================================================
# DPI platform — local self-test
# ----------------------------------------------------------------------------
# Exercises every feature that does not require root: the C++ engine (file mode
# + rule-based blocking), the ThreatDetector heuristics, and the full backend
# API (alerts, analytics, and the block-rule control plane incl. live RuleSync
# hot-reload). Live packet capture needs `sudo` and is printed as instructions
# at the end.
#
# Usage:
#   ./scripts/test_local.sh                       # backend at http://localhost:8000
#   BACKEND_URL=http://host:8000 ./scripts/test_local.sh
#   IFACE=en0 ./scripts/test_local.sh             # interface used in the printed hints
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
IFACE="${IFACE:-en0}"
ENGINE="$ROOT/build/dpi_engine"
PCAP="$ROOT/test_dpi.pcap"
TMP="$(mktemp -d)"

# ---- colours ----
if [ -t 1 ]; then
  G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; B=$'\033[36m'; DIM=$'\033[2m'; N=$'\033[0m'
else G=""; R=""; Y=""; B=""; DIM=""; N=""; fi

PASS=0; FAIL=0; SKIP=0
CREATED_RULES=()

pass() { echo "  ${G}✓${N} $1"; PASS=$((PASS+1)); }
fail() { echo "  ${R}✗${N} $1"; FAIL=$((FAIL+1)); }
skip() { echo "  ${Y}‣${N} ${DIM}skip:${N} $1"; SKIP=$((SKIP+1)); }
section() { echo; echo "${B}== $1 ==${N}"; }

cleanup() {
  for id in "${CREATED_RULES[@]:-}"; do
    [ -n "$id" ] && curl -s -X DELETE "$BACKEND_URL/rules/$id" >/dev/null 2>&1
  done
  rm -rf "$TMP" 2>/dev/null
}
trap cleanup EXIT

# JSON field helper: `echo "$body" | jfield 'd.total'`
jfield() { node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{const d=JSON.parse(s);process.stdout.write(String(eval(process.argv[1])))}catch(e){process.stdout.write("")}})' "$1"; }
http_code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "${B}DPI local self-test${N}"
echo "${DIM}root: $ROOT${N}"
echo "${DIM}backend: $BACKEND_URL${N}"

# ---------------------------------------------------------------------------
section "Preflight"
for tool in node curl g++ cmake; do
  if command -v "$tool" >/dev/null 2>&1; then pass "$tool present"; else fail "$tool missing"; fi
done

if [ ! -x "$ENGINE" ]; then
  echo "  ${DIM}engine not built — building…${N}"
  cmake -B "$ROOT/build" >/dev/null 2>&1
  cmake --build "$ROOT/build" --target dpi_engine >/dev/null 2>&1
fi
[ -x "$ENGINE" ] && pass "dpi_engine built" || { fail "dpi_engine build failed"; }
[ -f "$PCAP" ] && pass "sample pcap present" || fail "test_dpi.pcap missing"

# ---------------------------------------------------------------------------
section "C++ engine — file mode"
if [ -x "$ENGINE" ] && [ -f "$PCAP" ]; then
  base=$("$ENGINE" "$PCAP" "$TMP/out_a.pcap" 2>/dev/null | grep -Eo 'Dropped:[[:space:]]*[0-9]+' | grep -Eo '[0-9]+')
  [ "${base:-x}" = "0" ] && pass "clean run drops 0 packets" || fail "clean run Dropped=${base:-?} (expected 0)"

  blk=$("$ENGINE" "$PCAP" "$TMP/out_b.pcap" --block-app "Twitter/X" --block-domain youtube.com --block-domain facebook.com 2>/dev/null | grep -Eo 'Dropped:[[:space:]]*[0-9]+' | grep -Eo '[0-9]+')
  [ "${blk:-0}" -gt 0 ] 2>/dev/null && pass "block rules drop matching packets (Dropped=$blk)" || fail "blocking dropped nothing"

  if [ -f "$TMP/out_b.pcap" ] && [ -f "$TMP/out_a.pcap" ]; then
    sa=$(wc -c < "$TMP/out_a.pcap"); sb=$(wc -c < "$TMP/out_b.pcap")
    [ "$sb" -lt "$sa" ] && pass "filtered output pcap is smaller ($sb < $sa bytes)" || fail "filtered pcap not smaller"
  fi
else
  skip "engine/pcap unavailable"
fi

# ---------------------------------------------------------------------------
section "C++ ThreatDetector — unit test"
if g++ -std=c++17 -pthread -I"$ROOT/include" \
      "$ROOT/tests/test_threat_detector.cpp" "$ROOT/src/threat_detector.cpp" "$ROOT/src/log_shipper.cpp" \
      -lcurl -o "$TMP/test_detector" 2>"$TMP/cc1.log"; then
  if "$TMP/test_detector" > "$TMP/det.log" 2>&1; then
    pass "detector unit test ($(grep -c '  ok:' "$TMP/det.log") assertions passed)"
  else
    fail "detector unit test failed"; sed 's/^/    /' "$TMP/det.log"
  fi
else
  fail "detector test failed to compile"; sed 's/^/    /' "$TMP/cc1.log"
fi

# ---------------------------------------------------------------------------
section "Backend API"
if [ "$(http_code "$BACKEND_URL/health")" = "200" ]; then
  pass "backend reachable"

  # health / stats
  [ "$(curl -s "$BACKEND_URL/health" | jfield 'd.status')" = "ok" ] && pass "GET /health -> ok" || fail "GET /health"
  tp=$(curl -s "$BACKEND_URL/stats" | jfield 'typeof d.total_packets')
  [ "$tp" = "number" ] && pass "GET /stats returns totals" || fail "GET /stats"

  # alerts (read paths — the endpoint that was previously missing)
  shape=$(curl -s "$BACKEND_URL/alerts?limit=1" | jfield '["total","page","limit","data"].every(k=>k in d)')
  [ "$shape" = "true" ] && pass "GET /alerts paginated shape" || fail "GET /alerts shape"
  fcode=$(http_code "$BACKEND_URL/alerts?severity=high")
  [ "$fcode" = "200" ] && pass "GET /alerts?severity=high (filter)" || fail "alerts filter ($fcode)"

  # traffic ingest + query
  for i in 1 2 3; do
    curl -s -X POST "$BACKEND_URL/logs" -H 'Content-Type: application/json' \
      -d "{\"src_ip\":\"198.51.100.$i\",\"dest_ip\":\"93.184.216.34\",\"domain\":\"selftest.example\",\"application\":\"SelfTest\",\"protocol\":\"HTTPS\",\"bytes\":1200,\"packets\":3,\"action\":\"forwarded\"}" >/dev/null
  done
  ttotal=$(curl -s "$BACKEND_URL/traffic?limit=1" | jfield 'd.total')
  [ "${ttotal:-0}" -gt 0 ] 2>/dev/null && pass "POST /logs + GET /traffic (total=$ttotal)" || fail "traffic ingest/query"
  acode=$(http_code "$BACKEND_URL/analytics/top-domains?hours=24")
  [ "$acode" = "200" ] && pass "GET /analytics/top-domains" || fail "analytics ($acode)"

  # ---- block rules CRUD + control plane ----
  RID=$(curl -s -X POST "$BACKEND_URL/rules" -H 'Content-Type: application/json' \
        -d '{"type":"domain","value":"selftest-block.example","note":"self-test"}' | jfield 'd.rule._id')
  if [ -n "$RID" ] && [ "$RID" != "undefined" ]; then
    CREATED_RULES+=("$RID"); pass "POST /rules creates rule"
  else fail "POST /rules"; fi

  curl -s "$BACKEND_URL/rules/active" | grep -q "domain selftest-block.example" \
    && pass "/rules/active includes new rule" || fail "/rules/active missing new rule"

  dupc=$(http_code -X POST "$BACKEND_URL/rules" -H 'Content-Type: application/json' -d '{"type":"domain","value":"selftest-block.example"}')
  [ "$dupc" = "409" ] && pass "duplicate rule -> 409" || fail "duplicate rule ($dupc)"

  badc=$(http_code -X POST "$BACKEND_URL/rules" -H 'Content-Type: application/json' -d '{"type":"bogus","value":"x"}')
  [ "$badc" = "400" ] && pass "invalid type -> 400" || fail "invalid type ($badc)"

  # engine-facing RuleSync: does the real C++ poller fetch & parse this rule?
  if g++ -std=c++17 -pthread -I"$ROOT/include" \
        "$ROOT/tests/test_rule_sync.cpp" "$ROOT/src/rule_sync.cpp" -lcurl -o "$TMP/test_rulesync" 2>"$TMP/cc2.log"; then
    out=$("$TMP/test_rulesync" "$BACKEND_URL" 2>/dev/null)
    echo "$out" | grep -q "RULE domain selftest-block.example" \
      && pass "RuleSync (engine) polled & parsed the new rule" || fail "RuleSync did not pick up rule"
  else
    fail "RuleSync harness failed to compile"; sed 's/^/    /' "$TMP/cc2.log"
  fi

  # toggle off -> excluded from the engine feed
  if [ -n "$RID" ] && [ "$RID" != "undefined" ]; then
    curl -s -X PATCH "$BACKEND_URL/rules/$RID" -H 'Content-Type: application/json' -d '{"enabled":false}' >/dev/null
    curl -s "$BACKEND_URL/rules/active" | grep -q "selftest-block.example" \
      && fail "disabled rule still in /active" || pass "PATCH disable removes rule from /active"

    dcode=$(http_code -X DELETE "$BACKEND_URL/rules/$RID")
    if [ "$dcode" = "200" ]; then pass "DELETE /rules/:id"; CREATED_RULES=(); else fail "DELETE /rules ($dcode)"; fi
  fi
else
  skip "backend not reachable at $BACKEND_URL — start it: (cd backend && npm start)"
  skip "then re-run this script to cover the API + RuleSync tests"
fi

# ---------------------------------------------------------------------------
section "Live packet capture (manual — needs sudo)"
cat <<EOF
  ${DIM}Live capture can't be automated (raw sockets need root). To try it:${N}

    ${ROOT}/build/dpi_engine --list-interfaces
    sudo ${ROOT}/build/dpi_engine --interface ${IFACE} --backend-url ${BACKEND_URL}

  ${DIM}Then browse the web and watch the dashboard populate. To see blocking,${N}
  ${DIM}add a rule on the Block Rules page (takes effect within 5s). For alerts:${N}
    nmap -p 1-1000 scanme.nmap.org      ${DIM}# -> port_scan alert${N}
EOF

# ---------------------------------------------------------------------------
section "Summary"
echo "  ${G}pass: $PASS${N}   ${R}fail: $FAIL${N}   ${Y}skip: $SKIP${N}"
[ "$FAIL" -eq 0 ] && echo "  ${G}All automated checks passed.${N}" || echo "  ${R}Some checks failed.${N}"
exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)
