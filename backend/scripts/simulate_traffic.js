// ============================================================================
// Traffic Simulator — Generate realistic demo traffic data
// ============================================================================
// Usage:
//   node scripts/simulate_traffic.js              → Generate 50 logs
//   node scripts/simulate_traffic.js --count 200  → Generate 200 logs
//   node scripts/simulate_traffic.js --live       → Continuous mode (1-3/sec)
//   node scripts/simulate_traffic.js --live --url http://localhost:3000
// ============================================================================

require("dotenv").config();
const axios = require("axios");

// ---------------------------------------------------------------------------
// Realistic traffic data pools
// ---------------------------------------------------------------------------

const DOMAINS = [
  { domain: "www.youtube.com", app: "YouTube" },
  { domain: "www.google.com", app: "Google" },
  { domain: "www.facebook.com", app: "Facebook" },
  { domain: "www.instagram.com", app: "Instagram" },
  { domain: "twitter.com", app: "Twitter/X" },
  { domain: "github.com", app: "GitHub" },
  { domain: "discord.com", app: "Discord" },
  { domain: "open.spotify.com", app: "Spotify" },
  { domain: "www.netflix.com", app: "Netflix" },
  { domain: "www.amazon.com", app: "Amazon" },
  { domain: "web.telegram.org", app: "Telegram" },
  { domain: "zoom.us", app: "Zoom" },
  { domain: "www.tiktok.com", app: "TikTok" },
  { domain: "www.linkedin.com", app: "LinkedIn" },
  { domain: "stackoverflow.com", app: "StackOverflow" },
  { domain: "www.reddit.com", app: "Reddit" },
  { domain: "www.cloudflare.com", app: "Cloudflare" },
  { domain: "www.apple.com", app: "Apple" },
  { domain: "www.microsoft.com", app: "Microsoft" },
  { domain: "chat.openai.com", app: "ChatGPT" },
];

const PROTOCOLS = ["HTTPS", "HTTP", "DNS", "HTTPS", "HTTPS", "HTTPS"];

const ACTIONS = [
  "forwarded", "forwarded", "forwarded", "forwarded", "forwarded",
  "forwarded", "forwarded", "forwarded", "forwarded", "blocked",
];

const SRC_IPS = [
  "192.168.1.10", "192.168.1.15", "192.168.1.20", "192.168.1.25",
  "10.0.0.5", "10.0.0.12", "10.0.0.18", "10.0.0.33",
  "172.16.0.100", "172.16.0.101", "172.16.0.102",
];

const DEST_IPS = [
  "142.250.80.46", "172.64.155.209", "104.18.32.47", "157.240.1.35",
  "13.107.42.14", "140.82.114.4", "162.159.200.1", "151.101.1.69",
  "52.94.236.248", "34.107.243.93", "20.189.173.25",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateLog() {
  const target = pick(DOMAINS);
  const action = pick(ACTIONS);

  return {
    src_ip: pick(SRC_IPS),
    dest_ip: pick(DEST_IPS),
    protocol: pick(PROTOCOLS),
    domain: target.domain,
    application: target.app,
    bytes: randInt(64, 15000),
    packets: randInt(1, 20),
    action,
  };
}

// ---------------------------------------------------------------------------
// Send logs
// ---------------------------------------------------------------------------

async function sendLog(baseUrl, log) {
  try {
    await axios.post(`${baseUrl}/logs`, log, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    });
    return true;
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
    return false;
  }
}

async function sendAlert(baseUrl) {
  const alertTypes = ["port_scan", "brute_force", "anomaly", "policy_violation", "dns_tunnel"];
  const severities = ["low", "medium", "medium", "high", "critical"];

  const alert = {
    src_ip: pick(SRC_IPS),
    alert_type: pick(alertTypes),
    severity: pick(severities),
    description: `Suspicious activity detected from ${pick(SRC_IPS)}`,
  };

  try {
    await axios.post(`${baseUrl}/alerts`, alert, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    });
    return true;
  } catch (err) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const isLive = args.includes("--live");
  const urlIdx = args.indexOf("--url");
  const countIdx = args.indexOf("--count");

  const baseUrl = urlIdx !== -1 ? args[urlIdx + 1] : (process.env.BACKEND_URL || "http://localhost:3000");
  const count = countIdx !== -1 ? parseInt(args[countIdx + 1], 10) : 50;

  console.log(`\n🚀 DPI Traffic Simulator`);
  console.log(`   Target:  ${baseUrl}`);
  console.log(`   Mode:    ${isLive ? "LIVE (continuous)" : `BATCH (${count} logs)`}\n`);

  if (isLive) {
    // Continuous mode: send 1-3 logs per second
    console.log("   Press Ctrl+C to stop\n");
    let sent = 0;
    let failed = 0;
    let alertsSent = 0;

    const interval = setInterval(async () => {
      const batchSize = randInt(1, 3);
      for (let i = 0; i < batchSize; i++) {
        const log = generateLog();
        const ok = await sendLog(baseUrl, log);
        if (ok) {
          sent++;
          process.stdout.write(`\r   📡 Sent: ${sent}  Failed: ${failed}  Alerts: ${alertsSent}  [${log.application}]     `);
        } else {
          failed++;
        }
      }

      // Occasionally send an alert (10% chance per tick)
      if (Math.random() < 0.1) {
        const ok = await sendAlert(baseUrl);
        if (ok) alertsSent++;
      }
    }, randInt(500, 1500));

    process.on("SIGINT", () => {
      clearInterval(interval);
      console.log(`\n\n   ✅ Done: ${sent} sent, ${failed} failed, ${alertsSent} alerts\n`);
      process.exit(0);
    });
  } else {
    // Batch mode: send N logs + a few alerts
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < count; i++) {
      const log = generateLog();
      const ok = await sendLog(baseUrl, log);
      if (ok) {
        sent++;
        process.stdout.write(`\r   📡 Progress: ${i + 1}/${count}  [${log.application}]       `);
      } else {
        failed++;
      }
    }

    // Send a few alerts too
    const alertCount = Math.ceil(count * 0.1);
    let alertsSent = 0;
    for (let i = 0; i < alertCount; i++) {
      const ok = await sendAlert(baseUrl);
      if (ok) alertsSent++;
    }

    console.log(`\n\n   ✅ Done: ${sent} logs sent, ${failed} failed, ${alertsSent} alerts\n`);
  }
}

main();
