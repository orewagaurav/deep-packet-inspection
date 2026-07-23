// ============================================================================
// One-off maintenance: remove legacy FAKE security alerts
// ============================================================================
// Before real detection existed, simulate_traffic.js posted random fake alerts
// (anomaly / brute_force / policy_violation / intrusion_attempt). Those are now
// obsolete — real alerts come from the C++ engine's ThreatDetector.
//
// This deletes every security_alert older than the cutoff (default: today),
// which is exactly the set of pre-detection fake rows. Real detector alerts are
// all timestamped from the day you first ran the live engine onward.
//
// Usage:
//   node scripts/clean_fake_alerts.js            # delete alerts before today (UTC)
//   node scripts/clean_fake_alerts.js 2026-07-23 # delete alerts before a given date
//   DRY_RUN=1 node scripts/clean_fake_alerts.js  # count only, delete nothing
// ============================================================================

require("dotenv").config();
const { MongoClient } = require("mongodb");

(async () => {
  const cutoff = new Date(process.argv[2] || new Date().toISOString().slice(0, 10));
  if (Number.isNaN(cutoff.getTime())) {
    console.error("Invalid date. Use YYYY-MM-DD.");
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const col = client.db(process.env.DB_NAME || "dpi_logs").collection("security_alerts");

  const query = { timestamp: { $lt: cutoff } };
  const matched = await col.countDocuments(query);
  const total = await col.countDocuments();
  console.log(`Total alerts: ${total} | matching (< ${cutoff.toISOString()}): ${matched}`);

  if (process.env.DRY_RUN) {
    console.log("DRY_RUN set — nothing deleted.");
  } else {
    const res = await col.deleteMany(query);
    console.log(`Deleted ${res.deletedCount}. Remaining: ${await col.countDocuments()}`);
  }

  await client.close();
})().catch((err) => {
  console.error("Cleanup failed:", err.message);
  process.exit(1);
});
