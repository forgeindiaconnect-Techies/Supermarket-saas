const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");
const { requireCustomerAuth } = require("../middleware/authMiddleware");

// All cart endpoints strictly require authenticated customer session
router.use(requireCustomerAuth);

router.get("/", cartController.getCart);
router.post("/add", cartController.addToCart);
router.put("/update-quantity", cartController.updateQuantity);
router.delete("/items/:productId", cartController.removeFromCart);
router.delete("/clear", cartController.clearCart);
router.post("/sync", cartController.syncCart);

module.exports = router;

