import React, { useState, useRef, useEffect } from "react";
import { Outlet, NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  CreditCard,
  Users,
  BarChart2,
  MessageSquare,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Bell,
  Check,
  ShoppingCart,
  Settings,
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
  const { user, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Collapsible Menu Groups State (all open by default for rich sidebar hierarchy)
  const [openGroups, setOpenGroups] = useState({
    supermarkets: true,
    plans: true,
    registered: true,
    analytics: true,
    settings: false,
  });

  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

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

  // Fetch Central Platform Notifications
  useEffect(() => {
    const fetchCentralNotifs = async () => {
      try {
        const res = await API.get("/super-admin/notifications");
        if (res.data?.success && Array.isArray(res.data.notifications)) {
          setNotifications(res.data.notifications);
          const unread = typeof res.data.unreadCount === "number"
            ? res.data.unreadCount
            : res.data.notifications.filter((n) => !n.isRead).length;
          setUnreadNotifCount(unread);
        }
      } catch (_) {}
    };

    fetchCentralNotifs();
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socket.emit("join-tenant", { role: "SUPER_ADMIN", supermarketCode: "ALL" });

    socket.on("platform:notification", fetchCentralNotifs);
    socket.on("supermarket:registered", fetchCentralNotifs);

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

  const handleNavClick = () => {
    setSidebarOpen(false);
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

      {/* Left Deep Forest Green Super Admin Sidebar Matching Reference Mockup */}
      <aside className={`sa-sidebar ${sidebarOpen ? "open" : ""}`}>
        {/* Brand Header */}
        <div className="sa-sidebar-header">
          <Link to="/super-admin" className="sa-brand-link" onClick={handleNavClick}>
            <div className="sa-brand-logo-wrap">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 3H5L6.68 14.39C6.77 15.03 7.32 15.5 7.96 15.5H18.04C18.68 15.5 19.23 15.03 19.32 14.39L20.5 6.5H6"
                  stroke="#ffffff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9" cy="19.5" r="1.5" fill="#4ade80" />
                <circle cx="17" cy="19.5" r="1.5" fill="#4ade80" />
                <path
                  d="M10 9L12 11L16 7"
                  stroke="#4ade80"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="sa-brand-text">
              <span className="sa-brand-name">GrocerEase</span>
              <span className="sa-brand-tagline">Smart Supermarket Solution</span>
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
          {/* 1. Dashboard (Active Green Pill) */}
          <NavLink
            to="/super-admin"
            end
            onClick={handleNavClick}
            className={({ isActive }) => `sa-nav-pill-main ${isActive ? "active" : ""}`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          {/* 2. Supermarket Management Group */}
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

          {/* 3. Subscription Plans Group */}
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
                  className={({ isActive }) => `sa-subitem ${isActive ? "active-sub" : ""}`}
                >
                  <span className="sa-dot">&rsaquo;</span>
                  <span>Create Plan</span>
                </NavLink>
                <NavLink
                  to="/super-admin/manage-plans"
                  onClick={handleNavClick}
                  className={({ isActive }) => `sa-subitem ${isActive ? "active-sub" : ""}`}
                >
                  <span className="sa-dot">&rsaquo;</span>
                  <span>Manage Plans</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* 4. Registered Supermarkets Group */}
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

          {/* 5. Analytics & Reports Group */}
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

          {/* 6. Supermarket Chat */}
          <NavLink
            to="/super-admin/chat"
            onClick={handleNavClick}
            className={({ isActive }) => `sa-nav-pill-main ${isActive ? "active" : ""}`}
          >
            <MessageSquare size={17} />
            <span>Supermarket Chat</span>
          </NavLink>

          {/* 7. Platform Settings */}
          <NavLink
            to="/super-admin/settings"
            onClick={handleNavClick}
            className={({ isActive }) => `sa-nav-pill-main ${isActive ? "active" : ""}`}
          >
            <Settings size={17} />
            <span>Settings</span>
          </NavLink>
        </nav>

        {/* Sidebar Bottom CTA Promo Card & Logout Button */}
        <div className="sa-sidebar-bottom-section">
          {/* Promo Card: Grow Your Business with GrocerEase */}
          <div className="sa-sidebar-cta-card">
            <div className="sa-sidebar-cta-icon-box">
              <ShoppingCart size={16} color="#ffffff" />
            </div>
            <div className="sa-sidebar-cta-text">
              <strong className="sa-sidebar-cta-title">Grow Your Business</strong>
              <span className="sa-sidebar-cta-sub">with GrocerEase</span>
            </div>
            <button
              type="button"
              className="sa-sidebar-cta-btn"
              onClick={() => navigate("/super-admin/plans")}
            >
              Upgrade Plan &rarr;
            </button>
          </div>

          {/* Clean Logout Button */}
          <button
            type="button"
            className="sa-sidebar-clean-logout-btn"
            onClick={logout}
            aria-label="Logout"
          >
            <LogOut size={16} color="#ffffff" strokeWidth={2.2} />
            <span>Logout</span>
          </button>

          <span className="sa-copyright-text">
            &copy; 2026 GrocerEase. All rights reserved.
          </span>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="sa-main-wrapper" ref={mainWrapperRef}>
        {/* Decorative Fluid Ambient Mint Glow Waves Matching Image 1 Reference */}
        <div className="sa-dashboard-bg-waves" aria-hidden="true">
          <svg
            className="sa-bg-waves-svg"
            viewBox="0 0 1440 900"
            preserveAspectRatio="none"
            fill="none"
          >
            <defs>
              <linearGradient id="waveGradTop1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#86EFAC" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#6EE7B7" stopOpacity="0.10" />
              </linearGradient>
              <linearGradient id="waveGradTop2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#BBF7D0" stopOpacity="0.55" />
                <stop offset="50%" stopColor="#A7F3D0" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#DCFCE7" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="waveGradBottom1" x1="100%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#86EFAC" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#A7F3D0" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#BBF7D0" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="waveGradMiddle1" x1="0%" y1="50%" x2="50%" y2="50%">
                <stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#A7F3D0" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Top Right Flowing Waves behind header & greeting */}
            <path
              d="M720,0 C880,90 1060,110 1440,20 L1440,0 Z"
              fill="url(#waveGradTop1)"
            />
            <path
              d="M920,0 C1040,160 1200,120 1440,160 L1440,0 Z"
              fill="url(#waveGradTop2)"
            />
            <path
              d="M1100,0 C1180,240 1320,180 1440,240 L1440,0 Z"
              fill="#86EFAC"
              fillOpacity="0.22"
            />
            {/* Middle Left Wave under Supermarket Overview */}
            <path
              d="M80,560 C240,540 400,620 520,580 C440,650 300,670 100,660 Z"
              fill="url(#waveGradMiddle1)"
            />
            {/* Bottom Right Wave behind Smarter Management Promo Card */}
            <path
              d="M920,900 C1080,750 1260,810 1440,770 L1440,900 Z"
              fill="url(#waveGradBottom1)"
            />
            <path
              d="M1120,900 C1240,820 1340,850 1440,840 L1440,900 Z"
              fill="#A7F3D0"
              fillOpacity="0.35"
            />
          </svg>
        </div>

        {/* Top Header Bar Matching Reference Mockup */}
        <header className="sa-clean-top-header">
          <div className="sa-header-welcome-left">
            <button
              type="button"
              className="sa-header-mobile-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Toggle Navigation Menu"
            >
              <Menu size={20} color="#0f172a" />
            </button>
            <div className="sa-welcome-greeting-wrap">
              <div className="sa-welcome-title-row">
                <span className="sa-waving-hand">👋</span>
                <div className="sa-welcome-texts">
                  <h1 className="sa-welcome-h1">Welcome Back,</h1>
                  <span className="sa-welcome-name">Super Admin</span>
                </div>
              </div>
              <p className="sa-welcome-tagline">Here's what's happening today!</p>
            </div>
          </div>

          <div className="sa-header-actions-right">
            {/* Notification Bell with Red Badge */}
            <div className="sa-notif-wrap" ref={notifRef}>
              <button
                type="button"
                className={`sa-notif-circle-btn ${notifDropdownOpen ? "active" : ""}`}
                onClick={() => {
                  setNotifDropdownOpen((prev) => !prev);
                  setProfileDropdownOpen(false);
                }}
                aria-label="Platform Notifications"
              >
                <Bell size={19} color="#1f2937" strokeWidth={2.2} />
                {unreadNotifCount > 0 && (
                  <span className="sa-notif-badge-pill">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notifDropdownOpen && (
                <div className="sa-notif-dropdown-menu">
                  <div className="sa-nd-header">
                    <div className="sa-nd-title-row">
                      <div className="sa-nd-title-group">
                        <strong className="sa-nd-title-text">Platform Notifications</strong>
                        {unreadNotifCount > 0 && (
                          <span className="sa-nd-count-pill">{unreadNotifCount} New</span>
                        )}
                      </div>
                      <div className="sa-nd-actions-wrap">
                        {unreadNotifCount > 0 && (
                          <button
                            type="button"
                            className="sa-nd-btn-mark-all"
                            onClick={handleMarkAllNotifsRead}
                            title="Mark all notifications as read"
                          >
                            <Check size={12} strokeWidth={2.6} />
                            <span>Mark All Read</span>
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button
                            type="button"
                            className="sa-nd-btn-clear"
                            onClick={handleClearAllNotifs}
                            title="Clear all notifications"
                          >
                            <span>Clear</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <small className="sa-nd-subtitle">SaaS Platform Management &amp; Store Events</small>
                  </div>

                  <div className="sa-nd-list" style={{ maxHeight: "320px", overflowY: "auto" }}>
                    {notifications.length > 0 ? (
                      notifications.map((n) => (
                        <div
                          key={n._id}
                          className={`sa-nd-item ${!n.isRead ? "unread" : ""}`}
                          onClick={() => {
                            if (n.actionUrl) {
                              setNotifDropdownOpen(false);
                              navigate(n.actionUrl);
                            }
                          }}
                        >
                          <div className={`sa-nd-item-dot ${n.color || "green"}`} />
                          <div className="sa-nd-item-content">
                            <div className="sa-nd-item-title-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                              <span className="sa-nd-item-title">{n.title}</span>
                              {n.badge && (
                                <span style={{
                                  fontSize: "9.5px",
                                  fontWeight: 800,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: n.type === "PAYMENT_SUCCESSFUL" ? "#DCFCE7" : n.type === "CART_ITEM_ADDED" ? "#F3E8FF" : "#EFF6FF",
                                  color: n.type === "PAYMENT_SUCCESSFUL" ? "#15803D" : n.type === "CART_ITEM_ADDED" ? "#7E22CE" : "#1D4ED8",
                                  letterSpacing: "0.4px"
                                }}>
                                  {n.badge}
                                </span>
                              )}
                            </div>
                            <p className="sa-nd-item-msg">{n.message}</p>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "3px" }}>
                              {n.supermarketName && (
                                <span style={{ fontSize: "10.5px", color: "#64748B", fontWeight: 600 }}>
                                  🏪 {n.supermarketName}
                                </span>
                              )}
                              <span className="sa-nd-item-time">
                                {new Date(n.createdAt).toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: "1.5rem", textAlign: "center", color: "#64748b" }}>
                        <Bell size={22} color="#94a3b8" style={{ marginBottom: "6px" }} />
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>
                          No pending platform notifications
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile User Chip with SA Initials */}
            <div className="sa-profile-chip-wrap" ref={profileRef}>
              <button
                type="button"
                className="sa-profile-chip-btn"
                onClick={() => {
                  setProfileDropdownOpen((prev) => !prev);
                  setNotifDropdownOpen(false);
                }}
              >
                <div className="sa-profile-avatar-initials">
                  <span>SA</span>
                </div>
                <div className="sa-profile-chip-text">
                  <span className="sa-profile-chip-name">Super Admin</span>
                  <span className="sa-profile-chip-role">
                    Super Admin <ChevronDown size={12} className="sa-role-chevron" />
                  </span>
                </div>
              </button>

              {/* Profile Dropdown */}
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
                      <span>Platform Settings</span>
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
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Outlet */}
        <main className="sa-page-content" ref={pageContentRef}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
