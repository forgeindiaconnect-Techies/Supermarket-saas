const express = require("express");
const router = express.Router();
const {
  checkout,
  approvePayment,
  completePayment,
  updatePaymentStatus,
  confirmCashPayment,
  getOrders,
  getOrderById,
  getAdminStats,
  logCartActivity,
  getCartActivity,
  getReports,
  getNotifications,
  deleteOrder,
  updatePickupStatus,
  updateDeliveryStatus,
  setFulfillmentChoice,
  setPickupReady,
  customerCompletePickup,
  getOrderTracking,
} = require("../controllers/orderController");

// Public/Customer routes
router.post("/checkout", checkout);
router.post("/cart-activity", logCartActivity);
router.get("/cart-activity", getCartActivity);

// Customer Post-Payment Fulfillment Choice (Option A: Doorstep vs Option B: Collect from Store)
router.put("/:id/fulfillment-choice", setFulfillmentChoice);
router.post("/:id/fulfillment-choice", setFulfillmentChoice);

// Customer Complete Button for Store Collection Pickup
router.put("/:id/customer-complete-pickup", customerCompletePickup);
router.post("/:id/customer-complete-pickup", customerCompletePickup);

// Store Admin Pickup Ready Notification Dispatch
router.put("/:id/pickup-ready", setPickupReady);
router.post("/:id/pickup-ready", setPickupReady);

// Super Admin approval & completion workflow routes
router.post("/:id/approve", approvePayment);
router.put("/:id/approve", approvePayment);

router.post("/:id/complete", completePayment);
router.put("/:id/complete", completePayment);

router.patch("/:id/status", updatePaymentStatus);
router.put("/:id/status", updatePaymentStatus);

// Pickup & Delivery Status updates
router.put("/:id/pickup-status", updatePickupStatus);
router.patch("/:id/pickup-status", updatePickupStatus);
router.put("/:id/delivery-status", updateDeliveryStatus);
router.patch("/:id/delivery-status", updateDeliveryStatus);

// Staff confirmation for cash at exit
router.post("/:id/confirm-cash", confirmCashPayment);

// Admin stats
router.get("/stats", getAdminStats);

// Reports Management
router.get("/reports", getReports);

// Dedicated isolated notifications query
router.get("/notifications", getNotifications);

// Orders query & deletion
router.get("/", getOrders);
router.get("/:id/tracking", getOrderTracking);
router.get("/:id", getOrderById);
router.delete("/:id", deleteOrder);

module.exports = router;
