// ============================================================================
// Server Entry Point — Express + Socket.IO
// ============================================================================

require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const app = require("./src/app");
const { connectDB, closeDB } = require("./src/config/database");
const { initializeCollections } = require("./src/models/schema");
const { logger } = require("./src/services/logger");
const { setIO } = require("./src/services/socketManager");

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Initialize collections, indexes, and TTL policies
    await initializeCollections();

    // 3. Create HTTP server from Express app (required for Socket.IO)
    const server = http.createServer(app);

    // 4. Initialize Socket.IO with CORS
    const io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    // 5. Store io instance in singleton for use by services/routes
    setIO(io);

    // 6. Handle WebSocket connections
    io.on("connection", (socket) => {
      logger.info("WebSocket client connected", { id: socket.id });
      console.log(`[WS] Client connected: ${socket.id}`);

      socket.on("disconnect", (reason) => {
        logger.info("WebSocket client disconnected", { id: socket.id, reason });
        console.log(`[WS] Client disconnected: ${socket.id} (${reason})`);
      });
    });

    // 7. Start the server
    server.listen(PORT, () => {
      logger.info(`DPI Backend API listening on port ${PORT}`);
      console.log(`\n[Server] http://localhost:${PORT}`);
      console.log("[Server] Endpoints:");
      console.log("  POST /logs          — Ingest traffic logs from DPI engine");
      console.log("  POST /alerts        — Ingest security alerts");
      console.log("  POST /flows         — Upsert flow statistics");
      console.log("  GET  /traffic       — Query traffic logs");
      console.log("  GET  /blocked       — Query blocked events");
      console.log("  GET  /stats         — Summary statistics");
      console.log("  GET  /analytics/top-domains");
      console.log("  GET  /analytics/top-applications");
      console.log("  GET  /analytics/traffic-volume");
      console.log("  GET  /analytics/blocked-events");
      console.log("  GET  /health        — Health check");
      console.log("  WS   /              — Socket.IO real-time events\n");
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n[Server] ${signal} received — shutting down...`);
      io.close();
      server.close(async () => {
        await closeDB();
        process.exit(0);
      });
      // Force exit after 10s
      setTimeout(() => process.exit(1), 10000);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    logger.error("Failed to start server", { error: err.message });
    console.error("[Server] Fatal:", err.message);
    process.exit(1);
  }
}

start();
