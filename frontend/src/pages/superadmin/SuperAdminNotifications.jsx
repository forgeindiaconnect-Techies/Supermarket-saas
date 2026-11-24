import React, { useState, useEffect } from "react";
import {
  Bell,
  Lock,
  Search,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Building2,
  User,
  Mail,
  Clock,
  Calendar,
  ShieldCheck,
  AlertCircle,
  Filter,
  Check,
  Sparkles,
  ArrowRight,
  Shield,
  Eye,
  Store,
  ShoppingCart,
  CreditCard,
  Truck,
  Package,
  Phone,
  Tag,
} from "lucide-react";
import API, { SOCKET_URL } from "../../services/api";
import { io } from "socket.io-client";
import "./SuperAdmin.css";

export default function SuperAdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // "all" | "password" | "unread" | "registration"
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [socketConnected, setSocketConnected] = useState(false);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 4000);
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await API.get("/super-admin/notifications");
      if (res.data?.success && Array.isArray(res.data.notifications)) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.warn("Notifications fetch notice:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Real-time Socket.IO listener for instant updates without manual refresh
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      query: { role: "SUPER_ADMIN" },
      auth: {
        token: localStorage.getItem("grocerease_token") || "",
        role: "SUPER_ADMIN",
      },
    });

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("join-tenant", { role: "SUPER_ADMIN", supermarketCode: "ALL" });
    });

    socket.on("platform:notification", (data) => {
      if (data?.notification) {
        setNotifications((prev) => [data.notification, ...prev]);
        setUnreadCount((c) => c + 1);
        showToast(
          `🔔 New Alert: ${data.notification.title || "Password Change Activity"}`,
          "info"
        );
      } else {
        fetchNotifications();
      }
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    const interval = setInterval(fetchNotifications, 15000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, []);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await API.put(`/super-admin/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      showToast("Notification marked as read.", "success");
    } catch (err) {
      console.error("Mark read error:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await API.put("/super-admin/notifications/mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      showToast("All notifications marked as read.", "success");
    } catch (err) {
      console.error("Mark all read error:", err);
    }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await API.delete(`/super-admin/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      showToast("Notification removed.", "info");
    } catch (err) {
      console.error("Delete notification error:", err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear all platform notifications?")) return;
    try {
      await API.delete("/super-admin/notifications/clear-all");
      setNotifications([]);
      setUnreadCount(0);
      showToast("All notifications cleared.", "info");
    } catch (err) {
      console.error("Clear all error:", err);
    }
  };

  // Filtered and searched notifications (Strictly SaaS Platform Lifecycle Events)
  const filteredNotifications = notifications.filter((n) => {
    // Tab filter
    if (activeFilter === "store") {
      if (n.type !== "NEW_REGISTRATION" && n.type !== "SUPERMARKET_CREATED") return false;
    } else if (activeFilter === "status") {
      if (n.type !== "SUPERMARKET_DEACTIVATED" && n.type !== "SUPERMARKET_STATUS_CHANGED") return false;
    } else if (activeFilter === "subscription") {
      if (
        n.type !== "TRIAL_EXPIRING" &&
        n.type !== "TRIAL_EXPIRED" &&
        n.type !== "TRIAL_COMPLETED" &&
        n.type !== "SUBSCRIPTION_RENEWED"
      )
        return false;
    } else if (activeFilter === "password") {
      const isPass =
        n.type === "PASSWORD_CHANGED" ||
        n.type === "ADMIN_PASSWORD_UPDATED" ||
        (n.title && n.title.toLowerCase().includes("password"));
      if (!isPass) return false;
    } else if (activeFilter === "unread") {
      if (n.isRead) return false;
    }

    // Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const title = (n.title || "").toLowerCase();
    const storeName = (n.supermarketName || "").toLowerCase();
    const storeCode = (n.supermarketCode || "").toLowerCase();
    const adminName = (n.metadata?.adminName || "").toLowerCase();
    const adminUser = (n.metadata?.adminUsername || "").toLowerCase();
    const email = (n.metadata?.email || "").toLowerCase();
    const msg = (n.message || "").toLowerCase();
    const plan = (n.metadata?.plan || "").toLowerCase();

    return (
      title.includes(q) ||
      storeName.includes(q) ||
      storeCode.includes(q) ||
      adminName.includes(q) ||
      adminUser.includes(q) ||
      email.includes(q) ||
      msg.includes(q) ||
      plan.includes(q)
    );
  });

  const storesAddedCount = notifications.filter(
    (n) => n.type === "NEW_REGISTRATION" || n.type === "SUPERMARKET_CREATED"
  ).length;
  const statusUpdatesCount = notifications.filter(
    (n) => n.type === "SUPERMARKET_DEACTIVATED" || n.type === "SUPERMARKET_STATUS_CHANGED"
  ).length;
  const subscriptionUpdatesCount = notifications.filter(
    (n) =>
      n.type === "TRIAL_EXPIRING" ||
      n.type === "TRIAL_EXPIRED" ||
      n.type === "TRIAL_COMPLETED" ||
      n.type === "SUBSCRIPTION_RENEWED"
  ).length;
  const passwordUpdatesCount = notifications.filter(
    (n) =>
      n.type === "PASSWORD_CHANGED" ||
      n.type === "ADMIN_PASSWORD_UPDATED" ||
      (n.title && n.title.toLowerCase().includes("password"))
  ).length;

  return (
    <div
      style={{
        maxWidth: "1320px",
        margin: "0 auto",
        padding: "1.25rem 1.5rem 3rem 1.5rem",
        backgroundColor: "#c5e4d2",
        borderRadius: "20px",
        border: "1.5px solid #93d4af",
        boxShadow: "0 6px 24px rgba(16, 185, 129, 0.08)",
        minHeight: "calc(100vh - 110px)",
      }}
    >
      {/* Toast Notification */}
      {toast.show && (
        <div
          style={{
            position: "fixed",
            bottom: "28px",
            right: "28px",
            background:
              toast.type === "error"
                ? "#dc2626"
                : toast.type === "info"
                ? "#047857"
                : "#065f46",
            color: "#ffffff",
            padding: "14px 22px",
            borderRadius: "14px",
            boxShadow: "0 14px 35px rgba(6, 78, 59, 0.28)",
            zIndex: 99999,
            fontSize: "14px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {toast.type === "error" ? (
            <AlertCircle size={18} color="#ffffff" />
          ) : (
            <CheckCircle2 size={18} color="#4ade80" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. Page Header Card */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          background: "#ffffff",
          padding: "1.25rem 1.75rem",
          borderRadius: "16px",
          border: "1.5px solid #86efac",
          boxShadow: "0 4px 14px rgba(16, 185, 129, 0.08)",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "#dcfce7",
              color: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(22, 163, 74, 0.15)",
              border: "1px solid #86efac",
            }}
          >
            <Bell size={26} strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.45rem",
                  fontWeight: 800,
                  color: "#064e3b",
                  letterSpacing: "-0.02em",
                }}
              >
                Platform Notifications &amp; Security Alerts
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: socketConnected ? "#dcfce7" : "#fef3c7",
                  color: socketConnected ? "#15803d" : "#b45309",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "0.74rem",
                  fontWeight: 750,
                  border: `1px solid ${socketConnected ? "#86efac" : "#fde68a"}`,
                }}
              >
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: socketConnected ? "#22c55e" : "#f59e0b",
                    boxShadow: socketConnected ? "0 0 8px #22c55e" : "none",
                  }}
                />
                {socketConnected ? "Real-Time Active" : "Polling"}
              </span>
            </div>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.86rem", color: "#64748b" }}>
              Dynamic tenant password updates, credential change tracking and platform event logs
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#dcfce7",
                color: "#15803d",
                border: "1.5px solid #86efac",
                padding: "8px 14px",
                borderRadius: "10px",
                fontSize: "0.84rem",
                fontWeight: 750,
                cursor: "pointer",
              }}
            >
              <Check size={14} strokeWidth={2.4} />
              <span>Mark All Read ({unreadCount})</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#fee2e2",
                color: "#b91c1c",
                border: "1.5px solid #fecaca",
                padding: "8px 14px",
                borderRadius: "10px",
                fontSize: "0.84rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Trash2 size={14} />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            padding: "16px 20px",
            borderRadius: "14px",
            border: "1.5px solid #a7f3d0",
            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.05)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "#dcfce7",
              color: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #86efac",
            }}
          >
            <Bell size={20} />
          </div>
          <div>
            <span style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 700 }}>
              TOTAL PLATFORM ALERTS
            </span>
            <div style={{ fontSize: "1.45rem", fontWeight: 850, color: "#064e3b" }}>
              {notifications.length}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "16px 20px",
            borderRadius: "14px",
            border: "1.5px solid #a7f3d0",
            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.05)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "#dcfce7",
              color: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #86efac",
            }}
          >
            <Building2 size={20} />
          </div>
          <div>
            <span style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 700 }}>
              STORES CREATED
            </span>
            <div style={{ fontSize: "1.45rem", fontWeight: 850, color: "#16a34a" }}>
              {storesAddedCount}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "16px 20px",
            borderRadius: "14px",
            border: "1.5px solid #fed7aa",
            boxShadow: "0 2px 8px rgba(234, 88, 12, 0.05)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "#fff7ed",
              color: "#ea580c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #fed7aa",
            }}
          >
            <AlertCircle size={20} />
          </div>
          <div>
            <span style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 700 }}>
              STATUS &amp; DEACTIVATIONS
            </span>
            <div style={{ fontSize: "1.45rem", fontWeight: 850, color: "#c2410c" }}>
              {statusUpdatesCount}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "16px 20px",
            borderRadius: "14px",
            border: "1.5px solid #bfdbfe",
            boxShadow: "0 2px 8px rgba(37, 99, 235, 0.05)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "#eff6ff",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #bfdbfe",
            }}
          >
            <Lock size={20} />
          </div>
          <div>
            <span style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 700 }}>
              PASSWORD CHANGES
            </span>
            <div style={{ fontSize: "1.45rem", fontWeight: 850, color: "#1e40af" }}>
              {passwordUpdatesCount}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "16px 20px",
            borderRadius: "14px",
            border: unreadCount > 0 ? "1.5px solid #fca5a5" : "1.5px solid #a7f3d0",
            boxShadow: "0 2px 8px rgba(220, 38, 38, 0.05)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: unreadCount > 0 ? "#fee2e2" : "#dcfce7",
              color: unreadCount > 0 ? "#dc2626" : "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: unreadCount > 0 ? "1px solid #fecaca" : "1px solid #86efac",
            }}
          >
            <Bell size={20} />
          </div>
          <div>
            <span style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 700 }}>
              UNREAD ALERTS
            </span>
            <div
              style={{
                fontSize: "1.45rem",
                fontWeight: 850,
                color: unreadCount > 0 ? "#dc2626" : "#064e3b",
              }}
            >
              {unreadCount}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search and Filter Bar */}
      <div
        style={{
          background: "#ffffff",
          padding: "1rem 1.25rem",
          borderRadius: "16px",
          border: "1.5px solid #86efac",
          boxShadow: "0 4px 14px rgba(16, 185, 129, 0.06)",
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        {/* Search Input */}
        <div style={{ position: "relative", flex: "1 1 320px", maxWidth: "460px" }}>
          <Search
            size={16}
            color="#059669"
            style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by store name, ID (e.g. SM-7087), admin name, email, plan..."
            style={{
              width: "100%",
              padding: "10px 14px 10px 42px",
              borderRadius: "10px",
              border: "1.5px solid #a7f3d0",
              fontSize: "0.88rem",
              fontWeight: 600,
              color: "#064e3b",
              outline: "none",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Tabs strictly for SaaS Platform Management */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: activeFilter === "all" ? "#047857" : "#f1f5f9",
              color: activeFilter === "all" ? "#ffffff" : "#475569",
              border: "none",
              padding: "8px 14px",
              borderRadius: "10px",
              fontSize: "0.82rem",
              fontWeight: 750,
              cursor: "pointer",
            }}
          >
            <span>All</span>
            <span
              style={{
                background: activeFilter === "all" ? "rgba(255,255,255,0.25)" : "#cbd5e1",
                padding: "1px 6px",
                borderRadius: "10px",
                fontSize: "0.74rem",
              }}
            >
              {notifications.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("store")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: activeFilter === "store" ? "#059669" : "#ecfdf5",
              color: activeFilter === "store" ? "#ffffff" : "#047857",
              border: "1px solid #a7f3d0",
              padding: "8px 14px",
              borderRadius: "10px",
              fontSize: "0.82rem",
              fontWeight: 750,
              cursor: "pointer",
            }}
          >
            <Building2 size={13} />
            <span>🏪 Stores Added</span>
            <span
              style={{
                background: activeFilter === "store" ? "rgba(255,255,255,0.25)" : "#a7f3d0",
                padding: "1px 6px",
                borderRadius: "10px",
                fontSize: "0.74rem",
              }}
            >
              {storesAddedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("status")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: activeFilter === "status" ? "#ea580c" : "#fff7ed",
              color: activeFilter === "status" ? "#ffffff" : "#c2410c",
              border: "1px solid #fed7aa",
              padding: "8px 14px",
              borderRadius: "10px",
              fontSize: "0.82rem",
              fontWeight: 750,
              cursor: "pointer",
            }}
          >
            <AlertCircle size={13} />
            <span>🛑 Deactivations &amp; Status</span>
            <span
              style={{
                background: activeFilter === "status" ? "rgba(255,255,255,0.25)" : "#fed7aa",
                padding: "1px 6px",
                borderRadius: "10px",
                fontSize: "0.74rem",
              }}
            >
              {statusUpdatesCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("subscription")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: activeFilter === "subscription" ? "#d97706" : "#fef3c7",
              color: activeFilter === "subscription" ? "#ffffff" : "#b45309",
              border: "1px solid #fde68a",
              padding: "8px 14px",
              borderRadius: "10px",
              fontSize: "0.82rem",
              fontWeight: 750,
              cursor: "pointer",
            }}
          >
            <Calendar size={13} />
            <span>⏳ Trials &amp; Subscriptions</span>
            <span
              style={{
                background: activeFilter === "subscription" ? "rgba(255,255,255,0.25)" : "#fde68a",
                padding: "1px 6px",
                borderRadius: "10px",
                fontSize: "0.74rem",
              }}
            >
              {subscriptionUpdatesCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("password")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: activeFilter === "password" ? "#1e40af" : "#eff6ff",
              color: activeFilter === "password" ? "#ffffff" : "#1e40af",
              border: "1px solid #bfdbfe",
              padding: "8px 14px",
              borderRadius: "10px",
              fontSize: "0.82rem",
              fontWeight: 750,
              cursor: "pointer",
            }}
          >
            <Lock size={13} />
            <span>🔑 Password Changes</span>
            <span
              style={{
                background: activeFilter === "password" ? "rgba(255,255,255,0.25)" : "#bfdbfe",
                padding: "1px 6px",
                borderRadius: "10px",
                fontSize: "0.74rem",
              }}
            >
              {passwordUpdatesCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("unread")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: activeFilter === "unread" ? "#dc2626" : "#fee2e2",
              color: activeFilter === "unread" ? "#ffffff" : "#b91c1c",
              border: "1px solid #fecaca",
              padding: "8px 14px",
              borderRadius: "10px",
              fontSize: "0.82rem",
              fontWeight: 750,
              cursor: "pointer",
            }}
          >
            <span>Unread</span>
            <span
              style={{
                background: activeFilter === "unread" ? "rgba(255,255,255,0.25)" : "#fecaca",
                padding: "1px 6px",
                borderRadius: "10px",
                fontSize: "0.74rem",
              }}
            >
              {unreadCount}
            </span>
          </button>
        </div>
      </div>

      {/* 4. Notifications Feed List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {loading && notifications.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              padding: "3rem",
              borderRadius: "16px",
              textAlign: "center",
              border: "1.5px solid #a7f3d0",
              color: "#064e3b",
            }}
          >
            <RefreshCw size={28} className="spin" style={{ margin: "0 auto 10px auto" }} />
            <p style={{ margin: 0, fontWeight: 700 }}>Loading platform notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              padding: "3.5rem 2rem",
              borderRadius: "16px",
              textAlign: "center",
              border: "1.5px solid #a7f3d0",
              color: "#64748b",
            }}
          >
            <Bell size={40} color="#a7f3d0" style={{ margin: "0 auto 12px auto" }} />
            <h3 style={{ margin: "0 0 6px 0", color: "#064e3b", fontWeight: 800 }}>
              No Notifications Found
            </h3>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>
              {searchQuery
                ? `No notifications matching "${searchQuery}". Try a different keyword.`
                : "No notifications recorded in this category yet."}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const isCreation = notif.type === "NEW_REGISTRATION" || notif.type === "SUPERMARKET_CREATED";
            const isDeactivation = notif.type === "SUPERMARKET_DEACTIVATED";
            const isStatus = notif.type === "SUPERMARKET_STATUS_CHANGED";
            const isSubscription =
              notif.type === "TRIAL_EXPIRING" ||
              notif.type === "TRIAL_EXPIRED" ||
              notif.type === "TRIAL_COMPLETED" ||
              notif.type === "SUBSCRIPTION_RENEWED" ||
              notif.type === "EMAIL_SENT";
            const isPassword =
              notif.type === "PASSWORD_CHANGED" ||
              notif.type === "ADMIN_PASSWORD_UPDATED" ||
              (notif.title && notif.title.toLowerCase().includes("password"));

            const storeCode =
              notif.supermarketCode ||
              notif.metadata?.supermarketId ||
              notif.supermarket?.code ||
              "N/A";
            const storeName =
              notif.supermarketName ||
              notif.metadata?.supermarketName ||
              notif.supermarket?.name ||
              "Supermarket";

            const adminName = notif.metadata?.adminName || notif.supermarket?.adminName || "Store Admin";
            const adminUser = notif.metadata?.adminUsername || notif.supermarket?.adminUsername || "";
            const email = notif.metadata?.email || notif.supermarket?.email || "N/A";
            const plan = notif.metadata?.plan || notif.supermarket?.plan || "Standard";

            const dateStr =
              notif.metadata?.date ||
              new Date(notif.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
            const timeStr =
              notif.metadata?.time ||
              new Date(notif.createdAt).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              });

            // Card accent border & theme
            let cardBorder = notif.isRead ? "1.5px solid #e2e8f0" : "2px solid #10b981";
            let iconBg = "#dcfce7";
            let iconColor = "#16a34a";
            let iconBorder = "1.5px solid #86efac";

            if (isDeactivation) {
              cardBorder = notif.isRead ? "1.5px solid #e2e8f0" : "2px solid #ef4444";
              iconBg = "#fee2e2";
              iconColor = "#dc2626";
              iconBorder = "1.5px solid #fca5a5";
            } else if (isStatus) {
              cardBorder = notif.isRead ? "1.5px solid #e2e8f0" : "2px solid #f97316";
              iconBg = "#fff7ed";
              iconColor = "#ea580c";
              iconBorder = "1.5px solid #fed7aa";
            } else if (isSubscription) {
              cardBorder = notif.isRead ? "1.5px solid #e2e8f0" : "2px solid #f59e0b";
              iconBg = "#fef3c7";
              iconColor = "#d97706";
              iconBorder = "1.5px solid #fde68a";
            } else if (isPassword) {
              cardBorder = notif.isRead ? "1.5px solid #e2e8f0" : "2px solid #3b82f6";
              iconBg = "#eff6ff";
              iconColor = "#2563eb";
              iconBorder = "1.5px solid #bfdbfe";
            }

            return (
              <div
                key={notif._id}
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: cardBorder,
                  padding: "1.25rem 1.5rem",
                  boxShadow: !notif.isRead
                    ? isDeactivation
                      ? "0 6px 20px rgba(239, 68, 68, 0.12)"
                      : isStatus
                      ? "0 6px 20px rgba(249, 115, 22, 0.12)"
                      : isSubscription
                      ? "0 6px 20px rgba(245, 158, 11, 0.12)"
                      : isPassword
                      ? "0 6px 20px rgba(59, 130, 246, 0.12)"
                      : "0 6px 20px rgba(16, 185, 129, 0.12)"
                    : "0 2px 8px rgba(0,0,0,0.03)",
                  position: "relative",
                  transition: "all 0.2s ease",
                }}
              >
                {/* Header Row: Title & Badges */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "10px",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "12px",
                        background: iconBg,
                        color: iconColor,
                        border: iconBorder,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isDeactivation ? (
                        <AlertCircle size={20} strokeWidth={2.4} />
                      ) : isStatus ? (
                        <RefreshCw size={20} strokeWidth={2.4} />
                      ) : isSubscription ? (
                        <Calendar size={20} strokeWidth={2.4} />
                      ) : isPassword ? (
                        <Lock size={20} strokeWidth={2.4} />
                      ) : (
                        <Building2 size={20} strokeWidth={2.4} />
                      )}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "1.05rem",
                            fontWeight: 800,
                            color: "#0f172a",
                          }}
                        >
                          {notif.title || (isDeactivation ? "Store Deactivated" : isCreation ? "New Store Registered" : `${storeName} – Platform Alert`)}
                        </h3>

                        {notif.badge && (
                          <span
                            style={{
                              background: isDeactivation || notif.type === "TRIAL_EXPIRED"
                                ? "#fee2e2"
                                : isStatus || notif.type === "TRIAL_EXPIRING"
                                ? "#fef3c7"
                                : isPassword
                                ? "#eff6ff"
                                : "#dcfce7",
                              color: isDeactivation || notif.type === "TRIAL_EXPIRED"
                                ? "#b91c1c"
                                : isStatus || notif.type === "TRIAL_EXPIRING"
                                ? "#b45309"
                                : isPassword
                                ? "#1e40af"
                                : "#15803d",
                              border: isDeactivation || notif.type === "TRIAL_EXPIRED"
                                ? "1px solid #fca5a5"
                                : isStatus || notif.type === "TRIAL_EXPIRING"
                                ? "1px solid #fde68a"
                                : isPassword
                                ? "1px solid #bfdbfe"
                                : "1px solid #86efac",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "0.72rem",
                              fontWeight: 850,
                              letterSpacing: "0.04em",
                            }}
                          >
                            {notif.badge}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginTop: "4px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            background: "#eff6ff",
                            color: "#1e40af",
                            border: "1px solid #bfdbfe",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "0.74rem",
                            fontWeight: 800,
                          }}
                        >
                          <Building2 size={12} />
                          <span>ID: {storeCode}</span>
                        </span>

                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            background: "#f1f5f9",
                            color: "#475569",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                          }}
                        >
                          <Store size={12} />
                          <span>{storeName}</span>
                        </span>

                        {plan && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              background: "#f0fdf4",
                              color: "#15803d",
                              border: "1px solid #bbf7d0",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "0.74rem",
                              fontWeight: 750,
                            }}
                          >
                            <Sparkles size={12} />
                            <span>{plan} Plan</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badges & Timestamp */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {!notif.isRead ? (
                      <span
                        style={{
                          background: "#fee2e2",
                          color: "#b91c1c",
                          border: "1px solid #fca5a5",
                          padding: "3px 10px",
                          borderRadius: "20px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          letterSpacing: "0.04em",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: "#dc2626",
                          }}
                        />
                        NEW
                      </span>
                    ) : (
                      <span
                        style={{
                          background: "#f1f5f9",
                          color: "#64748b",
                          padding: "3px 10px",
                          borderRadius: "20px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                        }}
                      >
                        READ
                      </span>
                    )}

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.78rem",
                        color: "#64748b",
                        fontWeight: 600,
                        background: "#f8fafc",
                        padding: "4px 10px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <Clock size={13} color="#94a3b8" />
                      <span>{dateStr}, {timeStr}</span>
                    </div>
                  </div>
                </div>

                {/* Primary Activity Message Display */}
                <div
                  style={{
                    background: isDeactivation || notif.type === "TRIAL_EXPIRED"
                      ? "#fff5f5"
                      : isStatus || notif.type === "TRIAL_EXPIRING"
                      ? "#fffbeb"
                      : isPassword
                      ? "#f8faff"
                      : "#f0fdf4",
                    border: isDeactivation || notif.type === "TRIAL_EXPIRED"
                      ? "1px solid #fed7d7"
                      : isStatus || notif.type === "TRIAL_EXPIRING"
                      ? "1px solid #fef3c7"
                      : isPassword
                      ? "1px solid #dbeafe"
                      : "1px solid #bbf7d0",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    marginBottom: "1rem",
                    fontSize: "0.92rem",
                    fontWeight: 750,
                    color: isDeactivation || notif.type === "TRIAL_EXPIRED"
                      ? "#991b1b"
                      : isStatus || notif.type === "TRIAL_EXPIRING"
                      ? "#92400e"
                      : isPassword
                      ? "#1e40af"
                      : "#166534",
                  }}
                >
                  {notif.message}
                </div>

                {/* Information Grid: 100% dynamic SaaS platform details */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                    gap: "0.75rem",
                    padding: "12px 16px",
                    background: "#f8fafc",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    marginBottom: "1rem",
                  }}
                >
                  {isCreation ? (
                    <>
                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Store Name &amp; Code
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 750, color: "#0f172a", marginTop: "2px" }}>
                          {storeName} ({storeCode})
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Subscription Plan
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 750, color: "#16a34a", marginTop: "2px" }}>
                          {plan} Plan
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Store Admin Email
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a", marginTop: "2px", wordBreak: "break-all" }}>
                          {email}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Registration Status
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 750, color: "#15803d", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <CheckCircle2 size={14} color="#16a34a" />
                          <span>Tenant Active</span>
                        </div>
                      </div>
                    </>
                  ) : isDeactivation || isStatus ? (
                    <>
                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Supermarket
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 750, color: "#0f172a", marginTop: "2px" }}>
                          {storeName} ({storeCode})
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          New Status
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 800, color: isDeactivation ? "#dc2626" : "#ea580c", marginTop: "2px" }}>
                          {notif.metadata?.newStatus || (isDeactivation ? "Suspended" : "Updated")}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Previous Status
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#64748b", marginTop: "2px" }}>
                          {notif.metadata?.previousStatus || "Active"}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Action Type
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 750, color: isDeactivation ? "#b91c1c" : "#c2410c", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <AlertCircle size={14} />
                          <span>{isDeactivation ? "Store Deactivated" : "Status Changed"}</span>
                        </div>
                      </div>
                    </>
                  ) : isSubscription ? (
                    <>
                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Supermarket
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 750, color: "#0f172a", marginTop: "2px" }}>
                          {storeName} ({storeCode})
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Subscription Plan
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 750, color: "#0f172a", marginTop: "2px" }}>
                          {plan}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Expiry / Renewal Date
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 750, color: notif.type === "TRIAL_EXPIRED" ? "#dc2626" : "#d97706", marginTop: "2px" }}>
                          {notif.metadata?.expiryDate || notif.metadata?.newExpiryDate ? new Date(notif.metadata.expiryDate || notif.metadata.newExpiryDate).toLocaleDateString("en-IN") : "Recorded"}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Subscription Status
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 750, color: notif.type === "TRIAL_EXPIRED" ? "#dc2626" : "#16a34a", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Calendar size={14} />
                          <span>{notif.badge || "Subscription Alert"}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Admin Name
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 750, color: "#0f172a", marginTop: "2px" }}>
                          {adminName} {adminUser && <span style={{ color: "#64748b", fontWeight: 600 }}>({`@${adminUser}`})</span>}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Supermarket ID
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 750, color: "#1e40af", marginTop: "2px" }}>
                          {storeCode}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Registered Email
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a", marginTop: "2px", wordBreak: "break-all" }}>
                          {email}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Security Status
                        </span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 750, color: "#15803d", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <ShieldCheck size={14} color="#16a34a" />
                          <span>Hashed &amp; Verified</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>
                      Supermarket: <strong>{storeName}</strong> ({storeCode})
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {!notif.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(notif._id, e)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background: "#dcfce7",
                          color: "#15803d",
                          border: "1px solid #86efac",
                          padding: "5px 12px",
                          borderRadius: "8px",
                          fontSize: "0.76rem",
                          fontWeight: 750,
                          cursor: "pointer",
                        }}
                      >
                        <Check size={13} />
                        <span>Mark Read</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleDelete(notif._id, e)}
                      title="Delete notification"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        background: "#f1f5f9",
                        color: "#64748b",
                        border: "1px solid #cbd5e1",
                        padding: "5px 10px",
                        borderRadius: "8px",
                        fontSize: "0.76rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
