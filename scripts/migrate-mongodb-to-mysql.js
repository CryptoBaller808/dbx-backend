/**
 * Database migration script
 * Migrates legacy MongoDB models to Sequelize
 */
const mongoose = require('mongoose');
const db = require('../models');
const config = require('../config');

/**
 * Migrates data from MongoDB to MySQL using Sequelize
 * This script should be run once during the transition period
 */
async function migrateData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Connect to MySQL via Sequelize
    await db.sequelize.authenticate();
    console.log('Connected to MySQL');

    // Migrate Account Offers
    console.log('Migrating Account Offers...');
    const AccountOfferMongo = require('../model/AccountOffers');
    const accountOffers = await AccountOfferMongo.find({});
    
    for (const offer of accountOffers) {
      await db.account_offers.create({
        account: offer.account,
        txId: offer.txId,
        pair: offer.pair,
        offerType: offer.offerType,
        side: offer.side,
        price: offer.price,
        amount: offer.amount,
        date: offer.date,
        createdAt: offer.createdAt,
        updatedAt: offer.updatedAt
      });
    }
    console.log(`Migrated ${accountOffers.length} account offers`);

    // Add more migration steps for other MongoDB models here

    console.log('Migration completed successfully');
    
    // Disconnect from both databases
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateData();
}

module.exports = { migrateData };
