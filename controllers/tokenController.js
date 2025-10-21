const db = require('../models');

// Get All Tokens
exports.getAllTokens = async (req, res) => {
  try {
    const tokens = await db.Token.findAll({ where: { status: true } });
    res.status(200).json({ success: true, data: tokens });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

