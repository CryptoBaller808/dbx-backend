/**
 * Database configuration for Sequelize
 * Supports both DATABASE_URL (Railway/Postgres) and individual env vars (MySQL)
 */
const { Sequelize } = require('sequelize');

const useUrl = !!process.env.DATABASE_URL;
const dialectOptions = {};

if (useUrl) {
  // Railway PG typically requires SSL
  dialectOptions.ssl = { require: true, rejectUnauthorized: false };
  // Honor PGSSLMODE if provided (no-verify → rejectUnauthorized:false)
  if ((process.env.PGSSLMODE || '').toLowerCase() === 'no-verify') {
    dialectOptions.ssl.rejectUnauthorized = false;
  }
}

const logging = process.env.SEQ_LOG_SQL === 'true' ? console.log : false;

const sequelize = useUrl
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions,
      logging,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'mysql',
        dialectOptions,
        logging,
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      }
    );

module.exports = { sequelize };

