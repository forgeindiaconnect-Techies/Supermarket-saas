const mongoose = require("mongoose");

const emailLogSchema = new mongoose.Schema(
  {
    supermarket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supermarket",
      default: null,
      index: true,
    },
    supermarketCode: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    supermarketName: {
      type: String,
      default: "",
      trim: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    templateType: {
      type: String,
      enum: [
        "WELCOME",
        "TRIAL_EXPIRY",
        "EXPIRING_SOON",
        "EXPIRED",
        "RENEWAL_REMINDER",
        "RENEWAL_CONFIRMATION",
        "CUSTOM_NOTICE",
        "ORDER_RECEIPT",
        "TEST_EMAIL",
      ],
      default: "CUSTOM_NOTICE",
      index: true,
    },
    status: {
      type: String,
      enum: ["SENT", "FAILED", "PENDING"],
      default: "PENDING",
      index: true,
    },
    messageId: {
      type: String,
      default: "",
      trim: true,
    },
    smtpResponse: {
      type: String,
      default: "",
    },
    errorMessage: {
      type: String,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

emailLogSchema.index({ recipientEmail: 1, createdAt: -1 });
emailLogSchema.index({ supermarket: 1, createdAt: -1 });

module.exports = mongoose.model("EmailLog", emailLogSchema);
