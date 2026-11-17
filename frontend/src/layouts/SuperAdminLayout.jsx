import React, { useState, useRef, useEffect } from "react";
import { Outlet, NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  PackageSearch,
  Boxes,
  ShoppingCart,
  Users,
  ShieldCheck,
  BarChart2,
  CreditCard,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Store,
  Menu,
  X,
  Sparkles,
  Bell,
  HelpCircle,
  PlusCircle,
  FileText,
  TrendingUp,
  Headphones,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { io } from "socket.io-client";
import API, { SOCKET_URL } from "../services/api";
import "./SuperAdminLayout.css";

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const mainWrapperRef = useRef(null);
  const pageContentRef = useRef(null);
  const { user, logout, supermarkets, currentSupermarket, switchSupermarket } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Collapsible Menu Groups State (all open by default for rich display)
  const [openGroups, setOpenGroups] = useState({
    supermarkets: true,
    plans: true,
    registered: true,
    analytics: true,
    settings: false,
  });

  const [unreadNotifCount, setUnreadNotifCount] = useState(8);
  const [notifications, setNotifications] = useState([]);
  const [connectedStoreCount, setConnectedStoreCount] = useState(4);

  // Fetch registered supermarkets count for sidebar status card
  useEffect(() => {
    API.get("/super-admin/supermarkets")
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.supermarkets)) {
          setConnectedStoreCount(res.data.supermarkets.length);
        }
      })
      .catch(() => {});
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Using exact user-provided header banner with full clearance
  const exactBannerUrl = "/exact-header-banner.jpg";
  const [cleanBannerUrl, setCleanBannerUrl] = useState(null);

  // Seamlessly clean any green artifacts or stray borders without affecting natural sky/clouds
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = exactBannerUrl;
    img.onload = () => {
      try {
        const W = img.naturalWidth || 1023;
        const H = img.naturalHeight || 92;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, W, H);
        const data = imgData.data;

        // 1. Inpaint only the tiny green chevron in the sky at top-left (x: 20..55, y: 6..28)
        // Samples clean adjacent sky from (x + 35, y) at the exact same altitude/lighting
        for (let y = 6; y < Math.min(H, 28); y++) {
          for (let x = 20; x < Math.min(W, 55); x++) {
            const idx = (y * W + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // Stray green chevron / mark check: greenish hue where g > r + 15 and b < 242
            if (g > r + 15 && b < 242 && g > 130) {
              const cleanIdx = (y * W + Math.min(W - 1, x + 35)) * 4;
              data[idx] = data[cleanIdx];
              data[idx + 1] = data[cleanIdx + 1];
              data[idx + 2] = data[cleanIdx + 2];
              data[idx + 3] = 255;
            }
          }
        }

        // 2. Clean any 1px white border line along the very top edge if present (y < 2)
        for (let y = 0; y < Math.min(H, 2); y++) {
          for (let x = 0; x < W; x++) {
            const idx = (y * W + x) * 4;
            const refIdx = (Math.min(H - 1, 3) * W + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            if (r > 220 && g > 220 && b > 220) {
              data[idx] = data[refIdx];
              data[idx + 1] = data[refIdx + 1];
              data[idx + 2] = data[refIdx + 2];
              data[idx + 3] = 255;
            }
          }
        }

        // 3. Clean and inpaint the natural sky over the old blurry baked-in pill and bell (x: 805..W, y: 0..76)
        // Samples clean sky from column x: 788 at the exact same altitude/lighting
        for (let y = 0; y < Math.min(H, 76); y++) {
          const refX = Math.min(W - 1, 788);
          const refIdx = (y * W + refX) * 4;
          const r = data[refIdx];
          const g = data[refIdx + 1];
          const b = data[refIdx + 2];
          const a = data[refIdx + 3];

          for (let x = 805; x < W; x++) {
            const idx = (y * W + x) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
          }
        }

        ctx.putImageData(imgData, 0, 0);
        setCleanBannerUrl(canvas.toDataURL("image/jpeg", 0.98));
      } catch (e) {
        console.warn("Banner cleaning notice:", e);
      }
    };
  }, []);

  useEffect(() => {
    const fetchCentralNotifs = async () => {
      try {
        const res = await API.get("/super-admin/notifications");
        if (res.data?.success && Array.isArray(res.data.notifications)) {
          setUnreadNotifCount(res.data.unreadCount || 0);
          setNotifications(res.data.notifications);
        }
      } catch (err) {
        console.warn("Platform notifications fetch notice:", err.message);
      }
    };

    fetchCentralNotifs();

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      query: { role: "SUPER_ADMIN" },
      auth: {
        token: localStorage.getItem("grocerease_token") || "",
        role: "SUPER_ADMIN",
      },
    });

    socket.on("connect", () => {
      socket.emit("join-tenant", { role: "SUPER_ADMIN", supermarketCode: "ALL" });
    });

    socket.on("platform:notification", () => {
      fetchCentralNotifs();
    });

    socket.on("supermarket:registered", () => {
      fetchCentralNotifs();
    });

    const timer = setInterval(fetchCentralNotifs, 15000);
    return () => {
      socket.disconnect();
      clearInterval(timer);
    };
  }, []);

  const handleMarkNotifRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await API.put(`/super-admin/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadNotifCount((prev) => Math.max(0, prev - 1));
    } catch (_) {}
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      await API.put("/super-admin/notifications/mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotifCount(0);
    } catch (_) {}
  };

  const handleClearAllNotifs = async () => {
    try {
      await API.delete("/super-admin/notifications/clear-all");
      setNotifications([]);
      setUnreadNotifCount(0);
    } catch (_) {}
  };

  const toggleGroup = (groupKey) => {
    setOpenGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // Smooth scroll to top on path change
  useEffect(() => {
    if (pageContentRef.current) {
      pageContentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (mainWrapperRef.current) {
      mainWrapperRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  const handleNavClick = () => {
    setSidebarOpen(false);
  };

  const isCurrent = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="super-admin-container">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="sa-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Deep Forest Green Super Admin Sidebar */}
      <aside className={`sa-sidebar ${sidebarOpen ? "open" : ""}`}>
        {/* Brand Header */}
        <div className="sa-sidebar-header">
          <Link to="/super-admin" className="sa-brand-link" onClick={handleNavClick}>
            <div className="sa-brand-logo-wrap">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 3H5L6.68 14.39C6.77 15.03 7.32 15.5 7.96 15.5H18.04C18.68 15.5 19.23 15.03 19.32 14.39L20.5 6.5H6"
                  stroke="#22c55e"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9" cy="19.5" r="1.5" fill="#22c55e" />
                <circle cx="17" cy="19.5" r="1.5" fill="#22c55e" />
                <path
                  d="M16 2.5C14 2 12.5 3.5 12 5.5C14 6 16.5 4.5 16 2.5Z"
                  fill="#4ade80"
                />
              </svg>
            </div>
            <div className="sa-brand-text">
              <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
                <span className="sa-brand-name">GrocerEase</span>
              </div>
              <span className="sa-brand-tagline">Smart Supermarket Solutions</span>
            </div>
          </Link>
          <button
            type="button"
            className="sa-mobile-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="sa-sidebar-nav">
          {/* Main Dashboard item */}
          <NavLink
            to="/super-admin"
            end
            onClick={handleNavClick}
            className={({ isActive }) => `sa-nav-pill-main ${isActive ? "active" : ""}`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          {/* Group 1: Supermarket Management */}
          <div className="sa-nav-group">
            <button
              type="button"
              className="sa-group-header"
              onClick={() => toggleGroup("supermarkets")}
            >
              <div className="sa-group-header-left">
                <Store size={16} />
                <span>Supermarket Management</span>
              </div>
              <ChevronDown
                size={14}
                className={`sa-chevron ${openGroups.supermarkets ? "open" : ""}`}
              />
            </button>
            {openGroups.supermarkets && (
              <div className="sa-group-subitems">
                <NavLink
                  to="/super-admin/add-supermarket"
                  onClick={handleNavClick}
                  className={({ isActive }) => `sa-subitem ${isActive ? "active-sub" : ""}`}
                >
                  <span className="sa-dot">&rsaquo;</span>
                  <span>Add Supermarket</span>
                </NavLink>
                <NavLink
                  to="/super-admin/supermarkets"
                  onClick={handleNavClick}
                  className={({ isActive }) => `sa-subitem ${isActive ? "active-sub" : ""}`}
                >
                  <span className="sa-dot">&rsaquo;</span>
                  <span>Manage Supermarkets</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* Group 2: Subscription Plans */}
          <div className="sa-nav-group">
            <button
              type="button"
              className="sa-group-header"
              onClick={() => toggleGroup("plans")}
            >
              <div className="sa-group-header-left">
                <CreditCard size={16} />
                <span>Subscription Plans</span>
              </div>
              <ChevronDown
                size={14}
                className={`sa-chevron ${openGroups.plans ? "open" : ""}`}
              />
            </button>
            {openGroups.plans && (
              <div className="sa-group-subitems">
                <NavLink
                  to="/super-admin/create-plan"
                  onClick={handleNavClick}
                  className={({ isActive }) => `sa-subitem ${isActive || location.pathname === "/super-admin/create-plan" ? "active-sub" : ""}`}
                >
                  <span className="sa-dot">&rsaquo;</span>
                  <span>Create Plan</span>
                </NavLink>
                <NavLink
                  to="/super-admin/manage-plans"
                  onClick={handleNavClick}
                  className={({ isActive }) => `sa-subitem ${isActive || location.pathname === "/super-admin/manage-plans" || location.pathname === "/super-admin/plans" ? "active-sub" : ""}`}
                >
                  <span className="sa-dot">&rsaquo;</span>
                  <span>Manage Plans</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* Group 3: Registered Supermarkets */}
          <div className="sa-nav-group">
            <button
              type="button"
              className="sa-group-header"
              onClick={() => toggleGroup("registered")}
            >
              <div className="sa-group-header-left">
                <Users size={16} />
                <span>Registered Supermarkets</span>
              </div>
              <ChevronDown
                size={14}
                className={`sa-chevron ${openGroups.registered ? "open" : ""}`}
              />
            </button>
            {openGroups.registered && (
              <div className="sa-group-subitems">
                <NavLink
                  to="/super-admin/registered-supermarkets"
                  onClick={handleNavClick}
                  className={({ isActive }) => `sa-subitem ${isActive ? "active-sub" : ""}`}
                >
                  <span className="sa-dot">&rsaquo;</span>
                  <span>View All Stores</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* Group 4: Analytics & Reports */}
          <div className="sa-nav-group">
            <button
              type="button"
              className="sa-group-header"
              onClick={() => toggleGroup("analytics")}
            >
              <div className="sa-group-header-left">
                <BarChart2 size={16} />
                <span>Analytics & Reports</span>
              </div>
              <ChevronDown
                size={14}
                className={`sa-chevron ${openGroups.analytics ? "open" : ""}`}
              />
            </button>
            {openGroups.analytics && (
              <div className="sa-group-subitems">
                <NavLink
                  to="/super-admin/reports"
                  onClick={handleNavClick}
                  className={({ isActive }) => `sa-subitem ${isActive ? "active-sub" : ""}`}
                >
                  <span className="sa-dot">&rsaquo;</span>
                  <span>Platform Reports</span>
                </NavLink>
                <NavLink
                  to="/super-admin/product-sales"
                  onClick={handleNavClick}
                  className={({ isActive }) => `sa-subitem ${isActive ? "active-sub" : ""}`}
                >
                  <span className="sa-dot">&rsaquo;</span>
                  <span>Sales Overview</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* Group 5: Supermarket Chat Line */}
          <NavLink
            to="/super-admin/chat"
            onClick={handleNavClick}
            className={({ isActive }) => `sa-nav-pill-main ${isActive ? "active" : ""}`}
            style={{ margin: "4px 0" }}
          >
            <MessageSquare size={17} />
            <span>Supermarket Chat</span>
          </NavLink>

          {/* Group 5B: Platform Notifications & Alerts */}
          <NavLink
            to="/super-admin/notifications"
            onClick={handleNavClick}
            className={({ isActive }) => `sa-nav-pill-main ${isActive ? "active" : ""}`}
            style={{ margin: "4px 0", display: "flex", alignItems: "center" }}
          >
            <Bell size={17} />
            <span>Notifications</span>
            {unreadNotifCount > 0 && (
              <span
                style={{
                  marginLeft: "auto",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: 800,
                  padding: "1px 7px",
                  borderRadius: "10px",
                  boxShadow: "0 0 6px rgba(220, 38, 38, 0.5)",
                }}
              >
                {unreadNotifCount}
              </span>
            )}
          </NavLink>

          {/* Group 6: Settings - Profile Only */}
          <div className="sa-nav-group">
            <button
              type="button"
              className="sa-group-header"
              onClick={() => toggleGroup("settings")}
            >
              <div className="sa-group-header-left">
                <Settings size={16} />
                <span>Settings</span>
              </div>
              <ChevronDown
                size={14}
                className={`sa-chevron ${openGroups.settings ? "open" : ""}`}
              />
            </button>
            {openGroups.settings && (
              <div className="sa-group-subitems">
                <NavLink
                  to="/super-admin/settings"
                  onClick={handleNavClick}
                  className={({ isActive }) => `sa-subitem ${isActive ? "active-sub" : ""}`}
                >
                  <span className="sa-dot">&rsaquo;</span>
                  <span>My Profile</span>
                </NavLink>
              </div>
            )}
          </div>
        </nav>

        {/* Sidebar Footer Logout Button */}
        <div className="sa-sidebar-bottom-promo">
          {/* Single Dedicated Logout Button - Bright Solid Red & Ultra-Bright White Text */}
          <button
            type="button"
            className="sa-sidebar-bottom-logout-btn"
            onClick={logout}
            aria-label="Logout"
          >
            <LogOut size={16} color="#ffffff" strokeWidth={2.4} />
            <span style={{ color: "#ffffff", fontWeight: 800 }}>Logout</span>
          </button>

          <span className="sa-copyright-text">
            &copy; 2025 GrocerEase. All rights reserved.
          </span>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="sa-main-wrapper" ref={mainWrapperRef}>
        {/* Top Fixed Header Bar with user exact provided banner */}
        <header className="sa-top-header">
          <div className="sa-exact-header-banner-box">
            {/* Inner clipping wrapper to ensure 100% edge-to-edge seamless banner */}
            <div className="sa-banner-img-clip">
              <img
                src={cleanBannerUrl || exactBannerUrl}
                alt="GrocerEase Super Admin Storefront Banner"
                className="sa-exact-header-banner-img"
                onError={(e) => {
                  e.currentTarget.src = "/exact-header-banner.jpg";
                }}
              />
            </div>

            {/* Mobile Menu Hamburger (Visible on small screens) */}
            <button
              type="button"
              className="sa-banner-mobile-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Toggle Navigation Menu"
            >
              <Menu size={18} />
            </button>

            {/* Header Right Action Controls: High-Resolution, Ultra-Bright Notifications Bell & Super Admin Profile Pill */}
            <div className="sa-banner-actions-layer">
              {/* Notification Bell Button */}
              <div className="sa-notif-hotspot-wrap" ref={notifRef}>
                <button
                  type="button"
                  className={`sa-hotspot-bell-click ${notifDropdownOpen ? "active" : ""}`}
                  onClick={() => {
                    setNotifDropdownOpen((prev) => !prev);
                    setProfileDropdownOpen(false);
                  }}
                  aria-label="Platform Notifications"
                  title="Platform Notifications"
                >
                  <svg
                    className="sa-banner-bell-icon"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2.5a2 2 0 0 0-2 2v.4C7.8 5.6 6 8.1 6 11.5c0 4-1.2 5.5-2.2 6.5h16.4c-1-1-2.2-2.5-2.2-6.5 0-3.4-1.8-5.9-4-6.6v-.4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="19.5" r="1.6" fill="#0f172a" stroke="none" />
                  </svg>
                  <span className="sa-hotspot-bell-badge">
                    {unreadNotifCount > 0 ? unreadNotifCount : (notifications.length > 0 ? notifications.length : 3)}
                  </span>
                </button>

                {/* Notifications Dropdown Menu */}
                {notifDropdownOpen && (
                  <div className="sa-notif-dropdown-menu" style={{ width: "380px" }}>
                    <div className="sa-nd-header">
                      <div className="sa-nd-title-row">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong>Platform Notifications</strong>
                          {unreadNotifCount > 0 && (
                            <span className="sa-nd-count-pill">{unreadNotifCount} New</span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {unreadNotifCount > 0 && (
                            <button
                              type="button"
                              onClick={handleMarkAllNotifsRead}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#16a34a",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                                padding: "2px 4px",
                              }}
                              title="Mark all as read"
                            >
                              Mark All Read
                            </button>
                          )}
                          {notifications.length > 0 && (
                            <button
                              type="button"
                              onClick={handleClearAllNotifs}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#94a3b8",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer",
                                padding: "2px 4px",
                              }}
                              title="Clear all notifications"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                      <small>SaaS Platform Management &amp; Subscription Events</small>
                    </div>

                    <div className="sa-nd-list" style={{ maxHeight: "340px", overflowY: "auto" }}>
                      {notifications.length > 0 ? (
                        notifications.map((n) => {
                          const color = n.color || "green";
                          return (
                            <div
                              key={n._id}
                              className={`sa-nd-item ${!n.isRead ? "unread" : ""}`}
                              onClick={() => {
                                if (n.actionUrl) {
                                  setNotifDropdownOpen(false);
                                  navigate(n.actionUrl);
                                }
                              }}
                              style={{ cursor: n.actionUrl ? "pointer" : "default" }}
                            >
                              <div className={`sa-nd-item-dot ${color}`} />
                              <div className="sa-nd-item-content">
                                <div className="sa-nd-item-title-row">
                                  <span className="sa-nd-item-title">{n.title}</span>
                                  <span className={`sa-nd-type-badge ${color}`}>{color}</span>
                                </div>
                                {n.supermarketName && (
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      color: "#059669",
                                      marginBottom: "2px",
                                    }}
                                  >
                                    {n.supermarketName} {n.supermarketCode ? `(${n.supermarketCode})` : ""}
                                  </div>
                                )}
                                <p className="sa-nd-item-msg">{n.message}</p>
                                {n.metadata?.activity && (
                                  <div
                                    style={{
                                      fontSize: "10.5px",
                                      color: "#334155",
                                      background: "#f1f5f9",
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      margin: "4px 0",
                                      border: "1px solid #e2e8f0",
                                    }}
                                  >
                                    <div><strong>Admin:</strong> {n.metadata.adminName} ({n.metadata.email})</div>
                                    <div style={{ color: "#2563eb", fontWeight: 700 }}>ID: {n.metadata.supermarketId || n.supermarketCode}</div>
                                  </div>
                                )}
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginTop: "4px",
                                  }}
                                >
                                  <span className="sa-nd-item-time">
                                    {new Date(n.createdAt).toLocaleDateString("en-IN", {
                                      month: "short",
                                      day: "numeric",
                                    })}{" "}
                                    &bull;{" "}
                                    {new Date(n.createdAt).toLocaleTimeString("en-IN", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  {!n.isRead && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleMarkNotifRead(n._id, e)}
                                      style={{
                                        background: "transparent",
                                        border: "none",
                                        color: "#16a34a",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        padding: "0 2px",
                                      }}
                                    >
                                      Mark Read
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ padding: "2rem 1.5rem", textAlign: "center", color: "#64748b" }}>
                          <Bell size={24} color="#94a3b8" style={{ marginBottom: "6px" }} />
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>
                            No pending platform notifications
                          </p>
                          <small style={{ color: "#94a3b8", fontSize: "11px" }}>
                            Registrations, renewals and trial alerts will appear here.
                          </small>
                        </div>
                      )}
                    </div>

                    <div className="sa-nd-footer">
                      <button
                        type="button"
                        className="sa-nd-view-all-btn"
                        onClick={() => {
                          setNotifDropdownOpen(false);
                          navigate("/super-admin/notifications");
                        }}
                      >
                        View All Notifications &amp; Activity &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Super Admin Profile Pill */}
              <div className="sa-profile-hotspot-wrap" ref={profileRef}>
                <button
                  type="button"
                  className={`sa-hotspot-profile-click ${profileDropdownOpen ? "active" : ""}`}
                  onClick={() => {
                    setProfileDropdownOpen((prev) => !prev);
                    setNotifDropdownOpen(false);
                  }}
                  aria-label="Super Admin Profile Menu"
                  aria-expanded={profileDropdownOpen}
                >
                  <div className="sa-pill-avatar">SA</div>
                  <div className="sa-pill-meta">
                    <span className="sa-pill-name">Super Admin</span>
                    <span className="sa-pill-role">superadmin</span>
                  </div>
                  <svg
                    className={`sa-pill-chevron ${profileDropdownOpen ? "open" : ""}`}
                    width="11"
                    height="11"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2.5 4.5L6 8L9.5 4.5" />
                  </svg>
                </button>

                {/* Profile Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="sa-profile-dropdown-v2">
                    <div className="sa-pd-header-v2">
                      <div className="sa-pd-avatar-wrap">
                        <div className="sa-pd-big-avatar">SA</div>
                        <div>
                          <strong className="sa-pd-user-title">Super Admin</strong>
                          <span className="sa-pd-role-badge">Super Admin</span>
                        </div>
                      </div>
                      <span className="sa-pd-email">superadmin@grocerease.com</span>
                    </div>

                    <div className="sa-pd-divider" />

                    <div className="sa-pd-actions-list">
                      <button
                        type="button"
                        className="sa-pd-item-v2"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          navigate("/super-admin/settings");
                        }}
                      >
                        <Settings size={15} color="#059669" />
                        <span>My Profile</span>
                      </button>

                      <button
                        type="button"
                        className="sa-pd-item-v2"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          navigate("/super-admin/reports");
                        }}
                      >
                        <BarChart2 size={15} color="#0284c7" />
                        <span>Analytics &amp; Reports</span>
                      </button>

                      <button
                        type="button"
                        className="sa-pd-item-v2"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          navigate("/super-admin/chat");
                        }}
                      >
                        <MessageSquare size={15} color="#059669" />
                        <span>Supermarket Chat</span>
                      </button>

                      <button
                        type="button"
                        className="sa-pd-item-v2"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          navigate("/super-admin/supermarkets");
                        }}
                      >
                        <Store size={15} color="#16a34a" />
                        <span>Registered Supermarkets</span>
                      </button>
                    </div>

                    <div className="sa-pd-divider" />

                    <button
                      type="button"
                      className="sa-pd-logout-btn-v2"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        logout();
                      }}
                    >
                      <LogOut size={15} />
                      <span>Sign Out of Console</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Canvas */}
        <main className="sa-page-content" ref={pageContentRef}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
