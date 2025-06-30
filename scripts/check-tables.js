// check-tables.js
const { Sequelize } = require('sequelize');

(async () => {
  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
  });

  try {
    await sequelize.authenticate();
    console.log('✅ Connected to DB');

    const [results] = await sequelize.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name;
    `);

    console.log('📦 Tables found:');
    results.forEach(row => {
      console.log(`- ${row.table_schema}.${row.table_name}`);
    });

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error connecting or querying DB:', error);
  }
})();
