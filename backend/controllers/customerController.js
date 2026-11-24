const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Order = require("../models/Order");
const Supermarket = require("../models/Supermarket");

/**
 * Migration helper to ensure legacy customer records have accurate registrationType
 * without silently or incorrectly reclassifying them.
 */
async function backfillLegacyCustomerRecords(supermarketId) {
  try {
    const unclassified = await Customer.find({
      supermarket: supermarketId,
      $or: [{ registrationType: { $exists: false } }, { registrationType: null }, { registrationType: "" }],
    });

    for (const cust of unclassified) {
      const cleanPhone = (cust.phone || "").replace(/\D/g, "").slice(-10);
      const onlineOrder = await Order.findOne({
        supermarket: supermarketId,
        purchaseMode: "ONLINE",
        $or: [{ "customer.customerId": cust._id }, { "customer.phone": { $regex: cleanPhone } }],
      });

      if (onlineOrder || cust.password) {
        cust.registrationType = "ONLINE";
      } else {
        cust.registrationType = "OFFLINE";
      }
      await cust.save();
    }
  } catch (err) {
    console.warn("Backfill legacy customers notice:", err.message);
  }
}

/**
 * GET /api/customers
 * Store Admin Customer Tab: Strictly OFFLINE registrations only.
 * Applies authenticated tenant isolation: never trusts client-supplied supermarket ID.
 */
exports.getStoreOfflineCustomers = async (req, res) => {
  try {
    // 1. Enforce strict authenticated tenant isolation
    const supermarketId =
      req.user?.supermarket?._id ||
      req.user?.supermarket ||
      req.supermarketId;

    if (!supermarketId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Store Admin tenant context required.",
      });
    }

    // Run one-time legacy backfill check
    await backfillLegacyCustomerRecords(supermarketId);

    const storeObjectId = mongoose.Types.ObjectId.isValid(supermarketId)
      ? new mongoose.Types.ObjectId(supermarketId)
      : supermarketId;

    const storeCode = req.user?.supermarketCode || req.user?.supermarket?.code || "";

    // Find any offline orders in this supermarket to also include any offline shoppers who shopped here
    const offlineOrdersInStore = await Order.find({
      $or: [{ supermarket: storeObjectId }, { supermarket: String(supermarketId) }],
      purchaseMode: "OFFLINE",
    }).select("customer");
    const offlinePhonesFromOrders = offlineOrdersInStore
      .map((o) => (o.customer?.phone || "").replace(/\D/g, "").slice(-10))
      .filter((p) => p.length === 10);

    const storeMatchConditions = [
      { supermarket: storeObjectId },
      { supermarket: String(supermarketId) },
    ];
    if (storeCode) {
      storeMatchConditions.push({ supermarketCode: storeCode });
    }
    if (offlinePhonesFromOrders.length > 0) {
      storeMatchConditions.push({ phone: { $in: offlinePhonesFromOrders } });
    }

    // 2. Strict Database Filter: OFFLINE registrations only for this supermarket
    const query = {
      $and: [
        { $or: storeMatchConditions },
        { registrationType: "OFFLINE" }, // MANDATORY: Online customers are strictly excluded at query level
      ],
    };

    // Optional status filter
    if (req.query.status && req.query.status !== "All Statuses" && req.query.status !== "all") {
      query.status = req.query.status;
    }

    // Optional search query
    if (req.query.search) {
      const q = String(req.query.search).trim();
      const digits = q.replace(/\D/g, "");
      query.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
      if (digits) {
        query.$or.push({ phone: { $regex: digits } });
      }
    }

    const customers = await Customer.find(query)
      .select("-password")
      .sort({ createdAt: -1 });

    // 3. Aggregate offline visit and order statistics for each offline customer
    const enhancedCustomers = await Promise.all(
      customers.map(async (cust) => {
        const cleanPhone = (cust.phone || "").replace(/\D/g, "").slice(-10);

        // Fetch genuine offline orders for this customer in this supermarket
        const offlineOrders = await Order.find({
          supermarket: supermarketId,
          purchaseMode: "OFFLINE",
          $or: [
            { "customer.customerId": cust._id },
            { "customer.phone": { $regex: cleanPhone } },
          ],
        }).sort({ createdAt: -1 });

        const totalOrders = offlineOrders.length;
        const totalSpent = offlineOrders.reduce((sum, ord) => {
          return ord.paymentStatus === "Completed" ? sum + (ord.totalAmount || 0) : sum;
        }, 0);

        const paymentMethodsUsed = {};
        offlineOrders.forEach((o) => {
          const m = o.paymentMethod || "UPI";
          paymentMethodsUsed[m] = (paymentMethodsUsed[m] || 0) + 1;
        });

        const idSuffix = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : String(cust._id).slice(-4);

        return {
          _id: cust._id,
          id: `CUST-OFF-${idSuffix}`,
          name: cust.name,
          phone: `+91 ${cleanPhone}`,
          email: cust.email || "",
          address: cust.address || "",
          registrationType: cust.registrationType, // Always "OFFLINE"
          registeredLocation: cust.registeredLocation || "",
          status: cust.status || "Active",
          registrationDate: cust.createdAt,
          createdAt: cust.createdAt,
          updatedAt: cust.updatedAt,
          totalOrders,
          totalSpent,
          latestOrderDate: offlineOrders[0]?.createdAt || cust.createdAt,
          orders: offlineOrders.map((ord) => ({
            id: ord.orderNumber,
            orderId: ord._id,
            date: ord.createdAt,
            amount: ord.totalAmount,
            discount: ord.discountAmount,
            paymentMethod: ord.paymentMethod,
            paymentStatus: ord.paymentStatus,
            exitBarcode: ord.exitBarcode,
            items: (ord.items || []).map((it) => ({
              name: it.name,
              quantity: it.quantity,
              price: it.price,
              subtotal: it.subtotal,
            })),
          })),
          paymentMethodsUsed,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: enhancedCustomers.length,
      registrationType: "OFFLINE",
      customers: enhancedCustomers,
    });
  } catch (error) {
    console.error("Get offline customers error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve offline customer registrations.",
      error: error.message,
    });
  }
};

/**
 * POST /api/customers
 * Register a new OFFLINE customer (e.g. walk-in customer at the store checkout or desk)
 */
exports.createOfflineCustomer = async (req, res) => {
  try {
    const supermarketId =
      req.user?.supermarket?._id ||
      req.user?.supermarket ||
      req.supermarketId;

    if (!supermarketId) {
      return res.status(403).json({
        success: false,
        message: "Store Admin tenant context required.",
      });
    }

    const store = await Supermarket.findById(supermarketId);
    if (!store) {
      return res.status(404).json({ success: false, message: "Supermarket not found." });
    }

    const { name, phone, email, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Customer name is required." });
    }

    const rawDigits = String(phone || "").replace(/\D/g, "");
    const cleanPhone = rawDigits.length >= 10 ? rawDigits.slice(-10) : rawDigits;
    if (!cleanPhone || cleanPhone.length !== 10 || !["6", "7", "8", "9"].includes(cleanPhone[0])) {
      return res.status(400).json({
        success: false,
        message: "A valid 10-digit Indian mobile number starting with 6, 7, 8, or 9 is required.",
      });
    }

    // Check if customer already exists
    let customer = await Customer.findOne({ phone: cleanPhone });

    if (customer) {
      // If customer is already registered online, prevent duplicate and do not silently convert
      if (customer.registrationType === "ONLINE") {
        return res.status(400).json({
          success: false,
          message: `Customer ${customer.name} (${cleanPhone}) is registered through ONLINE shopping. They are listed under the Orders tab. Duplicate accounts are not permitted.`,
        });
      }

      // Update existing offline customer
      customer.name = name.trim();
      if (email) customer.email = email.trim().toLowerCase();
      if (address) customer.address = address.trim();
      customer.supermarket = store._id;
      customer.supermarketCode = store.code;
      customer.supermarketName = store.name;
      customer.registeredLocation = `${store.city}, ${store.state || ""}`.trim();
      customer.registrationType = "OFFLINE";
      await customer.save();

      return res.status(200).json({
        success: true,
        message: `Offline customer "${customer.name}" updated successfully.`,
        customer,
      });
    }

    // Create new OFFLINE customer
    customer = await Customer.create({
      name: name.trim(),
      phone: cleanPhone,
      email: email ? email.trim().toLowerCase() : "",
      address: address?.trim() || "",
      supermarket: store._id,
      supermarketCode: store.code,
      supermarketName: store.name,
      registeredLocation: `${store.city}, ${store.state || ""}`.trim(),
      registrationType: "OFFLINE", // STRICT
      status: "Active",
    });

    return res.status(201).json({
      success: true,
      message: `Offline walk-in customer "${customer.name}" registered successfully.`,
      customer,
    });
  } catch (error) {
    console.error("Create offline customer error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to register offline customer.",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/customers/:id/status
 * Update customer status (Active / Inactive / Suspended)
 */
exports.updateCustomerStatus = async (req, res) => {
  try {
    const supermarketId =
      req.user?.supermarket?._id ||
      req.user?.supermarket ||
      req.supermarketId;

    const { id } = req.params;
    const { status } = req.body;

    if (!["Active", "Inactive", "Suspended", "Blocked"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value." });
    }

    const customer = await Customer.findOne({
      _id: id,
      supermarket: supermarketId,
      registrationType: "OFFLINE",
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Offline customer record not found in your supermarket.",
      });
    }

    customer.status = status;
    await customer.save();

    return res.status(200).json({
      success: true,
      message: `Customer "${customer.name}" status updated to ${status}.`,
      customer,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update customer status.",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/customers/:id
 * Delete an offline customer record
 */
exports.deleteCustomer = async (req, res) => {
  try {
    const supermarketId =
      req.user?.supermarket?._id ||
      req.user?.supermarket ||
      req.supermarketId;

    const { id } = req.params;

    const customer = await Customer.findOneAndDelete({
      _id: id,
      supermarket: supermarketId,
      registrationType: "OFFLINE",
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Offline customer not found or access denied.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Customer "${customer.name}" removed from offline directory.`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete customer.",
      error: error.message,
    });
  }
};

/**
 * POST /api/customers/offline-register
 * Public endpoint for walk-in offline mobile shoppers to register during barcode scan checkout
 * Guaranteed to save exclusively as registrationType: "OFFLINE" in MongoDB and associate with store.
 */
exports.registerOfflineCustomerPublic = async (req, res) => {
  try {
    const { name, phone, email, address, supermarketId, supermarketCode } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Customer name is mandatory." });
    }

    const rawDigits = String(phone || "").replace(/\D/g, "");
    const cleanPhone = rawDigits.length >= 10 ? rawDigits.slice(-10) : rawDigits;
    if (!cleanPhone || cleanPhone.length !== 10 || !["6", "7", "8", "9"].includes(cleanPhone[0])) {
      return res.status(400).json({
        success: false,
        message: "A valid 10-digit Indian mobile number starting with 6, 7, 8, or 9 is required.",
      });
    }

    // Resolve Supermarket tenant strictly
    let store = null;
    const target = supermarketId || supermarketCode;
    if (target) {
      if (String(target).match(/^[0-9a-fA-F]{24}$/)) {
        store = await Supermarket.findById(target);
      }
      if (!store) {
        store = await Supermarket.findOne({ code: String(target).toUpperCase() });
      }
    }

    if (!store) {
      return res.status(400).json({
        success: false,
        message: "Supermarket identification is required to register an offline customer.",
      });
    }

    // Find or create customer
    let customer = await Customer.findOne({ phone: cleanPhone });

    if (customer) {
      customer.name = name.trim();
      if (email) customer.email = email.trim().toLowerCase();
      if (address) customer.address = address.trim();
      customer.supermarket = store._id;
      customer.supermarketCode = store.code;
      customer.supermarketName = store.name;
      customer.registeredLocation = `${store.city}, ${store.state || ""}`.trim();
      customer.registrationType = "OFFLINE"; // STRICT
      await customer.save();
    } else {
      customer = await Customer.create({
        name: name.trim(),
        phone: cleanPhone,
        email: email ? email.trim().toLowerCase() : "",
        address: address?.trim() || "",
        supermarket: store._id,
        supermarketCode: store.code,
        supermarketName: store.name,
        registeredLocation: `${store.city}, ${store.state || ""}`.trim(),
        registrationType: "OFFLINE", // STRICT
        status: "Active",
      });
    }

    // Notify store admin
    try {
      const io = req.app && req.app.get ? req.app.get("io") : null;
      if (io) {
        const { emitTenantNotification } = require("../utils/notificationEmitter");
        emitTenantNotification(io, "notification", {
          type: "NEW_CUSTOMER",
          title: "New Offline Customer Registered",
          message: `${customer.name} (${customer.phone}) registered for offline shopping.`,
          data: { customerId: customer._id, registrationType: "OFFLINE" },
          supermarketId: store._id.toString(),
          supermarketCode: store.code,
        });
      }
    } catch (emitterErr) {
      console.warn("Notification emitter warning:", emitterErr ? emitterErr.message : emitterErr);
    }

    return res.status(200).json({
      success: true,
      message: `Offline customer "${customer.name}" registered successfully.`,
      customer,
    });
  } catch (error) {
    console.error("Register offline customer public error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to register offline customer.",
      error: error.message,
    });
  }
};


