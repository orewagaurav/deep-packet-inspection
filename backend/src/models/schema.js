// ============================================================================
// MongoDB Schema Initialization — Indexes & TTL
// ============================================================================
// Creates collections with validation, indexes, and TTL policies.
// All time-series collections share a single 30-day retention window.
// ============================================================================

const { getDB } = require("../config/database");

// Unified retention for every time-series collection.
const TTL_SECONDS = 30 * 24 * 3600; // 30 days

/**
 * Ensure a collection's single-field `timestamp` index expires after
 * `seconds`. Migration-safe and idempotent:
 *   - no timestamp index yet         → create one with the TTL
 *   - a timestamp index already exists with a different TTL, or none at all
 *     (e.g. blocked_events' plain idx_timestamp) → change it IN PLACE via
 *     collMod (no drop, no data loss). MongoDB 5.0+ can convert a non-TTL
 *     single-field index into a TTL index this way.
 *
 * Re-running createIndex with a new expireAfterSeconds would throw
 * IndexOptionsConflict, which is why this reconciliation is needed.
 */
async function ensureTtlIndex(db, collName, seconds, name) {
  const coll = db.collection(collName);
  const indexes = await coll.indexes();
  const existing = indexes.find(
    (ix) => ix.key && Object.keys(ix.key).length === 1 && ix.key.timestamp !== undefined
  );

  if (!existing) {
    await coll.createIndex({ timestamp: 1 }, { expireAfterSeconds: seconds, name });
    return;
  }
  if (existing.expireAfterSeconds !== seconds) {
    await db.command({
      collMod: collName,
      index: { name: existing.name, expireAfterSeconds: seconds },
    });
  }
}

/**
 * Initialize all collections, indexes, and TTL policies.
 * Safe to call multiple times (idempotent).
 */
async function initializeCollections() {
  const db = getDB();

  // --------------------------------------------------------------------------
  // 1. traffic_logs — TTL: 30 days
  // --------------------------------------------------------------------------
  const trafficLogs = db.collection("traffic_logs");
  await ensureTtlIndex(db, "traffic_logs", TTL_SECONDS, "ttl_30days");
  await trafficLogs.createIndex({ src_ip: 1, timestamp: -1 }, { name: "idx_src_ip_ts" });
  await trafficLogs.createIndex({ dest_ip: 1 }, { name: "idx_dest_ip" });
  await trafficLogs.createIndex({ domain: 1, timestamp: -1 }, { name: "idx_domain_ts" });
  await trafficLogs.createIndex({ application: 1 }, { name: "idx_application" });
  await trafficLogs.createIndex({ action: 1, timestamp: -1 }, { name: "idx_action_ts" });
  await trafficLogs.createIndex({ protocol: 1 }, { name: "idx_protocol" });

  // --------------------------------------------------------------------------
  // 2. flow_stats — TTL: 30 days (clock resets on each upsert)
  // --------------------------------------------------------------------------
  const flowStats = db.collection("flow_stats");
  await ensureTtlIndex(db, "flow_stats", TTL_SECONDS, "ttl_30days");
  await flowStats.createIndex({ flow_id: 1 }, { unique: true, name: "idx_flow_id" });
  await flowStats.createIndex({ src_ip: 1 }, { name: "idx_src_ip" });
  await flowStats.createIndex({ dest_ip: 1 }, { name: "idx_dest_ip" });

  // --------------------------------------------------------------------------
  // 3. blocked_events — TTL: 30 days
  //    The single-field timestamp index doubles as the TTL index and the
  //    sort index used by GET /blocked (single-field indexes are bidirectional).
  // --------------------------------------------------------------------------
  const blockedEvents = db.collection("blocked_events");
  await ensureTtlIndex(db, "blocked_events", TTL_SECONDS, "ttl_30days");
  await blockedEvents.createIndex({ src_ip: 1, timestamp: -1 }, { name: "idx_src_ip_ts" });
  await blockedEvents.createIndex({ domain: 1 }, { name: "idx_domain" });
  await blockedEvents.createIndex({ application: 1 }, { name: "idx_application" });
  await blockedEvents.createIndex({ rule_type: 1 }, { name: "idx_rule_type" });

  // --------------------------------------------------------------------------
  // 4. security_alerts — TTL: 30 days
  // --------------------------------------------------------------------------
  const securityAlerts = db.collection("security_alerts");
  await ensureTtlIndex(db, "security_alerts", TTL_SECONDS, "ttl_30days");
  await securityAlerts.createIndex({ src_ip: 1, timestamp: -1 }, { name: "idx_src_ip_ts" });
  await securityAlerts.createIndex({ alert_type: 1 }, { name: "idx_alert_type" });
  await securityAlerts.createIndex({ severity: 1 }, { name: "idx_severity" });

  // --------------------------------------------------------------------------
  // 5. rules — control-plane blocklist (no TTL; managed via the dashboard)
  //    Unique on (type, value) so the same rule can't be added twice.
  // --------------------------------------------------------------------------
  const rules = db.collection("rules");
  await rules.createIndex({ type: 1, value: 1 }, { unique: true, name: "idx_type_value" });
  await rules.createIndex({ enabled: 1 }, { name: "idx_enabled" });

  console.log("[Schema] All collections and indexes initialized (TTL: 30 days)");
}

module.exports = { initializeCollections };
