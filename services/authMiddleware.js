require('dotenv').config()
const { DATE } = require('sequelize')
const db = require("../models");  // Use models instead of util/database
const jwt = require('jsonwebtoken')
const User = db.User;  // Use capitalized User model
const { user_mfa } = require('../models');

//  11. Login User
const loginUser = async (req, res) => {
    // authenticate user
    const username = req.body.username
    const user = {name: username}
    const accessToken = jwt.sign(user, process.env.JWT_SECRET, {expiresIn: '24h'})
    res.json({access_token: accessToken})
}

// Enhanced authentication middleware with MFA support
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
  
    if (authHeader) {
        const token = authHeader && authHeader.split(' ')[1];
  
        if (token == null) return res.sendStatus(401);
  
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) return res.send(err);

            console.log("From AUTH", user);
  
        if (user.wallet) {
          // If the user has a wallet, check token against wallet
          if (user.walletToken === token) {
            req.user = user;
            return next();
          }
        }

        // If the token doesn't match the wallet or the user doesn't have a wallet, fall back to email authentication
        try {
            User.findOne({ where: { email: user.email } })
              .then((foundUser) => {
                if (foundUser) {
                  req.user = foundUser;
                  return next();
                } else {
                  return res.send("No user found.");
                }
              })
              .catch((err) => {
                console.error(err);
                return res.send("Error occurred while querying the database.");
              });
          } catch (err) {
            console.error(err);
            return res.send("Error occurred while querying the database.");
          }
          
      });
    } else {
      res.send("Please provide an access token.");
    }
}

// MFA-required middleware for sensitive operations
const requireMFA = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        // Check if user has MFA enabled
        const userMFA = await user_mfa.findOne({
            where: { userId: req.user.id }
        });

        if (!userMFA || !userMFA.isEnabled) {
            // MFA not enabled - allow access but recommend enabling
            req.mfaStatus = { enabled: false, required: false };
            return next();
        }

        // Check for MFA token in headers
        const mfaToken = req.headers['x-mfa-token'];
        
        if (!mfaToken) {
            return res.status(403).json({
                error: 'MFA verification required for this operation',
                code: 'MFA_REQUIRED',
                mfaEnabled: true
            });
        }

        // Verify MFA token (this would typically call the MFA service)
        // For now, we'll add a placeholder that can be implemented
        req.mfaStatus = { enabled: true, verified: true };
        next();

    } catch (error) {
        console.error('MFA middleware error:', error);
        return res.status(500).json({
            error: 'Authentication error',
            code: 'AUTH_ERROR'
        });
    }
};

module.exports = {
    authenticateToken,
    loginUser,
    requireMFA
}