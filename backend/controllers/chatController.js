const mongoose = require("mongoose");
const ChatMessage = require("../models/ChatMessage");
const Supermarket = require("../models/Supermarket");
const User = require("../models/User");

// 1. POST /api/chat/send - Send a private message between Super Admin and a specific Supermarket
exports.sendMessage = async (req, res) => {
  try {
    const { message, supermarketId: requestedStoreId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message content is required.",
      });
    }

    let targetSupermarketId = null;
    let senderRole = req.user?.role;
    let senderName = req.user?.name || "Admin";

    // Strict Tenant Isolation Enforcement:
    if (senderRole === "STORE_ADMIN") {
      // Store Admin can ONLY send messages within their own authenticated supermarket
      targetSupermarketId = req.supermarketId || req.user.supermarket?._id || req.user.supermarket;
    } else if (senderRole === "SUPER_ADMIN") {
      // Super Admin replies to the specific target supermarket
      targetSupermarketId = requestedStoreId;
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Store Admins and Super Admins can participate in chat.",
      });
    }

    if (!targetSupermarketId) {
      return res.status(400).json({
        success: false,
        message: "Supermarket ID could not be identified for this conversation.",
      });
    }

    // Resolve Supermarket details from Database
    const supermarket = await Supermarket.findById(targetSupermarketId);
    if (!supermarket) {
      return res.status(404).json({
        success: false,
        message: "Target supermarket not found in database.",
      });
    }

    // Create Chat Message Record
    const chatMsg = await ChatMessage.create({
      supermarket: supermarket._id,
      supermarketName: supermarket.name,
      supermarketCode: supermarket.code,
      sender: req.user._id,
      senderName: senderRole === "SUPER_ADMIN" ? "GrocerEase Super Admin" : senderName,
      senderRole: senderRole === "SUPER_ADMIN" ? "SUPER_ADMIN" : "STORE_ADMIN",
      message: message.trim(),
      isRead: false,
    });

    // Update supermarket's dynamic chat status
    const newChatStatus = senderRole === "SUPER_ADMIN" ? "Replied" : "Unread";
    supermarket.chatStatus = newChatStatus;
    await supermarket.save().catch(() => {});

    // Real-Time Socket.IO Broadcast
    try {
      const io = req.app.get("io");
      if (io) {
        const payload = {
          _id: chatMsg._id,
          supermarketId: supermarket._id.toString(),
          supermarketName: supermarket.name,
          supermarketCode: supermarket.code,
          senderId: req.user._id.toString(),
          senderName: chatMsg.senderName,
          senderRole: chatMsg.senderRole,
          message: chatMsg.message,
          createdAt: chatMsg.createdAt,
          isRead: chatMsg.isRead,
          chatStatus: newChatStatus,
        };

        // Emit to Store Admin's dedicated tenant room
        io.to(`tenant:${supermarket._id.toString()}`).emit("chat:new_message", payload);
        if (supermarket.code) {
          io.to(`tenant:${supermarket.code.toUpperCase()}`).emit("chat:new_message", payload);
        }

        // Emit to Super Admin central room
        io.to("super_admin").emit("chat:new_message", payload);
      }
    } catch (socketErr) {
      console.warn("Socket broadcast notice:", socketErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      chatMessage: chatMsg,
    });
  } catch (error) {
    console.error("Send chat message error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send chat message.",
      error: error.message,
    });
  }
};

// 2. GET /api/chat/messages - Retrieve private conversation between Super Admin and a specific Supermarket
exports.getMessages = async (req, res) => {
  try {
    let targetStoreId = null;

    if (req.user?.role === "STORE_ADMIN") {
      // Store Admin is strictly scoped to their own supermarket
      targetStoreId = req.supermarketId || req.user.supermarket?._id || req.user.supermarket;
    } else if (req.user?.role === "SUPER_ADMIN") {
      targetStoreId = req.query.supermarketId || req.params.supermarketId;
    } else {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    if (!targetStoreId) {
      return res.status(400).json({
        success: false,
        message: "Supermarket ID is required to fetch chat history.",
      });
    }

    const messages = await ChatMessage.find({ supermarket: targetStoreId })
      .sort({ createdAt: 1 })
      .limit(200);

    return res.status(200).json({
      success: true,
      count: messages.length,
      supermarketId: targetStoreId,
      messages,
    });
  } catch (error) {
    console.error("Get chat messages error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve chat messages.",
      error: error.message,
    });
  }
};

// 3. GET /api/chat/conversations - Super Admin directory of all supermarket chat threads
exports.getSuperAdminConversations = async (req, res) => {
  try {
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Super Admin can view all store conversations.",
      });
    }

    const supermarkets = await Supermarket.find().sort({ name: 1 });

    const conversations = await Promise.all(
      supermarkets.map(async (store) => {
        // Find latest message for this supermarket
        const latestMsg = await ChatMessage.findOne({ supermarket: store._id })
          .sort({ createdAt: -1 });

        // Count unread messages sent by Store Admin
        const unreadCount = await ChatMessage.countDocuments({
          supermarket: store._id,
          senderRole: "STORE_ADMIN",
          isRead: false,
        });

        // Count total messages exchanged in this conversation
        const totalMessages = await ChatMessage.countDocuments({ supermarket: store._id });

        // Dynamic Chat Status computation according to strict platform rules:
        // Status: "New", "Unread", "Replied", "Resolved"
        let computedStatus = store.chatStatus || "New";
        if (unreadCount > 0) {
          computedStatus = totalMessages <= 1 ? "New" : "Unread";
        } else if (store.chatStatus === "Resolved") {
          computedStatus = "Resolved";
        } else if (latestMsg && latestMsg.senderRole === "SUPER_ADMIN") {
          computedStatus = "Replied";
        } else if (totalMessages === 0) {
          computedStatus = "New";
        } else {
          computedStatus = store.chatStatus || "Resolved";
        }

        return {
          supermarketId: store._id,
          supermarketName: store.name,
          supermarketCode: store.code,
          logoUrl: store.logoUrl || "",
          adminName: store.adminName || store.ownerName || "Store Admin",
          adminUsername: store.adminUsername || "",
          email: store.email || "",
          phone: store.phone || "",
          plan: store.plan || "Standard",
          status: store.status || "Active",
          city: store.city || "Bangalore",
          address: store.address || "",
          chatStatus: computedStatus,
          totalMessages,
          latestMessage: latestMsg
            ? {
                text: latestMsg.message,
                createdAt: latestMsg.createdAt,
                senderRole: latestMsg.senderRole,
                senderName: latestMsg.senderName,
              }
            : null,
          unreadCount,
        };
      })
    );

    // Sort by: supermarkets with newest messages first, then alphabetical
    conversations.sort((a, b) => {
      const timeA = a.latestMessage ? new Date(a.latestMessage.createdAt).getTime() : 0;
      const timeB = b.latestMessage ? new Date(b.latestMessage.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return res.status(200).json({
      success: true,
      totalSupermarkets: conversations.length,
      conversations,
    });
  } catch (error) {
    console.error("Get Super Admin conversations error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch supermarket conversations.",
      error: error.message,
    });
  }
};

// 4. PUT /api/chat/status/:supermarketId - Update chat conversation status (New, Unread, Replied, Resolved)
exports.updateChatStatus = async (req, res) => {
  try {
    const { supermarketId } = req.params;
    const { status } = req.body;

    if (!["New", "Unread", "Replied", "Resolved"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat status. Must be New, Unread, Replied, or Resolved.",
      });
    }

    const store = await Supermarket.findByIdAndUpdate(
      supermarketId,
      { chatStatus: status },
      { new: true }
    );

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Supermarket not found.",
      });
    }

    // Broadcast status change via Socket.IO
    try {
      const io = req.app.get("io");
      if (io) {
        io.to("super_admin").emit("chat:status_updated", {
          supermarketId: store._id.toString(),
          chatStatus: status,
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `Chat status updated to ${status}.`,
      supermarketId: store._id,
      chatStatus: status,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update chat status.",
      error: error.message,
    });
  }
};

// 4. PUT /api/chat/read/:supermarketId - Mark conversation messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { supermarketId } = req.params;

    let targetStoreId = null;
    let senderRoleToMarkAsRead = null;

    if (req.user?.role === "STORE_ADMIN") {
      targetStoreId = req.supermarketId || req.user.supermarket?._id || req.user.supermarket;
      // Store Admin marks messages sent by Super Admin as read
      senderRoleToMarkAsRead = "SUPER_ADMIN";
    } else if (req.user?.role === "SUPER_ADMIN") {
      targetStoreId = supermarketId;
      // Super Admin marks messages sent by Store Admin as read
      senderRoleToMarkAsRead = "STORE_ADMIN";
    }

    if (!targetStoreId) {
      return res.status(400).json({ success: false, message: "Supermarket ID is required." });
    }

    await ChatMessage.updateMany(
      {
        supermarket: targetStoreId,
        senderRole: senderRoleToMarkAsRead,
        isRead: false,
      },
      {
        $set: { isRead: true, readAt: new Date() },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Messages marked as read.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark messages as read.",
      error: error.message,
    });
  }
};

