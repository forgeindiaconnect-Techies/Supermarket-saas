const express = require("express");
const router = express.Router();
const {
  getDeliveryProfile,
  getDeliveryOrders,
  updateDeliveryOrderStatus,
  getDeliveryAnalytics,
  getDeliveryStaff,
  createDeliveryStaff,
  updateDeliveryStaff,
  toggleDeliveryStaffStatus,
  assignOrderToStaff,
} = require("../controllers/deliveryController");
const { authMiddleware, requireAuth } = require("../middleware/authMiddleware");

// Middleware to ensure user is an authorized delivery or store admin personnel
const requireDeliveryOrStoreAdmin = (req, res, next) => {
  const allowedRoles = ["DELIVERY_STAFF", "DELIVERY_ADMIN", "STORE_ADMIN", "ADMIN", "SUPER_ADMIN"];
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Delivery Dashboard or Store Admin authorization required.",
    });
  }
  next();
};

router.use(authMiddleware, requireAuth, requireDeliveryOrStoreAdmin);

// Dedicated Delivery Dashboard Routes
router.get("/profile", getDeliveryProfile);
router.get("/orders", getDeliveryOrders);
router.put("/orders/:id/status", updateDeliveryOrderStatus);
router.post("/orders/:id/assign", assignOrderToStaff);
router.get("/analytics", getDeliveryAnalytics);

// Store Admin Delivery Staff Management Routes
router.get("/staff", getDeliveryStaff);
router.post("/staff", createDeliveryStaff);
router.put("/staff/:id", updateDeliveryStaff);
router.put("/staff/:id/status", toggleDeliveryStaffStatus);

module.exports = router;

