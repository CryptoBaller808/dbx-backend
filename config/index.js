/* eslint-disable global-require */
dotEnv = require('dotenv');
// import dotEnv from "dotenv";
dotEnv.config();
const {credentials} = require('./configHelper.js');
// import { credentials } from "./configHelper.js";

const config = credentials;

module.exports = config;
