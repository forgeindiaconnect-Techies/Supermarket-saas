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

    // A. Resolve Customer Token (role === "CUSTOMER")
    if (decoded.role === "CUSTOMER") {
      const Customer = require("../models/Customer");
      const customer = await Customer.findById(decoded.id).select("-password").populate("supermarket");

      if (customer && customer.status === "Active") {
        req.user = {
          _id: customer._id,
          id: customer._id.toString(),
          customerId: customer.customerId || `CUST-ONL-${customer.phone.slice(-4)}`,
          name: customer.name,
          phone: customer.phone,
          email: customer.email || "",
          address: customer.address || "",
          role: "CUSTOMER",
          registrationType: customer.registrationType || "ONLINE",
          supermarket: customer.supermarket,
          supermarketId: customer.supermarket ? customer.supermarket._id.toString() : (customer.supermarket || null),
          supermarketCode: customer.supermarketCode || "",
          supermarketName: customer.supermarketName || "",
          status: customer.status,
        };
        req.customer = customer;
        req.isCustomer = true;
        if (customer.supermarket) {
          req.supermarketId = customer.supermarket._id ? customer.supermarket._id.toString() : customer.supermarket.toString();
          req.supermarket = customer.supermarket;
          req.supermarketCode = customer.supermarketCode;
        }
      }
      return next();
    }

    // B. Resolve Staff & Admin Token (User collection)
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

// Require authenticated customer strictly
function requireCustomerAuth(req, res, next) {
  if (!req.user || req.user.role !== "CUSTOMER") {
    return res.status(401).json({
      success: false,
      message: "Customer authentication required. Please sign in.",
    });
  }
  next();
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
  requireCustomerAuth,
  requireSuperAdmin,
  requireStoreAdminOrSuperAdmin,
  JWT_SECRET,
};

