// check-tables.js
const { Sequelize } = require('sequelize');

// Use your actual DATABASE_URL here if not relying on process.env
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
});

async function listTables() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to the database.');

    const [results] = await sequelize.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name;
    `);

    console.log('📦 Available Tables:');
    results.forEach(row => {
      console.log(`- ${row.table_schema}.${row.table_name}`);
    });
  } catch (error) {
    console.error('❌ Failed to connect or query:', error);
  } finally {
    await sequelize.close();
  }
}

listTables();
