#!/usr/bin/env node
// ============================================================================
// DPI Log Shipper — Reads dpi_logs.json (NDJSON) and POSTs to the backend API
// ============================================================================
// Usage:
//   node ship_logs.js [--file dpi_logs.json] [--api http://localhost:3000]
//   node ship_logs.js --watch   (tail -f mode for live streaming)
// ============================================================================

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const readline = require("readline");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}
const LOG_FILE = getArg("--file", path.resolve(__dirname, "..", "dpi_logs.json"));
const API_BASE = getArg("--api", "http://localhost:3000");
const WATCH_MODE = args.includes("--watch");
const BATCH_SIZE = Number(getArg("--batch", "50"));

// ---------------------------------------------------------------------------
// HTTP POST helper
// ---------------------------------------------------------------------------
function postJSON(endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    const mod = url.protocol === "https:" ? https : http;
    const data = JSON.stringify(body);

    const req = mod.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (chunk) => (buf += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: buf }));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Ship a single log line
// ---------------------------------------------------------------------------
async function shipLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const log = JSON.parse(trimmed);
    const res = await postJSON("/logs", log);
    if (res.status >= 400) {
      console.error(`[Ship] Error ${res.status}: ${res.body}`);
    }
  } catch (err) {
    console.error(`[Ship] Failed to send log: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Batch ship
// ---------------------------------------------------------------------------
async function shipBatch(lines) {
  const promises = lines.map((l) => shipLine(l));
  await Promise.all(promises);
}

// ---------------------------------------------------------------------------
// Main: read file and ship
// ---------------------------------------------------------------------------
async function main() {
  if (!fs.existsSync(LOG_FILE)) {
    console.error(`[Ship] Log file not found: ${LOG_FILE}`);
    process.exit(1);
  }

  console.log(`[Ship] Reading ${LOG_FILE}`);
  console.log(`[Ship] Posting to ${API_BASE}/logs`);

  const rl = readline.createInterface({
    input: fs.createReadStream(LOG_FILE),
    crlfDelay: Infinity,
  });

  let batch = [];
  let totalSent = 0;

  for await (const line of rl) {
    batch.push(line);
    if (batch.length >= BATCH_SIZE) {
      await shipBatch(batch);
      totalSent += batch.length;
      process.stdout.write(`\r[Ship] Sent ${totalSent} logs...`);
      batch = [];
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    await shipBatch(batch);
    totalSent += batch.length;
  }

  console.log(`\n[Ship] Done — ${totalSent} logs shipped to ${API_BASE}`);
}

// ---------------------------------------------------------------------------
// Watch mode: tail the file for new lines
// ---------------------------------------------------------------------------
async function watchMode() {
  console.log(`[Ship] Watch mode — tailing ${LOG_FILE}`);
  console.log(`[Ship] Posting to ${API_BASE}/logs`);

  let position = 0;
  if (fs.existsSync(LOG_FILE)) {
    position = fs.statSync(LOG_FILE).size; // start from end
  }

  fs.watchFile(LOG_FILE, { interval: 1000 }, async () => {
    const stat = fs.statSync(LOG_FILE);
    if (stat.size <= position) return;

    const stream = fs.createReadStream(LOG_FILE, { start: position });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      await shipLine(line);
    }

    position = stat.size;
  });

  // Keep alive
  process.on("SIGINT", () => {
    fs.unwatchFile(LOG_FILE);
    process.exit(0);
  });
}

if (WATCH_MODE) {
  watchMode();
} else {
  main();
}
