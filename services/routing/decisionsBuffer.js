/**
 * In-memory ring buffer for storing recent routing decisions
 * Used by admin monitoring endpoint
 */

const MAX_DECISIONS = 100;
const decisions = [];

/**
 * Add a routing decision to the buffer
 * @param {Object} decision - Routing decision record
 */
function addDecision(decision) {
  const record = {
    ...decision,
    timestamp: new Date().toISOString()
  };
  
  decisions.unshift(record); // Add to front
  
  if (decisions.length > MAX_DECISIONS) {
    decisions.pop(); // Remove oldest
  }
}

/**
 * Get recent routing decisions
 * @param {number} [limit=50] - Maximum number of decisions to return
 * @returns {Array} Recent decisions
 */
function getRecentDecisions(limit = 50) {
  return decisions.slice(0, Math.min(limit, decisions.length));
}

/**
 * Clear all decisions (for testing)
 */
function clearDecisions() {
  decisions.length = 0;
}

module.exports = {
  addDecision,
  getRecentDecisions,
  clearDecisions
};
