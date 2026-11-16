const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    supermarket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supermarket",
      required: true,
      index: true,
    },
    supermarketName: {
      type: String,
      default: "",
    },
    supermarketCode: {
      type: String,
      default: "",
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    senderRole: {
      type: String,
      enum: ["STORE_ADMIN", "SUPER_ADMIN"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    attachments: [
      {
        url: String,
        fileType: String,
        fileName: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

chatMessageSchema.index({ supermarket: 1, createdAt: 1 });
chatMessageSchema.index({ supermarketCode: 1, createdAt: 1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);

