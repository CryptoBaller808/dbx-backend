/**
 * executionController.js
 * Stage 7.1: Execution Configuration Controller
 * 
 * Provides frontend with execution configuration
 */

const executionConfig = require('../config/executionConfig');

/**
 * GET /api/execution/config
 * Returns current execution configuration for frontend
 */
exports.getConfig = async (req, res) => {
  try {
    const config = executionConfig.getConfig();
    
    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('[ExecutionController] Get config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get execution configuration',
      error: error.message
    });
  }
};
