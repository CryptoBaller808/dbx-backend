dotEnv = require('dotenv');
// import dotEnv from "dotenv";

dotEnv.config();

 const credentials = () => {
  const { XUMM_API_KEY, XUMM_API_SECRET, MONGO_URI, ENV_TYPE } = process.env;
  return {
    XUMM_API_KEY,
    XUMM_API_SECRET,
    // MONGO_URI,
    ENV_TYPE,
  };
};
module.exports = credentials();
