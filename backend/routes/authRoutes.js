const express = require("express");
const router = express.Router();
const { login, getMe, updateProfile, changePassword } = require("../controllers/authController");
const { authMiddleware, requireAuth } = require("../middleware/authMiddleware");

router.post("/login", login);
router.get("/me", authMiddleware, requireAuth, getMe);
router.put("/profile", authMiddleware, requireAuth, updateProfile);
router.post("/change-password", authMiddleware, requireAuth, changePassword);

module.exports = router;

