import React, { useState, useEffect, useCallback } from "react";
import {
  Truck,
  Users,
  Search,
  Filter,
  PlusCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  UserCheck,
  UserX,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronRight,
  Package,
  Calendar,
  DollarSign,
  RefreshCw,
  X,
  Send,
  Navigation,
  Eye,
  Copy,
  Check,
} from "lucide-react";
import { io } from "socket.io-client";
import API, { SOCKET_URL } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import ErpPageBanner from "../../components/ErpPageBanner";
import "./ProductManagement.css";
import "./DeliveryManagement.css";

export default function DeliveryManagement() {
  const { currentSupermarket } = useAuth();

  // Top Level View Switch: "orders" | "staff"
  const [activeView, setActiveView] = useState("orders");

  // Orders State
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [copiedOrderId, setCopiedOrderId] = useState(null);
  const [selectedOrderForView, setSelectedOrderForView] = useState(null);
  const [viewOrderModalOpen, setViewOrderModalOpen] = useState(false);

  // Quick Copy Order ID
  const handleCopyOrderId = (orderNumber, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(orderNumber);
    setCopiedOrderId(orderNumber);
    showToast(`✓ Order ID ${orderNumber} copied to clipboard!`);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  // Staff State
  const [staffList, setStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffStatusFilter, setStaffStatusFilter] = useState("all");

  // Modals
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedOrderForAssign, setSelectedOrderForAssign] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Timeline Progress Modal
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [selectedOrderForTimeline, setSelectedOrderForTimeline] = useState(null);

  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({
    name: "",
    phone: "",
    email: "",
    username: "",
    password: "",
    status: "Active",
  });
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [staffFormError, setStaffFormError] = useState("");

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState("");
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // 1. Fetch Delivery Orders
  const fetchOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      const res = await API.get("/delivery/orders");
      if (res.data?.success && Array.isArray(res.data.orders)) {
        setOrders(res.data.orders);
      }
    } catch (err) {
      console.warn("Delivery orders fetch notice:", err.message);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  // 2. Fetch Delivery Staff
  const fetchStaff = useCallback(async () => {
    try {
      setLoadingStaff(true);
      const res = await API.get("/delivery/staff");
      if (res.data?.success && Array.isArray(res.data.staff)) {
        setStaffList(res.data.staff);
      }
    } catch (err) {
      console.warn("Delivery staff fetch notice:", err.message);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchStaff();

    let socket;
    try {
      socket = io(SOCKET_URL || "http://localhost:5000", {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
      });

      socket.on("delivery:order_updated", () => {
        fetchOrders();
      });

      socket.on("order:updated", () => {
        fetchOrders();
      });

      socket.on("order:created", () => {
        fetchOrders();
      });

      socket.on("delivery_staff:updated", () => {
        fetchStaff();
      });
    } catch (_) {}

    return () => {
      if (socket) socket.disconnect();
    };
  }, [fetchOrders, fetchStaff]);

  // Handle Assign Staff to Order
  const handleOpenAssignModal = (order) => {
    setSelectedOrderForAssign(order);
    setSelectedStaffId(
      order.assignedStaff?._id ||
        order.assignedStaff ||
        order.deliveryStaff?._id ||
        order.deliveryStaff ||
        ""
    );
    setAssignModalOpen(true);
  };

  // Handle View Delivery Progress Timeline Modal
  const handleOpenTimelineModal = (order) => {
    setSelectedOrderForTimeline(order);
    setTimelineModalOpen(true);
  };

  const handleExecuteAssign = async () => {
    if (!selectedOrderForAssign || !selectedStaffId) {
      showToast("⚠️ Please select a delivery staff member.");
      return;
    }
    try {
      setIsAssigning(true);
      const res = await API.post(`/delivery/orders/${selectedOrderForAssign._id}/assign`, {
        staffId: selectedStaffId,
      });
      if (res.data?.success) {
        showToast("✓ Order assigned to delivery staff successfully!");
        setAssignModalOpen(false);
        fetchOrders();
        fetchStaff();
      } else {
        showToast(`⚠️ ${res.data?.message || "Failed to assign order."}`);
      }
    } catch (err) {
      showToast(`⚠️ ${err.response?.data?.message || err.message}`);
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle Advance Delivery Order Status
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await API.put(`/delivery/orders/${orderId}/status`, {
        status: newStatus,
      });
      if (res.data?.success) {
        showToast(`✓ Order status updated to "${newStatus}"!`);
        fetchOrders();
        fetchStaff();
      } else {
        showToast(`⚠️ ${res.data?.message || "Failed to update status."}`);
      }
    } catch (err) {
      showToast(`⚠️ ${err.response?.data?.message || err.message}`);
    }
  };

  // Open Staff Modal for Add or Edit
  const handleAutoGenerateUsername = (name) => {
    const rawName = (name !== undefined ? name : staffForm.name) || "driver";
    const base = rawName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 10);
    const storeSuffix = (currentSupermarket?.code || "sm")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const gen = `${base || "driver"}_${storeSuffix || "delivery"}`;
    setStaffForm((prev) => ({ ...prev, username: gen }));
  };

  const handleOpenAddStaff = () => {
    setEditingStaff(null);
    const storeSuffix = (currentSupermarket?.code || "sm").toLowerCase().replace(/[^a-z0-9]/g, "");
    setStaffForm({
      name: "",
      phone: "",
      email: "",
      username: `driver_${storeSuffix}`,
      password: "Delivery@123",
      status: "Active",
    });
    setStaffFormError("");
    setStaffModalOpen(true);
  };

  const handleOpenEditStaff = (staff) => {
    setEditingStaff(staff);
    setStaffForm({
      name: staff.name || "",
      phone: staff.phone ? String(staff.phone).replace(/\D/g, "").slice(-10) : "",
      email: staff.email || "",
      username: staff.username || "",
      password: "",
      status: staff.status === "Inactive" ? "Inactive" : "Active",
    });
    setStaffFormError("");
    setStaffModalOpen(true);
  };

  // Save Staff (Add or Edit)
  const handleSaveStaff = async (e) => {
    if (e) e.preventDefault();
    setStaffFormError("");

    if (!staffForm.name.trim()) {
      setStaffFormError("Staff name is required.");
      return;
    }
    const cleanP = staffForm.phone.replace(/\D/g, "").slice(-10);
    if (cleanP.length !== 10 || !/^[6-9]/.test(cleanP)) {
      setStaffFormError("Valid 10-digit Indian mobile number starting with 6, 7, 8, or 9 is required (e.g. 9876543210).");
      return;
    }
    if (!staffForm.username.trim()) {
      setStaffFormError("Login username is required.");
      return;
    }
    if (!editingStaff && (!staffForm.password || staffForm.password.length < 4)) {
      setStaffFormError("Password must be at least 4 characters long.");
      return;
    }

    try {
      setIsSavingStaff(true);
      if (editingStaff) {
        const res = await API.put(`/delivery/staff/${editingStaff._id}`, {
          ...staffForm,
          phone: `+91 ${cleanP}`,
        });
        if (res.data?.success) {
          const successMsg = res.data?.message || `✓ Staff member "${staffForm.name}" updated successfully!`;
          showToast(successMsg);
          setStaffModalOpen(false);
          fetchStaff();
        } else {
          setStaffFormError(res.data?.message || "Failed to update staff.");
        }
      } else {
        const res = await API.post("/delivery/staff", {
          ...staffForm,
          phone: `+91 ${cleanP}`,
        });
        if (res.data?.success) {
          const successMsg = res.data?.message || `✓ Delivery staff "${staffForm.name}" created successfully!`;
          showToast(successMsg);
          setStaffModalOpen(false);
          fetchStaff();
        } else {
          setStaffFormError(res.data?.message || "Failed to create staff.");
        }
      }
    } catch (err) {
      setStaffFormError(err.response?.data?.message || err.message);
    } finally {
      setIsSavingStaff(false);
    }
  };

  // Toggle Staff Active / Inactive Status
  const handleToggleStaffStatus = async (staff) => {
    try {
      const res = await API.put(`/delivery/staff/${staff._id}/status`);
      if (res.data?.success) {
        showToast(`✓ Status updated to ${res.data.status}`);
        fetchStaff();
      } else {
        showToast(`⚠️ ${res.data?.message || "Failed to toggle status."}`);
      }
    } catch (err) {
      showToast(`⚠️ ${err.response?.data?.message || err.message}`);
    }
  };

  // Filter Orders
  const filteredOrders = orders.filter((o) => {
    const s = o.deliveryStatus || "New";
    if (orderStatusFilter === "new" && s !== "New" && s !== "Pending") return false;
    if (orderStatusFilter === "preparing" && s !== "Preparing") return false;
    if (orderStatusFilter === "assigned" && s !== "Assigned" && s !== "Accepted" && s !== "OrderPickedUp") return false;
    if (orderStatusFilter === "out_for_delivery" && s !== "OutForDelivery") return false;
    if (orderStatusFilter === "delivered" && s !== "Delivered") return false;
    if (orderStatusFilter === "history" && s !== "Delivered" && s !== "Cancelled") return false;

    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      const matchNum = o.orderNumber?.toLowerCase().includes(q);
      const matchCust = o.customer?.name?.toLowerCase().includes(q) || o.customerName?.toLowerCase().includes(q);
      const matchPhone = o.customer?.phone?.includes(q) || o.customerPhone?.includes(q);
      const matchAddr = o.deliveryAddress?.toLowerCase().includes(q) || o.customer?.address?.toLowerCase().includes(q);
      if (!matchNum && !matchCust && !matchPhone && !matchAddr) return false;
    }
    return true;
  });

  // Filter Staff
  const filteredStaff = staffList.filter((s) => {
    if (staffStatusFilter !== "all" && s.status !== staffStatusFilter) return false;
    if (staffSearch.trim()) {
      const q = staffSearch.toLowerCase();
      const matchName = s.name?.toLowerCase().includes(q);
      const matchUser = s.username?.toLowerCase().includes(q);
      const matchPhone = s.phone?.includes(q);
      const matchEmail = s.email?.toLowerCase().includes(q);
      if (!matchName && !matchUser && !matchPhone && !matchEmail) return false;
    }
    return true;
  });

  // Counts for Badges
  const countNewOrders = orders.filter((o) => ["New", "Pending"].includes(o.deliveryStatus || "New")).length;
  const countPreparingOrders = orders.filter((o) => o.deliveryStatus === "Preparing").length;
  const countAssignedOrders = orders.filter((o) => ["Assigned", "Accepted", "OrderPickedUp"].includes(o.deliveryStatus)).length;
  const countOutOrders = orders.filter((o) => o.deliveryStatus === "OutForDelivery").length;
  const countDeliveredOrders = orders.filter((o) => o.deliveryStatus === "Delivered").length;

  return (
    <div className="grocer-page-container">
      {/* Toast Notification */}
      {toastMessage && <div className="del-toast-bar">{toastMessage}</div>}

      {/* Header Banner - Standardized ERP Banner */}
      <ErpPageBanner
        title="Delivery Fleet & Order Management"
        subtitle={`Track real-time doorstep delivery orders, assign fleet personnel, and monitor fulfillment for ${currentSupermarket?.name || "Your Supermarket"} (${currentSupermarket?.code || "SM"}).`}
        badges={["Doorstep Deliveries", "Fleet Staff Dispatch", "Live Order Tracking"]}
        icon={<Truck size={22} color="#ffffff" strokeWidth={2.4} />}
      />

      {/* Executive 4-Card Delivery KPI Strip */}
      <section className="pm-kpi-grid" style={{ marginBottom: "22px" }}>
        {/* Card 1: Total Orders */}
        <div className="pm-kpi-card blue-theme">
          <div className="pm-kpi-icon-pill blue">
            <Truck size={20} color="#2563EB" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">{orders.length}</h3>
            <span className="pm-kpi-label">Total Delivery Orders</span>
            <div className="pm-kpi-trend blue">
              <span className="trend-arrow">🚚</span>
              <span>Doorstep fulfillment</span>
            </div>
          </div>
        </div>

        {/* Card 2: Active Staff */}
        <div className="pm-kpi-card green-theme">
          <div className="pm-kpi-icon-pill green">
            <Users size={20} color="#059669" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">
              {staffList.filter((s) => s.status !== "Inactive").length}
            </h3>
            <span className="pm-kpi-label">Active Fleet Staff</span>
            <div className="pm-kpi-trend green">
              <span className="trend-arrow">✓</span>
              <span>{staffList.length} total drivers</span>
            </div>
          </div>
        </div>

        {/* Card 3: Out for Delivery */}
        <div className="pm-kpi-card purple-theme">
          <div className="pm-kpi-icon-pill purple">
            <Navigation size={20} color="#7C3AED" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">{countOutOrders}</h3>
            <span className="pm-kpi-label">Out for Delivery</span>
            <div className="pm-kpi-trend purple">
              <span className="trend-arrow">📍</span>
              <span>In transit right now</span>
            </div>
          </div>
        </div>

        {/* Card 4: Delivered Orders */}
        <div className="pm-kpi-card green-theme">
          <div className="pm-kpi-icon-pill green">
            <CheckCircle2 size={20} color="#16A34A" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">{countDeliveredOrders}</h3>
            <span className="pm-kpi-label">Successfully Delivered</span>
            <div className="pm-kpi-trend green">
              <span className="trend-arrow">✓</span>
              <span>Customer handoffs</span>
            </div>
          </div>
        </div>
      </section>

      {/* Top Level View Switcher & Action Toolbar */}
      <div className="del-toolbar-card">
        <div className="del-switch-pills">
          <button
            type="button"
            className={`del-switch-pill ${activeView === "orders" ? "active" : ""}`}
            onClick={() => setActiveView("orders")}
          >
            <Truck size={16} />
            <span>Delivery Orders</span>
            <span className="del-switch-count">{orders.length}</span>
          </button>
          <button
            type="button"
            className={`del-switch-pill ${activeView === "staff" ? "active" : ""}`}
            onClick={() => setActiveView("staff")}
          >
            <Users size={16} />
            <span>Delivery Staff Fleet</span>
            <span className="del-switch-count">{staffList.length}</span>
          </button>
        </div>

        {activeView === "staff" ? (
          <button
            type="button"
            className="del-primary-btn"
            onClick={handleOpenAddStaff}
          >
            <PlusCircle size={16} />
            <span>Add Delivery Staff</span>
          </button>
        ) : (
          <button
            type="button"
            className="del-secondary-btn"
            onClick={() => {
              fetchOrders();
              fetchStaff();
            }}
          >
            <RefreshCw size={14} className={loadingOrders ? "del-spin" : ""} />
            <span>Refresh Orders</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: DELIVERY ORDERS MANAGEMENT                                        */}
      {/* ========================================================================= */}
      {activeView === "orders" && (
        <div className="del-view-wrap">
          {/* Status Filter Strip */}
          <div className="del-status-strip">
            {[
              { id: "all", label: "All Orders", count: orders.length },
              { id: "new", label: "New Orders", count: countNewOrders },
              { id: "preparing", label: "Preparing", count: countPreparingOrders },
              { id: "assigned", label: "Assigned Orders", count: countAssignedOrders },
              { id: "out_for_delivery", label: "Out for Delivery", count: countOutOrders },
              { id: "delivered", label: "Delivered", count: countDeliveredOrders },
              { id: "history", label: "Order History", count: countDeliveredOrders },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`del-status-chip ${orderStatusFilter === f.id ? "active" : ""}`}
                onClick={() => setOrderStatusFilter(f.id)}
              >
                <span>{f.label}</span>
                <span className="del-status-badge">{f.count}</span>
              </button>
            ))}
          </div>

          {/* Full-Width Standard Search Box */}
          <div className="del-search-card">
            <div className="del-search-box">
              <Search size={18} color="#2563EB" />
              <input
                type="text"
                placeholder="Search by Order #, Customer Name, Mobile Number, or Delivery Address..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                autoComplete="off"
                spellCheck="false"
              />
              {orderSearch && (
                <button type="button" onClick={() => setOrderSearch("")} className="del-clear-btn" title="Clear Search">
                  ✕
                </button>
              )}
              <span className="del-search-count-pill">
                Showing {filteredOrders.length} of {orders.length} orders
              </span>
            </div>
          </div>

          {/* Orders Table strictly matching Reference Mockup Design */}
          {loadingOrders ? (
            <div className="del-loading-box">
              <RefreshCw size={26} className="del-spin" />
              <p>Fetching real-time delivery orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="del-empty-card">
              <div className="del-empty-icon-wrap">
                <Truck size={34} color="#2563EB" />
              </div>
              <h4>No Delivery Orders Found</h4>
              <p>
                {orderSearch
                  ? `No delivery orders matched "${orderSearch}". Try searching with a different term.`
                  : "There are currently no delivery orders in this status category. Live doorstep customer orders will appear here automatically."}
              </p>
              {orderSearch ? (
                <button
                  type="button"
                  className="del-secondary-btn"
                  style={{ marginTop: 14 }}
                  onClick={() => setOrderSearch("")}
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
                  <span>Check for New Orders</span>
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
                    <Truck size={18} color="#FFFFFF" />
                  </div>
                  <div>
                    <h3 className="pm-catalog-heading">
                      Home Delivery Orders Directory ({filteredOrders.length}{" "}
                      {filteredOrders.length === 1 ? "Order" : "Orders"} Listed)
                    </h3>
                    <span
                      style={{
                        fontSize: "11.5px",
                        color: "#64748B",
                        fontWeight: "600",
                      }}
                    >
                      Real-time door-to-door delivery fulfillment &amp; driver assignments
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
                      <th className="th-address">DELIVERY ADDRESS</th>
                      <th className="th-partner">DELIVERY PARTNER</th>
                      <th className="th-items">ITEMS</th>
                      <th className="th-amount">TOTAL AMOUNT</th>
                      <th className="th-status">STATUS</th>
                      <th className="th-action">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((ord, index) => {
                      const s = ord.deliveryStatus || "New";
                      const staffAssigned = ord.assignedStaff || ord.deliveryStaff;
                      const custName = ord.customer?.name || ord.customerName || "Customer";
                      const custPhone = ord.customer?.phone || ord.customerPhone || "—";
                      const deliveryAddress =
                        ord.deliveryAddress || ord.customer?.address || "Address not provided";
                      const itemCount = ord.items?.length || ord.totalItems || 1;
                      const firstItemName =
                        ord.items?.[0]?.name ||
                        ord.items?.[0]?.product?.name ||
                        (ord.items?.length ? "Package Items" : "Groceries");
                      const formattedDate = ord.createdAt
                        ? new Date(ord.createdAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "Recent";

                      const isDelivered =
                        s === "Delivered" || s === "Completed";

                      return (
                        <tr
                          key={ord._id || index}
                          className={isDelivered ? "row-completed-highlight" : ""}
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
                          <td className="td-address">
                            <div className="order-address-cell" title={deliveryAddress}>
                              📍 {deliveryAddress}
                            </div>
                          </td>
                          <td className="td-partner">
                            {staffAssigned ? (
                              <span className="order-partner-cell">
                                <UserCheck size={12} />
                                <span>{staffAssigned.name || ord.assignedStaffName || "Driver"}</span>
                              </span>
                            ) : (
                              <span className="order-partner-unassigned">
                                Unassigned
                              </span>
                            )}
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
                            {isDelivered ? (
                              <span className="order-status-pill status-completed">
                                <CheckCircle2 size={13} color="#15803D" strokeWidth={2.4} />
                                <span>Delivered</span>
                              </span>
                            ) : s === "Out for Delivery" || s === "OutForDelivery" ? (
                              <span className="order-status-pill status-outfordelivery">
                                <Navigation size={13} color="#0284C7" strokeWidth={2.4} />
                                <span>Out for Delivery</span>
                              </span>
                            ) : s === "OrderPickedUp" || s === "Products Collected" ? (
                              <span className="order-status-pill status-orderpickedup">
                                <Package size={13} color="#7E22CE" strokeWidth={2.4} />
                                <span>Picked Up</span>
                              </span>
                            ) : s === "Assigned" || s === "Accepted" ? (
                              <span className="order-status-pill status-assigned">
                                <UserCheck size={13} color="#6B21A8" strokeWidth={2.4} />
                                <span>Assigned</span>
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
                                viewOrderModalOpen ? null : setViewOrderModalOpen(true);
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DELIVERY STAFF FLEET MANAGEMENT                                  */}
      {/* ========================================================================= */}
      {activeView === "staff" && (
        <div className="del-view-wrap">
          {/* Search & Status Filter */}
          <div className="del-staff-filter-bar">
            <div className="del-search-card del-staff-search-card">
              <div className="del-search-box">
                <Search size={18} color="#2563EB" style={{ flexShrink: 0 }} />
                <input
                  type="search"
                  name="staff_fleet_search_filter"
                  id="staff_fleet_search_filter"
                  placeholder="Search staff by Name, Mobile, Email, or Username..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  data-lpignore="true"
                  data-form-type="other"
                />
                {staffSearch && (
                  <button type="button" onClick={() => setStaffSearch("")} className="del-clear-btn" title="Clear Search">
                    ✕
                  </button>
                )}
                <span className="del-search-count-pill">
                  {filteredStaff.length} staff
                </span>
              </div>
            </div>

            <div className="del-filter-pills">
              {["all", "Active", "Inactive"].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`del-filter-pill ${staffStatusFilter === st ? "active" : ""}`}
                  onClick={() => setStaffStatusFilter(st)}
                >
                  {st === "all" ? "All Staff" : st}
                </button>
              ))}
            </div>
          </div>

          {/* Staff Grid */}
          {loadingStaff ? (
            <div className="del-loading-box">
              <RefreshCw size={26} className="del-spin" />
              <p>Fetching delivery staff fleet...</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="del-empty-card">
              <div className="del-empty-icon-wrap" style={{ background: "#F0FDF4", borderColor: "#BBF7D0" }}>
                <Users size={34} color="#059669" />
              </div>
              <h4>No Delivery Staff Added</h4>
              <p>Add authorized delivery personnel to handle doorstep grocery delivery for this supermarket.</p>
              <button
                type="button"
                className="del-primary-btn"
                style={{ marginTop: 14 }}
                onClick={handleOpenAddStaff}
              >
                <PlusCircle size={15} />
                <span>Add First Delivery Staff</span>
              </button>
            </div>
          ) : (
            <div className="del-staff-grid">
              {filteredStaff.map((staff) => {
                const isActive = staff.status !== "Inactive" && staff.status !== "Suspended";

                return (
                  <div key={staff._id} className="del-staff-card">
                    <div className="del-staff-card-header">
                      <div className="del-staff-avatar-box">
                        <Truck size={20} color="#10B981" />
                      </div>
                      <div className="del-staff-info">
                        <strong className="del-staff-name">{staff.name}</strong>
                        <span className="del-staff-user">@{staff.username}</span>
                      </div>
                      <span className={`del-staff-status-badge ${isActive ? "active" : "inactive"}`}>
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="del-staff-contact-list">
                      <div className="del-contact-item">
                        <Phone size={13} color="#64748B" />
                        <span>{staff.phone || "No phone added"}</span>
                      </div>
                      <div className="del-contact-item">
                        <Mail size={13} color="#64748B" />
                        <span>{staff.email || `${staff.username}@delivery.store`}</span>
                      </div>
                    </div>

                    {/* Stats Strip */}
                    <div className="del-staff-stats-strip">
                      <div className="del-stat-cell">
                        <strong>{staff.totalAssigned || 0}</strong>
                        <span>Assigned</span>
                      </div>
                      <div className="del-stat-cell">
                        <strong style={{ color: "#D97706" }}>{staff.activeOrders || 0}</strong>
                        <span>Active</span>
                      </div>
                      <div className="del-stat-cell">
                        <strong style={{ color: "#059669" }}>{staff.deliveredOrders || 0}</strong>
                        <span>Delivered</span>
                      </div>
                    </div>

                    {/* Staff Actions */}
                    <div className="del-staff-actions">
                      <button
                        type="button"
                        className="del-staff-action-btn edit"
                        onClick={() => handleOpenEditStaff(staff)}
                        title="Edit Staff Details"
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        className={`del-staff-action-btn ${isActive ? "deactivate" : "activate"}`}
                        onClick={() => handleToggleStaffStatus(staff)}
                      >
                        {isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                        <span>{isActive ? "Deactivate" : "Activate"}</span>
                      </button>

                      <button
                        type="button"
                        className="del-staff-action-btn view-orders"
                        onClick={() => {
                          setOrderSearch(staff.name);
                          setActiveView("orders");
                        }}
                        title="Filter Orders for this staff"
                      >
                        <Truck size={13} />
                        <span>Orders</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW DELIVERY ORDER DETAILS (Matching Reference Mockup Action View)*/}
      {/* ========================================================================= */}
      {viewOrderModalOpen && selectedOrderForView && (
        <div
          className="del-modal-overlay"
          onClick={() => setViewOrderModalOpen(false)}
        >
          <div
            className="del-modal-card"
            style={{ maxWidth: "660px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="del-modal-header">
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
                {selectedOrderForView.deliveryStatus === "Delivered" ||
                selectedOrderForView.deliveryStatus === "Completed" ? (
                  <span className="order-status-pill status-completed">
                    <CheckCircle2 size={13} color="#15803D" strokeWidth={2.4} />
                    <span>Delivered</span>
                  </span>
                ) : selectedOrderForView.deliveryStatus === "Out for Delivery" ||
                  selectedOrderForView.deliveryStatus === "OutForDelivery" ? (
                  <span className="order-status-pill status-outfordelivery">
                    <Navigation size={13} color="#0284C7" strokeWidth={2.4} />
                    <span>Out for Delivery</span>
                  </span>
                ) : selectedOrderForView.deliveryStatus === "OrderPickedUp" ||
                  selectedOrderForView.deliveryStatus === "Products Collected" ? (
                  <span className="order-status-pill status-orderpickedup">
                    <Package size={13} color="#7E22CE" strokeWidth={2.4} />
                    <span>Picked Up</span>
                  </span>
                ) : selectedOrderForView.deliveryStatus === "Assigned" ||
                  selectedOrderForView.deliveryStatus === "Accepted" ? (
                  <span className="order-status-pill status-assigned">
                    <UserCheck size={13} color="#6B21A8" strokeWidth={2.4} />
                    <span>Assigned</span>
                  </span>
                ) : selectedOrderForView.deliveryStatus === "Preparing" ? (
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
                  className="del-modal-close"
                  onClick={() => setViewOrderModalOpen(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="del-modal-body" style={{ padding: "18px 22px", maxHeight: "72vh", overflowY: "auto" }}>
              {/* Customer & Address Strip */}
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
                    Delivery Destination
                  </span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 2, display: "flex", alignItems: "flex-start", gap: 5 }}>
                    <MapPin size={13} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{selectedOrderForView.deliveryAddress || selectedOrderForView.customer?.address || "Address not provided"}</span>
                  </div>
                </div>
              </div>

              {/* Delivery Partner Strip */}
              <div
                style={{
                  background: "#F0FDF4",
                  border: "1.5px solid #BBF7D0",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669" }}>
                    <UserCheck size={18} />
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>
                      Assigned Delivery Partner
                    </span>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#064E3B", marginTop: 1 }}>
                      {selectedOrderForView.assignedStaff?.name || selectedOrderForView.assignedStaffName || selectedOrderForView.deliveryStaff?.name || "Unassigned (No Driver Assigned Yet)"}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="del-assign-btn"
                  style={{ padding: "6px 14px", fontSize: "12px" }}
                  onClick={() => {
                    setViewOrderModalOpen(false);
                    handleOpenAssignModal(selectedOrderForView);
                  }}
                >
                  <UserCheck size={13} />
                  <span>{selectedOrderForView.assignedStaff ? "Change Driver" : "Assign Driver"}</span>
                </button>
              </div>

              {/* Order Items Table */}
              <div style={{ marginBottom: "16px" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Items Purchased ({selectedOrderForView.items?.length || selectedOrderForView.totalItems || 1})
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
                          Grand Total (Online Paid):
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 900, textAlign: "right", color: "#059669", fontSize: 15 }}>
                          ₹{Number(selectedOrderForView.totalAmount || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="del-modal-footer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <button
                type="button"
                className="del-secondary-btn"
                style={{ padding: "8px 14px", fontSize: "12.5px" }}
                onClick={() => {
                  setViewOrderModalOpen(false);
                  handleOpenTimelineModal(selectedOrderForView);
                }}
              >
                <Clock size={13} />
                <span>View Timeline</span>
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="del-btn-secondary"
                  onClick={() => setViewOrderModalOpen(false)}
                >
                  Close
                </button>

                {selectedOrderForView.deliveryStatus === "New" ||
                selectedOrderForView.deliveryStatus === "Pending" ? (
                  <button
                    type="button"
                    className="del-advance-btn"
                    style={{ background: "#7C3AED", color: "#fff" }}
                    onClick={() => {
                      handleUpdateOrderStatus(selectedOrderForView._id, "Preparing");
                      setViewOrderModalOpen(false);
                    }}
                  >
                    Mark Preparing
                  </button>
                ) : selectedOrderForView.deliveryStatus === "Preparing" ? (
                  <button
                    type="button"
                    className="del-advance-btn"
                    style={{ background: "#2563EB", color: "#fff" }}
                    onClick={() => {
                      handleUpdateOrderStatus(selectedOrderForView._id, "Products Collected");
                      setViewOrderModalOpen(false);
                    }}
                  >
                    Mark Products Collected
                  </button>
                ) : selectedOrderForView.deliveryStatus === "Products Collected" ? (
                  <button
                    type="button"
                    className="del-advance-btn"
                    style={{ background: "#D97706", color: "#fff" }}
                    onClick={() => {
                      handleUpdateOrderStatus(selectedOrderForView._id, "Out for Delivery");
                      setViewOrderModalOpen(false);
                    }}
                  >
                    Mark Out for Delivery
                  </button>
                ) : selectedOrderForView.deliveryStatus === "Out for Delivery" ||
                  selectedOrderForView.deliveryStatus === "OutForDelivery" ? (
                  <button
                    type="button"
                    className="del-delivered-btn"
                    onClick={() => {
                      handleUpdateOrderStatus(selectedOrderForView._id, "Delivered");
                      setViewOrderModalOpen(false);
                    }}
                  >
                    Mark Delivered
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ASSIGN ORDER TO STAFF                                            */}
      {/* ========================================================================= */}
      {assignModalOpen && selectedOrderForAssign && (
        <div className="del-modal-overlay" onClick={() => !isAssigning && setAssignModalOpen(false)}>
          <div className="del-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="del-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="del-modal-icon-circle">
                  <UserCheck size={18} color="#059669" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Assign Delivery Staff</h3>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>
                    Order {selectedOrderForAssign.orderNumber} • ₹{Number(selectedOrderForAssign.totalAmount || 0).toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="del-modal-close"
                onClick={() => !isAssigning && setAssignModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="del-modal-body">
              <div className="del-order-mini-summary">
                <div>
                  <span className="del-mini-label">Deliver To:</span>
                  <strong className="del-mini-val">
                    {selectedOrderForAssign.customer?.name || selectedOrderForAssign.customerName || "Customer"}
                  </strong>
                </div>
                <div>
                  <span className="del-mini-label">Address:</span>
                  <p className="del-mini-addr">
                    {selectedOrderForAssign.deliveryAddress || selectedOrderForAssign.customer?.address || "Address"}
                  </p>
                </div>
              </div>

              <label className="del-form-label" style={{ marginTop: 14 }}>
                Select Authorized Delivery Personnel:
              </label>

              {staffList.filter((s) => s.status !== "Inactive").length === 0 ? (
                <div className="del-no-staff-alert">
                  <AlertCircle size={16} color="#DC2626" />
                  <span>
                    No active delivery staff found. Please add delivery staff in the Delivery Staff Fleet tab first.
                  </span>
                </div>
              ) : (
                <div className="del-staff-picker-list">
                  {staffList
                    .filter((s) => s.status !== "Inactive")
                    .map((st) => (
                      <label
                        key={st._id}
                        className={`del-staff-pick-item ${selectedStaffId === st._id ? "selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="assignedStaffRadio"
                          value={st._id}
                          checked={selectedStaffId === st._id}
                          onChange={() => setSelectedStaffId(st._id)}
                        />
                        <div className="del-pick-avatar">
                          <Truck size={15} color="#059669" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <strong className="del-pick-name">{st.name}</strong>
                          <span className="del-pick-meta">
                            {st.phone} • {st.activeOrders || 0} active orders
                          </span>
                        </div>
                        {selectedStaffId === st._id && (
                          <CheckCircle2 size={18} color="#059669" />
                        )}
                      </label>
                    ))}
                </div>
              )}
            </div>

            <div className="del-modal-footer">
              <button
                type="button"
                className="del-btn-secondary"
                onClick={() => setAssignModalOpen(false)}
                disabled={isAssigning}
              >
                Cancel
              </button>
              <button
                type="button"
                className="del-btn-primary"
                onClick={handleExecuteAssign}
                disabled={isAssigning || !selectedStaffId}
              >
                {isAssigning ? "Assigning..." : "Confirm Staff Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD / EDIT DELIVERY STAFF                                        */}
      {/* ========================================================================= */}
      {staffModalOpen && (
        <div className="del-modal-overlay" onClick={() => !isSavingStaff && setStaffModalOpen(false)}>
          <div className="del-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="del-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="del-modal-icon-circle">
                  <Users size={18} color="#059669" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>
                    {editingStaff ? "Edit Delivery Staff" : "Add Delivery Staff"}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>
                    Multi-tenant isolated to {currentSupermarket?.name || "Your Supermarket"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="del-modal-close"
                onClick={() => !isSavingStaff && setStaffModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStaff}>
              <div className="del-modal-body">
                {staffFormError && (
                  <div className="del-form-error-banner">
                    <AlertCircle size={15} />
                    <span>{staffFormError}</span>
                  </div>
                )}

                <div className="del-form-group">
                  <label className="del-form-label">Staff Full Name *</label>
                  <input
                    type="text"
                    className="del-form-input"
                    placeholder="e.g. Ramesh Kumar"
                    value={staffForm.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setStaffForm((prev) => {
                        const update = { ...prev, name: newName };
                        if (!editingStaff) {
                          const base = newName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
                          const storeSuffix = (currentSupermarket?.code || "sm").toLowerCase().replace(/[^a-z0-9]/g, "");
                          if (base && (!prev.username || prev.username.startsWith("driver_"))) {
                            update.username = `${base}_${storeSuffix}`;
                          }
                        }
                        return update;
                      });
                    }}
                    required
                  />
                </div>

                <div className="del-form-grid-2">
                  <div className="del-form-group">
                    <label className="del-form-label">Mobile Number (10 Digits) *</label>
                    <div
                      className={`del-phone-input-wrap ${
                        staffForm.phone && !/^[6-9]/.test(staffForm.phone)
                          ? "has-error"
                          : staffForm.phone.length === 10
                          ? "is-valid"
                          : ""
                      }`}
                    >
                      <span className="del-phone-prefix">🇮🇳 +91</span>
                      <input
                        type="tel"
                        className="del-phone-input"
                        placeholder="e.g. 9876543210"
                        maxLength={10}
                        value={staffForm.phone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setStaffForm({ ...staffForm, phone: val });
                        }}
                        required
                      />
                    </div>
                    {staffForm.phone && !/^[6-9]/.test(staffForm.phone) ? (
                      <span className="del-field-hint error">
                        ⚠️ Mobile number must start with 6, 7, 8, or 9
                      </span>
                    ) : staffForm.phone.length === 10 ? (
                      <span className="del-field-hint success">
                        ✓ Valid 10-digit mobile number (+91 {staffForm.phone})
                      </span>
                    ) : (
                      <span className="del-field-hint">
                        10 digits starting with 6, 7, 8, or 9
                      </span>
                    )}
                  </div>

                  <div className="del-form-group">
                    <div className="del-form-label-row">
                      <label className="del-form-label">Email Address</label>
                      {staffForm.email && staffForm.email.includes("@") && (
                        <button
                          type="button"
                          className="del-auto-gen-btn"
                          onClick={() =>
                            setStaffForm((prev) => ({
                              ...prev,
                              username: prev.email.trim().toLowerCase(),
                            }))
                          }
                          title="Use email as username"
                        >
                          Use as Username
                        </button>
                      )}
                    </div>
                    <input
                      type="email"
                      className="del-form-input"
                      placeholder="e.g. ramesh@store.com"
                      value={staffForm.email}
                      onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    />
                    <span className="del-field-hint" style={{ color: "#0369a1" }}>
                      ✉️ Welcome email with credentials will be sent here.
                    </span>
                  </div>
                </div>

                <div className="del-form-grid-2">
                  <div className="del-form-group">
                    <div className="del-form-label-row">
                      <label className="del-form-label">Login Username *</label>
                      <button
                        type="button"
                        className="del-auto-gen-btn"
                        onClick={() => handleAutoGenerateUsername()}
                        title="Auto-generate a clean username"
                      >
                        ⚡ Auto-Generate
                      </button>
                    </div>
                    <div className="del-username-input-wrap">
                      <span className="del-username-at">@</span>
                      <input
                        type="text"
                        className="del-username-input"
                        placeholder="e.g. ramesh_hh8912 or email"
                        value={staffForm.username}
                        onChange={(e) =>
                          setStaffForm({
                            ...staffForm,
                            username: e.target.value.toLowerCase().trim(),
                          })
                        }
                        required
                      />
                    </div>
                    <span className="del-field-hint">
                      💡 Staff can sign in using this username or email!
                    </span>
                  </div>

                  <div className="del-form-group">
                    <label className="del-form-label">
                      {editingStaff ? "New Password (leave blank to keep)" : "Password *"}
                    </label>
                    <input
                      type="text"
                      className="del-form-input"
                      placeholder="e.g. Delivery@123"
                      value={staffForm.password}
                      onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                      required={!editingStaff}
                    />
                    <span className="del-field-hint">
                      {editingStaff
                        ? "Only fill to change password."
                        : "Credentials for the mobile Delivery Dashboard."}
                    </span>
                  </div>
                </div>

                <div className="del-form-group">
                  <label className="del-form-label">Account Status</label>
                  <select
                    className="del-form-select"
                    value={staffForm.status}
                    onChange={(e) => setStaffForm({ ...staffForm, status: e.target.value })}
                  >
                    <option value="Active">Active (Can accept delivery assignments)</option>
                    <option value="Inactive">Inactive (Suspended from assignments)</option>
                  </select>
                </div>
              </div>

              <div className="del-modal-footer">
                <button
                  type="button"
                  className="del-btn-secondary"
                  onClick={() => setStaffModalOpen(false)}
                  disabled={isSavingStaff}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="del-btn-primary"
                  disabled={isSavingStaff}
                >
                  {isSavingStaff
                    ? "Saving..."
                    : editingStaff
                    ? "Update Staff"
                    : "Create Delivery Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VIEW COMPLETE 6-STAGE DELIVERY TIMELINE PROGRESS                 */}
      {/* ========================================================================= */}
      {timelineModalOpen && selectedOrderForTimeline && (
        <div className="del-modal-backdrop" onClick={() => setTimelineModalOpen(false)}>
          <div
            className="del-modal-card"
            style={{ maxWidth: 650, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="del-modal-header" style={{ borderBottom: "1px solid #E2E8F0", paddingBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                    Order Delivery Progress
                  </h3>
                  <span className={`del-badge-status status-${(selectedOrderForTimeline.deliveryStatus || "new").toLowerCase()}`}>
                    {selectedOrderForTimeline.deliveryStatus || "New"}
                  </span>
                </div>
                <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: "13px" }}>
                  Order #{selectedOrderForTimeline.orderNumber} • Placed {new Date(selectedOrderForTimeline.createdAt).toLocaleString("en-IN")}
                </p>
              </div>
              <button
                type="button"
                className="del-modal-close"
                onClick={() => setTimelineModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px" }}>
              {/* Delivery Partner Details Card */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginBottom: 20,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
                    Assigned Delivery Partner
                  </div>
                  {selectedOrderForTimeline.assignedStaff || selectedOrderForTimeline.assignedStaffName ? (
                    <div style={{ marginTop: 4 }}>
                      <strong style={{ fontSize: "15px", color: "#0F172A" }}>
                        {selectedOrderForTimeline.assignedStaff?.name || selectedOrderForTimeline.assignedStaffName}
                      </strong>
                      <div style={{ fontSize: "13px", color: "#059669", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <Phone size={13} />
                        <span>{selectedOrderForTimeline.assignedStaff?.phone || selectedOrderForTimeline.assignedStaffPhone || "Phone not provided"}</span>
                      </div>
                      {selectedOrderForTimeline.assignedAt && (
                        <div style={{ fontSize: "12px", color: "#64748B", marginTop: 4 }}>
                          Assigned: {new Date(selectedOrderForTimeline.assignedAt).toLocaleString("en-IN")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: "#D97706", fontWeight: 600, fontSize: "13px", marginTop: 4 }}>
                      ⚠️ No delivery partner assigned yet
                    </div>
                  )}
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
                    Delivery Address
                  </div>
                  <div style={{ fontSize: "13px", color: "#334155", maxWidth: 260, marginTop: 2 }}>
                    {selectedOrderForTimeline.deliveryAddress || selectedOrderForTimeline.customer?.address || "Address not provided"}
                  </div>
                </div>
              </div>

              {/* 6-Stage Timeline */}
              <h4 style={{ fontSize: "14px", fontWeight: 800, color: "#1E293B", marginBottom: 16 }}>
                Delivery Stages Timeline
              </h4>

              {(() => {
                const s = (selectedOrderForTimeline.deliveryStatus || "New").toLowerCase();
                const tl = selectedOrderForTimeline.trackingTimeline || [];

                const getTimelineEntry = (stageName) => {
                  return tl.find((item) =>
                    (item.stage || item.status || item.title || "").toLowerCase().includes(stageName.toLowerCase())
                  );
                };

                const stages = [
                  {
                    step: 1,
                    name: "Order Confirmed",
                    desc: "Customer placed order and payment was successfully verified.",
                    isDone: true,
                    isActive: s === "new" || s === "pending" || s === "order confirmed",
                    time: selectedOrderForTimeline.orderConfirmedAt || selectedOrderForTimeline.createdAt,
                    entry: getTimelineEntry("Confirmed"),
                  },
                  {
                    step: 2,
                    name: "Preparing",
                    desc: "Supermarket staff is picking and packing grocery items.",
                    isDone: ["preparing", "assigned", "accepted", "products collected", "orderpickedup", "out for delivery", "outfordelivery", "delivered"].includes(s) && s !== "preparing",
                    isActive: s === "preparing",
                    time: selectedOrderForTimeline.preparingAt || (getTimelineEntry("Preparing")?.timestamp),
                    entry: getTimelineEntry("Preparing"),
                  },
                  {
                    step: 3,
                    name: "Delivery Partner Assigned",
                    desc: selectedOrderForTimeline.assignedStaffName
                      ? `${selectedOrderForTimeline.assignedStaffName} assigned for doorstep dispatch.`
                      : "Delivery partner assigned to pickup items.",
                    isDone: ["products collected", "orderpickedup", "out for delivery", "outfordelivery", "delivered"].includes(s),
                    isActive: s === "assigned" || s === "accepted",
                    time: selectedOrderForTimeline.assignedAt || (getTimelineEntry("Assigned")?.timestamp),
                    entry: getTimelineEntry("Assigned"),
                  },
                  {
                    step: 4,
                    name: "Products Collected",
                    desc: "Delivery partner has verified and collected packed products from supermarket.",
                    isDone: ["out for delivery", "outfordelivery", "delivered"].includes(s),
                    isActive: s === "products collected" || s === "orderpickedup",
                    time: selectedOrderForTimeline.productsCollectedAt || selectedOrderForTimeline.pickedUpAt || (getTimelineEntry("Collected")?.timestamp),
                    entry: getTimelineEntry("Collected"),
                  },
                  {
                    step: 5,
                    name: "Out for Delivery",
                    desc: "Delivery partner is on the way to customer address.",
                    isDone: s === "delivered",
                    isActive: s === "out for delivery" || s === "outfordelivery",
                    time: selectedOrderForTimeline.deliveryOutAt || (getTimelineEntry("Out for Delivery")?.timestamp),
                    entry: getTimelineEntry("Out for Delivery"),
                  },
                  {
                    step: 6,
                    name: "Delivered",
                    desc: "Package safely handed over to customer at doorstep.",
                    isDone: s === "delivered",
                    isActive: false,
                    time: selectedOrderForTimeline.deliveryCompletedAt || selectedOrderForTimeline.completedAt || (getTimelineEntry("Delivered")?.timestamp),
                    entry: getTimelineEntry("Delivered"),
                  },
                ];

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 0, paddingLeft: 8 }}>
                    {stages.map((st, idx) => {
                      const isLast = idx === stages.length - 1;
                      return (
                        <div key={st.step} style={{ display: "flex", gap: 16, position: "relative" }}>
                          {/* Left Line & Icon */}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                background: st.isDone ? "#16A34A" : st.isActive ? "#2563EB" : "#E2E8F0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#FFFFFF",
                                fontSize: "12px",
                                fontWeight: 800,
                                zIndex: 2,
                                boxShadow: st.isActive ? "0 0 0 4px rgba(37, 99, 235, 0.2)" : "none",
                              }}
                            >
                              {st.isDone ? "✓" : st.step}
                            </div>
                            {!isLast && (
                              <div
                                style={{
                                  width: 2,
                                  flex: 1,
                                  minHeight: 44,
                                  background: st.isDone ? "#16A34A" : "#E2E8F0",
                                  margin: "4px 0",
                                }}
                              />
                            )}
                          </div>

                          {/* Right Content */}
                          <div style={{ paddingBottom: isLast ? 0 : 20, flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <strong
                                style={{
                                  fontSize: "14px",
                                  color: st.isDone ? "#16A34A" : st.isActive ? "#2563EB" : "#475569",
                                }}
                              >
                                {st.name} {st.isActive && "(In Progress)"}
                              </strong>
                              {st.time && (
                                <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>
                                  {new Date(st.time).toLocaleTimeString("en-IN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    day: "numeric",
                                    month: "short",
                                  })}
                                </span>
                              )}
                            </div>
                            <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#64748B" }}>
                              {st.entry?.description || st.desc}
                            </p>
                            {st.entry?.updatedBy && (
                              <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: 2 }}>
                                Updated by: {st.entry.updatedBy} ({st.entry.role || "Staff"})
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Failed Delivery Stage if applicable */}
                    {s === "failed delivery" || selectedOrderForTimeline.failedDeliveryAt ? (
                      <div style={{ marginTop: 12, padding: 12, background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8 }}>
                        <strong style={{ color: "#DC2626", fontSize: "13px" }}>⚠️ Delivery Failed</strong>
                        <p style={{ margin: "4px 0 0", color: "#991B1B", fontSize: "12px" }}>
                          Reason: {selectedOrderForTimeline.failedReason || "Customer unreachable or address issue"}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              {/* Order Products Snapshot */}
              <div style={{ marginTop: 20, borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
                <h4 style={{ fontSize: "14px", fontWeight: 800, color: "#1E293B", marginBottom: 10 }}>
                  Purchased Products Snapshot ({selectedOrderForTimeline.items?.length || 0} items)
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                  {(selectedOrderForTimeline.items || []).map((itm, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "#F8FAFC",
                        padding: "8px 12px",
                        borderRadius: 8,
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "13px", color: "#1E293B" }}>{itm.name}</strong>
                        <div style={{ fontSize: "11px", color: "#64748B" }}>
                          Qty: {itm.quantity} × ₹{Number(itm.price || 0).toFixed(2)}
                        </div>
                      </div>
                      <strong style={{ fontSize: "13px", color: "#0F172A" }}>
                        ₹{Number((itm.quantity || 1) * (itm.price || 0)).toFixed(2)}
                      </strong>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, padding: "8px 12px", background: "#EFF6FF", borderRadius: 8 }}>
                  <strong style={{ color: "#1E40AF" }}>Total Amount</strong>
                  <strong style={{ color: "#1E40AF", fontSize: "15px" }}>
                    ₹{Number(selectedOrderForTimeline.totalAmount || 0).toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="del-modal-footer" style={{ borderTop: "1px solid #E2E8F0", padding: "12px 20px" }}>
              <button
                type="button"
                className="del-btn-secondary"
                onClick={() => setTimelineModalOpen(false)}
              >
                Close Progress View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

