const express = require("express");
const http = require("http");
const https = require("https");
const { Server, Socket } = require("socket.io");
const debugLib = require("debug");
const debug = debugLib("xrp-ledger:server");
const socketInit = require("./services/socket");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const morgan = require("morgan");
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUI = require("swagger-ui-express");
// const ledgerRouter = require("./routes/ledger");
const usersRouter = require("./routes/usersRoute.js");
const profileRouter = require("./routes/profileRoute.js");
const collectionRouter = require("./routes/collectionRoute.js");
const categoryRouter = require("./routes/categoryRoute.js");
// const itemRouter = require("./routes/itemRoute.js");
const minter = require("./routes/mintNFTRoute.js");
const saleRouter = require("./routes/saleRoute.js");
const dashRouter = require("./routes/dashRoute.js");
const adminRouter = require("./routes/adminRoute.js");
const mailingRouter = require("./routes/malingRoute.js");

//merge code
// import path from "path";
path = require("path");
const routes = require("./routes.js");
logger = require("morgan");
// import routes from "./routes.js";
// import cors from "cors";
// import logger from "morgan";
// import config from "./config/index.js";
//merge code end

const config = require("./config/index");

// import config from "./config/index";
//Database connectivity
// const db_url = process.env.MONGO_URI;

// mongoose
//   .connect(db_url, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => console.log('MongoDB CONNECTED!!!'))
//   .catch((err) => conso le.log(err));

// Load the MySQL pool connection
const sequelize = require("./util/database");

//const PORT = process.env.PORT || 3000;
const PORT = normalizePort(process.env.PORT || "5002");
const HOST_URL = process.env.HOST_URL;

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "NFT Marketplace API",
      version: "1.0.0",
      description: "NFT Marketplace REST APIs on XRPL",
    },
    servers: [
      {
        //url: "https://worldtradingexchange.com",
        url: HOST_URL, //for server

        //  url: 'https://api.digitalblock.exchange/', //for server

        //url: "http://ec2-13-56-149-179.us-west-1.compute.amazonaws.com",
        //  url: "", //for local
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Send auth token in headers for e.g - Bearer authtoken",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./routes/*.js"],
};

const specs = swaggerJsDoc(options);

const app = express();

app.use(
  cors({
    origin: [
      'https://manusai-x-dbx-fe.vercel.app',
      'https://manusai-x-dbx-admin.vercel.app',
      // Keep existing origins for production if needed
      process.env.NODE_ENV === 'production' ? '*' : 'http://localhost:3000'
    ],
    credentials: true // Enable credentials for cookies/sessions if needed
  } )
);

app.use(express.json());

// const server = http.createServer(app);
//
// const socket = new Server(server, {
//   cors: {
//     origin: "*",
//   },
// })

// app.use(morgan("dev"));
// app.use(bodyParser.json());	//application/json
// app.use((req,res,next)=>{
// 	res.setHeader('Access-Control-Allow-Origin','*');
// 	res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE');
// 	res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
// 	logger();
// })

//merge code
// app.use(logger("dev"));

// app.use(express.json({ limit: "50mb" }));
// app.use(express.urlencoded({ limit: "50mb", extended: false }));

// app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (_, res) => {
  res.status(200).json({ status: true, message: "Server running" });
});

app.use("/api/v1", routes);

// app.use("/*", (req, res) => {
// 	res.sendFile(path.join(__dirname, "../public/index.html"), (err) => {
// 		if (err) {
// 			res.status(500).send(err);
// 		}
// 	});
// });

// merge code end

app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(specs));
//user router
// app.use('/api/users',router);
//app.use("/ledgers", ledgerRouter);
app.use("/users", usersRouter);
app.use("/profiles", profileRouter);
app.use("/collection", collectionRouter);
app.use("/category", categoryRouter);
// app.use("/item" ,itemRouter);
app.use("/mint", minter);
app.use("/sale", saleRouter);
app.use("/userdashboard", dashRouter);
app.use("/admindashboard", adminRouter);
app.use("/mail", mailingRouter);

// const server = https.createServer(app).listen(PORT, function() {
//     console.log('Https App started');
// });

const server = http.createServer(app);
const socket = new Server(server, {
  cors: {
    origin: "*",
  },
});

// httpServer.listen(port, function(){
// console.log("server listening on port", port);
// });
//
// const socket = new Server(server, {
//   cors: {
//     origin: "*",
//   },
// })
//
//
// var httpServer = http.Server(app);
// httpServer.listen(port, function(){
// console.log("server listening on port", port);
// });
//
// io = require('socket.io').listen(httpServer);
// io.use(sharedsession(session));
// io.on('connection', function(socket){
// console.log("connected");

//server.listen(port);

// const io = require('socket.io')(server, {
//   path: '/chat/socket.io'
// });

/**
 * Normalize a port into a number, string, or false.
 */

server.listen(PORT, () => console.log(`The server is running on port ${PORT}`));
server.on("error", onError);
server.on("listening", onListening);

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

  var bind = typeof PORT === "string" ? "Pipe " + PORT : "Port " + PORT;

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

//app.listen(PORT, () => console.log(`The server is running on port ${PORT}`));

//module.exports = app;
