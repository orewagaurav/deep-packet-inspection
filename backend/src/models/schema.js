// ============================================================================
// MongoDB Schema Initialization — Indexes & TTL
// ============================================================================
// Creates collections with validation, indexes, and TTL policies.
// ============================================================================

const { getDB } = require("../config/database");

/**
 * Initialize all collections, indexes, and TTL policies.
 * Safe to call multiple times (createIndex is idempotent).
 */
async function initializeCollections() {
  const db = getDB();

  // --------------------------------------------------------------------------
  // 1. traffic_logs
  //    TTL: 7 days
  // --------------------------------------------------------------------------
  const trafficLogs = db.collection("traffic_logs");
  await trafficLogs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 3600, name: "ttl_7days" });
  await trafficLogs.createIndex({ src_ip: 1, timestamp: -1 }, { name: "idx_src_ip_ts" });
  await trafficLogs.createIndex({ dest_ip: 1 }, { name: "idx_dest_ip" });
  await trafficLogs.createIndex({ domain: 1, timestamp: -1 }, { name: "idx_domain_ts" });
  await trafficLogs.createIndex({ application: 1 }, { name: "idx_application" });
  await trafficLogs.createIndex({ action: 1, timestamp: -1 }, { name: "idx_action_ts" });
  await trafficLogs.createIndex({ protocol: 1 }, { name: "idx_protocol" });

  // --------------------------------------------------------------------------
  // 2. flow_stats
  //    TTL: 7 days
  // --------------------------------------------------------------------------
  const flowStats = db.collection("flow_stats");
  await flowStats.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 3600, name: "ttl_7days" });
  await flowStats.createIndex({ flow_id: 1 }, { unique: true, name: "idx_flow_id" });
  await flowStats.createIndex({ src_ip: 1 }, { name: "idx_src_ip" });
  await flowStats.createIndex({ dest_ip: 1 }, { name: "idx_dest_ip" });

  // --------------------------------------------------------------------------
  // 3. blocked_events
  //    No TTL specified — retained until explicit cleanup
  // --------------------------------------------------------------------------
  const blockedEvents = db.collection("blocked_events");
  await blockedEvents.createIndex({ timestamp: -1 }, { name: "idx_timestamp" });
  await blockedEvents.createIndex({ src_ip: 1, timestamp: -1 }, { name: "idx_src_ip_ts" });
  await blockedEvents.createIndex({ domain: 1 }, { name: "idx_domain" });
  await blockedEvents.createIndex({ application: 1 }, { name: "idx_application" });
  await blockedEvents.createIndex({ rule_type: 1 }, { name: "idx_rule_type" });

  // --------------------------------------------------------------------------
  // 4. security_alerts
  //    TTL: 30 days
  // --------------------------------------------------------------------------
  const securityAlerts = db.collection("security_alerts");
  await securityAlerts.createIndex({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 3600, name: "ttl_30days" });
  await securityAlerts.createIndex({ src_ip: 1, timestamp: -1 }, { name: "idx_src_ip_ts" });
  await securityAlerts.createIndex({ alert_type: 1 }, { name: "idx_alert_type" });
  await securityAlerts.createIndex({ severity: 1 }, { name: "idx_severity" });

  console.log("[Schema] All collections and indexes initialized");
}

module.exports = { initializeCollections };
