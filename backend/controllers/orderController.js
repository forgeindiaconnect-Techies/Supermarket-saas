const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const CartActivity = require("../models/CartActivity");
const Supermarket = require("../models/Supermarket");
const { emitTenantNotification } = require("../utils/notificationEmitter");
const { sendOrderReceiptEmail } = require("../utils/mailer");

// Helper function to safely deduct order inventory once
async function deductOrderInventory(order) {
  if (order.inventoryDeducted) return;

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const currentOrder = await Order.findById(order._id).session(session);

      if (!currentOrder) {
        throw new Error("Order not found.");
      }

      if (currentOrder.inventoryDeducted) {
        return;
      }

      for (const item of currentOrder.items) {
        const result = await Product.updateOne(
          {
            _id: item.product,
            stock: { $gte: item.quantity },
          },
          {
            $inc: { stock: -item.quantity },
          },
          { session }
        );

        if (result.matchedCount !== 1) {
          throw new Error(
            `Insufficient stock or product unavailable: ${item.name}`
          );
        }
      }

      currentOrder.inventoryDeducted = true;
      await currentOrder.save({ session });
    });

    order.inventoryDeducted = true;
  } finally {
    await session.endSession();
  }
}

// Checkout and place order
exports.checkout = async (req, res) => {
  try {
    const { items, paymentMethod = "UPI", customer } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty. Please scan products before checkout.",
      });
    }

    // 1. Resolve and Verify Supermarket Identity First
    // Multi-tenant validation: Every checkout must have a verified supermarket.
    // STRICT CUSTOMER SUPERMARKET ISOLATION:
    // If request contains an authenticated customer token, customer MUST checkout at their registered supermarket!
    let customerStore = null;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      try {
        const token = req.headers.authorization.split(" ")[1];
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "your_super_secret_jwt_key_here_change_in_production"
        );
        if (decoded && decoded.role === "CUSTOMER") {
          const Customer = require("../models/Customer");
          const cust = await Customer.findById(decoded.id || decoded._id).populate("supermarket");
          if (cust && cust.supermarket) {
            customerStore = cust.supermarket;
          }
        }
      } catch (_) {}
    }

    let resolvedSupermarketId =
      (customerStore ? customerStore._id.toString() : null) ||
      req.body?.supermarketId ||
      (typeof req.body?.supermarket === "string"
        ? req.body.supermarket
        : req.body?.supermarket?._id) ||
      req.headers["x-supermarket-id"] ||
      req.supermarketId;

    let resolvedSupermarketCode =
      (customerStore ? customerStore.code : null) ||
      req.body?.supermarketCode ||
      req.headers["x-supermarket-code"] ||
      req.supermarketCode;

    let verifiedStore = customerStore;
    if (!verifiedStore && resolvedSupermarketId && resolvedSupermarketId !== "all" && resolvedSupermarketId !== "null" && resolvedSupermarketId !== "undefined") {
      try {
        if (String(resolvedSupermarketId).match(/^[0-9a-fA-F]{24}$/)) {
          verifiedStore = await Supermarket.findById(resolvedSupermarketId);
        }
      } catch (_) {}
    }
    if (!verifiedStore && resolvedSupermarketCode && resolvedSupermarketCode !== "DEFAULT" && resolvedSupermarketCode !== "ALL") {
      verifiedStore = await Supermarket.findOne({ code: String(resolvedSupermarketCode).toUpperCase() });
    }
    if (!verifiedStore && req.supermarket) {
      verifiedStore = req.supermarket;
    }

    // Check first item's product supermarket if header was omitted
    if (!verifiedStore && items.length > 0) {
      const firstId = items[0].productId || items[0]._id;
      if (firstId) {
        const prod = await Product.findById(firstId);
        if (prod && prod.supermarket) {
          verifiedStore = await Supermarket.findById(prod.supermarket);
        }
      }
    }

    if (!verifiedStore) {
      return res.status(400).json({
        success: false,
        message: "Supermarket identification required. Please select a valid supermarket before checkout.",
      });
    }

    resolvedSupermarketId = verifiedStore._id.toString();
    resolvedSupermarketCode = verifiedStore.code;
    const resolvedSupermarketName = verifiedStore.name;

    // Strict Super Admin Online / Offline availability validation
    const purchaseMode = String(req.body?.purchaseMode || req.headers["x-purchase-mode"] || "OFFLINE").toUpperCase();
    if (purchaseMode === "ONLINE") {
      if (verifiedStore.onlineAvailable !== true) {
        return res.status(403).json({
          success: false,
          message: "This supermarket does not currently support Online Purchase. Please choose an available option.",
        });
      }
    } else {
      if (verifiedStore.offlineAvailable !== true) {
        return res.status(403).json({
          success: false,
          message: "This supermarket does not currently support Offline Purchase. Please choose an available option.",
        });
      }
    }

    // 2. Verify all products, enforce strict supermarket ownership, and check stock availability
    const verifiedItems = [];
    let grossSubtotal = 0;
    let totalDiscount = 0;

    for (const item of items) {
      const productId = item.productId || item._id;
      const quantity = Number(item.quantity);

      if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid product or quantity in cart.",
        });
      }

      const product = await Product.findOne({ _id: productId, isActive: { $ne: false } });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product "${item.name || productId}" is no longer available in inventory.`,
        });
      }

      // STRICT MULTI-TENANT CHECK: Ensure product belongs to the verified supermarket!
      const itemSupermarketId = product.supermarket ? product.supermarket.toString() : null;
      if (itemSupermarketId && itemSupermarketId !== resolvedSupermarketId) {
        return res.status(400).json({
          success: false,
          message: `Product "${product.name}" belongs to a different supermarket. All products in the cart must belong strictly to ${verifiedStore.name}.`,
        });
      }

      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Only ${product.stock} units available.`,
        });
      }

      const rawPrice = Number(product.price || 0);
      const rawCostPrice = Number(product.costPrice || 0);
      const explicitDiscount = Number(product.discount || 0);

      let originalMrp = rawPrice;
      let effectivePrice = rawPrice;
      let discountPerUnit = explicitDiscount;

      if (rawCostPrice > 0 && rawCostPrice !== rawPrice) {
        originalMrp = Math.max(rawPrice, rawCostPrice);
        effectivePrice = Math.min(rawPrice, rawCostPrice);
        discountPerUnit = Math.max(explicitDiscount, originalMrp - effectivePrice);
      } else if (explicitDiscount > 0) {
        originalMrp = rawPrice;
        effectivePrice = Math.max(0, rawPrice - explicitDiscount);
        discountPerUnit = explicitDiscount;
      }

      const itemSubtotal = effectivePrice * quantity;

      grossSubtotal += originalMrp * quantity;
      totalDiscount += discountPerUnit * quantity;

      verifiedItems.push({
        product: product._id,
        supermarket: verifiedStore._id,
        supermarketCode: verifiedStore.code,
        name: product.name,
        brand: product.brand || "",
        category: product.category,
        barcode: product.barcode || "",
        imageUrl: product.imageUrl || "",
        price: effectivePrice,
        originalPrice: originalMrp,
        discount: discountPerUnit,
        quantity,
        subtotal: itemSubtotal,
      });
    }

    // 3. Compute final order summary
    const discountAmount = totalDiscount;
    const taxAmount = 0;
    const totalAmount = Math.max(0, grossSubtotal - discountAmount + taxAmount);
    const totalItems = verifiedItems.reduce((acc, curr) => acc + curr.quantity, 0);

    // 4. Set payment status:
    const isCashPayment = paymentMethod === "Cash";
    const isPaid = req.body?.isPaid === true || req.body?.status === "Completed" || paymentMethod === "UPI" || paymentMethod === "Card";
    const paymentStatus = req.body?.paymentStatus || (isPaid ? "Completed" : "Pending");
    const inventoryDeducted = paymentStatus === "Completed";

    // 5. Generate unique Order number and Exit Receipt Barcode
    const timestampStr = Date.now().toString().slice(-6);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${timestampStr}-${randomSuffix}`;
    const exitBarcode = `EXIT-${Date.now().toString().slice(-8)}`;
    const paymentId = isCashPayment
      ? `PENDING-CASH-${Date.now().toString().slice(-6)}`
      : `PENDING-${paymentMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`;

    const rawCustomerPhone = (customer?.phone || "").replace(/\D/g, "").slice(-10);
    const cleanCustomerPhone = rawCustomerPhone ? `+91 ${rawCustomerPhone}` : "";

    // Safely associate with authenticated customer account (Never create duplicate customer records)
    const Customer = require("../models/Customer");
    let customerDoc = null;
    if (customer?.customerId && String(customer.customerId).match(/^[0-9a-fA-F]{24}$/)) {
      customerDoc = await Customer.findById(customer.customerId);
    }
    if (!customerDoc && rawCustomerPhone) {
      customerDoc = await Customer.findOne({ phone: rawCustomerPhone });
    }

    // Auto-create customer account if first time checking out with phone number
    if (!customerDoc && rawCustomerPhone && rawCustomerPhone.length === 10) {
      try {
        const regType = purchaseMode === "ONLINE" ? "ONLINE" : "OFFLINE";
        customerDoc = await Customer.create({
          name: (customer?.name || "Shopper").trim(),
          phone: rawCustomerPhone,
          email: (customer?.email || "").trim().toLowerCase(),
          address: (customer?.address || "").trim(),
          supermarket: verifiedStore._id,
          supermarketCode: verifiedStore.code,
          supermarketName: verifiedStore.name,
          registeredLocation: `${verifiedStore.city || ""}, ${verifiedStore.state || ""}`.trim(),
          registrationType: regType,
        });
      } catch (err) {
        customerDoc = await Customer.findOne({ phone: rawCustomerPhone }).catch(() => null);
      }
    }

    // Preserve and ensure registrationType on customer document
    if (customerDoc) {
      if (purchaseMode === "OFFLINE") {
        customerDoc.registrationType = "OFFLINE";
        if (verifiedStore) {
          customerDoc.supermarket = verifiedStore._id;
          customerDoc.supermarketCode = verifiedStore.code;
          customerDoc.supermarketName = verifiedStore.name;
          customerDoc.registeredLocation = `${verifiedStore.city}, ${verifiedStore.state || ""}`.trim();
        }
        await customerDoc.save().catch(() => {});
      } else if (!customerDoc.registrationType) {
        customerDoc.registrationType = "ONLINE";
        await customerDoc.save().catch(() => {});
      }
    }

    // If customer updated their address during checkout, update existing customer document
    if (customerDoc && customer?.address && customer.address.trim() && customerDoc.address !== customer.address.trim()) {
      customerDoc.address = customer.address.trim();
      await customerDoc.save().catch(() => {});
    }

    const finalCustomerName = (customer?.name || customerDoc?.name || "Mobile Shopper").trim();
    const finalCustomerAddress = (customer?.address || customerDoc?.address || "").trim();

    const nowTime = new Date();
    const etaDate = new Date(nowTime.getTime() + 35 * 60 * 1000);
    const defaultEtaTime = etaDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const defaultEtaDate = etaDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

    // STRICT WORKFLOW ISOLATION: Distinguish OFFLINE In-Store self-checkout from ONLINE orders
    const isOffline = purchaseMode === "OFFLINE";
    const reqOrderType = String(req.body.orderType || "").toUpperCase();
    const reqFulfillment = String(req.body.fulfillmentType || req.body.fulfillmentChoice || "").toUpperCase();
    const isHomeDelivery =
      !isOffline &&
      (reqOrderType === "DELIVERY" ||
        reqOrderType === "ONLINE_DELIVERY" ||
        reqOrderType === "SELF_PICKUP_DOORSTEP" ||
        reqFulfillment === "DELIVERY" ||
        reqFulfillment === "DOORSTEP_DELIVERY" ||
        (purchaseMode === "ONLINE" && reqOrderType !== "SELF_PICKUP" && reqFulfillment !== "SELF_PICKUP" && reqFulfillment !== "STORE_COLLECTION"));

    const finalOrderType = isOffline
      ? "IN_STORE"
      : (isHomeDelivery
        ? "DELIVERY"
        : (purchaseMode === "ONLINE" && (reqOrderType === "SELF_PICKUP" || reqFulfillment === "SELF_PICKUP" || reqFulfillment === "STORE_COLLECTION")
          ? "SELF_PICKUP"
          : "IN_STORE"));

    const finalFulfillmentChoice = isOffline
      ? ""
      : (isHomeDelivery
        ? "DOORSTEP_DELIVERY"
        : (finalOrderType === "SELF_PICKUP" ? "STORE_COLLECTION" : ""));

    const finalPickupStatus = (isOffline || isHomeDelivery) ? "" : ((req.body.pickupStatus && String(req.body.pickupStatus).trim()) || "Pending");
    const finalDeliveryStatus = isOffline ? "" : (isHomeDelivery ? ((req.body.deliveryStatus && String(req.body.deliveryStatus).trim()) || "Order Confirmed") : "");

    const order = await Order.create({
      orderNumber,
      items: verifiedItems,
      totalItems,
      subtotalAmount: grossSubtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      paymentMethod,
      paymentStatus,
      paymentId,
      purchaseMode,
      orderType: finalOrderType,
      fulfillmentChoice: finalFulfillmentChoice,
      pickupDate: (isOffline || isHomeDelivery) ? "" : (req.body.pickupDate || ""),
      pickupTimeSlot: (isOffline || isHomeDelivery) ? "" : (req.body.pickupTimeSlot || ""),
      pickupStatus: finalPickupStatus,
      deliveryStatus: finalDeliveryStatus,
      deliveryAddress: finalCustomerAddress,
      deliveryPhone: cleanCustomerPhone,
      deliveryCustomerName: finalCustomerName,
      deliveryNotes: req.body.deliveryNotes || "",
      orderConfirmedAt: nowTime,
      estimatedDeliveryTime: isOffline ? "" : (req.body.estimatedDeliveryTime || defaultEtaTime),
      estimatedDeliveryDate: isOffline ? "" : (req.body.estimatedDeliveryDate || defaultEtaDate),
      trackingTimeline: isOffline
        ? [
            {
              status: "In-Store Purchase Completed",
              stage: "Completed",
              title: "Self-Checkout Completed",
              description: "Payment confirmed and in-store exit pass issued.",
              timestamp: nowTime,
              updatedBy: finalCustomerName || "Customer",
              role: "CUSTOMER",
            },
          ]
        : [
            {
              status: "Order Confirmed",
              stage: "Order Confirmed",
              title: "Order Confirmed",
              description: isHomeDelivery
                ? "Your home delivery order has been received and confirmed by the supermarket."
                : "Your store pickup order has been placed and confirmed.",
              timestamp: nowTime,
              updatedBy: finalCustomerName || "Customer",
              role: "CUSTOMER",
            },
          ],
      statusHistory: [
        {
          previousStatus: "New",
          newStatus: isOffline ? "Completed" : (isHomeDelivery ? "Order Confirmed" : finalPickupStatus),
          timestamp: nowTime,
          updatedBy: finalCustomerName || "Customer",
          role: "CUSTOMER",
        },
      ],
      customer: {
        customerId: customerDoc ? customerDoc._id : null,
        name: finalCustomerName,
        phone: cleanCustomerPhone,
        email: customer?.email || customerDoc?.email || "",
        address: finalCustomerAddress,
      },
      exitBarcode,
      inventoryDeducted,
      supermarket: resolvedSupermarketId || null,
      supermarketCode: resolvedSupermarketCode || "DEFAULT",
      supermarketName: resolvedSupermarketName || "GrocerEase Supermarket",
    });

    // Payment completion handling:
    // Only set completedAt for OFFLINE in-store checkout (where scanning, payment, and exit barcode all complete at store counter)
    // Home delivery orders are fulfilled later step-by-step; payment success must NEVER automatically mark delivery as completed!
    if (paymentStatus === "Completed") {
      if (isOffline) {
        order.completedAt = nowTime;
      }
      await deductOrderInventory(order).catch(() => {});
    }

    // 5. Clean up temporary scanning cart activity sessions and clear customer MongoDB cart upon order completion
    try {
      if (customerDoc?._id && resolvedSupermarketId) {
        const Cart = require("../models/Cart");
        await Cart.findOneAndUpdate(
          { customer: customerDoc._id, supermarket: resolvedSupermarketId },
          { items: [], totalItems: 0, grossAmount: 0, totalSavings: 0, totalAmount: 0 }
        ).catch(() => {});
      }
      if (rawCustomerPhone) {
        await CartActivity.deleteMany({
          supermarket: resolvedSupermarketId || null,
          $or: [
            { sessionId: { $regex: rawCustomerPhone } },
            { customerName: customer?.name },
          ],
        });
      }
    } catch (_) { }

    try {
      const io = req.app?.get("io");
      if (io) {
        const notifData = {
          id: `pending-${order._id || order.orderNumber}`,
          type: "pending",
          badge: "PRE-BOOKING",
          title: "New Pre-Booking",
          actor: order.customer?.name || "Shopper",
          message: `${order.customer?.name || "Shopper"} is waiting for approval.`,
          timestamp: order.createdAt || new Date().toISOString(),
          order,
          customerName: order.customer?.name || "Shopper",
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          supermarketId: resolvedSupermarketId ? resolvedSupermarketId.toString() : null,
          supermarketCode: resolvedSupermarketCode || "DEFAULT",
          supermarketName: resolvedSupermarketName || "GrocerEase Supermarket",
        };
        // Strict tenant-isolated notification emission
        emitTenantNotification(io, "admin:notification", notifData);
        emitTenantNotification(io, "new-order", {
          ...notifData,
          order,
        });
      }
    } catch (_) { }

    return res.status(201).json({
      success: true,
      message: isCashPayment
        ? "Order registered. Please pay cash at the exit counter."
        : "Order placed successfully! Awaiting payment verification.",
      order,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return res.status(500).json({
      success: false,
      message: "Checkout failed",
      error: error.message,
    });
  }
};

// Log customer cart activity
exports.logCartActivity = async (req, res) => {
  try {
    const {
      sessionId = "mobile-shopper",
      customerName = "Mobile Shopper",
      productName,
      productId,
      quantity = 1,
      price = 0,
      action = "added",
      totalCartItems = 1,
      totalCartAmount = 0,
    } = req.body;

    if (!productName) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }

    let actSupermarketId = req.supermarketId;
    let actSupermarketCode = req.supermarketCode;

    // Resolve tenant strictly from product if productId provided
    if (productId) {
      try {
        const prod = await Product.findById(productId).select("supermarket supermarketCode");
        if (prod && prod.supermarket) {
          actSupermarketId = prod.supermarket.toString();
          actSupermarketCode = prod.supermarketCode || actSupermarketCode;
        }
      } catch (_) {}
    }
    if (req.body?.supermarketId) actSupermarketId = req.body.supermarketId;
    if (req.body?.supermarketCode) actSupermarketCode = req.body.supermarketCode;

    const activity = await CartActivity.create({
      sessionId,
      customerName,
      productName,
      productId,
      quantity,
      price,
      action,
      totalCartItems,
      totalCartAmount,
      supermarket: actSupermarketId || null,
      supermarketCode: actSupermarketCode || "DEFAULT",
    });

    try {
      const io = req.app?.get("io");
      if (io) {
        emitTenantNotification(io, "admin:notification", {
          id: `cart-${activity._id || Date.now()}`,
          type: "cart",
          badge: "ADDED TO CART",
          title: "Cart Item Added",
          actor: customerName || "Mobile Shopper",
          message: `${customerName || "Customer"} added ${productName} (Qty: ${quantity}) to cart.`,
          timestamp: activity.createdAt || new Date().toISOString(),
          customerName: customerName || "Mobile Shopper",
          productName,
          quantity,
          price,
          supermarketId: actSupermarketId ? actSupermarketId.toString() : null,
          supermarketCode: actSupermarketCode || "DEFAULT",
        });
      }
    } catch (_) {}

    return res.status(201).json({
      success: true,
      activity,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to record cart activity",
      error: error.message,
    });
  }
};

// Master purge function to ensure zero dummy/sample/seeded test data in database
async function purgeLegacyDummyRecords() {
  try {
    await Order.deleteMany({
      $or: [
        { orderNumber: { $in: ["ORD-948102-1001", "ORD-772109-2001", "ORD-289409", "ORD-289410", "ORD-STR001-1001", "ORD-STR002-2001", "ORD-DUMMY", "ORD-DEMO"] } },
        { "customer.name": { $in: ["Kavitha R", "Vikram Mehta", "Arun Kumar", "Priya Sharma", "Neha Patel", "Rahul Verma"] } },
        { totalAmount: { $in: [510, 9450] } },
      ],
    });
    await CartActivity.deleteMany({
      $or: [
        { customerName: { $in: ["Kavitha R", "Vikram Mehta", "Arun Kumar", "Priya Sharma", "Neha Patel", "Rahul Verma"] } },
        { sessionId: { $in: ["live-priya-sharma", "live-neha-patel", "live-rahul-verma"] } },
      ],
    });
  } catch (err) {
    console.warn("Purge dummy records note:", err.message);
  }
}

// Get live customer cart activities (Strict Multi-Tenant Scoping)
exports.getCartActivity = async (req, res) => {
  try {
    const filter = {};

    if (req.user && req.user.role === "STORE_ADMIN") {
      const orConditions = [];
      if (req.supermarketId) orConditions.push({ supermarket: req.supermarketId });
      if (req.supermarketCode && req.supermarketCode !== "DEFAULT" && req.supermarketCode !== "ALL") {
        orConditions.push({ supermarketCode: req.supermarketCode });
      }
      if (orConditions.length > 0) {
        filter.$or = orConditions;
      } else {
        return res.status(200).json({ success: true, count: 0, activities: [] });
      }
    } else if (req.supermarketId) {
      const orConditions = [{ supermarket: req.supermarketId }];
      if (req.supermarketCode && req.supermarketCode !== "DEFAULT" && req.supermarketCode !== "ALL") {
        orConditions.push({ supermarketCode: req.supermarketCode });
      }
      filter.$or = orConditions;
    } else if (!req.user || req.user.role !== "SUPER_ADMIN") {
      return res.status(200).json({ success: true, count: 0, activities: [] });
    }

    const activities = await CartActivity.find(filter).sort({ createdAt: -1 }).limit(30);

    return res.status(200).json({
      success: true,
      count: activities.length,
      activities,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cart activities",
      error: error.message,
    });
  }
};

// Get all orders (Strict Multi-Tenant Scoping & Real-Time only)
// Store Admin Order Tab: Strictly ONLINE registrations only.
exports.getOrders = async (req, res) => {
  try {
    const filter = {};
    const Customer = require("../models/Customer");

    // Auto-sanitize existing offline orders in MongoDB (e.g. ORD-439225-6948):
    // Ensure OFFLINE purchases never hold pickupStatus or online fulfillment actions
    try {
      await Order.updateMany(
        {
          $or: [
            { orderNumber: "ORD-439225-6948" },
            { purchaseMode: "OFFLINE", pickupStatus: { $ne: "" } },
            { orderType: { $in: ["IN_STORE", "OFFLINE"] }, pickupStatus: { $ne: "" } },
          ],
        },
        {
          $set: {
            purchaseMode: "OFFLINE",
            orderType: "OFFLINE",
            pickupStatus: "",
            deliveryStatus: "",
            fulfillmentChoice: "",
          },
        }
      );
    } catch (_) {}

    if (req.user && req.user.role === "CUSTOMER") {
      // STRICT CUSTOMER PRIVACY: Authenticated customers can only view their own orders!
      const cleanPhone = (req.user.phone || "").replace(/\D/g, "").slice(-10);
      const custId = req.user.id || req.user._id;
      const customerConditions = [];
      if (cleanPhone) {
        customerConditions.push({ "customer.phone": { $regex: cleanPhone } });
        customerConditions.push({ deliveryPhone: { $regex: cleanPhone } });
        customerConditions.push({ customerPhone: { $regex: cleanPhone } });
      }
      if (custId) {
        customerConditions.push({ "customer.customerId": custId });
      }
      filter.$or = customerConditions.length > 0 ? customerConditions : [{ "customer.phone": "NONE" }];

      // Enforce strict supermarket isolation: customer only sees orders from their registered supermarket
      if (req.user.supermarketId) {
        filter.supermarket = req.user.supermarketId;
      }
    } else if (req.user && req.user.role === "STORE_ADMIN") {
      const tenantStoreId = req.user.supermarket?._id || req.user.supermarket || req.supermarketId;
      const orConditions = [];
      if (tenantStoreId) orConditions.push({ supermarket: tenantStoreId });
      if (req.supermarketCode && req.supermarketCode !== "DEFAULT" && req.supermarketCode !== "ALL") {
        orConditions.push({ supermarketCode: req.supermarketCode });
      }
      if (orConditions.length > 0) {
        filter.$or = orConditions;
      } else {
        return res.status(200).json({ success: true, count: 0, orders: [] });
      }

      // Optional purchaseMode / registrationType filter (e.g. ONLINE or OFFLINE)
      if (req.query.purchaseMode) {
        filter.purchaseMode = req.query.purchaseMode.toUpperCase();
      } else if (req.query.registrationType === "ONLINE" || req.query.source === "ONLINE") {
        filter.purchaseMode = "ONLINE";
      } else if (req.query.registrationType === "OFFLINE" || req.query.source === "OFFLINE") {
        filter.purchaseMode = "OFFLINE";
      }
    } else if (req.supermarketId || req.query.supermarketId || req.headers["x-supermarket-id"]) {
      const targetStoreId = req.supermarketId || req.query.supermarketId || req.headers["x-supermarket-id"];
      const targetStoreCode = req.supermarketCode || req.query.supermarketCode || req.headers["x-supermarket-code"];
      const orConditions = [];
      if (targetStoreId && targetStoreId !== "all" && targetStoreId !== "ALL") {
        orConditions.push({ supermarket: targetStoreId });
      }
      if (targetStoreCode && targetStoreCode !== "DEFAULT" && targetStoreCode !== "ALL") {
        orConditions.push({ supermarketCode: targetStoreCode });
      }
      if (orConditions.length > 0) {
        filter.$or = orConditions;
      }

      // If specific purchaseMode requested
      if (req.query.purchaseMode) {
        filter.purchaseMode = req.query.purchaseMode.toUpperCase();
      } else if (req.query.registrationType === "ONLINE" || req.query.source === "ONLINE") {
        filter.purchaseMode = "ONLINE";
      } else if (req.query.registrationType === "OFFLINE" || req.query.source === "OFFLINE") {
        filter.purchaseMode = "OFFLINE";
      }
    } else if (req.query.phone || req.headers["x-customer-phone"]) {
      const cleanPhone = (req.query.phone || req.headers["x-customer-phone"]).replace(/\D/g, "").slice(-10);
      filter["customer.phone"] = { $regex: cleanPhone };
    } else if (!req.user || req.user.role !== "SUPER_ADMIN") {
      return res.status(200).json({ success: true, count: 0, orders: [] });
    }

    // Customer phone filter if provided
    const queryPhone = req.query.phone || req.headers["x-customer-phone"];
    if (queryPhone) {
      const cleanPhone = queryPhone.replace(/\D/g, "").slice(-10);
      const phoneRegex = { $regex: cleanPhone };
      const phoneCondition = {
        $or: [
          { "customer.phone": phoneRegex },
          { deliveryPhone: phoneRegex },
          { customerPhone: phoneRegex },
        ],
      };
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, phoneCondition];
        delete filter.$or;
      } else {
        filter.$or = phoneCondition.$or;
      }
    }

    const orders = await Order.find(filter)
      .populate({
        path: "customer.customerId",
        select: "name phone email address registrationType registeredLocation createdAt status",
      })
      .sort({ createdAt: -1 });

    // Filter genuine real-time orders (both ONLINE and OFFLINE)
    const genuineOrders = orders.filter((order) => {
      const orderNum = String(order.orderNumber || "").toUpperCase();
      const custName = String(order.customer?.name || "").toLowerCase().trim();
      const total = Number(order.totalAmount || 0);

      const isMock =
        ["ORD-948102-1001", "ORD-772109-2001", "ORD-289409", "ORD-289410"].includes(orderNum) ||
        ["kavitha r", "vikram mehta", "arun kumar", "priya sharma", "neha patel", "rahul verma"].includes(custName) ||
        total === 510 ||
        total === 9450;

      if (isMock) return false;
      return true;
    });

    return res.status(200).json({
      success: true,
      count: genuineOrders.length,
      orders: genuineOrders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

// Dedicated Multi-Tenant Notification Feed with Unread Counts
exports.getNotifications = async (req, res) => {
  try {
    const filter = {};

    if (req.user && req.user.role === "CUSTOMER") {
      // STRICT CUSTOMER PRIVACY: Authenticated customers can only view their own orders!
      const cleanPhone = (req.user.phone || "").replace(/\D/g, "").slice(-10);
      const custId = req.user.id || req.user._id;
      const customerConditions = [];
      if (cleanPhone) {
        customerConditions.push({ "customer.phone": { $regex: cleanPhone } });
        customerConditions.push({ deliveryPhone: { $regex: cleanPhone } });
        customerConditions.push({ customerPhone: { $regex: cleanPhone } });
      }
      if (custId) {
        customerConditions.push({ "customer.customerId": custId });
      }
      filter.$or = customerConditions.length > 0 ? customerConditions : [{ "customer.phone": "NONE" }];

      // Enforce strict supermarket isolation: customer only sees orders from their registered supermarket
      if (req.user.supermarketId) {
        filter.supermarket = req.user.supermarketId;
      }
    } else if (req.user && req.user.role === "STORE_ADMIN") {
      const orConditions = [];
      if (req.supermarketId) orConditions.push({ supermarket: req.supermarketId });
      if (req.supermarketCode && req.supermarketCode !== "DEFAULT" && req.supermarketCode !== "ALL") {
        orConditions.push({ supermarketCode: req.supermarketCode });
      }
      if (orConditions.length > 0) {
        filter.$or = orConditions;
      } else {
        return res.status(200).json({ success: true, count: 0, unreadCount: 0, notifications: [] });
      }
    } else if (req.supermarketId) {
      const orConditions = [{ supermarket: req.supermarketId }];
      if (req.supermarketCode && req.supermarketCode !== "DEFAULT" && req.supermarketCode !== "ALL") {
        orConditions.push({ supermarketCode: req.supermarketCode });
      }
      filter.$or = orConditions;
    } else if (!req.user || req.user.role !== "SUPER_ADMIN") {
      return res.status(200).json({ success: true, count: 0, unreadCount: 0, notifications: [] });
    }

    const [orders, cartActivities] = await Promise.all([
      Order.find({
        ...filter,
        paymentStatus: { $in: ["Pending", "Approved", "Completed"] },
      }).sort({ createdAt: -1 }).limit(50),
      CartActivity.find(filter).sort({ createdAt: -1 }).limit(30),
    ]);

    const notifications = [];

    orders.forEach((o) => {
      const isPending = o.paymentStatus === "Pending";
      const custName = o.customer?.name || "Mobile Shopper";
      const amount = Number(o.totalAmount || 0).toFixed(2);
      const notifId = isPending ? `pending-${o._id || o.orderNumber}` : `approved-${o._id || o.orderNumber}`;

      notifications.push({
        id: notifId,
        type: isPending ? "pending" : "approved",
        badge: isPending ? "PRE-BOOKING" : "APPROVED",
        title: isPending ? "New Pre-Booking" : "Pre-Booking Approved",
        actor: custName,
        message: isPending
          ? `${custName} is waiting for payment approval (₹${amount} • ${o.paymentMethod || "UPI"}).`
          : `Payment of ₹${amount} for order #${o.orderNumber} was approved for store exit.`,
        timestamp: isPending ? o.createdAt : (o.approvedAt || o.completedAt || o.createdAt),
        order: o,
        supermarketId: o.supermarket ? o.supermarket.toString() : null,
        supermarketCode: o.supermarketCode,
        supermarketName: o.supermarketName,
      });
    });

    cartActivities.forEach((act) => {
      const custName = act.customerName || "Mobile Shopper";
      const prodName = act.productName || "Product";
      notifications.push({
        id: `cart-${act._id || Math.random()}`,
        type: "cart",
        badge: "ADDED TO CART",
        title: "Cart Item Added",
        actor: custName,
        message: `${custName} added "${prodName}" (Qty: ${act.quantity || 1}) to cart.`,
        timestamp: act.createdAt,
        productName: prodName,
        quantity: act.quantity || 1,
        supermarketId: act.supermarket ? act.supermarket.toString() : null,
        supermarketCode: act.supermarketCode,
      });
    });

    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
      supermarket: {
        id: req.supermarketId,
        code: req.supermarketCode,
        name: req.supermarketName,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

// Universal helper to build flexible MongoDB order query (supports ObjectId, orderNumber with or without '#', exitBarcode)
function buildOrderQuery(id) {
  const cleanId = String(id || "").replace(/^#/, "").trim();
  const conditions = [
    { orderNumber: cleanId },
    { orderNumber: `#${cleanId}` },
    { exitBarcode: cleanId },
  ];
  if (mongoose.Types.ObjectId.isValid(cleanId) && /^[0-9a-fA-F]{24}$/.test(cleanId)) {
    conditions.unshift({ _id: cleanId });
  }
  return { $or: conditions };
}

// Helper to build real-time lifecycle tracking data (Both Store Pickup & Doorstep Delivery)
function formatTrackingData(order) {
  const oType = String(order.orderType || "").toUpperCase();
  const fChoice = String(order.fulfillmentChoice || "").toUpperCase();
  const hasPickupStatus = Boolean(order.pickupStatus && String(order.pickupStatus).trim() !== "");
  const isPickup =
    oType.includes("PICKUP") ||
    fChoice === "STORE_COLLECTION" ||
    hasPickupStatus;

  const timeline = Array.isArray(order.trackingTimeline) ? order.trackingTimeline : [];
  const findEntry = (keyword) => {
    return [...timeline].reverse().find((t) => {
      const s = String(t.status || t.stage || t.title || "").toLowerCase();
      return s.includes(keyword.toLowerCase());
    });
  };

  if (isPickup) {
    const pStatus = String(order.pickupStatus || "Pending").toLowerCase().trim();
    
    // STRICT LIFECYCLE: Pickup is ONLY completed when counter collection is confirmed by staff or customer.
    // NEVER automatically mark completed on payment or order placement!
    const isPickupCompleted =
      pStatus === "completed" ||
      order.customerPickupConfirmed === true ||
      Boolean(order.customerPickupCompletedAt);
    const isPickupReady = (pStatus === "readyforpickup" || pStatus === "ready") && !isPickupCompleted;
    const isPickupPreparing = pStatus === "preparing" && !isPickupReady && !isPickupCompleted;

    // Stage 1: Order Placed & Confirmed (Always completed upon order placement)
    const s1Completed = true;
    const s1Active = !isPickupPreparing && !isPickupReady && !isPickupCompleted;

    // Stage 2: Preparing at Store (Completed only when store moves to Ready or Completed)
    const s2Completed = isPickupReady || isPickupCompleted;
    const s2Active = isPickupPreparing;

    // Stage 3: Ready for Pickup (Completed only when customer actually collects order)
    const s3Completed = isPickupCompleted;
    const s3Active = isPickupReady;

    // Stage 4: Order Completed & Collected (Strictly upon physical counter collection)
    const s4Completed = isPickupCompleted;
    const s4Active = false;

    const e1 = findEntry("confirm") || findEntry("order placed");
    const e2 = findEntry("prep");
    const e3 = findEntry("ready");
    const e4 = findEntry("collect") || findEntry("complete");

    const stages = [
      {
        step: 1,
        id: "ORDER_CONFIRMED",
        title: "Order Placed & Confirmed",
        description: "Your store pickup order has been placed and received by the supermarket.",
        isCompleted: s1Completed,
        isActive: s1Active,
        isPending: false,
        timestamp: order.orderConfirmedAt || e1?.timestamp || order.createdAt,
        updatedBy: e1?.updatedBy || "System",
        role: e1?.role || "SYSTEM",
      },
      {
        step: 2,
        id: "PREPARING",
        title: "Preparing at Store",
        description: "Supermarket store staff is packing and inspecting your items fresh from the shelves.",
        isCompleted: s2Completed,
        isActive: s2Active,
        isPending: !s2Completed && !s2Active,
        timestamp: (s2Completed || s2Active) ? (order.preparingAt || e2?.timestamp || null) : null,
        updatedBy: e2?.updatedBy || "Store Admin",
        role: e2?.role || "STORE_ADMIN",
      },
      {
        step: 3,
        id: "READY_FOR_PICKUP",
        title: "Ready for Pickup",
        description: order.estimatedReadyTime
          ? `Your items are packaged! Please collect at the store pickup counter (Scheduled: ${order.estimatedReadyTime}).`
          : "Your items are packaged and ready for collection at the store pickup counter.",
        isCompleted: s3Completed,
        isActive: s3Active,
        isPending: !s3Completed && !s3Active,
        timestamp: (s3Completed || s3Active) ? (order.pickupReadyAt || e3?.timestamp || null) : null,
        updatedBy: e3?.updatedBy || "Store Admin",
        role: e3?.role || "STORE_ADMIN",
      },
      {
        step: 4,
        id: "PICKUP_COMPLETED",
        title: "Order Completed & Collected",
        description: "Items verified and successfully collected by customer at the supermarket counter. Thank you!",
        isCompleted: s4Completed,
        isActive: false,
        isPending: !s4Completed,
        timestamp: s4Completed ? (order.customerPickupCompletedAt || e4?.timestamp || null) : null,
        updatedBy: e4?.updatedBy || "Store Admin",
        role: e4?.role || "STORE_ADMIN",
      },
    ];

    return {
      isPickup: true,
      fulfillmentType: "SELF_PICKUP",
      fulfillmentBadge: "Store Pickup",
      stages,
      deliveryPartner: null,
      isFailed: false,
      failedReason: "",
      failedDeliveryAt: null,
      estimatedDeliveryTime: order.estimatedReadyTime || order.pickupTimeSlot || "Today",
      estimatedDeliveryDate: order.estimatedReadyDate || order.pickupDate || "Today",
      isCompleted: s4Completed,
      statusTitle: s4Completed
        ? "Order Completed & Collected!"
        : s3Active
        ? "Ready for Pickup at Store Counter"
        : s2Active
        ? "Preparing at Store"
        : "Order Placed & Confirmed",
    };
  }

  // 6-stage Doorstep Delivery
  const dStatus = String(order.deliveryStatus || "New").toLowerCase().trim();
  const payStatus = String(order.paymentStatus || "").toLowerCase().trim();
  const isFailed = dStatus.includes("fail") || dStatus.includes("cancel");

  // CRITICAL: isDelivered is strictly when delivery is completed by delivery partner, NEVER automatically on payment!
  const isDelivered =
    dStatus === "delivered" ||
    (dStatus === "completed" && Boolean(order.deliveryCompletedAt)) ||
    Boolean(order.deliveryCompletedAt);

  // Canonical Delivery Stages (1 to 6 in strict sequential order):
  // 1: Order Confirmed
  // 2: Preparing
  // 3: Delivery Partner Assigned
  // 4: Products Collected
  // 5: Out for Delivery
  // 6: Delivered

  // Stage 1: Order Confirmed
  const e1 = findEntry("confirm") || findEntry("order placed");
  const stage1Completed = true;
  const stage1Active = (dStatus === "new" || dStatus === "pending" || dStatus === "order confirmed" || dStatus === "confirmed") && !isDelivered && !isFailed;
  const stage1Time = order.orderConfirmedAt || e1?.timestamp || order.createdAt;

  // Stage 2: Preparing
  const isPrepOrPast = isDelivered || [
    "preparing",
    "assigned",
    "accepted",
    "delivery partner assigned",
    "orderpickedup",
    "products collected",
    "productscollected",
    "collected",
    "picked up",
    "outfordelivery",
    "out for delivery",
    "delivered",
  ].includes(dStatus);
  const isPrepActive = dStatus === "preparing" && !isDelivered && !isFailed;
  const stage2Completed = (isPrepOrPast && !isPrepActive && dStatus !== "order confirmed" && dStatus !== "new" && dStatus !== "pending") || isDelivered;
  const stage2Active = isPrepActive;
  const e2 = findEntry("prep");
  const stage2Time = stage2Completed ? (order.preparingAt || e2?.timestamp || null) : null;

  // Stage 3: Delivery Partner Assigned
  const isAssignedOrPast = isDelivered || [
    "assigned",
    "accepted",
    "delivery partner assigned",
    "orderpickedup",
    "products collected",
    "productscollected",
    "collected",
    "picked up",
    "outfordelivery",
    "out for delivery",
    "delivered",
  ].includes(dStatus);
  const isAssignedActive = (dStatus === "assigned" || dStatus === "accepted" || dStatus === "delivery partner assigned") && !isDelivered && !isFailed;
  const stage3Completed = (isAssignedOrPast && !isAssignedActive && !isPrepActive && dStatus !== "order confirmed" && dStatus !== "new" && dStatus !== "pending") || isDelivered;
  const stage3Active = isAssignedActive;
  const e3 = findEntry("assign") || findEntry("accept");
  const stage3Time = stage3Completed ? (order.assignedAt || e3?.timestamp || order.deliveryAcceptedAt || null) : null;

  // Stage 4: Products Collected
  const isCollectedOrPast = isDelivered || [
    "orderpickedup",
    "products collected",
    "productscollected",
    "collected",
    "picked up",
    "outfordelivery",
    "out for delivery",
    "delivered",
  ].includes(dStatus);
  const isCollectedActive = ["orderpickedup", "products collected", "productscollected", "collected", "picked up"].includes(dStatus) && !isDelivered && !isFailed;
  const stage4Completed = (isCollectedOrPast && !isCollectedActive && !isAssignedActive && !isPrepActive && dStatus !== "order confirmed" && dStatus !== "new" && dStatus !== "pending") || isDelivered;
  const stage4Active = isCollectedActive;
  const e4 = findEntry("collect") || findEntry("picked");
  const stage4Time = stage4Completed ? (order.productsCollectedAt || order.pickedUpAt || e4?.timestamp || null) : null;

  // Stage 5: Out for Delivery
  const isOutOrDelivered = isDelivered || ["outfordelivery", "out for delivery", "delivered"].includes(dStatus);
  const isOutActive = (dStatus === "outfordelivery" || dStatus === "out for delivery") && !isDelivered && !isFailed;
  const stage5Completed = isDelivered;
  const stage5Active = isOutActive;
  const e5 = findEntry("out");
  const stage5Time = stage5Completed ? (order.deliveryOutAt || e5?.timestamp || null) : null;

  // Stage 6: Delivered
  const e6 = findEntry("deliver");
  const stage6Completed = isDelivered;
  const stage6Active = false;
  const stage6Time = stage6Completed ? (order.deliveryCompletedAt || e6?.timestamp || null) : null;

  const staffName = order.assignedStaffName || (typeof order.assignedStaff === "object" ? order.assignedStaff?.name : "") || "Delivery Partner";

  const stages = [
    {
      step: 1,
      id: "ORDER_CONFIRMED",
      title: "Order Confirmed",
      description: "Your home delivery order has been received and confirmed by the supermarket.",
      isCompleted: stage1Completed,
      isActive: stage1Active,
      isPending: false,
      timestamp: stage1Time,
      updatedBy: e1?.updatedBy || "System",
      role: e1?.role || "SYSTEM",
    },
    {
      step: 2,
      id: "PREPARING",
      title: "Preparing",
      description: "Supermarket store staff is packing and inspecting your items fresh from the shelves.",
      isCompleted: stage2Completed,
      isActive: stage2Active,
      isPending: !stage2Completed && !stage2Active && !isFailed,
      timestamp: stage2Time,
      updatedBy: e2?.updatedBy || "Store Admin",
      role: e2?.role || "STORE_ADMIN",
    },
    {
      step: 3,
      id: "PARTNER_ASSIGNED",
      title: "Delivery Partner Assigned",
      description: order.assignedStaffName
        ? `${staffName} has been assigned to deliver your order.`
        : "A dedicated delivery partner will be assigned to deliver your package.",
      isCompleted: stage3Completed,
      isActive: stage3Active,
      isPending: !stage3Completed && !stage3Active && !isFailed,
      timestamp: stage3Time,
      updatedBy: e3?.updatedBy || "Store Admin",
      role: e3?.role || "STORE_ADMIN",
    },
    {
      step: 4,
      id: "PRODUCTS_COLLECTED",
      title: "Products Collected",
      description: `${staffName} has collected the packed grocery products from the supermarket counter.`,
      isCompleted: stage4Completed,
      isActive: stage4Active,
      isPending: !stage4Completed && !stage4Active && !isFailed,
      timestamp: stage4Time,
      updatedBy: e4?.updatedBy || staffName,
      role: e4?.role || "DELIVERY_STAFF",
    },
    {
      step: 5,
      id: "OUT_FOR_DELIVERY",
      title: "Out for Delivery",
      description: `${staffName} is on the way to your delivery address with your groceries.`,
      isCompleted: stage5Completed,
      isActive: stage5Active,
      isPending: !stage5Completed && !stage5Active && !isFailed,
      timestamp: stage5Time,
      updatedBy: e5?.updatedBy || staffName,
      role: e5?.role || "DELIVERY_STAFF",
    },
    {
      step: 6,
      id: "DELIVERED",
      title: "Delivered",
      description: "Package safely delivered to your doorstep. Thank you for shopping with us!",
      isCompleted: stage6Completed,
      isActive: false,
      isPending: !stage6Completed && !isFailed,
      timestamp: stage6Time,
      updatedBy: e6?.updatedBy || staffName,
      role: e6?.role || "DELIVERY_STAFF",
    },
  ];

  let deliveryPartner = null;
  const hasStaff = Boolean(order.assignedStaff || order.assignedStaffName);
  if ((isAssignedOrPast || isDelivered) && hasStaff) {
    const staffObj = typeof order.assignedStaff === "object" ? order.assignedStaff : null;
    deliveryPartner = {
      _id: staffObj?._id || order.assignedStaff || null,
      name: order.assignedStaffName || staffObj?.name || "Delivery Partner",
      phone: order.assignedStaffPhone || staffObj?.phone || "",
      photoUrl: staffObj?.photoUrl || "",
      assignedAt: order.assignedAt || null,
      status: isDelivered ? "Delivered" : dStatus.includes("out") ? "Out for Delivery" : dStatus.includes("collect") ? "Products Collected" : "Assigned",
    };
  }

  const createdAtDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const etaTarget = new Date(createdAtDate.getTime() + 35 * 60 * 1000);
  const estimatedDeliveryTime = order.estimatedDeliveryTime || etaTarget.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const estimatedDeliveryDate = order.estimatedDeliveryDate || etaTarget.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return {
    isPickup: false,
    fulfillmentType: "DELIVERY",
    fulfillmentBadge: "Doorstep Delivery",
    stages,
    deliveryPartner,
    isFailed,
    failedReason: order.failedReason || "",
    failedDeliveryAt: order.failedDeliveryAt || null,
    estimatedDeliveryTime,
    estimatedDeliveryDate,
    isCompleted: stage6Completed,
    statusTitle: stage6Completed
      ? "Delivered to Your Doorstep"
      : stage5Active
      ? "Out for Delivery"
      : stage4Active
      ? "Products Collected"
      : stage3Active
      ? "Delivery Partner Assigned"
      : stage2Active
      ? "Preparing Your Order"
      : "Order Confirmed",
  };
}

// Get order by ID or orderNumber (with populated tracking & partner details)
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const cleanId = String(id || "").replace(/^#/, "").trim();

    const query = {
      $or: [
        { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null },
        { orderNumber: cleanId },
        { orderNumber: `#${cleanId}` },
        { exitBarcode: cleanId },
      ],
    };
    if (req.user && req.user.role === "STORE_ADMIN" && req.supermarketId) {
      query.supermarket = req.supermarketId;
    }

    const order = await Order.findOne(query)
      .populate("assignedStaff", "name username phone email status photoUrl")
      .populate("supermarket", "name code address city state phone email logoUrl")
      .populate({
        path: "customer.customerId",
        select: "name phone email address registrationType",
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const trackingMeta = formatTrackingData(order);

    return res.status(200).json({
      success: true,
      order,
      tracking: trackingMeta,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

// Dedicated Amazon-Style Customer Real-Time Order Tracking Endpoint
exports.getOrderTracking = async (req, res) => {
  try {
    const { id } = req.params;
    const cleanId = String(id || "").replace(/^#/, "").trim();

    const query = {
      $or: [
        { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null },
        { orderNumber: cleanId },
        { orderNumber: `#${cleanId}` },
        { exitBarcode: cleanId },
      ],
    };

    const order = await Order.findOne(query)
      .populate("assignedStaff", "name username phone email status photoUrl")
      .populate("supermarket", "name code address city state phone email logoUrl");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const trackingMeta = formatTrackingData(order);

    return res.status(200).json({
      success: true,
      orderNumber: order.orderNumber,
      orderId: order._id,
      isPickup: trackingMeta.isPickup,
      fulfillmentType: trackingMeta.fulfillmentType,
      fulfillmentBadge: trackingMeta.fulfillmentBadge,
      statusTitle: trackingMeta.statusTitle,
      isCompleted: trackingMeta.isCompleted,
      deliveryStatus: order.deliveryStatus,
      pickupStatus: order.pickupStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      totalItems: order.totalItems,
      items: order.items,
      deliveryAddress: order.deliveryAddress,
      deliveryPhone: order.deliveryPhone,
      deliveryCustomerName: order.deliveryCustomerName || order.customer?.name,
      supermarket: order.supermarket,
      supermarketName: order.supermarketName,
      createdAt: order.createdAt,
      stages: trackingMeta.stages,
      deliveryPartner: trackingMeta.deliveryPartner,
      estimatedDeliveryTime: trackingMeta.estimatedDeliveryTime,
      estimatedDeliveryDate: trackingMeta.estimatedDeliveryDate,
      order,
    });
  } catch (error) {
    console.error("Order tracking error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order tracking details",
      error: error.message,
    });
  }
};

// Super Admin / Store Admin approves customer payment (Status: Approved)
exports.approvePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const query = buildOrderQuery(id);
    if (req.user && req.user.role === "STORE_ADMIN" && req.supermarketId) {
      query.supermarket = req.supermarketId;
    }

    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or you do not have permission to access it.",
      });
    }

    if (order.paymentStatus !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve this order because its status is ${order.paymentStatus}.`,
      });
    }

    order.paymentStatus = "Approved";
    order.approvedAt = new Date();
    await order.save();

    try {
      const io = req.app?.get("io");
      if (io) {
        emitTenantNotification(io, "admin:notification", {
          id: `approved-${order._id || order.orderNumber}`,
          type: "approved",
          badge: "APPROVED",
          title: "Pre-Booking Approved",
          actor: order.customer?.name || "Shopper",
          message: `${order.customer?.name || "Shopper"} was approved for store exit.`,
          timestamp: order.approvedAt || new Date().toISOString(),
          order,
          supermarketId: order.supermarket ? order.supermarket.toString() : null,
          supermarketCode: order.supermarketCode,
          customerName: order.customer?.name || "Shopper",
          totalAmount: order.totalAmount,
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `Order #${order.orderNumber} payment approved. Ready for store exit.`,
      order,
    });
  } catch (error) {
    console.error("Approve payment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve payment",
      error: error.message,
    });
  }
};

// Super Admin / System completes customer payment and verifies transaction (Status: Completed)
exports.completePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const query = buildOrderQuery(id);
    if (req.user && req.user.role === "STORE_ADMIN" && req.supermarketId) {
      query.supermarket = req.supermarketId;
    }

    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or you do not have permission to access it.",
      });
    }

    if (order.paymentStatus === "Completed") {
      return res.status(200).json({
        success: true,
        message: `Order #${order.orderNumber} is already completed.`,
        order,
      });
    }

    if (order.paymentStatus !== "Approved" && order.paymentStatus !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot complete this order because its status is ${order.paymentStatus}.`,
      });
    }

    // Atomically deduct stock from inventory if not done already
    await deductOrderInventory(order);

    order.paymentStatus = "Completed";
    // Only mark completedAt if order is offline. Delivery orders are completed later upon genuine doorstep delivery.
    if (order.isOffline || (!order.deliveryStatus && !order.pickupStatus)) {
      order.completedAt = new Date();
    }
    if (!order.paymentId || order.paymentId.startsWith("PENDING")) {
      order.paymentId = `${order.paymentMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`;
    }

    // Automatically sync fulfillment lifecycle status when order payment is marked completed
    const oType = String(order.orderType || "").toUpperCase();
    const fChoice = String(order.fulfillmentChoice || "").toUpperCase();
    if (oType.includes("PICKUP") || fChoice === "STORE_COLLECTION" || order.pickupStatus) {
      if (!order.pickupStatus || order.pickupStatus === "New" || order.pickupStatus === "Pending") {
        order.pickupStatus = "Order Confirmed";
      }
    } else if (order.deliveryStatus) {
      // CRITICAL FIX: Payment success must NEVER mark home delivery as Delivered!
      if (!order.deliveryStatus || order.deliveryStatus === "New" || order.deliveryStatus === "Pending") {
        order.deliveryStatus = "Order Confirmed";
        if (!order.orderConfirmedAt) order.orderConfirmedAt = new Date();
      }
    }
    await order.save();

    // Broadcast real-time order update so customer mobile app and admin dashboards reflect changes immediately
    try {
      const io = req.app?.get("io");
      if (io) {
        io.emit("order:updated", { order });
        io.emit("order:tracking_update", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          deliveryStatus: order.deliveryStatus,
          pickupStatus: order.pickupStatus,
          paymentStatus: order.paymentStatus,
          completedAt: order.completedAt,
          order,
        });
      }
    } catch (_) {}

    // Send digital receipt and exit QR via Brevo SMTP if customer email is provided
    if (order.customer?.email) {
      sendOrderReceiptEmail({ order, customerEmail: order.customer.email }).catch((err) => {
        console.warn("⚠️ Digital receipt delivery notice:", err.message);
      });
    }

    return res.status(200).json({
      success: true,
      message: `Order #${order.orderNumber} marked as Completed & stock verified.`,
      order,
    });
  } catch (error) {
    console.error("Complete payment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to complete payment",
      error: error.message,
    });
  }
};

// Update order payment status dynamically
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, failureReason } = req.body;

    if (!["Pending", "Approved", "Completed", "Failed", "Network Error"].includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status. Must be Pending, Approved, Completed, Failed, or Network Error.",
      });
    }

    const query = {
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { orderNumber: id },
        { exitBarcode: id },
      ],
    };
    if (req.user && req.user.role === "STORE_ADMIN" && req.supermarketId) {
      query.supermarket = req.supermarketId;
    }

    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or you do not have permission to access it.",
      });
    }

    if (paymentStatus === "Completed" && order.paymentStatus !== "Approved") {
      return res.status(400).json({
        success: false,
        message: "Payment must be approved before completion.",
      });
    }

    if (paymentStatus === "Completed" && order.paymentMethod === "Cash") {
      return res.status(400).json({
        success: false,
        message: "Cash orders must use the cash confirmation workflow.",
      });
    }

    if (paymentStatus === "Completed") {
      await deductOrderInventory(order);
      if (order.isOffline || (!order.deliveryStatus && !order.pickupStatus)) {
        order.completedAt = new Date();
      }
      if (!order.paymentId || order.paymentId.startsWith("PENDING")) {
        order.paymentId = `${order.paymentMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`;
      }
      const oType = String(order.orderType || "").toUpperCase();
      const fChoice = String(order.fulfillmentChoice || "").toUpperCase();
      if (oType.includes("PICKUP") || fChoice === "STORE_COLLECTION" || order.pickupStatus) {
        if (!order.pickupStatus || order.pickupStatus === "New" || order.pickupStatus === "Pending") {
          order.pickupStatus = "Order Confirmed";
        }
      } else if (order.deliveryStatus) {
        // CRITICAL FIX: Payment success must NEVER mark home delivery as Delivered!
        if (!order.deliveryStatus || order.deliveryStatus === "New" || order.deliveryStatus === "Pending") {
          order.deliveryStatus = "Order Confirmed";
          if (!order.orderConfirmedAt) order.orderConfirmedAt = new Date();
        }
      }
    } else if (paymentStatus === "Approved") {
      order.approvedAt = new Date();
    }

    order.paymentStatus = paymentStatus;
    if (failureReason !== undefined) {
      order.failureReason = failureReason;
    }
    await order.save();

    // Broadcast real-time order update
    try {
      const io = req.app?.get("io");
      if (io) {
        io.emit("order:updated", { order });
        io.emit("order:tracking_update", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          deliveryStatus: order.deliveryStatus,
          pickupStatus: order.pickupStatus,
          paymentStatus: order.paymentStatus,
          completedAt: order.completedAt,
          order,
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `Order #${order.orderNumber} status changed to ${paymentStatus}.`,
      order,
    });
  } catch (error) {
    console.error("Update payment status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update payment status",
      error: error.message,
    });
  }
};

// Confirm cash payment by supermarket cashier/staff & atomically deduct inventory
exports.confirmCashPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const query = {
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { orderNumber: id },
        { exitBarcode: id },
      ],
    };
    if (req.user && req.user.role === "STORE_ADMIN" && req.supermarketId) {
      query.supermarket = req.supermarketId;
    }

    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or you do not have permission to access it.",
      });
    }

    if (order.paymentMethod !== "Cash") {
      return res.status(400).json({
        success: false,
        message: "This order is not a cash payment.",
      });
    }

    if (order.paymentStatus !== "Approved") {
      return res.status(400).json({
        success: false,
        message: "Order must be approved before cash confirmation.",
      });
    }

    // Atomically deduct stock from inventory now that cash is collected
    await deductOrderInventory(order);

    order.paymentStatus = "Completed";
    order.completedAt = new Date();
    order.paymentId = `CASH-${Date.now().toString().slice(-6)}`;
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Cash payment confirmed successfully! Stock deducted.",
      order,
    });
  } catch (error) {
    console.error("Confirm cash error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to confirm cash payment",
      error: error.message,
    });
  }
};

// Get consolidated Admin Dashboard statistics (Strict Multi-Tenant Scoping)
exports.getAdminStats = async (req, res) => {
  try {
    const prodFilter = { isActive: { $ne: false } };
    const ordFilter = {};
    const cartFilter = {};

    if (req.user && req.user.role === "STORE_ADMIN") {
      const orConditions = [];
      if (req.supermarketId) orConditions.push({ supermarket: req.supermarketId });
      if (req.supermarketCode && req.supermarketCode !== "DEFAULT" && req.supermarketCode !== "ALL") {
        orConditions.push({ supermarketCode: req.supermarketCode });
      }
      if (orConditions.length > 0) {
        ordFilter.$or = orConditions;
        cartFilter.$or = orConditions;
        if (req.supermarketId) prodFilter.supermarket = req.supermarketId;
      } else {
        return res.status(200).json({ success: true, stats: {} });
      }
    } else if (req.supermarketId) {
      prodFilter.supermarket = req.supermarketId;
      ordFilter.supermarket = req.supermarketId;
      cartFilter.supermarket = req.supermarketId;
    }
    const products = await Product.find(prodFilter);
    const rawOrders = await Order.find(ordFilter).sort({ createdAt: -1 });

    // Filter out any mock / test dummy orders
    const allOrders = rawOrders.filter((order) => {
      const orderNum = String(order.orderNumber || "").toUpperCase();
      const custName = String(order.customer?.name || "").toLowerCase().trim();
      const total = Number(order.totalAmount || 0);
      return !(
        ["ORD-948102-1001", "ORD-772109-2001", "ORD-289409", "ORD-289410"].includes(orderNum) ||
        ["kavitha r", "vikram mehta", "arun kumar", "priya sharma", "neha patel", "rahul verma"].includes(custName) ||
        total === 510 ||
        total === 9450
      );
    });

    const completedOrders = allOrders.filter(
      (o) => o.paymentStatus === "Completed" || o.paymentStatus === "Approved"
    );
    const approvedOrders = allOrders.filter((o) => o.paymentStatus === "Approved");
    const pendingOrders = allOrders.filter((o) => o.paymentStatus === "Pending");
    const pendingCashOrders = allOrders.filter(
      (o) => o.paymentMethod === "Cash" && o.paymentStatus === "Pending"
    );

    const totalProducts = products.length;

    let totalInventoryValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    const categoryMap = {};

    for (const p of products) {
      const stock = Number(p.stock || 0);
      const price = Number(p.price || 0);
      totalInventoryValue += stock * price;

      const threshold = Number(p.lowStockThreshold || 5);
      if (stock === 0) {
        outOfStockCount++;
      } else if (stock <= threshold) {
        lowStockCount++;
      }

      const cat = p.category || "Other";
      if (!categoryMap[cat]) {
        categoryMap[cat] = { count: 0, value: 0 };
      }
      categoryMap[cat].count += 1;
      categoryMap[cat].value += stock * price;
    }

    const totalSales = completedOrders.reduce((sum, ord) => sum + (ord.totalAmount || 0), 0);
    const totalOrders = completedOrders.length;
    const pendingCashOrdersCount = pendingCashOrders.length;

    // Format category distribution for charts
    const categoryDistribution = Object.keys(categoryMap).map((cat) => ({
      name: cat,
      count: categoryMap[cat].count,
      value: categoryMap[cat].value,
    }));

    // Recent orders (last 8)
    const recentOrders = allOrders.slice(0, 8);

    // Live customer cart activities (latest 8) scoped to supermarket
    const recentCartActivity = await CartActivity.find(cartFilter).sort({ createdAt: -1 }).limit(8);

    // Active carts (within past 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    let activeCartsCount = 0;
    try {
      const activeSessions = await CartActivity.distinct("sessionId", {
        createdAt: { $gte: twoHoursAgo },
        action: { $in: ["added", "updated"] },
        ...(req.supermarketId ? { supermarket: req.supermarketId } : {}),
      });
      activeCartsCount = activeSessions.length;
    } catch (_) {
      activeCartsCount = 0;
    }

    // Distinct registered customers count
    const customerPhoneSet = new Set();
    allOrders.forEach((o) => {
      const p = o.customer?.phone || o.customer?.name;
      if (p) customerPhoneSet.add(p);
    });
    const totalCustomers = customerPhoneSet.size;

    return res.status(200).json({
      success: true,
      stats: {
        totalProducts,
        totalInventoryValue,
        totalSales,
        totalOrders,
        totalCustomers,
        pendingCashOrdersCount,
        allOrdersCount: allOrders.length,
        lowStockCount,
        outOfStockCount,
        categoryDistribution,
        recentOrders,
        recentCartActivity,
        activeCartsCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to generate dashboard statistics",
      error: error.message,
    });
  }
};

// Reports Management - Uses only existing MongoDB records (Strict Multi-Tenant Scoping)
exports.getReports = async (req, res) => {
  try {
    const { from, to } = req.query;

    const startDate = from ? new Date(from) : null;
    const endDate = to ? new Date(to) : null;

    if (
      (from && Number.isNaN(startDate.getTime())) ||
      (to && Number.isNaN(endDate.getTime()))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid report date range.",
      });
    }

    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }

    const ordQuery = {};
    const prodQuery = { isActive: { $ne: false } };

    if (req.user && req.user.role === "STORE_ADMIN") {
      const orConditions = [];
      if (req.supermarketId) orConditions.push({ supermarket: req.supermarketId });
      if (req.supermarketCode && req.supermarketCode !== "DEFAULT" && req.supermarketCode !== "ALL") {
        orConditions.push({ supermarketCode: req.supermarketCode });
      }
      if (orConditions.length > 0) {
        ordQuery.$or = orConditions;
        if (req.supermarketId) prodQuery.supermarket = req.supermarketId;
      } else {
        return res.status(200).json({ success: true, reports: {} });
      }
    } else if (req.supermarketId) {
      ordQuery.supermarket = req.supermarketId;
      prodQuery.supermarket = req.supermarketId;
    }
    const rawOrders = await Order.find(ordQuery).sort({ createdAt: -1 }).lean();
    const products = await Product.find(prodQuery).sort({ createdAt: -1 }).lean();

    // Strictly exclude any dummy/mock orders
    const allOrders = rawOrders.filter((order) => {
      const orderNum = String(order.orderNumber || "").toUpperCase();
      const custName = String(order.customer?.name || "").toLowerCase().trim();
      const total = Number(order.totalAmount || 0);
      return !(
        ["ORD-948102-1001", "ORD-772109-2001", "ORD-289409", "ORD-289410"].includes(orderNum) ||
        ["kavitha r", "vikram mehta", "arun kumar", "priya sharma", "neha patel", "rahul verma"].includes(custName) ||
        total === 510 ||
        total === 9450
      );
    });

    const filteredOrders = allOrders.filter((order) => {
      const reportDate = new Date(
        order.paymentStatus === "Completed"
          ? order.completedAt || order.createdAt
          : order.createdAt
      );

      if (Number.isNaN(reportDate.getTime())) return false;
      if (startDate && reportDate < startDate) return false;
      if (endDate && reportDate > endDate) return false;

      return true;
    });

    const completedOrders = filteredOrders.filter(
      (order) => order.paymentStatus === "Completed" || order.paymentStatus === "Approved"
    );

    const totalSales = completedOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0
    );

    const productsSold = completedOrders.reduce(
      (sum, order) =>
        sum +
        (order.items || []).reduce(
          (itemSum, item) => itemSum + Number(item.quantity || 0),
          0
        ),
      0
    );

    const customerKeys = new Set();

    filteredOrders.forEach((order) => {
      const customer = order.customer || {};
      const key = customer.phone || customer.email || customer.name;

      if (key) customerKeys.add(String(key).trim().toLowerCase());
    });

    const lowStockProducts = products.filter(
      (product) =>
        Number(product.stock) > 0 &&
        Number(product.stock) <= Number(product.lowStockThreshold ?? 5)
    );

    const outOfStockProducts = products.filter(
      (product) => Number(product.stock) <= 0
    );

    const paymentMethods = {};

    completedOrders.forEach((order) => {
      const method = order.paymentMethod || "Unknown";

      if (!paymentMethods[method]) {
        paymentMethods[method] = { orders: 0, sales: 0 };
      }

      paymentMethods[method].orders += 1;
      paymentMethods[method].sales += Number(order.totalAmount || 0);
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalSales,
        totalOrders: filteredOrders.length,
        completedOrders: completedOrders.length,
        pendingOrders: filteredOrders.filter(
          (order) => order.paymentStatus === "Pending"
        ).length,
        approvedOrders: filteredOrders.filter(
          (order) => order.paymentStatus === "Approved"
        ).length,
        failedOrders: filteredOrders.filter(
          (order) => order.paymentStatus === "Failed"
        ).length,
        networkErrorOrders: filteredOrders.filter(
          (order) => order.paymentStatus === "Network Error"
        ).length,
        networkErrorAmount: filteredOrders
          .filter((order) => order.paymentStatus === "Network Error")
          .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0),
        productsSold,
        totalCustomers: customerKeys.size,
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
      },
      paymentMethods,
      orders: filteredOrders,
      completedOrders,
      products,
      lowStockProducts,
      outOfStockProducts,
    });
  } catch (error) {
    console.error("Reports API Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate reports.",
      error: error.message,
    });
  }
};

// DELETE /api/orders/:id - Permanently delete an order from database
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const query = buildOrderQuery(id);
    if (req.supermarketId) {
      query.supermarket = req.supermarketId;
    }

    const order = await Order.findOneAndDelete(query);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or already permanently deleted.",
      });
    }

    // Record in DeletedRecord
    try {
      const DeletedRecord = require("../models/DeletedRecord");
      await DeletedRecord.create({
        entityType: "ORDER",
        identifier: order.orderNumber || String(order._id),
        secondaryIdentifier: String(order._id),
        name: `Order #${order.orderNumber || id}`,
        metadata: {
          totalAmount: order.totalAmount,
          supermarket: order.supermarket,
          supermarketCode: order.supermarketCode,
          customerName: order.customer?.name,
        },
      });
    } catch (_) {}

    // Broadcast real-time deletion
    try {
      const io = req.app?.get("io");
      if (io) {
        io.emit("order:deleted", {
          id: String(order._id),
          orderNumber: order.orderNumber,
          supermarketId: order.supermarket ? String(order.supermarket) : null,
          supermarketCode: order.supermarketCode,
        });
        io.emit("platform:stats_updated", {
          type: "ORDER_DELETED",
          id: String(order._id),
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `Order #${order.orderNumber || id} permanently deleted from database.`,
      deletedId: String(order._id),
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    console.error("Delete order error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete order.",
      error: error.message,
    });
  }
};

// Update Self-Pickup status (Pending, ReadyForPickup, Completed, Cancelled)
exports.updatePickupStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { pickupStatus, estimatedReadyTime, estimatedReadyDate, instructions } = req.body;

    const validStatuses = ["New", "Pending", "Preparing", "ReadyForPickup", "Completed", "Cancelled"];
    if (pickupStatus && !validStatuses.includes(pickupStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid pickup status. Allowed: ${validStatuses.join(", ")}`,
      });
    }

    const query = buildOrderQuery(id);
    if (req.supermarketId) {
      query.supermarket = req.supermarketId;
    }

    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (pickupStatus) {
      order.pickupStatus = pickupStatus;
    }
    if (estimatedReadyTime) {
      order.estimatedReadyTime = estimatedReadyTime;
    }
    if (estimatedReadyDate) {
      order.estimatedReadyDate = estimatedReadyDate;
    }
    if (instructions) {
      order.pickupInstructions = instructions;
    }
    if (pickupStatus === "Preparing") {
      if (!order.preparingAt) order.preparingAt = new Date();
      if (!Array.isArray(order.trackingTimeline)) order.trackingTimeline = [];
      order.trackingTimeline.push({
        status: "Preparing at Store",
        stage: "PREPARING",
        title: "Preparing at Store",
        description: "Supermarket store staff is packing and inspecting your items fresh from the shelves.",
        timestamp: order.preparingAt,
        updatedBy: req.user?.name || "Store Admin",
        role: "STORE_ADMIN",
      });
    }
    if (pickupStatus === "ReadyForPickup") {
      order.pickupReadyNotificationSent = true;
      if (!order.pickupReadyAt) order.pickupReadyAt = new Date();
      if (!Array.isArray(order.trackingTimeline)) order.trackingTimeline = [];
      order.trackingTimeline.push({
        status: "Ready for Pickup",
        stage: "READY_FOR_PICKUP",
        title: "Ready for Pickup",
        description: `Your items are packaged and ready for collection at the store pickup counter.`,
        timestamp: order.pickupReadyAt,
        updatedBy: req.user?.name || "Store Admin",
        role: "STORE_ADMIN",
      });
    }
    if (pickupStatus === "Completed") {
      order.customerPickupConfirmed = true;
      if (!order.customerPickupCompletedAt) order.customerPickupCompletedAt = new Date();
      order.completedAt = order.customerPickupCompletedAt;
      if (order.paymentStatus === "Pending" || order.paymentStatus === "Approved") {
        order.paymentStatus = "Completed";
      }
      if (!Array.isArray(order.trackingTimeline)) order.trackingTimeline = [];
      order.trackingTimeline.push({
        status: "Order Completed & Collected",
        stage: "PICKUP_COMPLETED",
        title: "Order Completed & Collected",
        description: "Items verified and successfully collected by customer at the supermarket counter.",
        timestamp: order.customerPickupCompletedAt,
        updatedBy: req.user?.name || "Store Admin",
        role: "STORE_ADMIN",
      });
    }

    // Save embedded customer review if provided during pickup status update
    if (req.body.rating || (req.body.review && req.body.review.rating)) {
      const numRating = Number(req.body.rating || req.body.review.rating);
      const revComment = (req.body.comment || req.body.review?.comment || "").trim();
      const custName = (req.body.customerName || req.body.review?.customerName || order.customer?.name || "Verified Customer").trim();
      order.review = {
        rating: numRating,
        comment: revComment,
        submittedAt: new Date(),
        customerName: custName,
      };
      try {
        const Review = require("../models/Review");
        await Review.findOneAndUpdate(
          { order: order._id },
          {
            order: order._id,
            orderNumber: order.orderNumber,
            supermarket: order.supermarket || null,
            supermarketCode: order.supermarketCode || "",
            supermarketName: order.supermarketName || "",
            customer: {
              customerId: order.customer?.customerId || null,
              name: custName,
              phone: order.customer?.phone || "",
              email: order.customer?.email || "",
            },
            rating: numRating,
            comment: revComment,
            orderType: order.orderType || "SELF_PICKUP",
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (_) {}
    }

    await order.save();

    try {
      const io = req.app?.get("io");
      if (io) {
        io.emit("order:updated", { order });
        io.emit("order:tracking_update", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          pickupStatus: order.pickupStatus,
          paymentStatus: order.paymentStatus,
          completedAt: order.completedAt,
          order,
        });
        if (pickupStatus === "ReadyForPickup") {
          io.emit("order:pickup_ready", {
            orderId: order._id,
            orderNumber: order.orderNumber,
            estimatedReadyTime: order.estimatedReadyTime,
            estimatedReadyDate: order.estimatedReadyDate,
            message: `Your order will be ready for pickup at ${order.estimatedReadyTime || "the scheduled time"}. Please visit the store and collect your products.`,
          });
        }
        if (pickupStatus === "Completed") {
          io.emit("order:pickup_completed", {
            orderId: order._id,
            orderNumber: order.orderNumber,
            customerName: order.customer?.name || "Customer",
            collectedAt: order.customerPickupCompletedAt,
          });
        }
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `Pickup status updated to "${pickupStatus}" for Order #${order.orderNumber}.`,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update pickup status",
      error: error.message,
    });
  }
};

// Customer selects Option A (Deliver to My Doorstep) or Option B (Collect from Store) after Self Pickup payment
exports.setFulfillmentChoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { fulfillmentChoice, deliveryAddress, deliveryPhone } = req.body;

    if (!["DOORSTEP_DELIVERY", "STORE_COLLECTION"].includes(fulfillmentChoice)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fulfillment choice. Must be 'DOORSTEP_DELIVERY' or 'STORE_COLLECTION'.",
      });
    }

    const query = buildOrderQuery(id);
    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (fulfillmentChoice === "DOORSTEP_DELIVERY") {
      order.orderType = "SELF_PICKUP_DOORSTEP";
      order.fulfillmentChoice = "DOORSTEP_DELIVERY";
      order.deliveryStatus = "New";
      if (deliveryAddress && deliveryAddress.trim()) {
        order.deliveryAddress = deliveryAddress.trim();
        if (order.customer) order.customer.address = deliveryAddress.trim();
      }
      if (deliveryPhone && deliveryPhone.trim()) {
        order.deliveryPhone = deliveryPhone.trim();
      }
    } else {
      order.orderType = "SELF_PICKUP_STORE_COLLECTION";
      order.fulfillmentChoice = "STORE_COLLECTION";
      order.pickupStatus = "New";
    }

    await order.save();

    try {
      const io = req.app?.get("io");
      if (io) {
        io.emit("order:updated", { order });
        io.emit("order:fulfillment_chosen", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          fulfillmentChoice,
          orderType: order.orderType,
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: fulfillmentChoice === "DOORSTEP_DELIVERY"
        ? "Doorstep delivery selected. Order dispatched to Store Admin Delivery team."
        : "Store collection selected. Order sent to Store Admin for packing & pickup preparation.",
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to set fulfillment choice",
      error: error.message,
    });
  }
};

// Store Admin sets estimated pickup-ready date/time and sends notification to customer
exports.setPickupReady = async (req, res) => {
  try {
    const { id } = req.params;
    const { estimatedReadyTime = "5:30 PM", estimatedReadyDate = "Today", instructions = "Please visit the store and collect your products." } = req.body;

    const query = buildOrderQuery(id);
    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    order.pickupStatus = "ReadyForPickup";
    order.estimatedReadyTime = estimatedReadyTime.trim();
    order.estimatedReadyDate = estimatedReadyDate.trim();
    order.pickupInstructions = instructions.trim();
    order.pickupReadyNotificationSent = true;
    if (!order.pickupReadyAt) order.pickupReadyAt = new Date();
    if (!Array.isArray(order.trackingTimeline)) order.trackingTimeline = [];
    order.trackingTimeline.push({
      status: "Ready for Pickup",
      stage: "READY_FOR_PICKUP",
      title: "Ready for Pickup",
      description: `Your order will be ready for pickup at ${order.estimatedReadyTime}. Please visit the store and collect your products.`,
      timestamp: order.pickupReadyAt,
      updatedBy: req.user?.name || "Store Admin",
      role: "STORE_ADMIN",
    });
    await order.save();

    const notifMessage = `Your order will be ready for pickup at ${order.estimatedReadyTime}. Please visit the store and collect your products.`;

    try {
      const io = req.app?.get("io");
      if (io) {
        io.emit("order:updated", { order });
        io.emit("order:pickup_ready", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          estimatedReadyTime: order.estimatedReadyTime,
          estimatedReadyDate: order.estimatedReadyDate,
          message: notifMessage,
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `Pickup ready notification sent to customer for Order #${order.orderNumber}.`,
      notifMessage,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark order as ready for pickup",
      error: error.message,
    });
  }
};

// Customer physically collects order and clicks Complete in mobile app
exports.customerCompletePickup = async (req, res) => {
  try {
    const { id } = req.params;

    const query = buildOrderQuery(id);
    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    order.pickupStatus = "Completed";
    order.paymentStatus = "Completed";
    order.customerPickupConfirmed = true;
    order.customerPickupCompletedAt = new Date();
    order.completedAt = new Date();
    if (!Array.isArray(order.trackingTimeline)) order.trackingTimeline = [];
    order.trackingTimeline.push({
      status: "Order Completed & Collected",
      stage: "PICKUP_COMPLETED",
      title: "Order Completed & Collected",
      description: "Items verified and successfully collected by customer at the supermarket counter.",
      timestamp: order.customerPickupCompletedAt,
      updatedBy: req.body?.adminOverride ? "Store Admin" : (order.customer?.name || "Customer"),
      role: req.body?.adminOverride ? "STORE_ADMIN" : "CUSTOMER",
    });

    // Deduct stock if not already done
    try {
      await deductOrderInventory(order);
    } catch (_) {}

    // Save customer review if included with completion payload
    if (req.body.rating || (req.body.review && req.body.review.rating)) {
      const numRating = Number(req.body.rating || req.body.review.rating);
      const revComment = (req.body.comment || req.body.review?.comment || "").trim();
      const custName = (req.body.customerName || req.body.review?.customerName || order.customer?.name || "Verified Customer").trim();
      order.review = {
        rating: numRating,
        comment: revComment,
        submittedAt: new Date(),
        customerName: custName,
      };
      try {
        const Review = require("../models/Review");
        await Review.findOneAndUpdate(
          { order: order._id },
          {
            order: order._id,
            orderNumber: order.orderNumber,
            supermarket: order.supermarket || null,
            supermarketCode: order.supermarketCode || "",
            supermarketName: order.supermarketName || "",
            customer: {
              customerId: order.customer?.customerId || null,
              name: custName,
              phone: order.customer?.phone || "",
              email: order.customer?.email || "",
            },
            rating: numRating,
            comment: revComment,
            orderType: order.orderType || "SELF_PICKUP",
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (_) {}
    }

    await order.save();

    try {
      const io = req.app?.get("io");
      if (io) {
        io.emit("order:updated", { order });
        io.emit("order:tracking_update", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          pickupStatus: order.pickupStatus,
          paymentStatus: order.paymentStatus,
          completedAt: order.customerPickupCompletedAt,
          order,
        });
        io.emit("order:pickup_completed", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          customerName: order.customer?.name || "Customer",
          collectedAt: order.customerPickupCompletedAt,
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `Order #${order.orderNumber} successfully marked as Completed & Collected!`,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to complete pickup",
      error: error.message,
    });
  }
};

// Update Delivery status (Order Confirmed, Preparing, Assigned, Products Collected, Out for Delivery, Delivered)
exports.updateDeliveryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryStatus, assignedStaffName, assignedStaffId, notes } = req.body;

    const query = buildOrderQuery(id);
    if (req.supermarketId) {
      query.supermarket = req.supermarketId;
    }

    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const previousStatus = order.deliveryStatus || "Order Confirmed";
    const now = new Date();
    const sLower = String(deliveryStatus || "").toLowerCase().trim();

    let canonicalStatus = deliveryStatus;
    let timelineStage = "Order Confirmed";
    let timelineTitle = "Order Confirmed";
    let timelineDesc = notes || "";

    if (sLower === "order confirmed" || sLower === "confirmed" || sLower === "new") {
      canonicalStatus = "Order Confirmed";
      timelineStage = "Order Confirmed";
      if (!order.orderConfirmedAt) order.orderConfirmedAt = now;
      timelineTitle = "Order Confirmed";
      timelineDesc = notes || "Your order has been confirmed and received by the supermarket.";
    } else if (sLower === "preparing") {
      canonicalStatus = "Preparing";
      timelineStage = "Preparing";
      order.preparingAt = now;
      timelineTitle = "Preparing Your Order";
      timelineDesc = notes || "The supermarket team is picking, packing, and quality-checking your items.";
    } else if (sLower === "assigned" || sLower === "accepted" || sLower === "delivery partner assigned") {
      canonicalStatus = "Assigned";
      timelineStage = "Delivery Partner Assigned";
      order.assignedAt = now;
      if (assignedStaffId) order.assignedStaff = assignedStaffId;
      if (assignedStaffName) order.assignedStaffName = assignedStaffName;
      timelineTitle = "Delivery Partner Assigned";
      timelineDesc = notes || `${order.assignedStaffName || "Delivery partner"} has been assigned to your order.`;
    } else if (sLower === "products collected" || sLower === "orderpickedup" || sLower === "collected" || sLower === "picked up") {
      canonicalStatus = "Products Collected";
      timelineStage = "Products Collected";
      order.productsCollectedAt = now;
      order.pickedUpAt = now;
      timelineTitle = "Products Collected";
      timelineDesc = notes || `${order.assignedStaffName || "Delivery partner"} has collected the packed grocery products from the supermarket counter.`;
    } else if (sLower === "out for delivery" || sLower === "outfordelivery") {
      canonicalStatus = "Out for Delivery";
      timelineStage = "Out for Delivery";
      order.deliveryOutAt = now;
      timelineTitle = "Out for Delivery";
      timelineDesc = notes || `${order.assignedStaffName || "Delivery partner"} is on the way to your delivery address.`;
    } else if (sLower === "delivered" || sLower === "completed") {
      canonicalStatus = "Delivered";
      timelineStage = "Delivered";
      order.deliveryCompletedAt = now;
      order.completedAt = now;
      if (order.paymentStatus === "Pending") {
        order.paymentStatus = "Completed";
      }
      timelineTitle = "Order Delivered";
      timelineDesc = notes || "Your groceries have been successfully delivered to your doorstep. Thank you for shopping with us!";
    } else if (sLower === "failed delivery" || sLower === "failed" || sLower === "cancelled") {
      canonicalStatus = "Failed Delivery";
      timelineStage = "Failed Delivery";
      order.failedDeliveryAt = now;
      order.failedReason = notes || "Delivery could not be completed";
      timelineTitle = "Delivery Failed";
      timelineDesc = order.failedReason;
    }

    order.deliveryStatus = canonicalStatus;
    if (assignedStaffName) order.assignedStaffName = assignedStaffName;
    if (notes) order.deliveryNotes = notes;

    // Audit tracking and status transitions
    if (!Array.isArray(order.trackingTimeline)) {
      order.trackingTimeline = [];
    }
    order.trackingTimeline.push({
      stage: timelineStage,
      status: canonicalStatus,
      title: timelineTitle,
      description: timelineDesc,
      timestamp: now,
      updatedBy: req.user?.name || "Store Admin",
      updatedById: req.user?._id || null,
      role: req.user?.role || "STORE_ADMIN",
    });

    if (!Array.isArray(order.statusHistory)) {
      order.statusHistory = [];
    }
    order.statusHistory.push({
      previousStatus,
      newStatus: canonicalStatus,
      timestamp: now,
      updatedBy: req.user?.name || "Store Admin",
      updatedById: req.user?._id || null,
      role: req.user?.role || "STORE_ADMIN",
    });

    await order.save();

    try {
      const io = req.app?.get("io");
      if (io) {
        io.emit("order:updated", { order });
        io.emit("order:tracking_update", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          deliveryStatus: order.deliveryStatus,
          paymentStatus: order.paymentStatus,
          completedAt: order.deliveryCompletedAt || null,
          order,
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `Delivery status updated to "${canonicalStatus}" for Order #${order.orderNumber}.`,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update delivery status",
      error: error.message,
    });
  }
};

// Submit Order Review (Store Pickup or Home Delivery)
exports.submitOrderReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating is required and must be between 1 and 5 stars.",
      });
    }

    const query = buildOrderQuery(id);
    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    // Verify order completion stage before enabling review (Flexible check)
    const orderTypeUpper = String(order.orderType || "").toUpperCase();
    const pickupStatusUpper = String(order.pickupStatus || "").toUpperCase();
    const deliveryStatusUpper = String(order.deliveryStatus || "").toUpperCase();
    const paymentStatusUpper = String(order.paymentStatus || "").toUpperCase();

    const isPickupCompleted =
      order.customerPickupConfirmed === true ||
      pickupStatusUpper === "COMPLETED" ||
      orderTypeUpper.includes("PICKUP");

    const isDeliveryCompleted =
      deliveryStatusUpper === "DELIVERED" ||
      deliveryStatusUpper === "COMPLETED";

    const isCompleted = isPickupCompleted || isDeliveryCompleted || paymentStatusUpper === "COMPLETED";

    if (!isCompleted) {
      return res.status(400).json({
        success: false,
        message: "Reviews are only enabled after your order has been completed, collected, or delivered.",
      });
    }

    // STRICT CHECK: Prevent duplicate reviews for the same order
    const Review = require("../models/Review");
    const existingReview = await Review.findOne({ order: order._id }).catch(() => null);
    if (existingReview || (order.review && order.review.rating)) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted a review for this order. Duplicate reviews are not allowed.",
        review: order.review || existingReview,
      });
    }

    const customerName = (
      req.body.customerName ||
      order.customer?.name ||
      order.deliveryCustomerName ||
      "Verified Customer"
    ).trim();
    const customerPhone = order.customer?.phone || order.deliveryPhone || "";
    const customerId = order.customer?.customerId || null;

    // Save embedded review summary on order document first
    order.review = {
      rating: numRating,
      comment: (comment || "").trim(),
      submittedAt: new Date(),
      customerName,
    };
    await order.save();

    // Create / Upsert Review in dedicated collection
    let reviewDoc = null;
    try {
      reviewDoc = await Review.findOneAndUpdate(
        { order: order._id },
        {
          order: order._id,
          orderNumber: order.orderNumber,
          supermarket: order.supermarket || null,
          supermarketCode: order.supermarketCode || "",
          supermarketName: order.supermarketName || "",
          customer: {
            customerId,
            name: customerName,
            phone: customerPhone,
            email: order.customer?.email || "",
          },
          rating: numRating,
          comment: (comment || "").trim(),
          orderType: order.orderType || "SELF_PICKUP",
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (reviewErr) {
      console.warn("Notice updating Review collection:", reviewErr.message);
    }

    // Notify Supermarket Admin of new customer review in real-time
    try {
      if (order.supermarket) {
        emitTenantNotification(order.supermarket.toString(), {
          type: "NEW_REVIEW",
          title: `New ${numRating}★ Customer Review`,
          message: `Order #${order.orderNumber}: "${(comment || "").trim().slice(0, 80)}" by ${customerName}`,
          data: { orderId: order._id, rating: numRating },
        });
      }
      const io = req.app?.get("io");
      if (io) {
        io.emit("order:reviewed", { orderId: order._id, review: order.review });
        io.emit("order:updated", { order });
      }
    } catch (_) {}

    return res.status(201).json({
      success: true,
      message: "Thank you for your feedback! Your review has been submitted successfully.",
      review: order.review,
      reviewId: reviewDoc?._id || order._id,
    });
  } catch (error) {
    console.error("Submit order review error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit review.",
      error: error.message,
    });
  }
};

// GET Order Review
exports.getOrderReview = async (req, res) => {
  try {
    const { id } = req.params;
    const query = buildOrderQuery(id);
    const order = await Order.findOne(query).select("review orderNumber customer orderType");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    return res.status(200).json({
      success: true,
      review: order.review || null,
      hasReviewed: Boolean(order.review && order.review.rating),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve order review.",
      error: error.message,
    });
  }
};




