const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: false,
  },
  name: { type: String, required: true },
  brand: { type: String, default: "" },
  category: { type: String, default: "" },
  barcode: { type: String, default: "" },
  imageUrl: { type: String, default: "" },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    items: [orderItemSchema],
    totalItems: {
      type: Number,
      required: true,
      min: 1,
    },
    subtotalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["UPI", "Card", "Cash", "Razorpay"],
      default: "UPI",
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Approved", "Completed", "Failed", "Network Error"],
      default: "Pending",
    },
    failureReason: {
      type: String,
      default: "",
    },
    approvedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    inventoryDeducted: {
      type: Boolean,
      default: false,
    },
    paymentId: {
      type: String,
      default: "",
    },
    customer: {
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        default: null,
      },
      name: { type: String, default: "Guest Shopper" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      address: { type: String, default: "" },
    },
    exitBarcode: {
      type: String,
      required: true,
    },
    purchaseMode: {
      type: String,
      enum: ["ONLINE", "OFFLINE"],
      default: "OFFLINE",
      index: true,
    },
    orderType: {
      type: String,
      enum: [
        "DELIVERY",
        "SELF_PICKUP",
        "ONLINE_DELIVERY",
        "SELF_PICKUP_DOORSTEP",
        "SELF_PICKUP_STORE_COLLECTION",
        "IN_STORE",
        "OFFLINE",
      ],
      default: "IN_STORE",
      index: true,
    },
    fulfillmentChoice: {
      type: String,
      enum: ["DOORSTEP_DELIVERY", "STORE_COLLECTION", "PENDING_SELECTION", ""],
      default: "",
    },
    pickupDate: {
      type: String,
      default: "",
      trim: true,
    },
    pickupTimeSlot: {
      type: String,
      default: "",
      trim: true,
    },
    estimatedReadyTime: {
      type: String,
      default: "",
      trim: true,
    },
    estimatedReadyDate: {
      type: String,
      default: "",
      trim: true,
    },
    pickupInstructions: {
      type: String,
      default: "",
      trim: true,
    },
    pickupReadyNotificationSent: {
      type: Boolean,
      default: false,
    },
    customerPickupConfirmed: {
      type: Boolean,
      default: false,
    },
    customerPickupCompletedAt: {
      type: Date,
    },
    pickupStatus: {
      type: String,
      enum: ["New", "Pending", "Preparing", "ReadyForPickup", "Completed", "Cancelled", ""],
      default: "",
      index: true,
    },
    deliveryStatus: {
      type: String,
      enum: [
        "New",
        "Pending",
        "Order Confirmed",
        "Preparing",
        "Assigned",
        "Accepted",
        "OrderPickedUp",
        "Products Collected",
        "OutForDelivery",
        "Out for Delivery",
        "Delivered",
        "Failed Delivery",
        "Cancelled",
        "",
      ],
      default: "",
      index: true,
    },
    orderConfirmedAt: {
      type: Date,
      default: Date.now,
    },
    preparingAt: {
      type: Date,
    },
    assignedAt: {
      type: Date,
    },
    pickedUpAt: {
      type: Date,
    },
    productsCollectedAt: {
      type: Date,
    },
    failedDeliveryAt: {
      type: Date,
    },
    failedReason: {
      type: String,
      default: "",
    },
    estimatedDeliveryTime: {
      type: String,
      default: "",
      trim: true,
    },
    estimatedDeliveryDate: {
      type: String,
      default: "",
      trim: true,
    },
    trackingTimeline: [
      {
        status: { type: String, default: "" },
        stage: { type: String, default: "" },
        title: { type: String, default: "" },
        description: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now },
        updatedBy: { type: String, default: "" },
        updatedById: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        role: { type: String, default: "" },
      },
    ],
    deliveryAddress: {
      type: String,
      default: "",
      trim: true,
    },
    deliveryPhone: {
      type: String,
      default: "",
      trim: true,
    },
    deliveryCustomerName: {
      type: String,
      default: "",
      trim: true,
    },
    deliveryNotes: {
      type: String,
      default: "",
      trim: true,
    },
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedStaffName: {
      type: String,
      default: "",
      trim: true,
    },
    assignedStaffPhone: {
      type: String,
      default: "",
      trim: true,
    },
    deliveryAcceptedAt: {
      type: Date,
    },
    deliveryOutAt: {
      type: Date,
    },
    deliveryCompletedAt: {
      type: Date,
    },
    supermarket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supermarket",
      default: null,
      index: true,
    },
    supermarketCode: {
      type: String,
      default: "DEFAULT",
      trim: true,
      index: true,
    },
    supermarketName: {
      type: String,
      default: "GrocerEase Supermarket",
      trim: true,
    },
    review: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: {
        type: String,
        default: "",
        trim: true,
      },
      submittedAt: {
        type: Date,
      },
      customerName: {
        type: String,
        default: "",
      },
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ supermarket: 1, createdAt: -1 });
orderSchema.index({ supermarket: 1, paymentStatus: 1 });
orderSchema.index({ supermarket: 1, deliveryStatus: 1 });
orderSchema.index({ supermarket: 1, orderType: 1 });

module.exports = mongoose.model("Order", orderSchema);

