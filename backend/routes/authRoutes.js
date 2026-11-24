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
  getCustomerMe,
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
router.get("/supermarkets", async (req, res) => {
  try {
    const Supermarket = require("../models/Supermarket");
    const supermarkets = await Supermarket.find({
      status: { $in: ["Active", "Trial"] },
    })
      .select("_id name code city state address pincode logoUrl deliveryBannerUrl onlineAvailable offlineAvailable onlineDeliveryAvailable selfPickupAvailable status")
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: supermarkets.length,
      supermarkets: supermarkets.map((s) => ({
        _id: s._id.toString(),
        name: s.name,
        code: s.code,
        city: s.city || "",
        state: s.state || "",
        address: s.address || "",
        pincode: s.pincode || "",
        logoUrl: s.logoUrl || "",
        onlineDeliveryAvailable: s.onlineDeliveryAvailable === true,
        selfPickupAvailable: s.selfPickupAvailable === true,
        onlineAvailable: s.onlineDeliveryAvailable === true || s.selfPickupAvailable === true || s.onlineAvailable === true,
        offlineAvailable: s.selfPickupAvailable === true || s.offlineAvailable === true,
        status: s.status,
      })),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active supermarkets",
      error: err.message,
    });
  }
});
router.post("/customer/register", customerRegister);
router.post("/customer/login", customerLogin);
router.get("/customer/me", authMiddleware, getCustomerMe);
router.put("/customer/profile", authMiddleware, updateCustomerProfile);

module.exports = router;

