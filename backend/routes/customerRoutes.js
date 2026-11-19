const express = require("express");
const router = express.Router();
const {
  getStoreOfflineCustomers,
  createOfflineCustomer,
  updateCustomerStatus,
  deleteCustomer,
} = require("../controllers/customerController");
const { authMiddleware, requireAuth } = require("../middleware/authMiddleware");

// All routes require authentication and tenant isolation
router.use(authMiddleware);
router.use(requireAuth);

// GET /api/customers - strictly OFFLINE registrations only for Store Admin
router.get("/", getStoreOfflineCustomers);

// POST /api/customers - register new OFFLINE customer
router.post("/", createOfflineCustomer);

// PATCH /api/customers/:id/status - update customer account status
router.patch("/:id/status", updateCustomerStatus);
router.put("/:id/status", updateCustomerStatus);

// DELETE /api/customers/:id - remove offline customer record
router.delete("/:id", deleteCustomer);

module.exports = router;

