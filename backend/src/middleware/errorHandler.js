// ============================================================================
// Global Error Handler Middleware
// ============================================================================

const { logger } = require("../services/logger");

function errorHandler(err, req, res, _next) {
  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });

  const status = err.statusCode || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
}

module.exports = errorHandler;
