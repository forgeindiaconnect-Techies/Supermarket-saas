import React, { useState, useEffect, useCallback } from "react";
import {
  PackageCheck,
  ShoppingBag,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bell,
  Send,
  Calendar,
  Phone,
  Package,
  RefreshCw,
  X,
  Store,
  Check,
} from "lucide-react";
import { io } from "socket.io-client";
import API, { SOCKET_URL } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import ErpPageBanner from "../../components/ErpPageBanner";
import "./ProductManagement.css";
import "./PickupManagement.css";

export default function PickupManagement() {
  const { currentSupermarket } = useAuth();

  // Orders State
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Modal State for Setting Ready Time & Notifying Customer
  const [readyModalOpen, setReadyModalOpen] = useState(false);
  const [selectedOrderForReady, setSelectedOrderForReady] = useState(null);
  const [readyTime, setReadyTime] = useState("5:30 PM");
  const [readyDate, setReadyDate] = useState("Today");
  const [pickupInstructions, setPickupInstructions] = useState(
    "Please visit the store pickup counter and collect your packaged products."
  );
  const [isNotifying, setIsNotifying] = useState(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState("");
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // 1. Fetch Pickup Orders
  const fetchOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      const res = await API.get("/orders");
      if (res.data?.success && Array.isArray(res.data.orders)) {
        // Filter orders strictly for store pickup (SELF_PICKUP or STORE_COLLECTION)
        // Strictly exclude all Home Delivery orders so they never appear in Pickup
        const pickupList = res.data.orders.filter((o) => {
          const type = (o.orderType || "").toUpperCase();
          const choice = (o.fulfillmentChoice || "").toUpperCase();
          const isHomeDelivery =
            type === "DELIVERY" ||
            type === "ONLINE_DELIVERY" ||
            type === "SELF_PICKUP_DOORSTEP" ||
            choice === "DOORSTEP_DELIVERY" ||
            Boolean(o.deliveryStatus && o.deliveryStatus !== "");
          if (isHomeDelivery) return false;

          return (
            type === "SELF_PICKUP" ||
            type === "SELF_PICKUP_STORE_COLLECTION" ||
            choice === "STORE_COLLECTION" ||
            (Boolean(o.pickupStatus) && o.pickupStatus !== "")
          );
        });
        setOrders(pickupList);
      }
    } catch (err) {
      console.warn("Pickup orders fetch notice:", err.message);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    let socket;
    try {
      socket = io(SOCKET_URL || "http://localhost:5000", {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
      });

      socket.on("order:updated", () => {
        fetchOrders();
      });

      socket.on("order:pickup_ready", () => {
        fetchOrders();
      });

      socket.on("order:pickup_completed", (data) => {
        showToast(`✓ Order ${data?.orderNumber || ""} collected by customer!`);
        fetchOrders();
      });

      socket.on("order:created", () => {
        fetchOrders();
      });
    } catch (_) {}

    return () => {
      if (socket) socket.disconnect();
    };
  }, [fetchOrders]);

  // Handle Update Status to Preparing
  const handleStartPreparing = async (orderId) => {
    try {
      const res = await API.put(`/orders/${orderId}/pickup-status`, {
        pickupStatus: "Preparing",
      });
      if (res.data?.success) {
        showToast("✓ Order marked as 'Preparing'. Packing started!");
        fetchOrders();
      } else {
        showToast(`⚠️ ${res.data?.message || "Failed to update status."}`);
      }
    } catch (err) {
      showToast(`⚠️ ${err.response?.data?.message || err.message}`);
    }
  };

  // Open Ready & Notify Modal
  const handleOpenReadyModal = (order) => {
    setSelectedOrderForReady(order);
    const now = new Date();
    const future = new Date(now.getTime() + 30 * 60000);
    const hours = future.getHours();
    const mins = future.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    const formattedTime = `${h12}:${mins < 10 ? "0" + mins : mins} ${ampm}`;

    setReadyTime(order.estimatedReadyTime || formattedTime);
    setReadyDate(order.estimatedReadyDate || "Today");
    setPickupInstructions(
      order.pickupInstructions ||
        "Please visit the store counter with your Order ID and collect your packaged products."
    );
    setReadyModalOpen(true);
  };

  // Execute Ready & Notify Customer Dispatch
  const handleExecuteReadyAndNotify = async (e) => {
    if (e) e.preventDefault();
    if (!selectedOrderForReady) return;

    if (!readyTime.trim()) {
      showToast("⚠️ Please specify the estimated pickup time.");
      return;
    }

    try {
      setIsNotifying(true);
      const res = await API.put(`/orders/${selectedOrderForReady._id}/pickup-ready`, {
        estimatedReadyTime: readyTime.trim(),
        estimatedReadyDate: readyDate.trim(),
        pickupInstructions: pickupInstructions.trim(),
      });

      if (res.data?.success) {
        showToast(
          `✓ Customer notified: Order will be ready for pickup at ${readyTime.trim()}!`
        );
        setReadyModalOpen(false);
        fetchOrders();
      } else {
        showToast(`⚠️ ${res.data?.message || "Failed to send notification."}`);
      }
    } catch (err) {
      showToast(`⚠️ ${err.response?.data?.message || err.message}`);
    } finally {
      setIsNotifying(false);
    }
  };

  // Admin Manual Override to Complete Pickup
  const handleManualComplete = async (orderId) => {
    try {
      const res = await API.put(`/orders/${orderId}/customer-complete-pickup`, {
        adminOverride: true,
      });
      if (res.data?.success) {
        showToast("✓ Order marked as Completed (Collected from Store)!");
        fetchOrders();
      } else {
        showToast(`⚠️ ${res.data?.message || "Failed to complete pickup."}`);
      }
    } catch (err) {
      showToast(`⚠️ ${err.response?.data?.message || err.message}`);
    }
  };

  // Filter Orders
  const filteredOrders = orders.filter((o) => {
    const s = o.pickupStatus || "New";
    if (statusFilter === "new" && s !== "New" && s !== "Pending") return false;
    if (statusFilter === "preparing" && s !== "Preparing") return false;
    if (statusFilter === "ready" && s !== "ReadyForPickup") return false;
    if (statusFilter === "completed" && s !== "Completed") return false;
    if (statusFilter === "history" && s !== "Completed" && s !== "Cancelled") return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = o.orderNumber?.toLowerCase().includes(q);
      const matchCust =
        o.customer?.name?.toLowerCase().includes(q) || o.customerName?.toLowerCase().includes(q);
      const matchPhone = o.customer?.phone?.includes(q) || o.customerPhone?.includes(q);
      if (!matchNum && !matchCust && !matchPhone) return false;
    }
    return true;
  });

  // Category Counts
  const countNew = orders.filter((o) => ["New", "Pending"].includes(o.pickupStatus || "New")).length;
  const countPreparing = orders.filter((o) => o.pickupStatus === "Preparing").length;
  const countReady = orders.filter((o) => o.pickupStatus === "ReadyForPickup").length;
  const countCompleted = orders.filter((o) => o.pickupStatus === "Completed").length;

  return (
    <div className="grocer-page-container">
      {/* Toast Alert */}
      {toastMessage && <div className="pick-toast-bar">{toastMessage}</div>}

      {/* Header Banner - Standardized ERP Banner */}
      <ErpPageBanner
        title="Self Pickup & Store Counter Fulfillment"
        subtitle={`Track in-store collection orders for ${currentSupermarket?.name || "Your Supermarket"} (${currentSupermarket?.code || "SM"}). Prepare paid grocery orders, set estimated ready times, dispatch automated notifications to the customer app, and verify store collection handoffs.`}
        badges={["In-Store Collection", "Ready-Time Alerts", "Hand-Off Verification"]}
        icon={<Store size={22} color="#ffffff" strokeWidth={2.4} />}
      />

      {/* Executive 4-Card Pickup KPI Strip */}
      <section className="pm-kpi-grid" style={{ marginBottom: "22px" }}>
        {/* Card 1: Total Pickup Orders */}
        <div className="pm-kpi-card green-theme">
          <div className="pm-kpi-icon-pill green">
            <Store size={20} color="#059669" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">{orders.length}</h3>
            <span className="pm-kpi-label">Total Pickup Orders</span>
            <div className="pm-kpi-trend green">
              <span className="trend-arrow">🏬</span>
              <span>Counter pickup</span>
            </div>
          </div>
        </div>

        {/* Card 2: New Orders Pending Preparation */}
        <div className="pm-kpi-card amber-theme">
          <div className="pm-kpi-icon-pill amber">
            <Clock size={20} color="#D97706" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">{countNew}</h3>
            <span className="pm-kpi-label">New Orders to Pack</span>
            <div className="pm-kpi-trend amber">
              <span className="trend-arrow">⏳</span>
              <span>Awaiting packing</span>
            </div>
          </div>
        </div>

        {/* Card 3: Ready for Collection */}
        <div className="pm-kpi-card blue-theme">
          <div className="pm-kpi-icon-pill blue">
            <Bell size={20} color="#2563EB" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">{countReady}</h3>
            <span className="pm-kpi-label">Ready for Pickup</span>
            <div className="pm-kpi-trend blue">
              <span className="trend-arrow">🔔</span>
              <span>Customers alerted</span>
            </div>
          </div>
        </div>

        {/* Card 4: Completed Pickups */}
        <div className="pm-kpi-card green-theme">
          <div className="pm-kpi-icon-pill green">
            <CheckCircle2 size={20} color="#16A34A" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">{countCompleted}</h3>
            <span className="pm-kpi-label">Completed Pickups</span>
            <div className="pm-kpi-trend green">
              <span className="trend-arrow">✓</span>
              <span>Collected at store</span>
            </div>
          </div>
        </div>
      </section>

      {/* Control Toolbar Card */}
      <div className="del-toolbar-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
            Store Collection Orders
          </span>
          <span className="del-switch-count">{orders.length}</span>
        </div>

        <button
          type="button"
          className="del-secondary-btn"
          onClick={fetchOrders}
        >
          <RefreshCw size={14} className={loadingOrders ? "del-spin" : ""} />
          <span>Refresh Pickup Orders</span>
        </button>
      </div>

      {/* Status Filter Strip */}
      <div className="pick-status-strip">
        {[
          { id: "all", label: "All Pickup Orders", count: orders.length },
          { id: "new", label: "New Pickup Orders", count: countNew },
          { id: "preparing", label: "Preparing Orders", count: countPreparing },
          { id: "ready", label: "Ready for Pickup", count: countReady },
          { id: "completed", label: "Completed Orders", count: countCompleted },
          { id: "history", label: "Pickup History", count: countCompleted },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            className={`pick-status-chip ${statusFilter === f.id ? "active" : ""}`}
            onClick={() => setStatusFilter(f.id)}
          >
            <span>{f.label}</span>
            <span className="pick-status-badge">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Search Bar - Full Width with Count Badge */}
      <div className="del-search-card">
        <div className="del-search-box">
          <Search size={18} color="#64748B" />
          <input
            type="text"
            placeholder="Search pickup orders by Order #, Customer Name, or Mobile Number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="del-clear-btn" title="Clear Search">
              ✕
            </button>
          )}
          <span className="del-search-count-pill">
            Showing {filteredOrders.length} of {orders.length} orders
          </span>
        </div>
      </div>

      {/* Orders Grid */}
      {loadingOrders ? (
        <div className="del-loading-box">
          <RefreshCw size={26} className="del-spin" />
          <p>Fetching real-time self pickup orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="del-empty-card">
          <div className="del-empty-icon-wrap" style={{ background: "#F0FDF4", borderColor: "#BBF7D0" }}>
            <Store size={34} color="#059669" />
          </div>
          <h4>No Store Collection Orders</h4>
          <p>
            {search
              ? `No pickup orders matched "${search}". Try searching with a different term.`
              : "There are currently no store pickup orders in this status category. Live counter collection orders will appear here automatically."}
          </p>
          {search ? (
            <button
              type="button"
              className="del-secondary-btn"
              style={{ marginTop: 14 }}
              onClick={() => setSearch("")}
            >
              Clear Search Filter
            </button>
          ) : (
            <button
              type="button"
              className="del-secondary-btn"
              style={{ marginTop: 14 }}
              onClick={fetchOrders}
            >
              <RefreshCw size={13} />
              <span>Check for New Pickups</span>
            </button>
          )}
        </div>
      ) : (
        <div className="pick-orders-grid">
          {filteredOrders.map((ord) => {
            const s = ord.pickupStatus || "New";
            const custName = ord.customer?.name || ord.customerName || "Shopper";
            const custPhone = ord.customer?.phone || ord.customerPhone || "";
            const isNotifSent = Boolean(ord.pickupReadyNotificationSent);
            const isCustomerCompleted = Boolean(ord.customerPickupConfirmed);

            return (
              <div key={ord._id} className="pick-order-card">
                {/* Header */}
                <div className="pick-order-header">
                  <div>
                    <span className="pick-order-num">{ord.orderNumber}</span>
                    <div className="pick-order-date">
                      <Calendar size={12} />
                      <span>
                        {ord.createdAt
                          ? new Date(ord.createdAt).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Recent"}
                      </span>
                    </div>
                  </div>
                  <span className={`pick-badge-status status-${s.toLowerCase()}`}>
                    {s === "ReadyForPickup" ? "Ready for Pickup" : s}
                  </span>
                </div>

                {/* Body */}
                <div className="pick-order-body">
                  <div className="pick-meta-row">
                    <strong className="pick-cust-name">{custName}</strong>
                    {custPhone ? (
                      <span className="pick-cust-phone">
                        <Phone size={12} />
                        <span>{custPhone}</span>
                      </span>
                    ) : null}
                  </div>

                  {/* Items & Amount */}
                  <div className="pick-items-summary">
                    <div className="pick-items-list">
                      <Package size={13} color="#64748B" />
                      <span>{ord.items?.length || ord.totalItems || 1} items</span>
                      <span className="pick-items-preview">
                        • {ord.items?.[0]?.name}
                        {ord.items?.length > 1 ? ` +${ord.items.length - 1} more` : ""}
                      </span>
                    </div>
                    <strong className="pick-amount-val">
                      ₹{Number(ord.totalAmount || 0).toFixed(2)}
                    </strong>
                  </div>

                  {/* Ready Notification Banner (if sent or preparing) */}
                  {ord.estimatedReadyTime && (
                    <div className="pick-notif-info-banner">
                      <div className="pick-notif-row">
                        <Bell size={13} color="#059669" />
                        <span>
                          Ready at: {ord.estimatedReadyTime} ({ord.estimatedReadyDate || "Today"})
                        </span>
                      </div>
                      <span className="pick-notif-text">
                        {ord.pickupInstructions || "Customer instructed to collect at store counter."}
                      </span>
                    </div>
                  )}

                  {/* Customer Hand-off Confirmation Stamp */}
                  {isCustomerCompleted && (
                    <div className="pick-completed-stamp">
                      <CheckCircle2 size={16} color="#059669" />
                      <span>
                        ✓ Verified Hand-off (Customer tapped Complete in App
                        {ord.customerPickupCompletedAt
                          ? ` at ${new Date(ord.customerPickupCompletedAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : ""}
                        )
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pick-order-actions">
                  {s === "New" || s === "Pending" ? (
                    <button
                      type="button"
                      className="pick-prepare-btn"
                      onClick={() => handleStartPreparing(ord._id)}
                    >
                      <Package size={14} />
                      <span>Start Preparing</span>
                    </button>
                  ) : null}

                  {s === "Preparing" ? (
                    <button
                      type="button"
                      className="pick-ready-btn"
                      onClick={() => handleOpenReadyModal(ord)}
                    >
                      <Bell size={14} />
                      <span>Mark Ready &amp; Notify Customer</span>
                    </button>
                  ) : null}

                  {s === "ReadyForPickup" && !isCustomerCompleted ? (
                    <>
                      <button
                        type="button"
                        className="pick-ready-btn"
                        style={{ background: "#047857" }}
                        onClick={() => handleOpenReadyModal(ord)}
                        title="Update estimated ready time"
                      >
                        <Clock size={14} />
                        <span>Update Ready Time</span>
                      </button>
                      <button
                        type="button"
                        className="pick-complete-btn"
                        onClick={() => handleManualComplete(ord._id)}
                      >
                        <CheckCircle2 size={14} />
                        <span>Mark Completed</span>
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SET ESTIMATED READY TIME & NOTIFY CUSTOMER APP                    */}
      {/* ========================================================================= */}
      {readyModalOpen && selectedOrderForReady && (
        <div
          className="pick-modal-overlay"
          onClick={() => !isNotifying && setReadyModalOpen(false)}
        >
          <div className="pick-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pick-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="pick-modal-icon-circle">
                  <Bell size={18} color="#059669" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Set Ready Time &amp; Notify Customer</h3>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>
                    Order {selectedOrderForReady.orderNumber} •{" "}
                    {selectedOrderForReady.customer?.name || "Customer"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="pick-modal-close"
                onClick={() => !isNotifying && setReadyModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteReadyAndNotify}>
              <div className="pick-modal-body">
                {/* Ready Date & Time Inputs */}
                <div>
                  <label className="pick-form-label">Estimated Collection Time *</label>
                  <input
                    type="text"
                    className="pick-form-input"
                    placeholder="e.g. 5:30 PM"
                    value={readyTime}
                    onChange={(e) => setReadyTime(e.target.value)}
                    required
                  />

                  {/* Quick Preset Buttons */}
                  <div className="pick-quick-times-row">
                    {["in 15 mins", "in 30 mins", "in 1 hour", "5:30 PM", "6:00 PM", "7:30 PM"].map(
                      (preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`pick-time-chip ${readyTime === preset ? "active" : ""}`}
                          onClick={() => {
                            if (preset === "in 15 mins") {
                              const t = new Date(Date.now() + 15 * 60000);
                              setReadyTime(
                                t.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
                              );
                            } else if (preset === "in 30 mins") {
                              const t = new Date(Date.now() + 30 * 60000);
                              setReadyTime(
                                t.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
                              );
                            } else if (preset === "in 1 hour") {
                              const t = new Date(Date.now() + 60 * 60000);
                              setReadyTime(
                                t.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
                              );
                            } else {
                              setReadyTime(preset);
                            }
                          }}
                        >
                          {preset}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="pick-form-label">Collection Day</label>
                  <select
                    className="pick-form-select"
                    value={readyDate}
                    onChange={(e) => setReadyDate(e.target.value)}
                  >
                    <option value="Today">Today</option>
                    <option value="Tomorrow">Tomorrow</option>
                    <option value="Day After Tomorrow">Day After Tomorrow</option>
                  </select>
                </div>

                <div>
                  <label className="pick-form-label">Pickup Counter Instructions</label>
                  <textarea
                    className="pick-form-textarea"
                    placeholder="e.g. Please visit counter #2 and show your Order ID to collect."
                    value={pickupInstructions}
                    onChange={(e) => setPickupInstructions(e.target.value)}
                  />
                </div>

                {/* Live App Notification Preview */}
                <div className="pick-preview-box">
                  <strong>📲 Customer App Notification Preview:</strong>
                  <p style={{ margin: "4px 0 0 0" }}>
                    "Your order will be ready for pickup at <strong>{readyTime}</strong> ({readyDate}). Please visit the store and collect your products."
                  </p>
                </div>
              </div>

              <div className="pick-modal-footer">
                <button
                  type="button"
                  className="pick-btn-secondary"
                  onClick={() => setReadyModalOpen(false)}
                  disabled={isNotifying}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pick-btn-primary"
                  disabled={isNotifying}
                >
                  {isNotifying ? "Sending Notification..." : "Send Notification & Mark Ready"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

