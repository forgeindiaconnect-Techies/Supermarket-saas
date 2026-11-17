const mongoose = require("mongoose");

const deletedRecordSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      required: true,
      enum: ["SUPERMARKET", "PRODUCT", "ORDER", "USER", "CUSTOMER", "SYSTEM"],
      index: true,
    },
    identifier: {
      type: String,
      required: true,
      index: true,
    },
    secondaryIdentifier: {
      type: String,
      index: true,
    },
    name: String,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    deletedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DeletedRecord", deletedRecordSchema);

