// ============================================================================
// MongoDB Connection Module
// ============================================================================
// Reusable connection with retry logic, connection pooling, and error handling.
// Uses the official MongoDB Node.js driver.
// ============================================================================

const { MongoClient } = require("mongodb");

const RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 3000;

/** @type {MongoClient | null} */
let client = null;

/** @type {import("mongodb").Db | null} */
let db = null;

/**
 * Sleep helper for retry backoff.
 * @param {number} ms
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Connect to MongoDB Atlas with retry logic.
 * Reads MONGODB_URI and DB_NAME from environment variables.
 *
 * @returns {Promise<import("mongodb").Db>} The database instance.
 */
async function connectDB() {
  // Return cached connection if already connected
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  const dbName = process.env.DB_NAME || "dpi_logs";

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(
        `[MongoDB] Connection attempt ${attempt}/${RETRY_ATTEMPTS}...`
      );

      client = new MongoClient(uri, {
        // Connection pool settings
        maxPoolSize: 20,
        minPoolSize: 5,
        maxIdleTimeMS: 60000,
        // Timeouts
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        // Retry
        retryWrites: true,
        retryReads: true,
      });

      await client.connect();

      // Verify connectivity
      await client.db("admin").command({ ping: 1 });

      db = client.db(dbName);
      console.log(`[MongoDB] Connected to database: ${dbName}`);

      // Handle unexpected disconnections
      client.on("close", () => {
        console.warn("[MongoDB] Connection closed unexpectedly");
        db = null;
        client = null;
      });

      return db;
    } catch (err) {
      console.error(
        `[MongoDB] Connection attempt ${attempt} failed: ${err.message}`
      );

      if (attempt < RETRY_ATTEMPTS) {
        const delay = RETRY_DELAY_MS * attempt; // Exponential-ish backoff
        console.log(`[MongoDB] Retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        throw new Error(
          `[MongoDB] Failed to connect after ${RETRY_ATTEMPTS} attempts: ${err.message}`
        );
      }
    }
  }
}

/**
 * Get the current database instance.
 * Throws if not yet connected.
 *
 * @returns {import("mongodb").Db}
 */
function getDB() {
  if (!db) {
    throw new Error("[MongoDB] Not connected. Call connectDB() first.");
  }
  return db;
}

/**
 * Get the MongoClient instance.
 * @returns {MongoClient}
 */
function getClient() {
  if (!client) {
    throw new Error("[MongoDB] Not connected. Call connectDB() first.");
  }
  return client;
}

/**
 * Gracefully close the MongoDB connection.
 */
async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("[MongoDB] Connection closed");
  }
}

module.exports = { connectDB, getDB, getClient, closeDB };
