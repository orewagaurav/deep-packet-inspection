# DPI Platform — Project & Interview Guide

A plain-English guide to **what this project is, what it does, how it works, and exactly what to say in an interview**. Read the top-level [`README.md`](./README.md) for the deep networking theory; read *this* file to be able to explain the project confidently.

---

## 1. One-line pitch (memorize this)

> "I built a **Deep Packet Inspection platform** — a C++ engine that inspects network traffic, identifies which application each connection belongs to (YouTube, Netflix, etc.) by parsing the TLS handshake, applies firewall-style block rules using a multi-threaded pipeline, and streams the results to a Node.js + MongoDB backend and a React dashboard for real-time analytics."

That single sentence covers: **systems programming + networking + full-stack + a real product**.

---

## 2. What problem does it solve?

Traditional firewalls only look at packet **headers** (IPs and ports). But almost all modern traffic is HTTPS on port 443 — so "block port 443" would block the entire internet. To block *only YouTube* while allowing everything else, you have to look **inside** the packets. That's **Deep Packet Inspection (DPI)**.

This project is a working model of what ISPs and enterprise firewalls (Palo Alto, Cisco, Fortinet) do:
- **See** what applications are on the network (visibility)
- **Block** specific apps / domains / IPs (policy enforcement)
- **Report** on it all through a dashboard (analytics)

---

## 3. The three parts (architecture)

```
   ┌─────────────────────────┐     dpi_logs.json       ┌──────────────────┐        ┌──────────────────┐
   │   C++ DPI ENGINE         │  ───(NDJSON logs)──▶    │  NODE.JS BACKEND │  ───▶  │  REACT DASHBOARD │
   │  (packet inspection)     │      ship_logs.js       │  Express+MongoDB │  REST  │  (charts/tables) │
   └─────────────────────────┘                          └──────────────────┘        └──────────────────┘
        the "hard" part                                   ingest + analytics            visualization
```

| Tier | Tech | Folder | Job |
|------|------|--------|-----|
| **Engine** | C++17, CMake, pthreads | `src/`, `include/` | Parse packets, classify apps, enforce rules |
| **Backend** | Node.js, Express 5, MongoDB | `backend/` | Ingest logs, serve analytics API |
| **Frontend** | React 19, Vite, Tailwind, Chart.js | `frontend/` | Dashboard, traffic, blocked, alerts pages |

The tiers are **decoupled**: the engine just writes JSON log lines to a file; a shipper script forwards them to the API; the frontend reads the API. Clean separation of concerns.

---

## 4. How the C++ engine works (the part interviewers care about)

### 4.1 The pipeline (multi-threaded)

```
 PCAP file
    │
    ▼
 [Reader thread]           reads packets, parses Ethernet→IP→TCP/UDP headers
    │   (hash 5-tuple → pick a Load Balancer)
    ▼
 [Load Balancer threads]   spread flows across workers by consistent hashing
    │   (hash 5-tuple → pick a Fast-Path worker)
    ▼
 [Fast-Path worker threads]  the workhorses: connection tracking + DPI + rule matching
    │
    ▼
 [Output thread]           writes forwarded packets to output.pcap + JSON logs
```

Threads talk through a **custom thread-safe queue** (`include/thread_safe_queue.h`) built on a `std::mutex` + two `std::condition_variable`s (one for "not empty", one for "not full") — a classic bounded producer/consumer queue that applies backpressure when full.

### 4.2 The single most important idea: consistent hashing on the 5-tuple

A **5-tuple** = `(src IP, dst IP, src port, dst port, protocol)` — it uniquely identifies one connection/flow.

Every packet is hashed on its 5-tuple to decide which worker thread handles it. Because the hash is deterministic, **all packets of the same connection always go to the same worker**. That's the key trick: each worker can keep its own connection table with **no locking between workers**, because no two workers ever touch the same flow. This is how real high-performance network gear scales across cores. (See `FiveTupleHash` in `include/types.h`.)

> Interview soundbite: *"I used consistent hashing on the flow 5-tuple so each thread owns a disjoint set of connections — that removes cross-thread contention and makes stateful inspection lock-free per worker."*

### 4.3 How classification actually works (SNI extraction)

This is the cleverest part. Even though HTTPS is encrypted, the **very first message** of a TLS connection — the **Client Hello** — sends the destination hostname in **cleartext** in a field called **SNI (Server Name Indication)**. The engine:

1. Detects a TLS Client Hello (record type `0x16`, handshake type `0x01`).
2. Walks the binary TLS structure by hand: version → random → session ID → cipher suites → compression → extensions.
3. Finds the SNI extension (`0x0000`) and pulls out the hostname string, e.g. `www.youtube.com`.
4. Maps the hostname to an application (`sniToAppType()` → `YOUTUBE`).

It also has extractors for plain **HTTP Host headers** (port 80) and stubs for **QUIC** and **DNS**. See `include/sni_extractor.h` and `src/sni_extractor.cpp`.

> Interview soundbite: *"You don't need to decrypt HTTPS to know where it's going — the SNI in the TLS Client Hello is unencrypted, so I parse the handshake bytes directly to identify the app."*

### 4.4 Connection tracking & rules

- **Connection tracker** (`connection_tracker.h`): per-worker flow table (`unordered_map<FiveTuple, Connection>`), tracks state (NEW → ESTABLISHED → CLASSIFIED → BLOCKED/CLOSED), byte/packet counts, and evicts stale flows on a timeout.
- **Rule manager** (`rule_manager.h`): thread-safe (`std::shared_mutex` — many readers, one writer) sets of blocked IPs, apps, domains (with `*.` wildcards), and ports. For every flow it answers "block or forward?".

### 4.5 Running the engine

```bash
cmake -B build && cmake --build build
./build/dpi_engine input.pcap output.pcap --block-app YouTube --block-ip 192.168.1.50 --block-domain facebook.com
```
It reads `input.pcap`, drops anything matching a rule, writes the survivors to `output.pcap`, and emits `dpi_logs.json` (one JSON object per flow with src/dst IP, domain, application, protocol, bytes, packets, action).

---

## 5. How the backend works

- **`ship_logs.js`** — reads `dpi_logs.json` (NDJSON) and POSTs each line to the API. Has a `--watch` mode that tails the file for live streaming.
- **Express API** (`backend/src/routes/`):
  - `POST /logs`, `POST /alerts`, `POST /flows` — ingestion
  - `GET /traffic`, `GET /blocked`, `GET /stats` — queries with filters + pagination
  - `GET /analytics/top-domains | top-applications | traffic-volume | blocked-events` — dashboard aggregations
- **MongoDB** (`schema.js`): indexes for fast queries + **TTL indexes** that auto-delete old logs (traffic 7 days, alerts 30 days). Analytics use **aggregation pipelines** (`$group`, `$sort`, time-bucketing for time-series).
- Hardened with `helmet`, `cors`, `morgan` logging, `winston` structured logs, and graceful shutdown. Deployed on Render.

---

## 6. How the frontend works

React 19 + Vite + Tailwind SPA (`frontend/src/`). Four routes — **Dashboard, Traffic, Blocked, Alerts** — with reusable components (`StatCard`, `TrafficChart`, `ApplicationChart`, `DomainTable`, `AlertsTable`). Talks to the deployed backend via an Axios client (`services/api.js`) and renders charts with Chart.js.

---

## 7. Data flow end to end (say this if asked "walk me through a request")

1. A packet arrives in the pcap → Reader parses headers → hashed to a Load Balancer → hashed to a Fast-Path worker.
2. Worker looks up/creates the flow, and if unclassified, parses the TLS Client Hello to extract the SNI → maps to an app.
3. Worker checks the rule manager: blocked → drop + count; allowed → forward to output pcap.
4. Worker appends a JSON line to `dpi_logs.json`.
5. `ship_logs.js` POSTs that line to `POST /logs` → stored in MongoDB `traffic_logs`.
6. Dashboard calls `GET /stats` and `/analytics/*` → MongoDB aggregates → Chart.js renders it.

---

## 8. Likely interview questions & answers

**Q: Why multiple threads instead of one?**
Packet processing is embarrassingly parallel *per flow*. Splitting reader / load-balancer / worker stages pipelines the work, and hashing flows to workers lets it scale across cores without locks on the hot path.

**Q: Why hash on the 5-tuple specifically?**
So all packets of one connection are handled by one worker — required for correct stateful tracking (you need to see the Client Hello and later packets of the same flow together) and it eliminates cross-thread locking.

**Q: How can you classify HTTPS without decrypting it?**
The TLS Client Hello sends the hostname (SNI) in cleartext before encryption starts. I parse those handshake bytes directly.

**Q: What's the thread-safe queue doing?**
Bounded producer/consumer queue with a mutex + condition variables. Consumers block when empty, producers block when full — the "full" case gives backpressure so a fast reader can't exhaust memory.

**Q: How does the backend stay fast as data grows?**
Indexes on the query fields, MongoDB aggregation pipelines instead of app-side loops, pagination on list endpoints, and TTL indexes that expire old data automatically.

**Q: What are the limitations? (be honest — they'll respect it)**
- Reads **pcap files offline**, not a live NIC (no raw-socket/libpcap capture yet).
- SNI-based classification breaks under **Encrypted Client Hello (ECH)**, which is the direction TLS is heading.
- The engine is a modular multi-threaded design (`DPIEngine` → `LBManager` → `FPManager`); the entry point is `src/main_dpi.cpp`.
- No automated tests yet.

**Q: How would you extend it?**
Live capture with libpcap; ECH/QUIC handling; a WebSocket feed so the dashboard updates in real time; per-flow bandwidth throttling instead of just block/allow; unit tests around the TLS parser.

---

## 9. Résumé bullet points (copy-paste, tune the metrics to what you measured)

- Built a **multi-threaded C++17 Deep Packet Inspection engine** that classifies network applications by parsing **TLS SNI** and HTTP host headers, using a Reader→Load-Balancer→Worker pipeline with **consistent 5-tuple hashing** for lock-free per-flow state.
- Designed a **bounded thread-safe queue** (mutex + condition variables) for backpressured inter-thread packet passing, and a **thread-safe rule engine** (`shared_mutex`) supporting IP/app/domain/port blocking with wildcard matching.
- Developed a **Node.js/Express + MongoDB** analytics backend with aggregation-pipeline endpoints, TTL-based data retention, and a log-shipping pipeline; **deployed on Render**.
- Created a **React + Vite + Tailwind** real-time dashboard (Chart.js) visualizing traffic volume, top domains/applications, and blocked events.

---

## 10. 30-second whiteboard sketch

```
pcap ─▶ Reader ─▶ LB threads ─▶ Worker threads ─▶ output.pcap + dpi_logs.json
                    (hash 5-tuple)   │
                                     ├─ parse TLS Client Hello → SNI → app
                                     └─ rule check → forward / drop
                                                        │
                              ship_logs.js ─▶ Express API ─▶ MongoDB ─▶ React dashboard
```

If you can draw this box diagram and explain the **5-tuple hashing** and **SNI extraction**, you've demonstrated the two most impressive ideas in the project.
