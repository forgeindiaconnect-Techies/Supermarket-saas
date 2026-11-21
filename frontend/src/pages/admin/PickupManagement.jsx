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
  Eye,
  Copy,
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
  const [selectedReviewOrder, setSelectedReviewOrder] = useState(null);
  const [copiedOrderId, setCopiedOrderId] = useState(null);
  const [selectedOrderForView, setSelectedOrderForView] = useState(null);
  const [viewOrderModalOpen, setViewOrderModalOpen] = useState(false);

  // Modal State for Setting Ready Time & Notifying Customer
  const [readyModalOpen, setReadyModalOpen] = useState(false);
  const [selectedOrderForReady, setSelectedOrderForReady] = useState(null);
  const [readyTime, setReadyTime] = useState("5:30 PM");
  const [readyDate, setReadyDate] = useState("Today");
  const [pickupInstructions, setPickupInstructions] = useState(
    "Please visit the store pickup counter and collect your packaged products."
  );
  const [isNotifying, setIsNotifying] = useState(false);

  // Quick Copy Order ID
  const handleCopyOrderId = (orderNumber, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(orderNumber);
    setCopiedOrderId(orderNumber);
    showToast(`✓ Order ID ${orderNumber} copied to clipboard!`);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

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
        // Filter orders strictly for store pickup (ONLINE customers who chose Collect from Store)
        // Strictly exclude all OFFLINE orders and Home Delivery orders so they never appear in Pickup
        const pickupList = res.data.orders.filter((o) => {
          const mode = String(o.purchaseMode || "").toUpperCase();
          const type = String(o.orderType || "").toUpperCase();
          const choice = String(o.fulfillmentChoice || "").toUpperCase();

          // CRITICAL: Offline in-store barcode scan purchases must NEVER appear in Pickup
          if (mode === "OFFLINE" || type === "IN_STORE" || type === "OFFLINE") {
            return false;
          }

          const isHomeDelivery =
            type === "DELIVERY" ||
            type === "ONLINE_DELIVERY" ||
            type === "SELF_PICKUP_DOORSTEP" ||
            choice === "DOORSTEP_DELIVERY" ||
            Boolean(o.deliveryStatus && o.deliveryStatus !== "");
          if (isHomeDelivery) return false;

          return (
            mode === "ONLINE" &&
            (type === "SELF_PICKUP" ||
              type === "SELF_PICKUP_STORE_COLLECTION" ||
              choice === "STORE_COLLECTION" ||
              (Boolean(o.pickupStatus) && o.pickupStatus !== ""))
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
    if (statusFilter === "reviewed" && (!o.review || !o.review.rating)) return false;

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
  const countReviewed = orders.filter((o) => o.review && o.review.rating).length;

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
          { id: "reviewed", label: "⭐ Customer Reviews", count: countReviewed },
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
        <div className="orders-table-card pm-catalog-card">
          <div className="pm-catalog-header">
            <div className="pm-catalog-title-group">
              <div
                className="pm-catalog-icon-box"
                style={{ background: "linear-gradient(135deg, #1455D9, #2563EB)" }}
              >
                <PackageCheck size={18} color="#FFFFFF" />
              </div>
              <div>
                <h3 className="pm-catalog-heading">
                  Store Pickup Orders Directory ({filteredOrders.length}{" "}
                  {filteredOrders.length === 1 ? "Order" : "Orders"} Listed)
                </h3>
                <span
                  style={{
                    fontSize: "11.5px",
                    color: "#64748B",
                    fontWeight: "600",
                  }}
                >
                  Strictly verified store pickup counter collection orders • Real-time status sync
                </span>
              </div>
            </div>

            <div
              className="cm-header-controls"
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="pm-action-btn primary"
                onClick={fetchOrders}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  background: "#059669",
                  color: "#FFFFFF",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <RefreshCw size={13} />
                <span>Refresh Orders</span>
              </button>
            </div>
          </div>

          <div className="orders-table-responsive pm-table-wrapper">
            <table className="orders-table pm-products-table">
              <thead>
                <tr>
                  <th className="th-idx">#</th>
                  <th className="th-orderid">ORDER ID</th>
                  <th className="th-datetime">DATE &amp; TIME</th>
                  <th className="th-customer">CUSTOMER</th>
                  <th className="th-mobile">MOBILE</th>
                  <th className="th-items">ITEMS</th>
                  <th className="th-amount">TOTAL AMOUNT</th>
                  <th className="th-status">STATUS</th>
                  <th className="th-action">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((ord, index) => {
                  const s = ord.pickupStatus || "New";
                  const custName = ord.customer?.name || ord.customerName || "Shopper";
                  const custPhone = ord.customer?.phone || ord.customerPhone || "—";
                  const itemCount = ord.items?.length || ord.totalItems || 1;
                  const firstItemName =
                    ord.items?.[0]?.name ||
                    ord.items?.[0]?.product?.name ||
                    (ord.items?.length ? "Package Items" : "Munch");
                  const formattedDate = ord.createdAt
                    ? new Date(ord.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : "Recent";

                  const isCompleted =
                    s === "Completed" || Boolean(ord.customerPickupConfirmed);

                  return (
                    <tr
                      key={ord._id || index}
                      className={isCompleted ? "row-completed-highlight" : ""}
                    >
                      <td className="td-idx">{index + 1}</td>
                      <td className="td-orderid">
                        <div className="order-id-cell">
                          <span
                            className="order-id-link"
                            onClick={() => {
                              setSelectedOrderForView(ord);
                              setViewOrderModalOpen(true);
                            }}
                          >
                            {ord.orderNumber}
                          </span>
                          <button
                            type="button"
                            className="order-id-copy-btn"
                            title="Copy Order ID"
                            onClick={(e) => handleCopyOrderId(ord.orderNumber, e)}
                          >
                            {copiedOrderId === ord.orderNumber ? (
                              <Check size={13} color="#16A34A" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="td-datetime">
                        <span className="order-datetime-text">{formattedDate}</span>
                      </td>
                      <td className="td-customer">
                        <span className="order-customer-name">{custName}</span>
                      </td>
                      <td className="td-mobile">
                        <span className="order-mobile-text">
                          <Phone size={12} color="#64748B" />
                          <span>{custPhone}</span>
                        </span>
                      </td>
                      <td className="td-items">
                        <div className="order-items-cell">
                          <span className="order-items-count-badge">
                            {itemCount} {itemCount === 1 ? "item" : "items"}
                          </span>
                          <span className="order-items-preview">
                            ({firstItemName})
                          </span>
                        </div>
                      </td>
                      <td className="td-amount">
                        <span className="order-amount-text">
                          ₹{Number(ord.totalAmount || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </td>
                      <td className="td-status">
                        {s === "Completed" || isCompleted ? (
                          <span className="order-status-pill status-completed">
                            <CheckCircle2 size={13} color="#15803D" strokeWidth={2.4} />
                            <span>Completed</span>
                          </span>
                        ) : s === "ReadyForPickup" ? (
                          <span className="order-status-pill status-ready">
                            <Bell size={13} color="#7E22CE" strokeWidth={2.4} />
                            <span>Ready</span>
                          </span>
                        ) : s === "Preparing" ? (
                          <span className="order-status-pill status-preparing">
                            <Package size={13} color="#1D4ED8" strokeWidth={2.4} />
                            <span>Preparing</span>
                          </span>
                        ) : (
                          <span className="order-status-pill status-pending">
                            <Clock size={13} color="#C2410C" strokeWidth={2.4} />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>
                      <td className="td-action">
                        <button
                          type="button"
                          className="order-action-view-btn"
                          onClick={() => {
                            setSelectedOrderForView(ord);
                            setViewOrderModalOpen(true);
                          }}
                        >
                          <Eye size={13} />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW PICKUP ORDER DETAILS (Matching Reference Mockup Action View) */}
      {/* ========================================================================= */}
      {viewOrderModalOpen && selectedOrderForView && (
        <div
          className="pick-modal-overlay"
          onClick={() => setViewOrderModalOpen(false)}
        >
          <div
            className="pick-modal-card"
            style={{ maxWidth: "640px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="pick-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: "#F5F3FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#2E0854",
                  }}
                >
                  <Eye size={20} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0F172A" }}>
                      {selectedOrderForView.orderNumber}
                    </h3>
                    <button
                      type="button"
                      className="order-id-copy-btn"
                      onClick={(e) => handleCopyOrderId(selectedOrderForView.orderNumber, e)}
                      title="Copy Order ID"
                    >
                      {copiedOrderId === selectedOrderForView.orderNumber ? (
                        <Check size={14} color="#16A34A" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                  <span style={{ fontSize: 12, color: "#64748B" }}>
                    Placed on{" "}
                    {selectedOrderForView.createdAt
                      ? new Date(selectedOrderForView.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "Recent"}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {selectedOrderForView.pickupStatus === "Completed" ||
                selectedOrderForView.customerPickupConfirmed ? (
                  <span className="order-status-pill status-completed">
                    <CheckCircle2 size={13} color="#15803D" strokeWidth={2.4} />
                    <span>Completed</span>
                  </span>
                ) : selectedOrderForView.pickupStatus === "ReadyForPickup" ? (
                  <span className="order-status-pill status-ready">
                    <Bell size={13} color="#7E22CE" strokeWidth={2.4} />
                    <span>Ready</span>
                  </span>
                ) : selectedOrderForView.pickupStatus === "Preparing" ? (
                  <span className="order-status-pill status-preparing">
                    <Package size={13} color="#1D4ED8" strokeWidth={2.4} />
                    <span>Preparing</span>
                  </span>
                ) : (
                  <span className="order-status-pill status-pending">
                    <Clock size={13} color="#C2410C" strokeWidth={2.4} />
                    <span>Pending</span>
                  </span>
                )}
                <button
                  type="button"
                  className="pick-modal-close"
                  onClick={() => setViewOrderModalOpen(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="pick-modal-body" style={{ padding: "18px 22px", maxHeight: "72vh", overflowY: "auto" }}>
              {/* Customer & Fulfillment Info Strip */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  background: "#F8FAFC",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: "1px solid #E2E8F0",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Customer Details
                  </span>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>
                    {selectedOrderForView.customer?.name || selectedOrderForView.customerName || "Customer"}
                  </div>
                  <div style={{ fontSize: 13, color: "#334155", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                    <Phone size={12} color="#059669" />
                    <span>{selectedOrderForView.customer?.phone || selectedOrderForView.customerPhone || "Not provided"}</span>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Fulfillment Channel
                  </span>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#059669", marginTop: 2 }}>
                    🏪 In-Store Collection Counter
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                    Online Payment: <strong>Verified Paid</strong>
                  </div>
                </div>
              </div>

              {/* Order Items Table */}
              <div style={{ marginBottom: "16px" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Order Items ({selectedOrderForView.items?.length || selectedOrderForView.totalItems || 1})
                </span>
                <div
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    overflow: "hidden",
                    marginTop: 8,
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#F1F5F9", textAlign: "left" }}>
                        <th style={{ padding: "8px 12px", fontWeight: 750, color: "#334155" }}>Item</th>
                        <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 750, color: "#334155" }}>Qty</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 750, color: "#334155" }}>Price</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 750, color: "#334155" }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedOrderForView.items || []).map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "9px 12px" }}>
                            <strong style={{ color: "#0F172A", display: "block" }}>{it.name}</strong>
                            {it.barcode && (
                              <span style={{ fontSize: 11, color: "#64748B" }}>#{it.barcode}</span>
                            )}
                          </td>
                          <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: 700 }}>
                            {it.quantity}
                          </td>
                          <td style={{ padding: "9px 12px", textAlign: "right", color: "#64748B" }}>
                            ₹{Number(it.price || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 800, color: "#0F172A" }}>
                            ₹{Number((it.price || 0) * (it.quantity || 1)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#F8FAFC" }}>
                        <td colSpan="3" style={{ padding: "10px 12px", fontWeight: 800, textAlign: "right", color: "#0F172A" }}>
                          Total Paid Amount:
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 900, textAlign: "right", color: "#059669", fontSize: 15 }}>
                          ₹{Number(selectedOrderForView.totalAmount || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Ready Schedule Banner if present */}
              {selectedOrderForView.estimatedReadyTime && (
                <div
                  style={{
                    background: "#ECFDF5",
                    border: "1.5px solid #A7F3D0",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    marginBottom: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Bell size={16} color="#059669" />
                  <span style={{ fontSize: 13, color: "#065F46", fontWeight: 700 }}>
                    Pickup scheduled for: {selectedOrderForView.estimatedReadyTime} ({selectedOrderForView.estimatedReadyDate || "Today"})
                  </span>
                </div>
              )}

              {/* Customer Review if submitted */}
              {selectedOrderForView.review?.rating ? (
                <div
                  style={{
                    background: "#FFFBEB",
                    border: "1.5px solid #FDE68A",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    marginBottom: "14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: "15px",
                          color: i < (selectedOrderForView.review.rating || 5) ? "#F59E0B" : "#CBD5E1",
                        }}
                      >
                        ★
                      </span>
                    ))}
                    <strong style={{ fontSize: 13, color: "#92400E", marginLeft: 4 }}>
                      {selectedOrderForView.review.rating}.0 Customer Review
                    </strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, fontStyle: "italic", color: "#78350F" }}>
                    "{selectedOrderForView.review.comment || "Customer submitted 5-star rating."}"
                  </p>
                </div>
              ) : null}
            </div>

            {/* Modal Actions Footer */}
            <div className="pick-modal-footer">
              <button
                type="button"
                className="pick-btn-secondary"
                onClick={() => setViewOrderModalOpen(false)}
              >
                Close
              </button>

              {selectedOrderForView.pickupStatus === "New" ||
              selectedOrderForView.pickupStatus === "Pending" ? (
                <button
                  type="button"
                  className="pick-btn-primary"
                  onClick={() => {
                    handleStartPreparing(selectedOrderForView._id);
                    setViewOrderModalOpen(false);
                  }}
                >
                  Start Preparing Order
                </button>
              ) : null}

              {selectedOrderForView.pickupStatus === "Preparing" ? (
                <button
                  type="button"
                  className="pick-btn-primary"
                  onClick={() => {
                    handleOpenReadyModal(selectedOrderForView);
                    setViewOrderModalOpen(false);
                  }}
                >
                  Mark Ready &amp; Notify Customer
                </button>
              ) : null}

              {selectedOrderForView.pickupStatus === "ReadyForPickup" &&
              !selectedOrderForView.customerPickupConfirmed ? (
                <button
                  type="button"
                  className="pick-btn-primary"
                  onClick={() => {
                    handleManualComplete(selectedOrderForView._id);
                    setViewOrderModalOpen(false);
                  }}
                >
                  Confirm Customer Hand-off (Complete)
                </button>
              ) : null}
            </div>
          </div>
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

      {/* Customer Review Details Modal */}
      {selectedReviewOrder && (
        <div
          className="pm-modal-backdrop"
          onClick={() => setSelectedReviewOrder(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            className="pm-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 40px -15px rgba(0,0,0,0.25)",
              border: "1px solid #E2E8F0",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", borderBottom: "1px solid #F1F5F9", paddingBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                  ⭐
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
                    Customer Pickup Review
                  </h3>
                  <span style={{ fontSize: "12px", color: "#64748B" }}>
                    Order #{selectedReviewOrder.orderNumber}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReviewOrder(null)}
                style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", width: "30px", height: "30px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", fontWeight: 800 }}
              >
                ✕
              </button>
            </div>

            {/* Customer Details Box */}
            <div style={{ background: "#F8FAFC", borderRadius: "12px", padding: "12px 16px", marginBottom: "16px", border: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Reviewed By</span>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#0F172A", marginTop: "2px" }}>
                    {selectedReviewOrder.review?.customerName || selectedReviewOrder.customer?.name || selectedReviewOrder.customerName || "Verified Customer"}
                  </div>
                  {(selectedReviewOrder.customer?.phone || selectedReviewOrder.customerPhone) && (
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                      📞 {selectedReviewOrder.customer?.phone || selectedReviewOrder.customerPhone}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ display: "inline-block", background: "#DCFCE7", color: "#166534", fontSize: "11px", fontWeight: 800, padding: "3px 8px", borderRadius: "6px", border: "1px solid #BBF7D0" }}>
                    ✓ Verified Pickup Buyer
                  </span>
                  <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                    {selectedReviewOrder.review?.submittedAt
                      ? new Date(selectedReviewOrder.review.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                      : "Recent"}
                  </div>
                </div>
              </div>
            </div>

            {/* Star Rating & Comment Display */}
            <div style={{ background: "#FFFBEB", borderRadius: "12px", padding: "16px", marginBottom: "18px", border: "1.5px solid #FDE68A" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: "20px",
                      color: i < (selectedReviewOrder.review?.rating || 5) ? "#F59E0B" : "#CBD5E1",
                    }}
                  >
                    ★
                  </span>
                ))}
                <span style={{ fontSize: "15px", fontWeight: 800, color: "#92400E", marginLeft: "6px" }}>
                  {selectedReviewOrder.review?.rating || 5}.0 / 5
                </span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#B45309", marginLeft: "auto", background: "#FEF3C7", padding: "2px 8px", borderRadius: "6px" }}>
                  {selectedReviewOrder.review?.rating === 5 ? "Outstanding!" : selectedReviewOrder.review?.rating >= 4 ? "Very Good" : "Feedback"}
                </span>
              </div>
              <div style={{ fontSize: "14px", color: "#78350F", fontStyle: "italic", fontWeight: 600, lineHeight: 1.5 }}>
                "{selectedReviewOrder.review?.comment || "Customer submitted star rating."}"
              </div>
            </div>

            {/* Order Items Purchased */}
            <div style={{ marginBottom: "18px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>
                Package Items ({selectedReviewOrder.items?.length || selectedReviewOrder.totalItems || 1} items)
              </span>
              <div style={{ marginTop: "6px", maxHeight: "110px", overflowY: "auto", border: "1px solid #F1F5F9", borderRadius: "8px", padding: "8px 12px", background: "#FAFAFA" }}>
                {(selectedReviewOrder.items || []).map((it, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "3px 0", color: "#334155" }}>
                    <span>• {it.name} (x{it.quantity})</span>
                    <strong style={{ color: "#0F172A" }}>₹{Number(it.price * it.quantity).toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setSelectedReviewOrder(null)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  background: "#0F172A",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

