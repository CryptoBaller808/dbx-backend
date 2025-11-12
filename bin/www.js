#!/usr/bin/env node
console.log('============================================================');
console.log('🔍 DIAGNOSTIC MODE - bin/www.js execution started');
console.log('⏰', new Date().toISOString(), ' node:', process.version, ' cwd:', process.cwd(), ' PORT:', process.env.PORT);
console.log('============================================================');

process.on('uncaughtException', (err) => { console.error('💥 UNCAUGHT', err?.stack || err); process.exit(1); });
process.on('unhandledRejection', (reason) => { console.error('💥 UNHANDLED', reason?.stack || reason); process.exit(1); });

console.log('📦 Loading ../app …');
let app;
try {
  app = require('../app');
  console.log('✅ app loaded');
} catch (e) {
  console.error('❌ Failed to load app:', e?.stack || e);
  process.exit(1);
}

const http = require('http');
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

console.log('🌐 Creating server…');
const server = http.createServer(app);

server.on('error', (err) => { console.error('💥 SERVER ERROR', err?.stack || err); process.exit(1); });

console.log(`🚀 Calling listen(${HOST}:${PORT}) …`);
server.listen(PORT, HOST, () => {
  console.log('============================================================');
  console.log(`✅ SERVER LISTENING on ${HOST}:${PORT}`);
  console.log('============================================================');
});
