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
              <Search size={18} color="#64748B" />
              <input
                type="text"
                placeholder="Search by Order #, Customer Name, Mobile Number, or Delivery Address..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
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

          {/* Orders Grid / Cards */}
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
            <div className="del-orders-grid">
              {filteredOrders.map((ord) => {
                const s = ord.deliveryStatus || "New";
                const staffAssigned = ord.assignedStaff || ord.deliveryStaff;
                const custName = ord.customer?.name || ord.customerName || "Customer";
                const custPhone = ord.customer?.phone || ord.customerPhone || "";
                const deliveryAddress =
                  ord.deliveryAddress || ord.customer?.address || "Address not provided";

                return (
                  <div key={ord._id} className="del-order-card">
                    {/* Header */}
                    <div className="del-order-header">
                      <div>
                        <span className="del-order-num">{ord.orderNumber}</span>
                        <div className="del-order-date">
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
                      <span className={`del-badge-status status-${s.toLowerCase()}`}>
                        {s === "OutForDelivery" ? "Out for Delivery" : s === "OrderPickedUp" ? "Picked Up" : s}
                      </span>
                    </div>

                    {/* Customer & Address */}
                    <div className="del-order-body">
                      <div className="del-meta-row">
                        <strong className="del-cust-name">{custName}</strong>
                        {custPhone ? (
                          <span className="del-cust-phone">
                            <Phone size={12} />
                            <span>{custPhone}</span>
                          </span>
                        ) : null}
                      </div>

                      <div className="del-address-box">
                        <MapPin size={14} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span className="del-address-text">{deliveryAddress}</span>
                      </div>

                      {/* Items & Amount */}
                      <div className="del-items-summary">
                        <div className="del-items-list">
                          <Package size={13} color="#64748B" />
                          <span>{ord.items?.length || ord.totalItems || 1} items</span>
                          <span className="del-items-preview">
                            • {ord.items?.[0]?.name}
                            {ord.items?.length > 1 ? ` +${ord.items.length - 1} more` : ""}
                          </span>
                        </div>
                        <strong className="del-amount-val">
                          ₹{Number(ord.totalAmount || 0).toFixed(2)}
                        </strong>
                      </div>

                      {/* Assigned Delivery Personnel */}
                      <div className="del-assigned-box">
                        <span className="del-assigned-label">Assigned Staff:</span>
                        {staffAssigned ? (
                          <div className="del-assigned-chip">
                            <UserCheck size={14} color="#059669" />
                            <strong>{staffAssigned.name || "Assigned Driver"}</strong>
                            {staffAssigned.phone && <small>({staffAssigned.phone})</small>}
                          </div>
                        ) : (
                          <span className="del-unassigned-pill">Unassigned</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="del-order-actions">
                      <button
                        type="button"
                        className="del-assign-btn"
                        onClick={() => handleOpenAssignModal(ord)}
                      >
                        <UserCheck size={14} />
                        <span>{staffAssigned ? "Reassign Staff" : "Assign Staff"}</span>
                      </button>

                      {s === "New" || s === "Pending" ? (
                        <button
                          type="button"
                          className="del-advance-btn"
                          style={{ background: "#7C3AED", color: "#fff" }}
                          onClick={() => handleUpdateOrderStatus(ord._id, "Preparing")}
                        >
                          <Package size={14} />
                          <span>Mark Preparing</span>
                        </button>
                      ) : s === "Preparing" || s === "Assigned" || s === "Accepted" || s === "OrderPickedUp" ? (
                        <button
                          type="button"
                          className="del-advance-btn"
                          onClick={() => handleUpdateOrderStatus(ord._id, "OutForDelivery")}
                        >
                          <Navigation size={14} />
                          <span>Mark Out for Delivery</span>
                        </button>
                      ) : s === "OutForDelivery" ? (
                        <button
                          type="button"
                          className="del-delivered-btn"
                          onClick={() => handleUpdateOrderStatus(ord._id, "Delivered")}
                        >
                          <CheckCircle2 size={14} />
                          <span>Mark Delivered</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
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
            <div className="del-search-box" style={{ flex: 1, maxWidth: 450 }}>
              <Search size={16} color="#94A3B8" />
              <input
                type="text"
                placeholder="Search staff by Name, Mobile, Email, or Username..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
              />
              {staffSearch && (
                <button type="button" onClick={() => setStaffSearch("")} className="del-clear-btn">
                  ✕
                </button>
              )}
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
    </div>
  );
}

