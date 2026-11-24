const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const customerSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
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
    // Optional initially for online customers until they select their supermarket in the dashboard
    supermarket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supermarket",
      required: false,
      default: null,
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
    // Registration source: strictly separates ONLINE customers from OFFLINE customers
    registrationType: {
      type: String,
      enum: ["ONLINE", "OFFLINE"],
      default: "ONLINE",
      index: true,
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
  if (!this.customerId && this.phone) {
    const prefix = this.registrationType === "OFFLINE" ? "CUST-OFF" : "CUST-ONL";
    this.customerId = `${prefix}-${this.phone.slice(-4)}`;
  }
  if (this.isModified("password") && this.password && !this.password.startsWith("$2a$")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

customerSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

customerSchema.index({ phone: 1 }, { unique: true });
customerSchema.index({ customerId: 1 }, { unique: true, sparse: true });
customerSchema.index({ supermarket: 1 });
customerSchema.index({ supermarket: 1, registrationType: 1 });

module.exports = mongoose.model("Customer", customerSchema);
