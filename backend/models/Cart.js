const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: { type: String, required: true },
  brand: { type: String, default: "" },
  category: { type: String, default: "" },
  barcode: { type: String, default: "" },
  imageUrl: { type: String, default: "" },
  price: { type: Number, required: true }, // Original MRP
  discount: { type: Number, default: 0 },
  effectivePrice: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  stock: { type: Number, default: 99 },
  subtotal: { type: Number, required: true },
});

const cartSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    supermarket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supermarket",
      required: true,
      index: true,
    },
    items: [cartItemSchema],
    totalItems: {
      type: Number,
      default: 0,
    },
    grossAmount: {
      type: Number,
      default: 0,
    },
    totalSavings: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Method to recalculate cart totals accurately
cartSchema.methods.recalculate = function () {
  let totalItems = 0;
  let grossAmount = 0;
  let totalAmount = 0;

  for (const item of this.items) {
    totalItems += item.quantity;
    grossAmount += (item.price || item.effectivePrice) * item.quantity;
    totalAmount += item.effectivePrice * item.quantity;
  }

  this.totalItems = totalItems;
  this.grossAmount = grossAmount;
  this.totalSavings = Math.max(0, grossAmount - totalAmount);
  this.totalAmount = Math.max(0, totalAmount);
};

// Strict customer and supermarket isolation: exactly one active cart per customer per registered supermarket
cartSchema.index({ customer: 1, supermarket: 1 }, { unique: true });

module.exports = mongoose.model("Cart", cartSchema);

