const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Supermarket = require("../models/Supermarket");

const JWT_SECRET = process.env.JWT_SECRET || "grocerease_multitenant_saas_secret_2026";

// Extract user from token
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(); // Guest or unauthenticated request
    }

    const token = authHeader.split(" ")[1];
    if (!token || token.startsWith("mock_")) {
      return next(); // Reject all mock/forged tokens
    }

    // Strictly verify JWT signature
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) {
      return next();
    }

    const user = await User.findById(decoded.id).select("-password").populate("supermarket");

    if (user && user.status === "Active") {
      // Validate that token role matches current database role to prevent role escalation
      if (decoded.role && user.role !== decoded.role) {
        return next();
      }

      req.user = user;
      if (user.supermarket) {
        req.supermarketId = user.supermarket._id.toString();
        req.supermarket = user.supermarket;
        req.supermarketCode = user.supermarket.code;
      }
    }

    next();
  } catch (error) {
    // If token is invalid or expired, request remains unauthenticated
    next();
  }
}

// Require authenticated user
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }
  next();
}

// Require Super Admin strictly
function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Access denied. Authentication required. Please log in as Super Admin.",
    });
  }
  if (req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Super Admin privileges required. Supermarket Admins are not authorized to access this dashboard or API.",
    });
  }
  next();
}

// Require Store Admin or Super Admin
function requireStoreAdminOrSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }
  if (req.user.role !== "SUPER_ADMIN" && req.user.role !== "STORE_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Store Admin or Super Admin privileges required.",
    });
  }
  next();
}

module.exports = {
  authMiddleware,
  requireAuth,
  requireSuperAdmin,
  requireStoreAdminOrSuperAdmin,
  JWT_SECRET,
};

