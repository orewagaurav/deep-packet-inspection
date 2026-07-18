// ============================================================================
// Socket Manager — Singleton for Socket.IO instance
// ============================================================================
//
// Avoids circular imports: server.js sets the io instance, and any
// service/route can import emitEvent() to push real-time updates.
//

let io = null;

/**
 * Store the Socket.IO server instance.
 * Called once from server.js after initialization.
 */
function setIO(instance) {
  io = instance;
}

/**
 * Retrieve the active Socket.IO server instance.
 */
function getIO() {
  return io;
}

/**
 * Emit an event to all connected clients.
 * Silently no-ops if Socket.IO hasn't been initialized yet.
 *
 * @param {string} event  — Event name (e.g. "traffic_update")
 * @param {*}      data   — Payload to send
 */
function emitEvent(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

module.exports = { getIO, setIO, emitEvent };
