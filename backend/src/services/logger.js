// ============================================================================
// Logger Service — Winston + MongoDB traffic logging
// ============================================================================

const winston = require("winston");
const geoip = require("geoip-lite");
const { getDB } = require("../config/database");
const { emitEvent } = require("./socketManager");

// Resolve a destination IP to a coarse location (offline MaxMind GeoLite data).
// Returns null for private / unroutable / unknown IPs.
function geoLookup(ip) {
  if (!ip) return null;
  const g = geoip.lookup(ip);
  if (!g || !Array.isArray(g.ll)) return null;
  return { country: g.country || "", city: g.city || "", lat: g.ll[0], lng: g.ll[1] };
}

// ---------------------------------------------------------------------------
// Winston logger (console + file)
// ---------------------------------------------------------------------------
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "dpi-backend" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

// ---------------------------------------------------------------------------
// logTraffic — Insert a traffic log into MongoDB
// ---------------------------------------------------------------------------

/**
 * Store a DPI traffic log in the traffic_logs collection.
 *
 * @param {Object} params
 * @param {string} params.src_ip   - Source IP address
 * @param {string} params.dest_ip  - Destination IP address
 * @param {string} params.protocol - Protocol (HTTPS, HTTP, DNS, …)
 * @param {string} params.domain   - Domain / SNI
 * @param {string} params.application - Classified application name
 * @param {number} params.bytes    - Byte count
 * @param {number} params.packets  - Packet count
 * @param {string} params.action   - Action taken (forwarded / blocked)
 * @returns {Promise<import("mongodb").InsertOneResult>}
 */
async function logTraffic({
  src_ip,
  dest_ip,
  protocol,
  domain,
  application,
  bytes,
  packets,
  action,
}) {
  const db = getDB();

  const doc = {
    timestamp: new Date(),
    src_ip,
    dest_ip,
    protocol,
    domain,
    application,
    bytes: Number(bytes) || 0,
    packets: Number(packets) || 0,
    action,
    geo: geoLookup(dest_ip),
  };

  const result = await db.collection("traffic_logs").insertOne(doc);

  // Emit real-time WebSocket event
  emitEvent("traffic_update", { ...doc, _id: result.insertedId });

  // If the packet was blocked, also record a blocked_event
  if (action === "blocked") {
    const blockedDoc = {
      timestamp: new Date(),
      src_ip,
      domain,
      application,
      rule_type: "dpi",
      reason: `Blocked ${application || domain} traffic`,
    };
    const blockedResult = await db.collection("blocked_events").insertOne(blockedDoc);

    // Emit blocked event
    emitEvent("blocked_event", { ...blockedDoc, _id: blockedResult.insertedId });
  }

  logger.info("Traffic logged", { src_ip, dest_ip, domain, action });

  return result;
}

/**
 * Store a security alert in the security_alerts collection.
 *
 * @param {Object} params
 * @param {string} params.src_ip
 * @param {string} params.alert_type  - e.g. "anomaly", "intrusion", "policy_violation"
 * @param {string} params.severity    - "low" | "medium" | "high" | "critical"
 * @param {string} params.description
 * @returns {Promise<import("mongodb").InsertOneResult>}
 */
async function logAlert({ src_ip, alert_type, severity, description }) {
  const db = getDB();

  const doc = {
    timestamp: new Date(),
    src_ip,
    alert_type,
    severity,
    description,
  };

  const result = await db.collection("security_alerts").insertOne(doc);

  // Emit real-time WebSocket event
  emitEvent("alert_update", { ...doc, _id: result.insertedId });

  logger.warn("Security alert", { src_ip, alert_type, severity });

  return result;
}

/**
 * Upsert a flow statistics record.
 *
 * @param {Object} params
 * @param {string} params.flow_id
 * @param {string} params.src_ip
 * @param {string} params.dest_ip
 * @param {number} params.total_packets
 * @param {number} params.total_bytes
 * @param {number} params.duration - seconds
 * @returns {Promise<import("mongodb").UpdateResult>}
 */
async function upsertFlowStats({
  flow_id,
  src_ip,
  dest_ip,
  total_packets,
  total_bytes,
  duration,
}) {
  const db = getDB();

  return db.collection("flow_stats").updateOne(
    { flow_id },
    {
      $set: {
        src_ip,
        dest_ip,
        total_packets: Number(total_packets) || 0,
        total_bytes: Number(total_bytes) || 0,
        duration: Number(duration) || 0,
        timestamp: new Date(), // resets TTL clock on update
      },
    },
    { upsert: true }
  );
}

module.exports = { logger, logTraffic, logAlert, upsertFlowStats };
