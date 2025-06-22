/**
 * Database utility functions
 * Standardized to use Sequelize consistently
 */
const db = require('../models');
const { Op } = db.Sequelize;

/**
 * Generic query builder for Sequelize
 * @param {Object} options - Query options
 * @param {String} options.model - Model name
 * @param {Object} options.where - Where conditions
 * @param {Array} options.include - Relations to include
 * @param {Array} options.attributes - Attributes to select
 * @param {Object} options.order - Order by clause
 * @param {Number} options.limit - Limit results
 * @param {Number} options.offset - Offset for pagination
 * @returns {Promise} - Sequelize query result
 */
const query = async (options) => {
  const { model, where, include, attributes, order, limit, offset, group } = options;
  
  if (!db[model]) {
    throw new Error(`Model ${model} not found`);
  }
  
  const queryOptions = {};
  
  if (where) queryOptions.where = where;
  if (include) queryOptions.include = include;
  if (attributes) queryOptions.attributes = attributes;
  if (order) queryOptions.order = order;
  if (limit) queryOptions.limit = limit;
  if (offset) queryOptions.offset = offset;
  if (group) queryOptions.group = group;
  
  return db[model].findAll(queryOptions);
};

/**
 * Find one record
 * @param {String} model - Model name
 * @param {Object} where - Where conditions
 * @param {Array} include - Relations to include
 * @returns {Promise} - Sequelize query result
 */
const findOne = async (model, where, include) => {
  if (!db[model]) {
    throw new Error(`Model ${model} not found`);
  }
  
  const options = { where };
  if (include) options.include = include;
  
  return db[model].findOne(options);
};

/**
 * Find by primary key
 * @param {String} model - Model name
 * @param {Number|String} id - Primary key
 * @param {Array} include - Relations to include
 * @returns {Promise} - Sequelize query result
 */
const findById = async (model, id, include) => {
  if (!db[model]) {
    throw new Error(`Model ${model} not found`);
  }
  
  const options = {};
  if (include) options.include = include;
  
  return db[model].findByPk(id, options);
};

/**
 * Create a record
 * @param {String} model - Model name
 * @param {Object} data - Data to create
 * @returns {Promise} - Sequelize query result
 */
const create = async (model, data) => {
  if (!db[model]) {
    throw new Error(`Model ${model} not found`);
  }
  
  return db[model].create(data);
};

/**
 * Update a record
 * @param {String} model - Model name
 * @param {Object} data - Data to update
 * @param {Object} where - Where conditions
 * @returns {Promise} - Sequelize query result
 */
const update = async (model, data, where) => {
  if (!db[model]) {
    throw new Error(`Model ${model} not found`);
  }
  
  return db[model].update(data, { where });
};

/**
 * Delete a record
 * @param {String} model - Model name
 * @param {Object} where - Where conditions
 * @returns {Promise} - Sequelize query result
 */
const destroy = async (model, where) => {
  if (!db[model]) {
    throw new Error(`Model ${model} not found`);
  }
  
  return db[model].destroy({ where });
};

/**
 * Count records
 * @param {String} model - Model name
 * @param {Object} where - Where conditions
 * @returns {Promise} - Sequelize query result
 */
const count = async (model, where) => {
  if (!db[model]) {
    throw new Error(`Model ${model} not found`);
  }
  
  return db[model].count({ where });
};

/**
 * Execute raw SQL query
 * @param {String} sql - SQL query
 * @param {Object} replacements - Query replacements
 * @param {String} type - Query type (SELECT, INSERT, etc.)
 * @returns {Promise} - Sequelize query result
 */
const rawQuery = async (sql, replacements, type = 'SELECT') => {
  return db.sequelize.query(sql, {
    replacements,
    type: db.Sequelize.QueryTypes[type],
    raw: true
  });
};

/**
 * Begin a transaction
 * @returns {Promise} - Sequelize transaction
 */
const beginTransaction = async () => {
  return db.sequelize.transaction();
};

module.exports = {
  query,
  findOne,
  findById,
  create,
  update,
  destroy,
  count,
  rawQuery,
  beginTransaction,
  Op
};
