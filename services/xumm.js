require('dotenv').config();
const { XummSdk } = require("xumm-sdk");
// import { XummSdk } from "xumm-sdk";
config = require("../config");
// import config from "../config/index.js";

console.log('[DBX BACKEND] Initializing XUMM SDK...');
console.log('[DBX BACKEND] XUMM_API_KEY:', process.env.XUMM_API_KEY ? '***' + process.env.XUMM_API_KEY.slice(-4) : 'NOT SET');
console.log('[DBX BACKEND] XUMM_API_SECRET:', process.env.XUMM_API_SECRET ? '***' + process.env.XUMM_API_SECRET.slice(-4) : 'NOT SET');
console.log('[DBX BACKEND] XRPL_NETWORK:', process.env.XRPL_NETWORK || 'mainnet (default)');

if (!process.env.XUMM_API_KEY || !process.env.XUMM_API_SECRET) {
  console.error('[DBX BACKEND] ✗ CRITICAL: XUMM API credentials not set!');
  console.error('[DBX BACKEND] XUMM wallet connection will fail until credentials are configured');
}

const Sdk = new XummSdk(
  process.env.XUMM_API_KEY,
  process.env.XUMM_API_SECRET,
  {
    network: process.env.XRPL_NETWORK || 'mainnet' // defaults to mainnet
  }
);

console.log('[DBX BACKEND] ✓ XUMM SDK initialized');

module.exports = Sdk;
