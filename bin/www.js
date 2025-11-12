#!/usr/bin/env node

// MINIMAL TEST - prove CMD runs
console.log('===== MINIMAL TEST START =====');
console.log('Node version:', process.version);
console.log('PORT:', process.env.PORT);
console.log('CWD:', process.cwd());
console.log('===== MINIMAL TEST END =====');

// Keep process alive
setInterval(() => {
  console.log('Still alive...');
}, 5000);
