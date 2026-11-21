const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true, // Strict: Prevent duplicate reviews for the same order
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
    },
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
    },
    supermarketName: {
      type: String,
      default: "",
      trim: true,
    },
    customer: {
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        default: null,
      },
      name: {
        type: String,
        default: "Verified Customer",
        trim: true,
      },
      phone: {
        type: String,
        default: "",
        trim: true,
      },
      email: {
        type: String,
        default: "",
        trim: true,
      },
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    orderType: {
      type: String,
      default: "SELF_PICKUP",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ supermarket: 1, createdAt: -1 });

module.exports = mongoose.model("Review", reviewSchema);

