const mongoose = require("mongoose");

const platformNotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "NEW_REGISTRATION",
        "TRIAL_EXPIRING",
        "TRIAL_EXPIRED",
        "EMAIL_SENT",
        "SUBSCRIPTION_RENEWED",
        "PASSWORD_CHANGED",
        "ADMIN_PASSWORD_UPDATED",
      ],
      required: true,
    },
    supermarket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supermarket",
      default: null,
    },
    supermarketName: {
      type: String,
      default: "",
    },
    supermarketCode: {
      type: String,
      default: "",
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      enum: ["green", "orange", "red", "blue"],
      default: "green",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    actionUrl: {
      type: String,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

platformNotificationSchema.index({ createdAt: -1 });
platformNotificationSchema.index({ isRead: 1 });
platformNotificationSchema.index({ type: 1 });

module.exports = mongoose.model("PlatformNotification", platformNotificationSchema);

