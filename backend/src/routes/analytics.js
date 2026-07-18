// ============================================================================
// Analytics Routes — Dashboard-facing aggregation endpoints
// ============================================================================
// GET /analytics/top-domains
// GET /analytics/top-applications
// GET /analytics/traffic-volume
// GET /analytics/blocked-events
// ============================================================================

const { Router } = require("express");
const { getDB } = require("../config/database");

const router = Router();

// --------------------------------------------------------------------------
// GET /analytics/top-domains
// Returns top domains by request count and byte volume.
// Query params: limit (default 10), hours (time window, default 24)
// --------------------------------------------------------------------------
router.get("/top-domains", async (req, res, next) => {
  try {
    const db = getDB();
    const limit = Math.min(Number(req.query.limit) || 10, 100);
    const hours = Number(req.query.hours) || 24;
    const since = new Date(Date.now() - hours * 3600 * 1000);

    const results = await db
      .collection("traffic_logs")
      .aggregate([
        { $match: { timestamp: { $gte: since }, domain: { $ne: "" } } },
        {
          $group: {
            _id: "$domain",
            request_count: { $sum: 1 },
            total_bytes: { $sum: "$bytes" },
            total_packets: { $sum: "$packets" },
            unique_sources: { $addToSet: "$src_ip" },
          },
        },
        {
          $project: {
            domain: "$_id",
            request_count: 1,
            total_bytes: 1,
            total_packets: 1,
            unique_sources: { $size: "$unique_sources" },
            _id: 0,
          },
        },
        { $sort: { request_count: -1 } },
        { $limit: limit },
      ])
      .toArray();

    res.json({ time_window_hours: hours, data: results });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// GET /analytics/top-applications
// Returns top classified applications by traffic volume.
// --------------------------------------------------------------------------
router.get("/top-applications", async (req, res, next) => {
  try {
    const db = getDB();
    const limit = Math.min(Number(req.query.limit) || 10, 100);
    const hours = Number(req.query.hours) || 24;
    const since = new Date(Date.now() - hours * 3600 * 1000);

    const results = await db
      .collection("traffic_logs")
      .aggregate([
        { $match: { timestamp: { $gte: since } } },
        {
          $group: {
            _id: "$application",
            request_count: { $sum: 1 },
            total_bytes: { $sum: "$bytes" },
            total_packets: { $sum: "$packets" },
            blocked_count: {
              $sum: { $cond: [{ $eq: ["$action", "blocked"] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            application: "$_id",
            request_count: 1,
            total_bytes: 1,
            total_packets: 1,
            blocked_count: 1,
            _id: 0,
          },
        },
        { $sort: { total_bytes: -1 } },
        { $limit: limit },
      ])
      .toArray();

    res.json({ time_window_hours: hours, data: results });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// GET /analytics/traffic-volume
// Returns time-series traffic volume bucketed by interval.
// Query params: hours (default 24), interval (minutes, default 60)
// --------------------------------------------------------------------------
router.get("/traffic-volume", async (req, res, next) => {
  try {
    const db = getDB();
    const hours = Number(req.query.hours) || 24;
    const intervalMin = Number(req.query.interval) || 60;
    const since = new Date(Date.now() - hours * 3600 * 1000);

    const results = await db
      .collection("traffic_logs")
      .aggregate([
        { $match: { timestamp: { $gte: since } } },
        {
          $group: {
            _id: {
              $toDate: {
                $subtract: [
                  { $toLong: "$timestamp" },
                  { $mod: [{ $toLong: "$timestamp" }, intervalMin * 60 * 1000] },
                ],
              },
            },
            total_bytes: { $sum: "$bytes" },
            total_packets: { $sum: "$packets" },
            request_count: { $sum: 1 },
            blocked_count: {
              $sum: { $cond: [{ $eq: ["$action", "blocked"] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            timestamp: "$_id",
            total_bytes: 1,
            total_packets: 1,
            request_count: 1,
            blocked_count: 1,
            _id: 0,
          },
        },
        { $sort: { timestamp: 1 } },
      ])
      .toArray();

    res.json({
      time_window_hours: hours,
      interval_minutes: intervalMin,
      data: results,
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// GET /analytics/blocked-events
// Returns blocked-event breakdown by domain, application, and rule type.
// --------------------------------------------------------------------------
router.get("/blocked-events", async (req, res, next) => {
  try {
    const db = getDB();
    const hours = Number(req.query.hours) || 24;
    const since = new Date(Date.now() - hours * 3600 * 1000);

    const [byDomain, byApp, byRule, timeline] = await Promise.all([
      // Top blocked domains
      db
        .collection("blocked_events")
        .aggregate([
          { $match: { timestamp: { $gte: since } } },
          { $group: { _id: "$domain", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
          { $project: { domain: "$_id", count: 1, _id: 0 } },
        ])
        .toArray(),

      // Top blocked applications
      db
        .collection("blocked_events")
        .aggregate([
          { $match: { timestamp: { $gte: since } } },
          { $group: { _id: "$application", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
          { $project: { application: "$_id", count: 1, _id: 0 } },
        ])
        .toArray(),

      // By rule type
      db
        .collection("blocked_events")
        .aggregate([
          { $match: { timestamp: { $gte: since } } },
          { $group: { _id: "$rule_type", count: { $sum: 1 } } },
          { $project: { rule_type: "$_id", count: 1, _id: 0 } },
        ])
        .toArray(),

      // Blocked events timeline (hourly)
      db
        .collection("blocked_events")
        .aggregate([
          { $match: { timestamp: { $gte: since } } },
          {
            $group: {
              _id: {
                $toDate: {
                  $subtract: [
                    { $toLong: "$timestamp" },
                    { $mod: [{ $toLong: "$timestamp" }, 3600000] },
                  ],
                },
              },
              count: { $sum: 1 },
            },
          },
          { $project: { timestamp: "$_id", count: 1, _id: 0 } },
          { $sort: { timestamp: 1 } },
        ])
        .toArray(),
    ]);

    res.json({
      time_window_hours: hours,
      by_domain: byDomain,
      by_application: byApp,
      by_rule_type: byRule,
      timeline,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
