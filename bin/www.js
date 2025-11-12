#!/usr/bin/env node
const app = require('../app');
const http = require('http');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

console.log('=== DBX Backend starting ===');
console.log('node:', process.version, 'cwd:', process.cwd(), 'PORT:', PORT);

const server = http.createServer(app);
server.listen(PORT, HOST, () => {
  console.log(`[BOOT] listening on ${HOST}:${PORT}`);
});
server.on('error', err => { console.error('SERVER ERROR', err); process.exit(1); });
