const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getMessages,
  getSuperAdminConversations,
  markAsRead,
  updateChatStatus,
} = require("../controllers/chatController");
const { authMiddleware, requireAuth } = require("../middleware/authMiddleware");

router.use(authMiddleware);
router.use(requireAuth);

// 1. Send private message
router.post("/send", sendMessage);

// 2. Get messages for a supermarket (Store Admin gets their own; Super Admin passes supermarketId)
router.get("/messages", getMessages);
router.get("/messages/:supermarketId", getMessages);

// 3. Super Admin list of all supermarket chat threads
router.get("/conversations", getSuperAdminConversations);

// 4. Mark conversation as read
router.put("/read/:supermarketId", markAsRead);

// 5. Update conversation status (New, Unread, Replied, Resolved)
router.put("/status/:supermarketId", updateChatStatus);

module.exports = router;

