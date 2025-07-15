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
const tempAdminRouter = require("./routes/tempAdminSetup.js");
const versionRouter = require("./routes/versionCheck_simple.js");
const simpleAdminRouter = require("./routes/simpleAdminCreation.js");
const debugAdminRouter = require("./routes/debugAdmin.js");
const simpleDiagnosticsRouter = require("./routes/simpleDiagnostics.js");
const safeSchemaRouter = require("./routes/safeSchemaCheck.js");
const simpleDatabaseTestRouter = require("./routes/simpleDatabaseTest.js");
const healthRouter = require("./routes/healthWithDiagnostics.js");
const schemaDiagnosticsRouter = require("./routes/schemaDiagnosticsEndpoint.js");
const testSchemaDiagnosticsRouter = require("./routes/testSchemaDiagnostics.js");

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

// Apply CORS middleware FIRST - before any other middleware
app.use(cors({
  origin: "*", // Temporarily allow all origins for testing
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'ngrok-skip-browser-warning'
  ],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Handle preflight requests explicitly
app.options('*', cors());

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

// CORS test endpoint
app.get("/cors-test", (req, res) => {
  res.status(200).json({ 
    status: true, 
    message: "CORS is working correctly",
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// Health endpoint with database schema diagnostics
app.use("/health", healthRouter);

// Schema diagnostics endpoint
app.use("/schema-diagnostics", schemaDiagnosticsRouter);

// Test schema diagnostics endpoint
app.use("/test-schema-diagnostics", testSchemaDiagnosticsRouter);

// Register version router early to avoid conflicts
app.use("/version", versionRouter);

// Database diagnostics endpoint directly in main app
app.get("/version/db-diagnostics", async (req, res) => {
  console.log('🔍 Database Diagnostics requested...');
  
  const report = {
    success: false,
    timestamp: new Date().toISOString(),
    environment: {
      database_url_exists: !!process.env.DATABASE_URL,
      database_url_preview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'not found'
    },
    connection: {},
    tables: {},
    errors: []
  };
  
  try {
    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      report.errors.push('DATABASE_URL environment variable not found');
      return res.json(report);
    }
    
    // Try to load Sequelize and connect
    const { Sequelize } = require('sequelize');
    
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });
    
    // Test connection
    await sequelize.authenticate();
    report.connection.status = 'successful';
    report.connection.dialect = 'postgres';
    
    // Check users table using raw SQL
    try {
      // Check if users table exists
      const [tableCheck] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      `);
      
      if (tableCheck.length > 0) {
        report.tables.users = { exists: true };
        
        // Get column information
        const [columnInfo] = await sequelize.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'users'
          ORDER BY ordinal_position
        `);
        
        report.tables.users.columns = columnInfo.map(col => col.column_name);
        report.tables.users.required_columns = {
          id: columnInfo.some(col => col.column_name === 'id'),
          email: columnInfo.some(col => col.column_name === 'email'),
          password: columnInfo.some(col => col.column_name === 'password'),
          role_id: columnInfo.some(col => col.column_name === 'role_id')
        };
        report.tables.users.column_details = columnInfo;
        
        // Get user count
        const [userCount] = await sequelize.query('SELECT COUNT(*) as count FROM users');
        report.tables.users.count = parseInt(userCount[0].count);
        
        // Check for admin user
        const [adminCheck] = await sequelize.query("SELECT id, email FROM users WHERE email = 'admin@dbx.com'");
        report.tables.users.admin_exists = adminCheck.length > 0;
        if (adminCheck.length > 0) {
          report.tables.users.admin_user = adminCheck[0];
        }
      } else {
        report.tables.users = { exists: false, error: 'Table not found' };
      }
      
    } catch (error) {
      report.tables.users = { exists: false, error: error.message };
    }
    
    // Check roles table using raw SQL
    try {
      // Check if roles table exists
      const [tableCheck] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'roles'
      `);
      
      if (tableCheck.length > 0) {
        report.tables.roles = { exists: true };
        
        // Get column information
        const [columnInfo] = await sequelize.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'roles'
          ORDER BY ordinal_position
        `);
        
        report.tables.roles.columns = columnInfo.map(col => col.column_name);
        report.tables.roles.required_columns = {
          id: columnInfo.some(col => col.column_name === 'id'),
          name: columnInfo.some(col => col.column_name === 'name')
        };
        report.tables.roles.column_details = columnInfo;
        
        // Get roles data
        const [rolesData] = await sequelize.query('SELECT id, name FROM roles ORDER BY id');
        report.tables.roles.data = rolesData;
        report.tables.roles.admin_role_exists = rolesData.some(role => role.name === 'admin');
        report.tables.roles.role_id_2_exists = rolesData.some(role => role.id === 2);
      } else {
        report.tables.roles = { exists: false, error: 'Table not found' };
      }
      
    } catch (error) {
      report.tables.roles = { exists: false, error: error.message };
    }
    
    await sequelize.close();
    report.success = true;
    
  } catch (error) {
    report.errors.push(`Connection error: ${error.message}`);
    report.connection.status = 'failed';
    console.error('❌ Database diagnostics failed:', error);
  }
  
  res.json(report);
});

// Alternative database diagnostics endpoint with different path
app.get("/db-schema-check", (req, res) => {
  console.log('🔍 Database Schema Check requested...');
  
  const report = {
    success: true,
    timestamp: new Date().toISOString(),
    message: "Database schema check working (synchronous)",
    environment: {
      database_url_exists: !!process.env.DATABASE_URL,
      database_url_preview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'not found'
    }
  };
  
  res.status(200).json(report);
});

// Simple test endpoint
app.get("/simple-test", (req, res) => {
  res.json({
    success: true,
    message: "Simple test endpoint working",
    timestamp: new Date().toISOString(),
    database_url_exists: !!process.env.DATABASE_URL
  });
});

// Database diagnostics endpoint
app.get("/db-diagnostics", async (req, res) => {
  const { testDatabase } = require('./simple-db-test');
  try {
    const report = await testDatabase();
    res.json(report);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Database diagnostics endpoint (synchronous like health)
app.get("/db-diagnostics-sync", (req, res) => {
  res.status(200).json({
    success: true,
    timestamp: new Date().toISOString(),
    message: "Database diagnostics endpoint working",
    environment: {
      database_url_exists: !!process.env.DATABASE_URL,
      database_url_preview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'not found'
    },
    note: "This is a synchronous test - async database queries will be added once this works"
  });
});

// Ultra-simple database test endpoint
app.get("/db-test-simple", async (req, res) => {
  try {
    const report = {
      success: true,
      timestamp: new Date().toISOString(),
      environment: {
        database_url_exists: !!process.env.DATABASE_URL,
        database_url_preview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'not found'
      },
      message: 'Simple database test endpoint working'
    };
    
    res.json(report);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Working database diagnostics endpoint
app.get("/db-diagnostics-working", async (req, res) => {
  console.log('🔍 Database Diagnostics requested...');
  
  const report = {
    success: false,
    timestamp: new Date().toISOString(),
    environment: {
      database_url_exists: !!process.env.DATABASE_URL,
      database_url_preview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'not found'
    },
    connection: {},
    tables: {},
    errors: []
  };
  
  try {
    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      report.errors.push('DATABASE_URL environment variable not found');
      return res.json(report);
    }
    
    // Try to load Sequelize and connect
    const { Sequelize } = require('sequelize');
    
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });
    
    // Test connection
    await sequelize.authenticate();
    report.connection.status = 'successful';
    report.connection.dialect = 'postgres';
    
    // Check users table using raw SQL
    try {
      // Check if users table exists
      const [tableCheck] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      `);
      
      if (tableCheck.length > 0) {
        report.tables.users = { exists: true };
        
        // Get column information
        const [columnInfo] = await sequelize.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'users'
          ORDER BY ordinal_position
        `);
        
        report.tables.users.columns = columnInfo.map(col => col.column_name);
        report.tables.users.required_columns = {
          id: columnInfo.some(col => col.column_name === 'id'),
          email: columnInfo.some(col => col.column_name === 'email'),
          password: columnInfo.some(col => col.column_name === 'password'),
          role_id: columnInfo.some(col => col.column_name === 'role_id')
        };
        report.tables.users.column_details = columnInfo;
        
        // Get user count
        const [userCount] = await sequelize.query('SELECT COUNT(*) as count FROM users');
        report.tables.users.count = parseInt(userCount[0].count);
        
        // Check for admin user
        const [adminCheck] = await sequelize.query("SELECT id, email FROM users WHERE email = 'admin@dbx.com'");
        report.tables.users.admin_exists = adminCheck.length > 0;
        if (adminCheck.length > 0) {
          report.tables.users.admin_user = adminCheck[0];
        }
      } else {
        report.tables.users = { exists: false, error: 'Table not found' };
      }
      
    } catch (error) {
      report.tables.users = { exists: false, error: error.message };
    }
    
    // Check roles table using raw SQL
    try {
      // Check if roles table exists
      const [tableCheck] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'roles'
      `);
      
      if (tableCheck.length > 0) {
        report.tables.roles = { exists: true };
        
        // Get column information
        const [columnInfo] = await sequelize.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'roles'
          ORDER BY ordinal_position
        `);
        
        report.tables.roles.columns = columnInfo.map(col => col.column_name);
        report.tables.roles.required_columns = {
          id: columnInfo.some(col => col.column_name === 'id'),
          name: columnInfo.some(col => col.column_name === 'name')
        };
        report.tables.roles.column_details = columnInfo;
        
        // Get roles data
        const [rolesData] = await sequelize.query('SELECT id, name FROM roles ORDER BY id');
        report.tables.roles.data = rolesData;
        report.tables.roles.admin_role_exists = rolesData.some(role => role.name === 'admin');
        report.tables.roles.role_id_2_exists = rolesData.some(role => role.id === 2);
      } else {
        report.tables.roles = { exists: false, error: 'Table not found' };
      }
      
    } catch (error) {
      report.tables.roles = { exists: false, error: error.message };
    }
    
    await sequelize.close();
    report.success = true;
    
  } catch (error) {
    report.errors.push(`Connection error: ${error.message}`);
    report.connection.status = 'failed';
    console.error('❌ Database diagnostics failed:', error);
  }
  
  res.json(report);
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

// Add explicit CORS headers for admin routes
app.use("/admindashboard", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://dbx-admin.onrender.com");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Credentials", "true");
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

app.use("/admindashboard", adminRouter);
app.use("/mail", mailingRouter);
app.use("/temp-admin", tempAdminRouter);
app.use("/simple-admin", simpleAdminRouter);
app.use("/debug-admin", debugAdminRouter);
app.use("/simple-diagnostics", simpleDiagnosticsRouter);
app.use("/safe-schema", safeSchemaRouter);
app.use("/simple-db-test", simpleDatabaseTestRouter);

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

// Initialize database and sync tables
const initializeDatabase = async () => {
  try {
    console.log('🔄 [Database] Starting database initialization...');
    
    // Import database models
    const { sequelize } = require('./models');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ [Database] Connection authenticated successfully');
    
    // Sync database - create tables if they don't exist
    await sequelize.sync({ alter: true });
    console.log('✅ [Database] Database synced successfully - tables created/updated');
    
    return true;
  } catch (error) {
    console.error('❌ [Database] Failed to initialize database:', error);
    console.error('🔧 [Database] Full error details:', error.message);
    console.error('📋 [Database] Stack trace:', error.stack);
    throw error;
  }
};

// Start server after database initialization
const startServer = async () => {
  try {
    // Initialize database first
    await initializeDatabase();
    
    // Start the server
    server.listen(PORT, () => {
      console.log(`✅ [Server] The server is running on port ${PORT}`);
      console.log('🎯 [Server] Database initialized and server ready!');
    });
    
    server.on("error", onError);
    server.on("listening", onListening);
    
  } catch (error) {
    console.error('❌ [Server] Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();

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
