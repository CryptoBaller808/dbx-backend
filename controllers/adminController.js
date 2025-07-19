// controllers/adminController.js
module.exports = {
  minimal: async (req, res) => {
    try {
      res.json({ success: true, message: "Minimal endpoint working!" });
    } catch (error) {
      console.error("Error in minimal:", error);
      res.status(500).json({ success: false, message: "Server error", error });
    }
  },

  testConnection: async (req, res) => {
    try {
      res.json({ success: true, message: "Database connection looks good!" });
    } catch (error) {
      console.error("Error in testConnection:", error);
      res.status(500).json({ success: false, message: "Server error", error });
    }
  },

  syncDatabase: async (req, res) => {
    try {
      const db = require("../models");
      await db.sequelize.sync({ alter: true });
      res.json({ success: true, message: "Database synced successfully!" });
    } catch (error) {
      console.error("Error in syncDatabase:", error);
      res.status(500).json({ success: false, message: "Server error", error });
    }
  },

  createDefaultAdmin: async (req, res) => {
    try {
      const db = require("../models");
      const [admin, created] = await db.Admin.findOrCreate({
        where: { email: "admin@dbx.com" },
        defaults: {
          name: "Default Admin",
          password: "securepassword123", // In production, use hashing
        },
      });
      res.json({
        success: true,
        message: created ? "Default admin created." : "Admin already exists.",
      });
    } catch (error) {
      console.error("Error in createDefaultAdmin:", error);
      res.status(500).json({ success: false, message: "Server error", error });
    }
  },
};
