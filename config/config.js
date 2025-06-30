// config/config.js

require('dotenv').config(); // Load environment variables from .env

module.exports = {
  development: {
    username: 'root',
    password: 'password',
    database: 'stellar',
    host: '127.0.0.1',
    dialect: 'mysql'
  },
  test: {
    username: 'root',
    password: 'password',
    database: 'stellar_test',
    host: '127.0.0.1',
    dialect: 'mysql'
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
};
