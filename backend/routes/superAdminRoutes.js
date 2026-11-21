const express = require("express");
const router = express.Router();
const {
  getAllSupermarkets,
  getSupermarketDetails,
  createSupermarket,
  updateSupermarket,
  deleteSupermarket,
  resetStorePassword,
  getPlatformAnalytics,
  getProductWiseSalesReport,
  getConsolidatedOrders,
  getGlobalCatalog,
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  sendRenewalEmail,
  sendRenewalChat,
  extendSubscription,
  testEmailConnection,
  sendAutomatedPlanEmail,
  getEmailLogs,
  getPlatformNotifications,
  markPlatformNotificationRead,
  markAllPlatformNotificationsRead,
  deletePlatformNotification,
  clearAllPlatformNotifications,
  clearDemoData,
  updateSupermarketAvailability,
  getPlatformSystemSettings,
} = require("../controllers/superAdminController");
const { authMiddleware, requireSuperAdmin } = require("../middleware/authMiddleware");

// Strictly protect all Super Admin routes and APIs against unauthorized access
router.use(authMiddleware);
router.use(requireSuperAdmin);

// 1. Supermarkets Management
router.get("/supermarkets", getAllSupermarkets);
router.get("/supermarkets/:id/details", getSupermarketDetails);
router.post("/supermarkets", createSupermarket);
router.put("/supermarkets/:id", updateSupermarket);
router.put("/supermarkets/:id/availability", updateSupermarketAvailability);
router.delete("/supermarkets/:id", deleteSupermarket);
router.post("/supermarkets/:id/reset-password", resetStorePassword);
router.post("/supermarkets/:id/send-renewal-email", sendRenewalEmail);
router.post("/supermarkets/:id/send-plan-email", sendAutomatedPlanEmail);
router.post("/supermarkets/:id/send-renewal-chat", sendRenewalChat);
router.post("/supermarkets/:id/extend-subscription", extendSubscription);
router.post("/test-email", testEmailConnection);
router.get("/test-email", testEmailConnection);
router.get("/email-logs", getEmailLogs);
router.post("/clear-demo-data", clearDemoData);
router.get("/clear-demo-data", clearDemoData);
router.get("/system-settings", getPlatformSystemSettings);

// 2. Centralized Analytics & Product-Wise Breakdown per Supermarket
router.get("/analytics", getPlatformAnalytics);
router.get("/product-sales", getProductWiseSalesReport);
router.get("/orders", getConsolidatedOrders);
router.get("/catalog", getGlobalCatalog);

// 3. SaaS Subscription Plans Management
router.get("/plans", getSubscriptionPlans);
router.post("/plans", createSubscriptionPlan);
router.put("/plans/:id", updateSubscriptionPlan);
router.delete("/plans/:id", deleteSubscriptionPlan);

// 4. SaaS Platform Notifications (Strictly Platform Management Events Only)
router.get("/notifications", getPlatformNotifications);
router.put("/notifications/mark-all-read", markAllPlatformNotificationsRead);
router.delete("/notifications/clear-all", clearAllPlatformNotifications);
router.put("/notifications/:id/read", markPlatformNotificationRead);
router.delete("/notifications/:id", deletePlatformNotification);

module.exports = router;

