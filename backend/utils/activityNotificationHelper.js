const mongoose = require("mongoose");
const PlatformNotification = require("../models/PlatformNotification");
const Supermarket = require("../models/Supermarket");
const { emitTenantNotification } = require("./notificationEmitter");

/**
 * Record and dispatch Cart Item Added notification permanently in MongoDB
 * Enforces strict distinction between Online Delivery and Store Pickup
 */
async function recordCartItemAddedNotification({
  customerName = "Customer",
  customerPhone = "",
  customerId = null,
  productName = "Product",
  quantity = 1,
  price = 0,
  supermarketId = null,
  supermarketCode = "",
  supermarketName = "",
  fulfillmentType = "ONLINE_DELIVERY",
  io = null,
}) {
  try {
    const cleanQty = Math.max(1, parseInt(quantity, 10) || 1);
    const cleanCustName = (customerName || "Customer").trim();
    const cleanCustPhone = (customerPhone || "").trim();

    // Strict fulfillment separation
    const isStorePickup =
      String(fulfillmentType).toUpperCase() === "STORE_PICKUP" ||
      String(fulfillmentType).toUpperCase() === "SELF_PICKUP";
    const activityType = isStorePickup ? "STORE_PICKUP" : "ONLINE_DELIVERY";
    const typeLabel = isStorePickup ? "Store Pickup" : "Online Delivery";

    // Resolve Supermarket details if incomplete
    let resolvedStoreName = supermarketName;
    let resolvedStoreCode = supermarketCode;
    let storeObjId = null;

    if (supermarketId && mongoose.Types.ObjectId.isValid(supermarketId)) {
      storeObjId = new mongoose.Types.ObjectId(supermarketId);
      if (!resolvedStoreName || !resolvedStoreCode) {
        try {
          const store = await Supermarket.findById(storeObjId).select("name code");
          if (store) {
            resolvedStoreName = resolvedStoreName || store.name;
            resolvedStoreCode = resolvedStoreCode || store.code;
          }
        } catch (_) {}
      }
    }

    // Exact message matching specification:
    // e.g.: "Naveen added Hari (Qty: 1) to their Online Delivery cart."
    // e.g.: "Agila added Dairy Milk (Qty: 2) to their Store Pickup cart."
    const title = "Cart Item Added";
    const badge = "ADDED TO CART";
    const message = `${cleanCustName} added ${productName} (Qty: ${cleanQty}) to their ${typeLabel} cart.`;

    // Deduplication window: Prevent duplicate notifications from rapid re-clicks / retries within 4 seconds
    const timeBucket = Math.floor(Date.now() / 4000);
    const custIdentifier = customerId || cleanCustPhone.replace(/\D/g, "") || cleanCustName;
    const idempotencyKey = `cart-${custIdentifier}-${productName}-${cleanQty}-${activityType}-${timeBucket}`;

    const existing = await PlatformNotification.findOne({ idempotencyKey }).catch(() => null);
    if (existing) {
      return existing;
    }

    const doc = await PlatformNotification.create({
      title,
      badge,
      type: "CART_ITEM_ADDED",
      activityType,
      supermarket: storeObjId,
      supermarketName: resolvedStoreName || "Supermarket",
      supermarketCode: resolvedStoreCode || "",
      customerName: cleanCustName,
      customerPhone: cleanCustPhone,
      productName,
      productQuantity: cleanQty,
      amount: Number(price || 0) * cleanQty,
      message,
      color: isStorePickup ? "purple" : "green",
      isRead: false,
      idempotencyKey,
      actionUrl: "/super-admin/notifications",
      metadata: {
        productName,
        quantity: cleanQty,
        unitPrice: Number(price || 0),
        fulfillmentType,
        customerName: cleanCustName,
        customerPhone: cleanCustPhone,
        date: new Date().toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        time: new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      },
    });

    // Real-Time Socket.IO emission to Super Admin and Tenant Store Admin
    if (io) {
      try {
        io.to("super_admin").emit("platform:notification", {
          notification: doc,
          unreadCountDelta: 1,
        });

        emitTenantNotification(io, "admin:notification", {
          id: `cart-${doc._id}`,
          type: "cart",
          badge: "ADDED TO CART",
          title,
          actor: cleanCustName,
          message,
          timestamp: doc.createdAt,
          customerName: cleanCustName,
          productName,
          quantity: cleanQty,
          supermarketId: storeObjId ? storeObjId.toString() : null,
          supermarketCode: resolvedStoreCode,
          supermarketName: resolvedStoreName,
        });
      } catch (sockErr) {
        console.warn("Notice emitting cart activity notification:", sockErr.message);
      }
    }

    return doc;
  } catch (err) {
    // Graceful duplicate key or validation handling
    if (err.code === 11000) {
      return null;
    }
    console.error("Error recording cart item added notification:", err);
    return null;
  }
}

/**
 * Record and dispatch Payment Successful notification permanently in MongoDB
 * Enforces strict distinction between Online Delivery and Store Pickup
 */
async function recordPaymentSuccessfulNotification({ order, io = null }) {
  try {
    if (!order) return null;

    // STRICT CHECK: Never generate payment-success notifications for Pending, Failed, or Cancelled payments!
    const pStatus = String(order.paymentStatus || "").toUpperCase();
    if (pStatus !== "COMPLETED") {
      return null;
    }

    // Strict idempotency: Ensure one successful payment generates strictly one payment notification
    const orderIdStr = String(order._id || order.id || "");
    const orderNumStr = String(order.orderNumber || "").trim();
    const idempotencyKey = `payment-success-${orderIdStr || orderNumStr}`;

    const existing = await PlatformNotification.findOne({ idempotencyKey }).catch(() => null);
    if (existing) {
      return existing;
    }

    // Strict fulfillment separation
    const oType = String(order.orderType || "").toUpperCase();
    const fChoice = String(order.fulfillmentChoice || "").toUpperCase();
    const hasPickup = Boolean(order.pickupStatus && String(order.pickupStatus).trim() !== "");
    const isStorePickup =
      oType.includes("PICKUP") ||
      fChoice === "STORE_COLLECTION" ||
      hasPickup;

    const activityType = isStorePickup ? "STORE_PICKUP" : "ONLINE_DELIVERY";
    const typeLabel = isStorePickup ? "Store Pickup" : "Online Delivery";
    const title = isStorePickup
      ? "Store Pickup Payment Successful"
      : "Online Delivery Payment Successful";
    const badge = "PAYMENT SUCCESSFUL";

    const custName = (
      order.customer?.name ||
      order.deliveryCustomerName ||
      order.customerName ||
      "Customer"
    ).trim();

    const custPhone = (
      order.customer?.phone ||
      order.deliveryPhone ||
      order.customerPhone ||
      ""
    ).trim();

    const rawAmount = Number(order.totalAmount || 0);
    const formattedAmount = rawAmount % 1 === 0 ? rawAmount.toFixed(0) : rawAmount.toFixed(2);

    // Exact message matching specification:
    // e.g.: "Naveen successfully paid ₹500 for an Online Delivery order."
    // e.g.: "Agila successfully paid ₹162 for a Store Pickup order."
    const article = isStorePickup ? "a" : "an";
    const message = `${custName} successfully paid ₹${formattedAmount} for ${article} ${typeLabel} order.`;

    let storeObjId = null;
    if (order.supermarket && mongoose.Types.ObjectId.isValid(order.supermarket)) {
      storeObjId = new mongoose.Types.ObjectId(order.supermarket);
    }

    const doc = await PlatformNotification.create({
      title,
      badge,
      type: "PAYMENT_SUCCESSFUL",
      activityType,
      supermarket: storeObjId,
      supermarketName: order.supermarketName || "Supermarket",
      supermarketCode: order.supermarketCode || "",
      customerName: custName,
      customerPhone: custPhone,
      amount: rawAmount,
      orderId: orderIdStr,
      orderNumber: orderNumStr,
      message,
      color: isStorePickup ? "blue" : "green",
      isRead: false,
      idempotencyKey,
      actionUrl: `/super-admin/orders?search=${encodeURIComponent(orderNumStr)}`,
      metadata: {
        orderId: orderIdStr,
        orderNumber: orderNumStr,
        totalAmount: rawAmount,
        paymentMethod: order.paymentMethod || "UPI",
        fulfillmentType: isStorePickup ? "SELF_PICKUP" : "DELIVERY",
        customerName: custName,
        customerPhone: custPhone,
        itemsCount: order.items?.length || order.totalItems || 1,
        date: new Date().toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        time: new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      },
    });

    // Real-Time Socket.IO emission to Super Admin and Tenant Store Admin
    if (io) {
      try {
        io.to("super_admin").emit("platform:notification", {
          notification: doc,
          unreadCountDelta: 1,
        });

        emitTenantNotification(io, "admin:notification", {
          id: `payment-${orderNumStr}`,
          type: "approved",
          badge: "PAYMENT SUCCESSFUL",
          title,
          actor: custName,
          message,
          timestamp: doc.createdAt,
          order,
          customerName: custName,
          totalAmount: rawAmount,
          supermarketId: storeObjId ? storeObjId.toString() : null,
          supermarketCode: order.supermarketCode,
          supermarketName: order.supermarketName,
        });
      } catch (sockErr) {
        console.warn("Notice emitting payment notification:", sockErr.message);
      }
    }

    return doc;
  } catch (err) {
    if (err.code === 11000) {
      return null;
    }
    console.error("Error recording payment successful notification:", err);
    return null;
  }
}

module.exports = {
  recordCartItemAddedNotification,
  recordPaymentSuccessfulNotification,
};
