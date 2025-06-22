// Mock authentication middleware for testing
const authenticateToken = (req, res, next) => {
  // Mock user for testing
  req.user = { id: 1, email: 'test@example.com' };
  next();
};

module.exports = {
  authenticateToken
};

