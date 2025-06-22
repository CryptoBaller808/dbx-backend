#!/usr/bin/env node

/**
 * Module dependencies.
 */
// import app from "../app";
// import debugLib from "debug";
// import http from "http";
// var debug = debugLib("xrp-ledger:server");
// import { Server, Socket } from "socket.io";
// import socketInit from "../services/socket";

app = require("../app");
const debugLib =require("debug");
const debug = debugLib("xrp-ledger:server");
const http = require("http");
//const debug = require("xrp-ledger:server");
const { Server, Socket } = require("socket.io");
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
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);
//socket io
const socket = new Server(server, {
//  path: '/wss/socket.io',
  cors: {
    origin: "*",
  },
});

// const io = require('socket.io')(server, {
//   path: '/chat/socket.io'
// });


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
  socketInit(socket);
}
