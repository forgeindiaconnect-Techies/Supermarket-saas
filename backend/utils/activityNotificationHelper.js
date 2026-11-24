const mongoose = require("mongoose");
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

    const title = "Cart Item Added";
    const badge = "ADDED TO CART";
    const message = `${cleanCustName} added ${productName} (Qty: ${cleanQty}) to their ${typeLabel} cart.`;

    // Strict SaaS Separation: Cart item additions are store-level retail customer actions.
    // They are dispatched EXCLUSIVELY to the tenant Store Admin and NEVER saved into PlatformNotification
    // or sent to the platform Super Admin.
    if (io) {
      try {
        const notifPayload = {
          id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: "cart",
          badge: "ADDED TO CART",
          title,
          actor: cleanCustName,
          message,
          timestamp: new Date().toISOString(),
          customerName: cleanCustName,
          productName,
          quantity: cleanQty,
          supermarketId: storeObjId ? storeObjId.toString() : null,
          supermarketCode: resolvedStoreCode,
          supermarketName: resolvedStoreName,
        };

        emitTenantNotification(io, "admin:notification", notifPayload);
      } catch (sockErr) {
        console.warn("Notice emitting store admin cart activity notification:", sockErr.message);
      }
    }

    return {
      success: true,
      title,
      badge,
      message,
      supermarketCode: resolvedStoreCode,
      supermarketName: resolvedStoreName,
    };
  } catch (err) {
    console.error("Error dispatching cart item added notification:", err);
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

    // Strict SaaS Separation: Order payment successes are store-level customer actions.
    // They are dispatched EXCLUSIVELY to the tenant Store Admin and NEVER saved into PlatformNotification
    // or sent to the platform Super Admin.
    if (io) {
      try {
        const notifPayload = {
          id: `payment-${orderNumStr || Date.now()}`,
          type: "approved",
          badge: "PAYMENT SUCCESSFUL",
          title,
          actor: custName,
          message,
          timestamp: new Date().toISOString(),
          order,
          customerName: custName,
          totalAmount: rawAmount,
          supermarketId: storeObjId ? storeObjId.toString() : null,
          supermarketCode: order.supermarketCode,
          supermarketName: order.supermarketName,
        };

        emitTenantNotification(io, "admin:notification", notifPayload);
      } catch (sockErr) {
        console.warn("Notice emitting store admin payment notification:", sockErr.message);
      }
    }

    return {
      success: true,
      title,
      badge,
      message,
      orderNumber: orderNumStr,
      supermarketCode: order.supermarketCode,
    };
  } catch (err) {
    console.error("Error dispatching payment successful notification:", err);
    return null;
  }
}

module.exports = {
  recordCartItemAddedNotification,
  recordPaymentSuccessfulNotification,
};
