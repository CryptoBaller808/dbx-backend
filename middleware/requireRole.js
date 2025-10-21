// middleware/requireRole.js

module.exports = function requireRole(roles) {
  return (req, res, next) => {
    console.warn('⚠️ requireRole middleware is temporarily bypassed. Allowed roles:', roles);
    // Temporarily allow all roles to proceed during debugging
    next();
  };
};

