const Order = require("../models/Order");
const Supermarket = require("../models/Supermarket");
const User = require("../models/User");
const { sendDeliveryStaffWelcomeEmail } = require("../utils/mailer");

// 1. GET /api/delivery/profile - Delivery Staff Profile & Supermarket Isolation Verification
exports.getDeliveryProfile = async (req, res) => {
  try {
    const supermarketId = req.user.supermarket?._id || req.user.supermarket;

    if (!supermarketId) {
      return res.status(400).json({
        success: false,
        message: "No supermarket attached to this delivery account.",
      });
    }

    const store = await Supermarket.findById(supermarketId);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Assigned Supermarket not found.",
      });
    }

    const isOnlineDeliveryEnabled = store.onlineDeliveryAvailable === true || store.onlineAvailable === true;
    if (!isOnlineDeliveryEnabled) {
      return res.status(403).json({
        success: false,
        message: `Online Delivery has been disabled for ${store.name}. Access to this Delivery Dashboard is suspended.`,
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
        role: req.user.role,
        phone: req.user.phone || store.phone,
        supermarketId: store._id,
        supermarketCode: store.code,
        supermarketName: store.name,
      },
      supermarket: {
        _id: store._id,
        name: store.name,
        code: store.code,
        city: store.city,
        state: store.state,
        address: store.address,
        phone: store.phone,
        email: store.email,
        logoUrl: store.logoUrl,
        deliveryBannerUrl: store.deliveryBannerUrl || store.logoUrl || "",
        themeColor: store.themeColor || "#16a34a",
        onlineDeliveryAvailable: true,
        selfPickupAvailable: store.selfPickupAvailable === true,
      },
    });
  } catch (error) {
    console.error("Get delivery profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch delivery profile.",
      error: error.message,
    });
  }
};

// 2. GET /api/delivery/orders - Strictly Multi-Tenant Scoped Delivery Orders
exports.getDeliveryOrders = async (req, res) => {
  try {
    const supermarketId = req.user.supermarket?._id || req.user.supermarket;
    const { status = "all" } = req.query;

    if (!supermarketId) {
      return res.status(400).json({
        success: false,
        message: "Tenant Supermarket ID required.",
      });
    }

    // Strict isolation: Delivery orders only (SELF_PICKUP and OFFLINE orders strictly excluded)
    const query = {
      supermarket: supermarketId,
      purchaseMode: "ONLINE",
      orderType: { $nin: ["SELF_PICKUP", "SELF_PICKUP_STORE_COLLECTION", "IN_STORE"] },
      fulfillmentChoice: { $ne: "STORE_COLLECTION" },
      $or: [
        { orderType: { $in: ["DELIVERY", "ONLINE_DELIVERY", "SELF_PICKUP_DOORSTEP"] } },
        { fulfillmentChoice: "DOORSTEP_DELIVERY" },
        { deliveryStatus: { $exists: true, $ne: "" } },
      ],
    };

    // If logged in as delivery staff, only see orders assigned to themselves or unassigned new/pending orders
    if (req.user.role === "DELIVERY_STAFF") {
      query.$and = [
        {
          $or: [
            { assignedStaff: req.user._id },
            { deliveryStatus: { $in: ["New", "Pending", "Order Confirmed", "Preparing", "Assigned"] } },
          ],
        },
      ];
    }

    const statusNorm = String(status).toLowerCase().trim();
    if (statusNorm === "pending" || statusNorm === "new" || statusNorm === "confirmed") {
      query.deliveryStatus = { $in: ["Pending", "New", "Order Confirmed"] };
    } else if (statusNorm === "preparing") {
      query.deliveryStatus = "Preparing";
    } else if (statusNorm === "assigned") {
      query.deliveryStatus = { $in: ["Assigned", "Accepted", "Delivery Partner Assigned"] };
    } else if (statusNorm === "collected" || statusNorm === "productscollected" || statusNorm === "pickedup") {
      query.deliveryStatus = { $in: ["Products Collected", "OrderPickedUp"] };
    } else if (statusNorm === "out_for_delivery" || statusNorm === "outfordelivery") {
      query.deliveryStatus = { $in: ["Out for Delivery", "OutForDelivery"] };
    } else if (statusNorm === "completed" || statusNorm === "delivered") {
      query.deliveryStatus = "Delivered";
    } else if (statusNorm === "failed" || statusNorm === "failed_delivery") {
      query.deliveryStatus = { $in: ["Failed Delivery", "Failed"] };
    }

    const orders = await Order.find(query)
      .populate("assignedStaff", "name username phone email status")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Get delivery orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve delivery orders.",
      error: error.message,
    });
  }
};

// 3. PUT /api/delivery/orders/:id/status - Update Delivery Status with Audit Timestamps & Real-Time Tracking
exports.updateDeliveryOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, assignedStaffId, assignedStaffName } = req.body;
    const supermarketId = req.user.supermarket?._id || req.user.supermarket;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required (Preparing, Assigned, Accepted, OrderPickedUp, OutForDelivery, Delivered, Cancelled).",
      });
    }

    // Enforce tenant isolation: Can only update orders belonging to this store
    const order = await Order.findOne({
      _id: id,
      supermarket: supermarketId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Delivery order not found or does not belong to your assigned supermarket.",
      });
    }

    // Security: Delivery staff can only update orders assigned to their account
    if (req.user.role === "DELIVERY_STAFF") {
      if (order.assignedStaff && order.assignedStaff.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized. You can only update delivery orders assigned to your account.",
        });
      }
    }

    // Normalize status into canonical stages
    let canonicalStatus = status;
    const sLower = String(status).toLowerCase().trim();

    const now = new Date();
    let timelineTitle = status;
    let timelineDesc = notes || "";
    let timelineStage = "Order Confirmed";

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
    } else if (sLower === "assigned" || sLower === "delivery partner assigned") {
      canonicalStatus = "Assigned";
      timelineStage = "Delivery Partner Assigned";
      order.assignedAt = now;
      if (assignedStaffId) order.assignedStaff = assignedStaffId;
      if (assignedStaffName) order.assignedStaffName = assignedStaffName;
      timelineTitle = "Delivery Partner Assigned";
      timelineDesc = notes || `${order.assignedStaffName || "Delivery partner"} has been assigned to your order.`;
    } else if (sLower === "accepted") {
      canonicalStatus = "Assigned";
      timelineStage = "Delivery Partner Assigned";
      order.deliveryAcceptedAt = now;
      if (!order.assignedStaff) {
        order.assignedStaff = req.user._id;
        order.assignedStaffName = req.user.name;
        order.assignedStaffPhone = req.user.phone || "";
      }
      timelineTitle = "Delivery Partner Confirmed";
      timelineDesc = notes || `${order.assignedStaffName || "Delivery partner"} accepted the delivery request.`;
    } else if (sLower === "products collected" || sLower === "orderpickedup" || sLower === "collected") {
      canonicalStatus = "Products Collected";
      timelineStage = "Products Collected";
      order.productsCollectedAt = now;
      order.pickedUpAt = now;
      timelineTitle = "Products Collected";
      timelineDesc = notes || `${order.assignedStaffName || "Delivery partner"} has verified and collected your packed grocery items from the supermarket.`;
    } else if (sLower === "out for delivery" || sLower === "outfordelivery" || sLower === "out_for_delivery") {
      canonicalStatus = "Out for Delivery";
      timelineStage = "Out for Delivery";
      order.deliveryOutAt = now;
      timelineTitle = "Out for Delivery";
      timelineDesc = notes || `${order.assignedStaffName || "Delivery partner"} is on the way to your delivery address.`;
    } else if (sLower === "delivered" || sLower === "completed") {
      canonicalStatus = "Delivered";
      timelineStage = "Delivered";
      order.deliveryCompletedAt = now;
      order.paymentStatus = "Completed";
      order.completedAt = now;
      timelineTitle = "Order Delivered";
      timelineDesc = notes || "Your groceries have been successfully delivered to your doorstep. Thank you for shopping with SuperMart!";
    } else if (sLower === "failed delivery" || sLower === "failed" || sLower === "cancelled") {
      canonicalStatus = "Failed Delivery";
      timelineStage = "Failed Delivery";
      order.failedDeliveryAt = now;
      order.failedReason = notes || req.body.reason || "Delivery could not be completed";
      timelineTitle = "Delivery Failed";
      timelineDesc = order.failedReason;
    }

    order.deliveryStatus = canonicalStatus;
    if (notes) order.deliveryNotes = notes;

    // Add entry to tracking timeline with full audit details
    if (!Array.isArray(order.trackingTimeline)) {
      order.trackingTimeline = [];
    }
    order.trackingTimeline.push({
      stage: timelineStage,
      status: canonicalStatus,
      title: timelineTitle,
      description: timelineDesc,
      timestamp: now,
      updatedBy: req.user.name || "Store Admin",
      updatedById: req.user._id,
      role: req.user.role || "STORE_ADMIN",
    });

    await order.save();

    // Populate assigned staff details for real-time broadcast and response
    const populatedOrder = await Order.findById(order._id)
      .populate("assignedStaff", "name username phone email status photoUrl")
      .populate("supermarket", "name code address phone email logoUrl")
      .lean();

    // Broadcast live update to store dashboard & mobile apps
    try {
      const io = req.app?.get("io");
      if (io) {
        io.emit("order:updated", { order: populatedOrder || order });
        io.emit("order:tracking_update", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          deliveryStatus: order.deliveryStatus,
          assignedStaff: populatedOrder?.assignedStaff || null,
          assignedStaffName: order.assignedStaffName,
          assignedStaffPhone: order.assignedStaffPhone,
          orderConfirmedAt: order.orderConfirmedAt,
          preparingAt: order.preparingAt,
          assignedAt: order.assignedAt,
          pickedUpAt: order.pickedUpAt,
          deliveryOutAt: order.deliveryOutAt,
          deliveryCompletedAt: order.deliveryCompletedAt,
          timeline: order.trackingTimeline,
          order: populatedOrder || order,
        });
        io.emit("delivery:order_updated", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: order.deliveryStatus,
          assignedStaffName: order.assignedStaffName,
          deliveryCompletedAt: order.deliveryCompletedAt,
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `Delivery status updated to "${status}" for Order #${order.orderNumber}.`,
      order: populatedOrder || order,
    });
  } catch (error) {
    console.error("Update delivery status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update delivery status.",
      error: error.message,
    });
  }
};

// 4. POST /api/delivery/orders/:id/assign - Store Admin Assigns Order to Delivery Staff
exports.assignOrderToStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { staffId } = req.body;
    const supermarketId = req.user.supermarket?._id || req.user.supermarket;

    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "Staff member ID is required.",
      });
    }

    const [order, staff] = await Promise.all([
      Order.findOne({ _id: id, supermarket: supermarketId }),
      User.findOne({ _id: staffId, supermarket: supermarketId, role: "DELIVERY_STAFF" }),
    ]);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found in this supermarket.",
      });
    }

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Delivery staff member not found in this supermarket.",
      });
    }

    const now = new Date();
    order.assignedStaff = staff._id;
    order.assignedStaffName = staff.name;
    order.assignedStaffPhone = staff.phone || "";
    order.deliveryStatus = "Assigned";
    order.assignedAt = now;

    if (!Array.isArray(order.trackingTimeline)) {
      order.trackingTimeline = [];
    }
    order.trackingTimeline.push({
      stage: "Delivery Partner Assigned",
      status: "Assigned",
      title: "Delivery Partner Assigned",
      description: `${staff.name} has been assigned to deliver your order.`,
      timestamp: now,
      updatedBy: req.user.name || "Store Admin",
      updatedById: req.user._id,
      role: req.user.role || "STORE_ADMIN",
    });

    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate("assignedStaff", "name username phone email status photoUrl")
      .populate("supermarket", "name code address phone email logoUrl")
      .lean();

    try {
      const io = req.app?.get("io");
      if (io) {
        io.emit("order:updated", { order: populatedOrder || order });
        io.emit("order:tracking_update", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          deliveryStatus: "Assigned",
          assignedStaff: {
            _id: staff._id,
            name: staff.name,
            phone: staff.phone,
            email: staff.email,
            status: staff.status,
          },
          assignedStaffName: staff.name,
          assignedStaffPhone: staff.phone,
          assignedAt: order.assignedAt,
          timeline: order.trackingTimeline,
          order: populatedOrder || order,
        });
        io.emit("delivery:order_assigned", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          staffId: staff._id,
          staffName: staff.name,
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `Order #${order.orderNumber} successfully assigned to ${staff.name}.`,
      order: populatedOrder || order,
      staff: {
        _id: staff._id,
        name: staff.name,
        phone: staff.phone,
      },
    });
  } catch (error) {
    console.error("Assign order error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign order to staff.",
      error: error.message,
    });
  }
};

// 5. GET /api/delivery/staff - Store Admin lists delivery staff for their supermarket
exports.getDeliveryStaff = async (req, res) => {
  try {
    const supermarketId = req.user.supermarket?._id || req.user.supermarket;
    if (!supermarketId) {
      return res.status(400).json({
        success: false,
        message: "Supermarket ID required.",
      });
    }

    const staffMembers = await User.find({
      supermarket: supermarketId,
      role: "DELIVERY_STAFF",
    })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    // Attach order assignment metrics for each staff member
    const enrichedStaff = await Promise.all(
      staffMembers.map(async (st) => {
        const [totalAssigned, activeOrders, deliveredOrders] = await Promise.all([
          Order.countDocuments({ supermarket: supermarketId, assignedStaff: st._id }),
          Order.countDocuments({
            supermarket: supermarketId,
            assignedStaff: st._id,
            deliveryStatus: { $in: ["Assigned", "Accepted", "OutForDelivery"] },
          }),
          Order.countDocuments({
            supermarket: supermarketId,
            assignedStaff: st._id,
            deliveryStatus: "Delivered",
          }),
        ]);

        return {
          ...st,
          totalAssigned,
          activeOrders,
          deliveredOrders,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: enrichedStaff.length,
      staff: enrichedStaff,
    });
  } catch (error) {
    console.error("Get delivery staff error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve delivery staff.",
      error: error.message,
    });
  }
};

// 6. POST /api/delivery/staff - Store Admin creates delivery staff credentials
exports.createDeliveryStaff = async (req, res) => {
  try {
    const supermarketId = req.user.supermarket?._id || req.user.supermarket;
    const { name, phone, email, username, password = "Delivery@123", status = "Active" } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Staff Name is required." });
    }
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: "Username is required." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);
    const cleanEmail = (email || "").trim().toLowerCase();

    // Strict Indian Mobile Number Validation: 10 digits starting with 6, 7, 8, or 9
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: "Valid 10-digit mobile number starting with 6, 7, 8, or 9 is required (e.g. 9876543210).",
      });
    }

    // Check duplicate username across system
    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Username "${cleanUsername}" is already taken. Please choose another username.`,
      });
    }

    const store = await Supermarket.findById(supermarketId);

    const newStaff = await User.create({
      name: name.trim(),
      username: cleanUsername,
      password: password.trim(),
      phone: `+91 ${cleanPhone}`,
      email: cleanEmail,
      role: "DELIVERY_STAFF",
      supermarket: supermarketId,
      supermarketCode: store?.code || "",
      supermarketName: store?.name || "",
      status: status === "Inactive" ? "Inactive" : "Active",
    });

    // Send Welcome Email with credentials and supermarket details if email is provided
    let emailDispatched = false;
    if (cleanEmail) {
      try {
        await sendDeliveryStaffWelcomeEmail({
          staff: newStaff,
          supermarket: store,
          plainPassword: password.trim(),
        });
        emailDispatched = true;
      } catch (mailErr) {
        console.warn("Delivery staff welcome email dispatch notice:", mailErr.message);
      }
    }

    try {
      const io = req.app?.get("io");
      if (io) {
        io.emit("delivery_staff:updated", { staffId: newStaff._id });
      }
    } catch (_) {}

    const successMessage = emailDispatched
      ? `Delivery staff "${newStaff.name}" created successfully! Welcome email with login credentials dispatched to ${cleanEmail}.`
      : `Delivery staff account "${newStaff.name}" created successfully.`;

    return res.status(201).json({
      success: true,
      message: successMessage,
      emailSent: emailDispatched,
      staff: {
        _id: newStaff._id,
        name: newStaff.name,
        username: newStaff.username,
        phone: newStaff.phone,
        email: newStaff.email,
        status: newStaff.status,
      },
    });
  } catch (error) {
    console.error("Create delivery staff error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create delivery staff.",
      error: error.message,
    });
  }
};

// 7. PUT /api/delivery/staff/:id - Store Admin edits staff details
exports.updateDeliveryStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, password, status } = req.body;
    const supermarketId = req.user.supermarket?._id || req.user.supermarket;

    const staff = await User.findOne({
      _id: id,
      supermarket: supermarketId,
      role: "DELIVERY_STAFF",
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Delivery staff account not found in your supermarket.",
      });
    }

    if (name) staff.name = name.trim();
    if (phone !== undefined) {
      const cleanP = phone.replace(/\D/g, "").slice(-10);
      if (cleanP && (cleanP.length !== 10 || !/^[6-9]/.test(cleanP))) {
        return res.status(400).json({
          success: false,
          message: "Valid 10-digit mobile number starting with 6, 7, 8, or 9 is required.",
        });
      }
      staff.phone = cleanP ? `+91 ${cleanP}` : "";
    }
    if (email !== undefined) staff.email = email.trim().toLowerCase();
    if (status) staff.status = status;
    if (password && password.trim()) staff.password = password.trim();

    await staff.save();

    return res.status(200).json({
      success: true,
      message: `Delivery staff "${staff.name}" updated successfully.`,
      staff: {
        _id: staff._id,
        name: staff.name,
        username: staff.username,
        phone: staff.phone,
        email: staff.email,
        status: staff.status,
      },
    });
  } catch (error) {
    console.error("Update delivery staff error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update delivery staff.",
      error: error.message,
    });
  }
};

// 8. PUT /api/delivery/staff/:id/status - Toggle staff Active / Inactive
exports.toggleDeliveryStaffStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const supermarketId = req.user.supermarket?._id || req.user.supermarket;

    const staff = await User.findOne({
      _id: id,
      supermarket: supermarketId,
      role: "DELIVERY_STAFF",
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Delivery staff account not found in your supermarket.",
      });
    }

    staff.status = staff.status === "Active" ? "Inactive" : "Active";
    await staff.save();

    return res.status(200).json({
      success: true,
      message: `Staff "${staff.name}" status changed to ${staff.status}.`,
      staff: {
        _id: staff._id,
        name: staff.name,
        status: staff.status,
      },
    });
  } catch (error) {
    console.error("Toggle delivery staff status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle delivery staff status.",
      error: error.message,
    });
  }
};

// 4. GET /api/delivery/analytics - Supermarket-Isolated Delivery Performance & Summary Reports
exports.getDeliveryAnalytics = async (req, res) => {
  try {
    const supermarketId = req.user.supermarket?._id || req.user.supermarket;

    if (!supermarketId) {
      return res.status(400).json({
        success: false,
        message: "Tenant Supermarket ID required.",
      });
    }

    const store = await Supermarket.findById(supermarketId);

    // Filter strictly by this supermarket
    const baseQuery = {
      supermarket: supermarketId,
      $or: [{ orderType: "DELIVERY" }, { purchaseMode: "ONLINE" }],
    };

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      pendingOrders,
      acceptedOrders,
      outForDeliveryOrders,
      deliveredOrders,
      todayDeliveredOrders,
      revenueResult,
    ] = await Promise.all([
      Order.countDocuments(baseQuery),
      Order.countDocuments({ ...baseQuery, deliveryStatus: { $in: ["Pending", "New"] } }),
      Order.countDocuments({ ...baseQuery, deliveryStatus: "Accepted" }),
      Order.countDocuments({ ...baseQuery, deliveryStatus: "OutForDelivery" }),
      Order.countDocuments({ ...baseQuery, deliveryStatus: "Delivered" }),
      Order.countDocuments({
        ...baseQuery,
        deliveryStatus: "Delivered",
        deliveryCompletedAt: { $gte: startOfToday },
      }),
      Order.aggregate([
        {
          $match: {
            ...baseQuery,
            deliveryStatus: "Delivered",
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
          },
        },
      ]),
    ]);

    const deliveredRevenue = revenueResult[0]?.totalRevenue || 0;
    const completionRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 100;

    return res.status(200).json({
      success: true,
      supermarketName: store?.name || "Supermarket",
      supermarketCode: store?.code || "",
      summary: {
        totalOrders,
        pendingOrders,
        acceptedOrders,
        outForDeliveryOrders,
        deliveredOrders,
        todayDeliveredOrders,
        deliveredRevenue,
        completionRate: `${completionRate}%`,
        averageDeliveryTime: "22 mins",
      },
    });
  } catch (error) {
    console.error("Get delivery analytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve delivery analytics.",
      error: error.message,
    });
  }
};

