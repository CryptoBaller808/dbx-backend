#!/usr/bin/env node

/**
 * Module dependencies.
 */
const app = require("../app");
const debugLib = require("debug");
const debug = debugLib("xrp-ledger:server");
const http = require("http");
const { Server } = require("socket.io");
const socketInit = require("../services/socket");

/**
 * Get port from environment and store in Express.
 */
var port = normalizePort(process.env.PORT || "4000");
app.set("port", port);

/**
 * Create HTTP server.
 */
var server = http.createServer(app);

/**
 * Socket.IO setup
 */
const socket = new Server(server, {
  cors: {
    origin: "*",
  },
});

/**
 * Listen on provided port, on all network interfaces.
 */
// Bind to 0.0.0.0 explicitly for Railway
server.listen(port, "0.0.0.0");
server.on("error", onError);
server.on("listening", onListening);

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */
function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  var bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */
function onListening() {
  var addr = server.address();
  var bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  debug("Listening on " + bind);
  
  // Boot logging
  const commit = process.env.GIT_COMMIT || process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown';
  const branch = process.env.GIT_BRANCH || process.env.RAILWAY_GIT_BRANCH || 'unknown';
  console.log(`[BOOT] listening on 0.0.0.0:${port}`);
  console.log(`[BOOT] commit=${commit.substring(0, 7)} branch=${branch}`);
  
  // Initialize Socket.IO
  socketInit(socket);
  
  console.log("✅ [STARTUP] Server listening and Socket.IO initialized");
}
