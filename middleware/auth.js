// Mock authentication middleware for testing
const authenticateToken = (req, res, next) => {
  // Mock user for testing
  req.user = { id: 1, email: 'test@example.com', role: 'admin' };
  next();
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole
};

