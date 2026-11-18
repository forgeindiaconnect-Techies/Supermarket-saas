const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    // Permanently connected supermarket tenant
    supermarket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supermarket",
      required: true,
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
    registeredLocation: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Blocked"],
      default: "Active",
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

customerSchema.pre("save", async function () {
  if (this.phone) {
    this.phone = this.phone.replace(/\D/g, "");
    if (this.phone.length === 12 && this.phone.startsWith("91")) {
      this.phone = this.phone.slice(2);
    }
  }
  if (this.isModified("password") && this.password && !this.password.startsWith("$2a$")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

customerSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return true; // If registered without password (mobile OTP style)
  return await bcrypt.compare(enteredPassword, this.password);
};

customerSchema.index({ phone: 1 }, { unique: true });
customerSchema.index({ supermarket: 1 });

module.exports = mongoose.model("Customer", customerSchema);
