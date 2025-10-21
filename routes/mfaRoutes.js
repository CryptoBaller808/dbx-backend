const express = require('express');

const router = express.Router();

// TEMPORARY: Completely disabled MFA routes to fix backend crash
// This is a minimal implementation to prevent Route.post() callback errors

console.log('⚠️  [MFA Routes] MFA functionality completely disabled to fix backend crash');
console.log('🔧 [MFA Routes] This is a temporary bypass - MFA will be restored after Phase 2');

// Export empty router to prevent any route registration issues
module.exports = router;

