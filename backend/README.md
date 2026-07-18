# DPI Backend API

Node.js backend for the DPI Network Monitoring Platform.

## Architecture

```
DPI Engine (C++) → dpi_logs.json (NDJSON)
       ↓
  ship_logs.js → POST /logs
       ↓
  Express API → MongoDB Atlas
       ↓
  Dashboard (React) ← GET /analytics/*
```

## Quick Start

```bash
cd backend
cp .env.example .env   # Edit with your MongoDB Atlas credentials
npm install
npm start              # Start API server on :3000
```

## Environment Variables

| Variable      | Description                  | Default   |
|---------------|------------------------------|-----------|
| `MONGODB_URI` | MongoDB Atlas connection URI | required  |
| `DB_NAME`     | Database name                | `dpi_logs`|
| `PORT`        | API server port              | `3000`    |
| `NODE_ENV`    | Environment                  | `development` |

## API Endpoints

### Ingestion (from DPI Engine)

| Method | Path       | Description                |
|--------|------------|----------------------------|
| POST   | `/logs`    | Ingest traffic log         |
| POST   | `/alerts`  | Ingest security alert      |
| POST   | `/flows`   | Upsert flow statistics     |

### Query

| Method | Path       | Description                |
|--------|------------|----------------------------|
| GET    | `/traffic` | Query traffic logs         |
| GET    | `/blocked` | Query blocked events       |
| GET    | `/stats`   | Summary statistics         |

### Analytics (Dashboard)

| Method | Path                           | Description                |
|--------|--------------------------------|----------------------------|
| GET    | `/analytics/top-domains`       | Top domains by requests    |
| GET    | `/analytics/top-applications`  | Top apps by traffic volume |
| GET    | `/analytics/traffic-volume`    | Time-series traffic volume |
| GET    | `/analytics/blocked-events`    | Blocked event breakdown    |

### System

| Method | Path       | Description      |
|--------|------------|------------------|
| GET    | `/health`  | Health check     |

## DPI Engine → Backend Pipeline

1. The C++ DPI engine writes NDJSON logs to `dpi_logs.json`
2. The log shipper sends them to the backend:

```bash
# One-shot: ship all existing logs
npm run ship-logs

# Watch mode: stream new logs in real-time
npm run ship-logs:watch
```

## MongoDB Collections

| Collection       | TTL     | Description                   |
|------------------|---------|-------------------------------|
| `traffic_logs`   | 7 days  | Per-packet traffic records    |
| `flow_stats`     | 7 days  | Aggregated flow statistics    |
| `blocked_events` | —       | Blocked traffic events        |
| `security_alerts`| 30 days | Security alerts               |

## Traffic Log Schema

```json
{
  "timestamp": "2026-03-04T12:00:00Z",
  "src_ip": "192.168.1.10",
  "dest_ip": "142.250.185.206",
  "protocol": "HTTPS",
  "application": "YouTube",
  "domain": "youtube.com",
  "bytes": 1500,
  "packets": 3,
  "action": "blocked"
}
```

## Project Structure

```
backend/
├── server.js                    # Entry point
├── .env                         # Environment variables
├── package.json
├── scripts/
│   └── ship_logs.js             # DPI log shipper (NDJSON → REST)
└── src/
    ├── app.js                   # Express app setup
    ├── config/
    │   └── database.js          # MongoDB connection (retry + pooling)
    ├── models/
    │   └── schema.js            # Collection indexes & TTL setup
    ├── routes/
    │   ├── dpi.js               # Core CRUD endpoints
    │   └── analytics.js         # Analytics aggregation endpoints
    ├── services/
    │   └── logger.js            # logTraffic(), logAlert(), upsertFlowStats()
    └── middleware/
        └── errorHandler.js      # Global error handler
```
