require('dotenv').config();
const { XummSdk } = require("xumm-sdk");
// import { XummSdk } from "xumm-sdk";
config = require("../config");
// import config from "../config/index.js";

const Sdk = new XummSdk(
  process.env.XUMM_API_KEY,
  process.env.XUMM_API_SECRET,
  {
    network: process.env.XRPL_NETWORK || 'mainnet' // defaults to mainnet
  }
);

module.exports = Sdk;
