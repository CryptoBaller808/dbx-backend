/**
 * Crypto Polyfill for Node.js Environment
 * 
 * WalletConnect v2 SignClient requires browser crypto APIs (crypto.getRandomValues, crypto.subtle)
 * that are not available in Node.js by default. This polyfill provides those APIs using Node's
 * native crypto module.
 * 
 * Stage E: Real Lobstr Wallet Integration
 * 
 * @module cryptoPolyfill
 */

const crypto = require('crypto');

/**
 * Polyfill crypto.getRandomValues for Node.js
 * This is required by WalletConnect v2 SignClient
 */
if (typeof globalThis.crypto === 'undefined') {
  console.log('[XLM CRYPTO] Initializing crypto polyfill for Node.js environment');
  
  // Create a minimal crypto object with getRandomValues
  globalThis.crypto = {
    getRandomValues: function(buffer) {
      if (!(buffer instanceof Uint8Array)) {
        throw new TypeError('Expected Uint8Array');
      }
      
      const bytes = crypto.randomBytes(buffer.length);
      buffer.set(bytes);
      return buffer;
    },
    
    // Add subtle crypto for full WalletConnect compatibility
    subtle: crypto.webcrypto?.subtle || crypto.subtle,
    
    // Add randomUUID if available (Node 16+)
    randomUUID: crypto.randomUUID ? crypto.randomUUID.bind(crypto) : undefined
  };
  
  console.log('[XLM CRYPTO] ✅ crypto.getRandomValues polyfill installed');
  console.log('[XLM CRYPTO] ✅ crypto.subtle available:', !!globalThis.crypto.subtle);
} else {
  console.log('[XLM CRYPTO] crypto already available (browser or Node 18+)');
}

module.exports = globalThis.crypto;
