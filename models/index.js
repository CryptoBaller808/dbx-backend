/**
 * Enhanced Database configuration utility
 * Implements security hardening, connection pooling,
 * and performance optimization for DBX Platform
 */
const { Sequelize, DataTypes } = require("sequelize");
const { databaseManager, config } = require("../data/databaseManager");

// Initialize enhanced database manager
let sequelize;

const initializeDatabase = async () => {
  try {
    // Initialize database manager with enhanced configuration
    await databaseManager.initialize();
    
    // Get primary connection
    sequelize = databaseManager.primaryConnection;
    
    // Create database indexes for optimization
    await databaseManager.createIndexes();
    
    console.log('[Models] Enhanced database initialization completed');
    return sequelize;
  } catch (error) {
    console.error('[Models] Database initialization failed:', error);
    throw error;
  }
};

// Initialize database object
const db = {};

// Assign Sequelize instances
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models
db.users = require("./consolidated/userModel")(sequelize, DataTypes);
db.roles = require("./consolidated/roleModel")(sequelize, DataTypes);
db.categories = require("./consolidated/categoriesModel")(sequelize, DataTypes);
db.collections = require("./consolidated/collectionsModel")(sequelize, DataTypes);
db.items = require("./consolidated/itemModel")(sequelize, DataTypes);
db.item_properties = require("./consolidated/itemPropertiesModel")(sequelize, DataTypes);
db.item_sale_info = require("./consolidated/itemSaleInfoModel")(sequelize, DataTypes);
db.item_bids = require("./consolidated/itemBidsModel")(sequelize, DataTypes);
db.wishlist = require("./consolidated/wishlistModel")(sequelize, DataTypes);
db.calcol = require("./consolidated/calcolModel")(sequelize, DataTypes);
db.item_activity = require("./consolidated/itemActivityModel")(sequelize, DataTypes);
db.currency_list = require("./consolidated/currenciesModel")(sequelize, DataTypes);

// Enhanced NF// Import NFT models
db.nfts = require('./NFT')(sequelize, Sequelize);
db.nft_collections = require('./NFTCollection')(sequelize, Sequelize);
db.nft_auctions = require('./NFTAuction')(sequelize, Sequelize);
db.nft_bids = require('./NFTBid')(sequelize, Sequelize);
db.nft_transactions = require('./NFTTransaction')(sequelize, Sequelize);
db.nft_royalties = require('./NFTRoyalty')(sequelize, Sequelize);
db.nft_bridge_transactions = require('./NFTBridgeTransaction')(sequelize, Sequelize);
db.creator_verifications = require('./CreatorVerification')(sequelize, Sequelize);
db.user_mfa = require("./UserMFA")(sequelize, DataTypes);
db.audit_logs = require("./AuditLog")(sequelize, DataTypes);
db.blockchain_list = require("./consolidated/blockchainModel")(sequelize, DataTypes);
db.settings = require("./consolidated/bannerModel")(sequelize, DataTypes);
db.transactions = require("./consolidated/transactionsModel")(sequelize, DataTypes);
db.account_offers = require("./consolidated/accountOffers")(sequelize, DataTypes);
db.user_mfa = require("./UserMFA")(sequelize, DataTypes);

// Define relationships
db.collections.hasMany(db.items, {
  as: "collection_items_count",
  foreignKey: "collection_id",
});

db.items.belongsTo(db.collections, {
  as: "item_collection",
  foreignKey: "collection_id",
});

db.items.hasOne(db.item_sale_info, {
  as: "item_sale_info",
  foreignKey: "item_id",
});

db.items.hasOne(db.item_sale_info, { 
  as: "hot_bids", 
  foreignKey: "item_id" 
});

db.items.hasOne(db.item_sale_info, {
  as: "live_auctions",
  foreignKey: "item_id",
});

db.items.hasOne(db.item_sale_info, { 
  as: "explore", 
  foreignKey: "item_id" 
});

db.item_sale_info.belongsTo(db.items, {
  as: "item_detail",
  foreignKey: "item_id",
});

db.items.hasMany(db.item_bids, { 
  as: "item_bids", 
  foreignKey: "item_id" 
});

db.item_bids.belongsTo(db.items, { 
  as: "item_detail", 
  foreignKey: "item_id" 
});

db.items.hasMany(db.item_activity, {
  as: "item_activity",
  foreignKey: "item_id",
});

db.item_activity.belongsTo(db.items, {
  as: "item_detail",
  foreignKey: "item_id",
});

db.items.hasMany(db.item_properties, {
  as: "item_properties_details",
  foreignKey: "item_id",
});

db.item_properties.belongsTo(db.items, { 
  as: "item", 
  foreignKey: "id" 
});

db.users.hasMany(db.item_activity, { 
  as: "buyerB", 
  foreignKey: "buyer" 
});

db.item_activity.belongsTo(db.users, {
  as: "buyer_details",
  foreignKey: "buyer",
  sourceKey: "id",
});

db.item_activity.belongsTo(db.users, {
  as: "seller_details",
  foreignKey: "seller",
  sourceKey: "id",
});

db.categories.hasMany(db.collections, {
  as: "category_detailM",
  foreignKey: "category_id",
});

db.collections.belongsTo(db.categories, {
  as: "category_details",
  foreignKey: "category_id",
});

db.users.hasMany(db.collections, {
  as: "creator_details",
  foreignKey: "user_id",
});

db.collections.belongsTo(db.users, {
  as: "creator_details",
  foreignKey: "user_id",
});

db.users.hasMany(db.items, { 
  as: "creator", 
  foreignKey: "user_id" 
});

db.items.belongsTo(db.users, { 
  as: "creator", 
  foreignKey: "user_id" 
});

db.users.hasMany(db.items, {
  as: "current_owner_details",
  foreignKey: "current_owner_id",
});

db.items.belongsTo(db.users, {
  as: "current_owner_details",
  foreignKey: "current_owner_id",
});

db.items.hasMany(db.wishlist, { 
  as: "wishlist_count", 
  foreignKey: "item_id" 
});

db.wishlist.belongsTo(db.items, { 
  as: "wishlistM", 
  foreignKey: "item_id" 
});

// Enhanced NFT Marketplace Relationships

// NFT Collection Relationships
db.users.hasMany(db.nft_collections, {
  as: "created_collections",
  foreignKey: "creator_id",
});

db.nft_collections.belongsTo(db.users, {
  as: "creator",
  foreignKey: "creator_id",
});

db.categories.hasMany(db.nft_collections, {
  as: "nft_collections",
  foreignKey: "category_id",
});

db.nft_collections.belongsTo(db.categories, {
  as: "category",
  foreignKey: "category_id",
});

// NFT Relationships
db.nft_collections.hasMany(db.nfts, {
  as: "nfts",
  foreignKey: "collection_id",
});

db.nfts.belongsTo(db.nft_collections, {
  as: "collection",
  foreignKey: "collection_id",
});

db.users.hasMany(db.nfts, {
  as: "created_nfts",
  foreignKey: "creator_id",
});

db.nfts.belongsTo(db.users, {
  as: "creator",
  foreignKey: "creator_id",
});

db.users.hasMany(db.nfts, {
  as: "owned_nfts",
  foreignKey: "current_owner_id",
});

db.nfts.belongsTo(db.users, {
  as: "current_owner",
  foreignKey: "current_owner_id",
});

// NFT Auction Relationships
db.nfts.hasMany(db.nft_auctions, {
  as: "auctions",
  foreignKey: "nft_id",
});

db.nft_auctions.belongsTo(db.nfts, {
  as: "nft",
  foreignKey: "nft_id",
});

db.users.hasMany(db.nft_auctions, {
  as: "selling_auctions",
  foreignKey: "seller_id",
});

db.nft_auctions.belongsTo(db.users, {
  as: "seller",
  foreignKey: "seller_id",
});

db.users.hasMany(db.nft_auctions, {
  as: "winning_auctions",
  foreignKey: "highest_bidder_id",
});

db.nft_auctions.belongsTo(db.users, {
  as: "highest_bidder",
  foreignKey: "highest_bidder_id",
});

db.users.hasMany(db.nft_auctions, {
  as: "bought_auctions",
  foreignKey: "buyer_id",
});

db.nft_auctions.belongsTo(db.users, {
  as: "buyer",
  foreignKey: "buyer_id",
});

// NFT Bid Relationships
db.nft_auctions.hasMany(db.nft_bids, {
  as: "bids",
  foreignKey: "auction_id",
});

db.nft_bids.belongsTo(db.nft_auctions, {
  as: "auction",
  foreignKey: "auction_id",
});

db.users.hasMany(db.nft_bids, {
  as: "placed_bids",
  foreignKey: "bidder_id",
});

db.nft_bids.belongsTo(db.users, {
  as: "bidder",
  foreignKey: "bidder_id",
});

// NFT Transaction Relationships
db.nfts.hasMany(db.nft_transactions, {
  as: "transactions",
  foreignKey: "nft_id",
});

db.nft_transactions.belongsTo(db.nfts, {
  as: "nft",
  foreignKey: "nft_id",
});

db.users.hasMany(db.nft_transactions, {
  as: "sent_transactions",
  foreignKey: "from_user_id",
});

db.nft_transactions.belongsTo(db.users, {
  as: "from_user",
  foreignKey: "from_user_id",
});

db.users.hasMany(db.nft_transactions, {
  as: "received_transactions",
  foreignKey: "to_user_id",
});

db.nft_transactions.belongsTo(db.users, {
  as: "to_user",
  foreignKey: "to_user_id",
});

db.nft_auctions.hasMany(db.nft_transactions, {
  as: "transactions",
  foreignKey: "auction_id",
});

db.nft_transactions.belongsTo(db.nft_auctions, {
  as: "auction",
  foreignKey: "auction_id",
});

// NFT Royalty Relationships
db.nfts.hasMany(db.nft_royalties, {
  as: "royalties",
  foreignKey: "nft_id",
});

db.nft_royalties.belongsTo(db.nfts, {
  as: "nft",
  foreignKey: "nft_id",
});

db.nft_collections.hasMany(db.nft_royalties, {
  as: "royalties",
  foreignKey: "collection_id",
});

db.nft_royalties.belongsTo(db.nft_collections, {
  as: "collection",
  foreignKey: "collection_id",
});

db.nft_transactions.hasMany(db.nft_royalties, {
  as: "royalties",
  foreignKey: "transaction_id",
});

db.nft_royalties.belongsTo(db.nft_transactions, {
  as: "transaction",
  foreignKey: "transaction_id",
});

db.users.hasMany(db.nft_royalties, {
  as: "received_royalties",
  foreignKey: "recipient_id",
});

db.nft_royalties.belongsTo(db.users, {
  as: "recipient",
  foreignKey: "recipient_id",
});

// NFT Bridge Transaction Relationships
db.nfts.hasMany(db.nft_bridge_transactions, {
  as: "bridge_transactions_as_original",
  foreignKey: "original_nft_id",
});

db.nft_bridge_transactions.belongsTo(db.nfts, {
  as: "original_nft",
  foreignKey: "original_nft_id",
});

db.nfts.hasMany(db.nft_bridge_transactions, {
  as: "bridge_transactions_as_destination",
  foreignKey: "destination_nft_id",
});

db.nft_bridge_transactions.belongsTo(db.nfts, {
  as: "destination_nft",
  foreignKey: "destination_nft_id",
});

db.users.hasMany(db.nft_bridge_transactions, {
  as: "bridge_transactions",
  foreignKey: "user_id",
});

db.nft_bridge_transactions.belongsTo(db.users, {
  as: "user",
  foreignKey: "user_id",
});

// MFA relationships
db.users.hasOne(db.user_mfa, {
  as: "mfa_settings",
  foreignKey: "userId",
});

db.user_mfa.belongsTo(db.users, {
  as: "user",
  foreignKey: "userId",
});

// Audit Log relationships
db.users.hasMany(db.audit_logs, {
  as: "audit_logs",
  foreignKey: "user_id",
});

db.audit_logs.belongsTo(db.users, {
  as: "user",
  foreignKey: "user_id",
});

// Creator Verification Relationships
db.users.hasMany(db.creator_verifications, {
  as: "verification_requests",
  foreignKey: "creator_id",
});

db.creator_verifications.belongsTo(db.users, {
  as: "creator",
  foreignKey: "creator_id",
});

db.users.hasMany(db.creator_verifications, {
  as: "reviewed_verifications",
  foreignKey: "reviewed_by",
});

db.creator_verifications.belongsTo(db.users, {
  as: "reviewer",
  foreignKey: "reviewed_by",
});

// Enhanced database initialization and synchronization
const initializeModels = async () => {
  try {
    // Initialize enhanced database manager
    await initializeDatabase();
    
    // Update sequelize reference after initialization
    db.sequelize = sequelize;
    
    // Sync database with models (don't force recreate tables)
    await db.sequelize.sync({ force: false });
    console.log("[Models] Database synchronized successfully with enhanced configuration");
    
    // Optimize database tables
    await databaseManager.optimizeTables();
    
    return db;
  } catch (error) {
    console.error("[Models] Database initialization failed:", error);
    throw error;
  }
};

// Export database manager and enhanced configuration
db.databaseManager = databaseManager;
db.config = config;
db.initializeModels = initializeModels;
db.initializeDatabase = initializeDatabase;

module.exports = db;
