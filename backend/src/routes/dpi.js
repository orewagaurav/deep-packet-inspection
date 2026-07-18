// ============================================================================
// Core DPI Routes — POST /logs, POST /alerts, GET /traffic, GET /blocked, GET /stats
// ============================================================================

const { Router } = require("express");
const { getDB } = require("../config/database");
const { logTraffic, logAlert, upsertFlowStats } = require("../services/logger");

const router = Router();

// --------------------------------------------------------------------------
// POST /logs — Receive traffic logs from DPI engine
// --------------------------------------------------------------------------
router.post("/logs", async (req, res, next) => {
  try {
    const { src_ip, dest_ip, protocol, domain, application, bytes, packets, action } = req.body;

    if (!src_ip || !dest_ip) {
      return res.status(400).json({ error: "src_ip and dest_ip are required" });
    }

    const result = await logTraffic({
      src_ip,
      dest_ip,
      protocol: protocol || "UNKNOWN",
      domain: domain || "",
      application: application || "Unknown",
      bytes: bytes || 0,
      packets: packets || 1,
      action: action || "forwarded",
    });

    res.status(201).json({ success: true, id: result.insertedId });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// POST /alerts — Receive security alerts
// --------------------------------------------------------------------------
router.post("/alerts", async (req, res, next) => {
  try {
    const { src_ip, alert_type, severity, description } = req.body;

    if (!src_ip || !alert_type) {
      return res.status(400).json({ error: "src_ip and alert_type are required" });
    }

    const result = await logAlert({
      src_ip,
      alert_type,
      severity: severity || "medium",
      description: description || "",
    });

    res.status(201).json({ success: true, id: result.insertedId });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// GET /traffic — Query traffic logs (with optional filters)
// --------------------------------------------------------------------------
router.get("/traffic", async (req, res, next) => {
  try {
    const db = getDB();
    const { src_ip, dest_ip, domain, application, action, limit = 100, page = 1 } = req.query;

    const filter = {};
    if (src_ip) filter.src_ip = src_ip;
    if (dest_ip) filter.dest_ip = dest_ip;
    if (domain) filter.domain = { $regex: domain, $options: "i" };
    if (application) filter.application = { $regex: application, $options: "i" };
    if (action) filter.action = action;

    const pageSize = Math.min(Number(limit) || 100, 1000);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * pageSize;

    const [docs, total] = await Promise.all([
      db
        .collection("traffic_logs")
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(pageSize)
        .toArray(),
      db.collection("traffic_logs").countDocuments(filter),
    ]);

    res.json({ total, page: Number(page) || 1, limit: pageSize, data: docs });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// GET /blocked — Query blocked events
// --------------------------------------------------------------------------
router.get("/blocked", async (req, res, next) => {
  try {
    const db = getDB();
    const { src_ip, domain, application, limit = 100, page = 1 } = req.query;

    const filter = {};
    if (src_ip) filter.src_ip = src_ip;
    if (domain) filter.domain = { $regex: domain, $options: "i" };
    if (application) filter.application = { $regex: application, $options: "i" };

    const pageSize = Math.min(Number(limit) || 100, 1000);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * pageSize;

    const [docs, total] = await Promise.all([
      db
        .collection("blocked_events")
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(pageSize)
        .toArray(),
      db.collection("blocked_events").countDocuments(filter),
    ]);

    res.json({ total, page: Number(page) || 1, limit: pageSize, data: docs });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// GET /stats — Summary statistics
// --------------------------------------------------------------------------
router.get("/stats", async (req, res, next) => {
  try {
    const db = getDB();

    const [totalPackets, totalBytes, blockedCount, alertsCount, topDomains, topApps] =
      await Promise.all([
        // Total packets
        db.collection("traffic_logs").aggregate([
          { $group: { _id: null, total: { $sum: "$packets" } } },
        ]).toArray(),

        // Total bytes
        db.collection("traffic_logs").aggregate([
          { $group: { _id: null, total: { $sum: "$bytes" } } },
        ]).toArray(),

        // Blocked count
        db.collection("blocked_events").countDocuments(),

        // Security alerts count
        db.collection("security_alerts").countDocuments(),

        // Top 10 domains
        db.collection("traffic_logs").aggregate([
          { $match: { domain: { $ne: "" } } },
          { $group: { _id: "$domain", count: { $sum: 1 }, bytes: { $sum: "$bytes" } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]).toArray(),

        // Top 10 applications
        db.collection("traffic_logs").aggregate([
          { $group: { _id: "$application", count: { $sum: 1 }, bytes: { $sum: "$bytes" } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]).toArray(),
      ]);

    res.json({
      total_packets: totalPackets[0]?.total || 0,
      total_bytes: totalBytes[0]?.total || 0,
      blocked_traffic_count: blockedCount,
      security_alerts_count: alertsCount,
      top_domains: topDomains.map((d) => ({ domain: d._id, count: d.count, bytes: d.bytes })),
      top_applications: topApps.map((a) => ({ application: a._id, count: a.count, bytes: a.bytes })),
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// POST /flows — Upsert flow statistics
// --------------------------------------------------------------------------
router.post("/flows", async (req, res, next) => {
  try {
    const { flow_id, src_ip, dest_ip, total_packets, total_bytes, duration } = req.body;

    if (!flow_id) {
      return res.status(400).json({ error: "flow_id is required" });
    }

    await upsertFlowStats({ flow_id, src_ip, dest_ip, total_packets, total_bytes, duration });

    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
