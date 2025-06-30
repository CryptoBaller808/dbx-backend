require('dotenv').config(); // Make sure dotenv is loaded

module.exports = {
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  },
  development: {
    // optional: still support local dev if needed
    username: 'root',
    password: 'password',
    database: 'stellar',
    host: '127.0.0.1',
    dialect: 'mysql'
  }
};
