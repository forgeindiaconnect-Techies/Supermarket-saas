const mongoose = require("mongoose");

const platformNotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    badge: {
      type: String,
      default: "",
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "NEW_REGISTRATION",
        "SUPERMARKET_CREATED",
        "SUPERMARKET_DEACTIVATED",
        "SUPERMARKET_STATUS_CHANGED",
        "TRIAL_EXPIRING",
        "TRIAL_EXPIRED",
        "TRIAL_COMPLETED",
        "EMAIL_SENT",
        "SUBSCRIPTION_RENEWED",
        "PASSWORD_CHANGED",
        "ADMIN_PASSWORD_UPDATED",
      ],
      required: true,
    },
    activityType: {
      type: String,
      enum: ["ONLINE_DELIVERY", "STORE_PICKUP", "IN_STORE", "SYSTEM"],
      default: "SYSTEM",
      index: true,
    },
    supermarket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supermarket",
      default: null,
      index: true,
    },
    supermarketName: {
      type: String,
      default: "",
      trim: true,
    },
    supermarketCode: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    customerName: {
      type: String,
      default: "",
      trim: true,
    },
    customerPhone: {
      type: String,
      default: "",
      trim: true,
    },
    productName: {
      type: String,
      default: "",
      trim: true,
    },
    productQuantity: {
      type: Number,
      default: 0,
    },
    amount: {
      type: Number,
      default: 0,
    },
    orderId: {
      type: String,
      default: "",
      trim: true,
    },
    orderNumber: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      enum: ["green", "orange", "red", "blue", "purple", "teal"],
      default: "green",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    actionUrl: {
      type: String,
      default: "",
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
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
platformNotificationSchema.index({ activityType: 1 });
platformNotificationSchema.index({ supermarket: 1, createdAt: -1 });

module.exports = mongoose.model("PlatformNotification", platformNotificationSchema);

