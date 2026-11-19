const express = require("express");
const router = express.Router();
const {
  login,
  getMe,
  updateProfile,
  changePassword,
  getSupermarketAvailability,
  customerRegister,
  customerLogin,
  updateCustomerProfile,
  deliveryLogin,
} = require("../controllers/authController");
const { authMiddleware, requireAuth } = require("../middleware/authMiddleware");

// Staff & Admin Auth
router.post("/login", login);
router.post("/delivery-login", deliveryLogin);
router.get("/me", authMiddleware, requireAuth, getMe);
router.get("/supermarket/availability", authMiddleware, requireAuth, getSupermarketAvailability);
router.put("/profile", authMiddleware, requireAuth, updateProfile);
router.post("/change-password", authMiddleware, requireAuth, changePassword);

// Customer Mobile App Auth & Supermarket Onboarding
router.post("/customer/register", customerRegister);
router.post("/customer/login", customerLogin);
router.put("/customer/profile", updateCustomerProfile);

module.exports = router;

