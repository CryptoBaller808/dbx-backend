const db = require('../models');
const { Op } = require('sequelize');

// Get All Exchange Pairs
exports.getAllPairs = async (req, res) => {
  try {
    const pairs = await db.ExchangePair.findAll({ where: { status: true } });
    res.status(200).json({ success: true, data: pairs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

