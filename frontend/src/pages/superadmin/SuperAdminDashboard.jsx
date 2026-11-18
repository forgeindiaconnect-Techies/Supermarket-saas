import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import {
  Store,
  Crown,
  TrendingUp,
  Share2,
  Boxes,
  Zap,
  CheckCircle2,
  BarChart2,
  PlusCircle,
  FileText,
  RefreshCw,
  Eye,
  Wifi,
  MessageSquare,
  Trash2,
} from "lucide-react";
import API, { SOCKET_URL } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "./SuperAdmin.css";

// Helper to interpolate smooth cubic bezier SVG spline from coordinate points
function buildSplinePath(pts) {
  if (!pts || pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  let path = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1] : pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return path;
}

const formatK = (num) => {
  if (num >= 1000) {
    const k = num / 1000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return String(num);
};

// Exact Vector KPI Icons Matching User Reference Mockup (Scalable & Colorable)
const KpiStorefrontIcon = ({ color = "#044e36", size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Top Roof Signboard Bar */}
    <rect x="2.5" y="4" width="19" height="2.5" rx="1.2" fill={color} />
    {/* Scalloped Awning Canopy */}
    <path
      d="M3 6.5h18l-1.2 5.2a2.4 2.4 0 0 1-4.6 0 2.4 2.4 0 0 1-4.4 0 2.4 2.4 0 0 1-4.6 0L3 6.5z"
      fill={color}
    />
    {/* Columns and Base */}
    <rect x="3.8" y="11.5" width="2.4" height="7.5" rx="0.5" fill={color} />
    <rect x="17.8" y="11.5" width="2.4" height="7.5" rx="0.5" fill={color} />
    <rect x="2.5" y="19" width="19" height="2" rx="0.8" fill={color} />
    {/* Center Arched Doorway */}
    <path d="M8.8 19v-4.5a3.2 3.2 0 0 1 6.4 0V19H8.8z" fill={color} />
    {/* Door Knob / Indicator */}
    <circle cx="13.2" cy="16.2" r="0.75" fill="#ffffff" />
  </svg>
);

const KpiCrownIcon = ({ color = "#0284c7", size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    {/* 5 Crown Tip Jewels */}
    <circle cx="3.5" cy="8.5" r="1.5" />
    <circle cx="7.75" cy="10.8" r="1.2" />
    <circle cx="12" cy="6.8" r="1.7" />
    <circle cx="16.25" cy="10.8" r="1.2" />
    <circle cx="20.5" cy="8.5" r="1.5" />
    {/* Crown Body with Scalloped Peaks */}
    <path d="M3.5 10l2.8 8.2c.2.5.7.8 1.2.8h8.8c.5 0 1-.3 1.2-.8l3-8.2-3.8 2.2-4.7-5.2-4.7 5.2-3.8-2.2z" />
    {/* Center Base Gem Cutout */}
    <circle cx="12" cy="16.2" r="1.4" fill="#ffffff" />
  </svg>
);

const KpiRevenueIcon = ({ size = 32 }) => (
  <div className="sa-ref-revenue-icon-wrap">
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none">
      {/* Light Mint Diagonal Notch / Handle at Bottom-Right */}
      <rect
        x="24.5"
        y="24.5"
        width="5"
        height="11"
        rx="2.5"
        transform="rotate(-45 24.5 24.5)"
        fill="#86efac"
      />
      {/* Vibrant Solid Emerald Coin Circle */}
      <circle cx="17" cy="17" r="15" fill="#059669" />
      {/* Clean White Crisp Indian Rupee Symbol */}
      <text
        x="17"
        y="22.5"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="17"
        fontWeight="850"
        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      >
        &#8377;
      </text>
    </svg>
  </div>
);

const KpiGrowthIcon = ({ color = "#7c3aed", size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* 4 Ascending Vertical Columns */}
    <rect x="3.2" y="14" width="2.8" height="6.5" rx="0.7" fill={color} />
    <rect x="7.4" y="11" width="2.8" height="9.5" rx="0.7" fill={color} />
    <rect x="11.6" y="8" width="2.8" height="12.5" rx="0.7" fill={color} />
    <rect x="15.8" y="5" width="2.8" height="15.5" rx="0.7" fill={color} />
    {/* Ascending Trend Line with Arrowhead */}
    <path
      d="M3.5 10.5l4.2-4.5 4.2 3.8 6.5-6"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.5 3.8h4.5v4.5"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { supermarkets, loadSupermarkets } = useAuth();

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salesRange, setSalesRange] = useState("7d"); // "7d" or "30d"
  const [wireCartUrl, setWireCartUrl] = useState(null);

  // Extract the complete white wire shopping cart with produce from the master reference image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/super-admin-reference-master.jpg";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        // Bounding box of the entire shopping cart (full produce, wire basket, wheels & handle)
        const x = Math.round(W * 0.020);
        const y = Math.round(H * 0.438);
        const w = Math.round(W * 0.088);
        const h = Math.round(H * 0.205);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        setWireCartUrl(canvas.toDataURL("image/png"));
      } catch (_) {}
    };
  }, []);

  // Fetch Central Platform Analytics & Registered Supermarkets (Real-Time Live)
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await API.get("/super-admin/analytics");
      if (res.data?.success) {
        setAnalytics(res.data);
      }
    } catch (err) {
      console.warn("Analytics fetch notice:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    if (loadSupermarkets) loadSupermarkets();

    // Live continuous polling every 5 seconds for real-time cards, graph, and overview updates
    const interval = setInterval(() => {
      fetchAnalytics();
      if (loadSupermarkets) loadSupermarkets();
    }, 5000);

    // Socket.io real-time listener for instant order updates across all supermarkets
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    socket.emit("join-tenant", { role: "SUPER_ADMIN", supermarketCode: "ALL" });
    const refreshAll = () => {
      fetchAnalytics();
      if (loadSupermarkets) loadSupermarkets();
    };
    socket.on("new-order", refreshAll);
    socket.on("admin:notification", refreshAll);
    socket.on("order-status-update", refreshAll);
    socket.on("order:created", refreshAll);
    socket.on("order:updated", refreshAll);
    socket.on("order:deleted", refreshAll);
    socket.on("supermarket:created", refreshAll);
    socket.on("supermarket:updated", refreshAll);
    socket.on("supermarket:deleted", refreshAll);
    socket.on("product:created", refreshAll);
    socket.on("product:updated", refreshAll);
    socket.on("product:deleted", refreshAll);
    socket.on("platform:stats_updated", refreshAll);

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  const handleLaunchStore = (store) => {
    const storeId =
      store.code ||
      (store._id && !String(store._id).startsWith("store-real-") ? store._id : store.slug || store._id);
    navigate(`/super-admin/registered-supermarkets?store=${storeId}`);
  };

  const handleResetToCleanDatabase = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to reset to a completely clean database? All demo supermarkets, products, orders, and notifications will be wiped to start strictly at 0. Only the Super Admin (admin / admin) will remain."
    );
    if (!confirmed) return;
    try {
      const res = await API.post("/super-admin/clear-demo-data");
      if (res.data?.success) {
        alert("Database successfully reset to 0! All counts are now clean.");
        fetchAnalytics();
        if (loadSupermarkets) loadSupermarkets();
      }
    } catch (err) {
      alert("Error resetting database: " + (err.response?.data?.message || err.message));
    }
  };

  // Real-Time KPI Values strictly calculated from live database
  const totalStoresCount =
    analytics?.summary?.totalSupermarkets !== undefined
      ? Number(analytics.summary.totalSupermarkets)
      : (supermarkets?.length || 0);

  const activeSubsCount =
    analytics?.summary?.activeSubscriptions !== undefined
      ? Number(analytics.summary.activeSubscriptions)
      : (supermarkets?.filter((s) => s.status === "Active")?.length || 0);

  const totalPlatformRevenue =
    analytics?.summary?.totalRevenue !== undefined
      ? Number(analytics.summary.totalRevenue)
      : (analytics?.summary?.totalStoreSales || 0);

  const rawGrowth = analytics?.summary?.platformGrowth;
  const platformGrowthRate = (rawGrowth !== undefined && rawGrowth !== null) ? Number(rawGrowth) : 0;

  const totalProductsCount =
    analytics?.summary?.totalProductsCount !== undefined
      ? Number(analytics.summary.totalProductsCount)
      : 0;

  const totalPosTurnstiles =
    analytics?.summary?.totalPosTurnstilesOnline !== undefined
      ? Number(analytics.summary.totalPosTurnstilesOnline)
      : 0;

  const newStoresThisMonth =
    analytics?.summary?.newStoresThisMonth !== undefined
      ? Number(analytics.summary.newStoresThisMonth)
      : totalStoresCount;

  // Real-Time Dynamic Sales Chart Series Calculation
  const rawChartData = salesRange === "7d" ? analytics?.chart7d : analytics?.chart30d;

  const chartData = useMemo(() => {
    if (Array.isArray(rawChartData) && rawChartData.length > 0) {
      return rawChartData;
    }
    const count = salesRange === "7d" ? 7 : 30;
    const fallback = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const m = monthNames[d.getMonth()] || "Nov";
      const day = d.getDate();
      fallback.push({
        dateKey: d.toISOString().split("T")[0],
        label: `${m} ${day}`,
        amount: 0,
        ordersCount: 0,
      });
    }
    return fallback;
  }, [rawChartData, salesRange]);

  const [activePointIdx, setActivePointIdx] = useState(null);

  const { points, splinePath, areaPath, maxVal } = useMemo(() => {
    let highest = 0;
    if (Array.isArray(chartData)) {
      for (let i = 0; i < chartData.length; i++) {
        const amt = Number(chartData[i]?.amount || 0);
        if (amt > highest) highest = amt;
      }
    }
    let computedMax = 10000;
    if (highest > 30000) {
      computedMax = Math.ceil(highest / 15000) * 15000;
    } else if (highest > 15000) {
      computedMax = 30000;
    } else if (highest > 0) {
      computedMax = 15000;
    }

    const N = chartData.length;
    const xMin = 48;
    const xMax = 515;
    const yTop = 50;
    const yBottom = 185;
    const h = yBottom - yTop;

    const pts = chartData.map((d, i) => {
      const x = N > 1 ? xMin + (i / (N - 1)) * (xMax - xMin) : xMin;
      const fraction = computedMax > 0 ? (d.amount || 0) / computedMax : 0;
      const y = yBottom - fraction * h;
      return {
        ...d,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        index: i,
      };
    });

    const sPath = buildSplinePath(pts);
    const lastX = pts[pts.length - 1]?.x || 515;
    const firstX = pts[0]?.x || 48;
    const aPath = sPath ? `${sPath} L ${lastX},185 L ${firstX},185 Z` : "";

    return { points: pts, splinePath: sPath, areaPath: aPath, maxVal: computedMax };
  }, [chartData]);

  const activePoint =
    activePointIdx !== null && points[activePointIdx]
      ? points[activePointIdx]
      : points[points.length - 1] || { amount: 0, label: "Today", x: 515, y: 185 };

  // Recent Supermarkets List matching live registered supermarkets
  const recentStoresList =
    supermarkets?.length > 0
      ? supermarkets.slice(0, 5)
      : (analytics?.recentSupermarkets || []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "-";
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } catch (_) {
      return "-";
    }
  };

  return (
    <div className="sa-ref-dashboard-container">
      {/* ================= 1. Top Row: 4 Metric KPI Cards (Compact & Branded Colors) ================= */}
      <section className="sa-ref-kpi-grid">
        {/* Card 1: Total Supermarkets (Soft Mint Green) */}
        <div className="sa-ref-kpi-card sa-kpi-mint">
          <div className="sa-ref-kpi-left">
            <div className="sa-ref-icon-wrap sa-icon-mint">
              <KpiStorefrontIcon color="#059669" size={20} />
            </div>
            <div className="sa-ref-kpi-text">
              <span className="sa-ref-kpi-label">Total Supermarkets</span>
              <div className="sa-ref-kpi-val-row">
                <span className="sa-ref-kpi-val">{totalStoresCount}</span>
                <span className="sa-ref-pill sa-pill-mint">&uarr; +{newStoresThisMonth}</span>
              </div>
            </div>
          </div>
          {/* Subtle Green Sparkline Wave */}
          <div className="sa-ref-kpi-spark">
            <svg viewBox="0 0 80 34" fill="none" className="sa-spark-svg">
              <defs>
                <linearGradient id="greenWaveGrad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M2,28 C18,28 24,18 40,22 C56,26 64,12 78,8 L78,34 L2,34 Z"
                fill="url(#greenWaveGrad1)"
              />
              <path
                d="M2,28 C18,28 24,18 40,22 C56,26 64,12 78,8"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Active Subscriptions (Soft Sky Blue) */}
        <div className="sa-ref-kpi-card sa-kpi-blue">
          <div className="sa-ref-kpi-left">
            <div className="sa-ref-icon-wrap sa-icon-blue">
              <KpiCrownIcon color="#0284c7" size={20} />
            </div>
            <div className="sa-ref-kpi-text">
              <span className="sa-ref-kpi-label">Active Subscriptions</span>
              <div className="sa-ref-kpi-val-row">
                <span className="sa-ref-kpi-val">{activeSubsCount}</span>
                <span className="sa-ref-pill sa-pill-blue">&uarr; +{activeSubsCount}</span>
              </div>
            </div>
          </div>
          <div className="sa-ref-kpi-spark">
            <svg viewBox="0 0 80 34" fill="none" className="sa-spark-svg">
              <defs>
                <linearGradient id="blueWaveGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M2,26 C16,26 26,16 42,20 C58,24 64,10 78,6 L78,34 L2,34 Z"
                fill="url(#blueWaveGrad2)"
              />
              <path
                d="M2,26 C16,26 26,16 42,20 C58,24 64,10 78,6"
                stroke="#0284c7"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Total Revenue (Warm Gold / Emerald) */}
        <div className="sa-ref-kpi-card sa-kpi-amber">
          <div className="sa-ref-kpi-left">
            <KpiRevenueIcon size={34} />
            <div className="sa-ref-kpi-text">
              <span className="sa-ref-kpi-label">Total Revenue</span>
              <div className="sa-ref-kpi-val-row">
                <span className="sa-ref-kpi-val">
                  &#8377;{Number(totalPlatformRevenue).toLocaleString("en-IN")}
                </span>
                <span className="sa-ref-pill sa-pill-amber">&uarr; +{platformGrowthRate}%</span>
              </div>
            </div>
          </div>
          {/* Ascending Green Mini Bars (6 Bars) */}
          <div className="sa-ref-mini-bars">
            <span className="sa-mbar b1" />
            <span className="sa-mbar b2" />
            <span className="sa-mbar b3" />
            <span className="sa-mbar b4" />
            <span className="sa-mbar b5" />
            <span className="sa-mbar b6" />
          </div>
        </div>

        {/* Card 4: Platform Growth (Soft Violet Purple) */}
        <div className="sa-ref-kpi-card sa-kpi-purple">
          <div className="sa-ref-kpi-left">
            <div className="sa-ref-icon-wrap sa-icon-purple">
              <KpiGrowthIcon color="#7c3aed" size={20} />
            </div>
            <div className="sa-ref-kpi-text">
              <span className="sa-ref-kpi-label">Platform Growth</span>
              <div className="sa-ref-kpi-val-row">
                <span className="sa-ref-kpi-val">{platformGrowthRate}%</span>
                <span className="sa-ref-pill sa-pill-purple">&uarr; +{platformGrowthRate}%</span>
              </div>
            </div>
          </div>
          {/* Ascending Purple Mini Bars (6 Bars) */}
          <div className="sa-ref-mini-bars sa-bars-purple">
            <span className="sa-mbar b1" />
            <span className="sa-mbar b2" />
            <span className="sa-mbar b3" />
            <span className="sa-mbar b4" />
            <span className="sa-mbar b5" />
            <span className="sa-mbar b6" />
          </div>
        </div>
      </section>

      {/* ================= 2. Center Section: Network Overview & Sales Performance ================= */}
      <section className="sa-ref-center-grid">
        {/* Left Card: Supermarket Network Overview */}
        <div className="sa-ref-card sa-ref-overview-card">
          <div className="sa-ref-card-header">
            <div className="sa-ref-card-title-wrap">
              <div className="sa-ref-header-icon-mint">
                <Share2 size={18} color="#059669" strokeWidth={2.4} />
              </div>
              <h3>Supermarket Network Overview</h3>
            </div>
            <Link to="/super-admin/supermarkets" className="sa-ref-view-all">
              <span>View All</span>
              <span>&rarr;</span>
            </Link>
          </div>

          {/* 4 Inner Metric Pill Boxes */}
          <div className="sa-ref-metric-pills-row">
            {/* Box 1: Stores */}
            <div className="sa-ref-stat-box">
              <div className="sa-ref-box-icon store-green">
                <Store size={18} color="#059669" />
              </div>
              <span className="sa-ref-box-main">{totalStoresCount} Stores</span>
              <span className="sa-ref-box-sub green-dot-label">
                <span className="sa-dot-online" /> Active &amp; Online
              </span>
            </div>

            {/* Box 2: Catalog Products */}
            <div className="sa-ref-stat-box">
              <div className="sa-ref-box-icon box-orange">
                <Boxes size={18} color="#ea580c" />
              </div>
              <span className="sa-ref-box-main">
                {totalProductsCount} Items
              </span>
              <span className="sa-ref-box-sub">Catalog Products</span>
            </div>

            {/* Box 3: Network Volume */}
            <div className="sa-ref-stat-box">
              <div className="sa-ref-box-icon box-purple">
                <span>&#8377;</span>
              </div>
              <span className="sa-ref-box-main">
                &#8377;{Number(totalPlatformRevenue).toLocaleString("en-IN")}
              </span>
              <span className="sa-ref-box-sub">Network Volume</span>
            </div>

            {/* Box 4: POS & Turnstiles */}
            <div className="sa-ref-stat-box">
              <div className="sa-ref-box-icon box-blue">
                <Wifi size={18} color="#0284c7" />
              </div>
              <span className="sa-ref-box-main">{totalPosTurnstiles} Online</span>
              <span className="sa-ref-box-sub">POS &amp; Turnstiles</span>
            </div>
          </div>

          {/* Bottom Split: 3D Shopping Cart & Checklist + Button */}
          <div className="sa-ref-overview-bottom">
            <div className="sa-ref-cart-img-box">
              <img
                src={wireCartUrl || "/check-cart.png"}
                alt="Supermarket Shopping Cart"
                className="sa-ref-cart-img"
              />
            </div>
            <div className="sa-ref-overview-desc-side">
              <ul className="sa-ref-checklist">
                <li>
                  <CheckCircle2 size={16} color="#059669" className="sa-chk-ico" />
                  <span>Real-time barcode generation &amp; stock sync across network</span>
                </li>
                <li>
                  <CheckCircle2 size={16} color="#059669" className="sa-chk-ico" />
                  <span>Dedicated tenant database isolation for every onboarded store</span>
                </li>
                <li>
                  <CheckCircle2 size={16} color="#059669" className="sa-chk-ico" />
                  <span>Customer self-checkout &amp; instant turnstile exit QR validation</span>
                </li>
              </ul>

              <button
                type="button"
                className="sa-ref-onboard-btn"
                onClick={() => navigate("/super-admin/add-supermarket")}
              >
                <span>+ Onboard Supermarket</span>
                <span>&rarr;</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Card: Sales Performance */}
        <div className="sa-ref-card sa-ref-sales-card">
          <div className="sa-ref-card-header">
            <div className="sa-ref-card-title-wrap">
              <div className="sa-ref-header-icon-mint">
                <BarChart2 size={18} color="#059669" strokeWidth={2.4} />
              </div>
              <h3>Sales Performance</h3>
            </div>
            <div className="sa-ref-toggle-pill-wrap">
              <button
                type="button"
                className={`sa-ref-toggle-btn ${salesRange === "7d" ? "active" : ""}`}
                onClick={() => {
                  setSalesRange("7d");
                  setActivePointIdx(null);
                }}
              >
                7 Days
              </button>
              <button
                type="button"
                className={`sa-ref-toggle-btn ${salesRange === "30d" ? "active" : ""}`}
                onClick={() => {
                  setSalesRange("30d");
                  setActivePointIdx(null);
                }}
              >
                30 Days
              </button>
            </div>
          </div>

          {/* Area Chart with Real-Time Dynamic Database Sales Data */}
          <div className="sa-ref-chart-container">
            <svg
              viewBox="0 0 540 220"
              preserveAspectRatio="none"
              className="sa-ref-sales-svg"
            >
              <defs>
                <linearGradient id="salesGreenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.36" />
                  <stop offset="65%" stopColor="#10b981" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Top & Right subtle boundary lines */}
              <line x1="38" y1="35" x2="520" y2="35" stroke="#e2e8f0" strokeWidth="1" />
              <line x1="520" y1="35" x2="520" y2="185" stroke="#e2e8f0" strokeWidth="1" />

              {/* Horizontal Internal Gridlines */}
              <line x1="38" y1="85" x2="520" y2="85" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="38" y1="135" x2="520" y2="135" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />

              {/* Vertical Gridlines aligned to dynamic real points */}
              {points.map((p, idx) => (
                <line
                  key={`vgrid-${idx}`}
                  x1={p.x}
                  y1="35"
                  x2={p.x}
                  y2="185"
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              ))}

              {/* High-Contrast Crisp Solid L-Shape Axis Box Frame (Y-Axis & X-Axis) */}
              <line x1="38" y1="35" x2="38" y2="185" stroke="#475569" strokeWidth="2.2" strokeLinecap="square" />
              <line x1="38" y1="185" x2="520" y2="185" stroke="#475569" strokeWidth="2.2" strokeLinecap="square" />

              {/* Y-Axis Tick Marks */}
              <line x1="33" y1="35" x2="38" y2="35" stroke="#475569" strokeWidth="1.8" />
              <line x1="33" y1="85" x2="38" y2="85" stroke="#475569" strokeWidth="1.8" />
              <line x1="33" y1="135" x2="38" y2="135" stroke="#475569" strokeWidth="1.8" />
              <line x1="33" y1="185" x2="38" y2="185" stroke="#475569" strokeWidth="1.8" />

              {/* X-Axis Tick Marks */}
              {points.map((p, idx) => (
                <line
                  key={`xtick-${idx}`}
                  x1={p.x}
                  y1="185"
                  x2={p.x}
                  y2="190"
                  stroke="#475569"
                  strokeWidth="1.6"
                />
              ))}

              {/* Y-Axis Labels (Dynamic Real-Time Scale) */}
              <text x="32" y="38" className="sa-chart-axis-text" textAnchor="end">
                &#8377;{formatK(maxVal)}
              </text>
              <text x="32" y="88" className="sa-chart-axis-text" textAnchor="end">
                &#8377;{formatK(Math.round((maxVal * 2) / 3))}
              </text>
              <text x="32" y="138" className="sa-chart-axis-text" textAnchor="end">
                &#8377;{formatK(Math.round(maxVal / 3))}
              </text>
              <text x="32" y="188" className="sa-chart-axis-text" textAnchor="end">
                &#8377;0
              </text>

              {/* Dynamic Gradient Area Fill */}
              {areaPath && (
                <path d={areaPath} fill="url(#salesGreenGrad)" />
              )}

              {/* Dynamic Green Spline Curve from Real-Time Points */}
              {splinePath && (
                <path
                  d={splinePath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />
              )}

              {/* Data Points on Curve with Real-Time Values */}
              {points.map((p, idx) => (
                <circle
                  key={`pt-${idx}`}
                  cx={p.x}
                  cy={p.y}
                  r={idx === activePoint.index ? 5 : 3.5}
                  fill="#047857"
                  stroke="#ffffff"
                  strokeWidth={idx === activePoint.index ? 2.5 : 1.5}
                  style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                  onMouseEnter={() => setActivePointIdx(idx)}
                  onClick={() => setActivePointIdx(idx)}
                />
              ))}

              {/* X-Axis Real-Time Dates */}
              {points.map((p, idx) => {
                if (
                  salesRange === "30d" &&
                  idx % Math.ceil(points.length / 6) !== 0 &&
                  idx !== points.length - 1
                ) {
                  return null;
                }
                return (
                  <text
                    key={`dlabel-${idx}`}
                    x={p.x}
                    y="206"
                    className="sa-chart-date-text"
                    textAnchor="middle"
                  >
                    {p.label}
                  </text>
                );
              })}
            </svg>

            {/* Pinned / Hover Tooltip Badge showing Real Database Amount & Date */}
            <div
              className="sa-ref-chart-tooltip"
              style={{
                left: `${(activePoint.x / 540) * 100}%`,
                top: `${(activePoint.y / 220) * 100}%`,
                transform:
                  activePoint.x > 400
                    ? "translate(-92%, -125%)"
                    : activePoint.x < 80
                    ? "translate(-10%, -125%)"
                    : "translate(-50%, -125%)",
                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                whiteSpace: "nowrap",
                width: "max-content",
                minWidth: "max-content",
              }}
            >
              <span className="sa-ref-tooltip-amount" style={{ whiteSpace: "nowrap" }}>
                &#8377;{Number(activePoint.amount || 0).toLocaleString("en-IN")}
              </span>
              <span className="sa-ref-tooltip-date" style={{ whiteSpace: "nowrap" }}>
                {activePoint.label}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 3. Bottom Section: Recent Supermarkets & Quick Actions ================= */}
      <section className="sa-ref-bottom-grid">
        {/* Left Card: Recent Supermarkets */}
        <div className="sa-ref-card sa-ref-table-card">
          <div className="sa-ref-card-header">
            <div className="sa-ref-card-title-wrap">
              <div className="sa-ref-header-icon-mint">
                <Store size={18} color="#059669" strokeWidth={2.4} />
              </div>
              <h3>Recent Supermarkets</h3>
            </div>
            <Link to="/super-admin/registered-supermarkets" className="sa-ref-view-all">
              <span>View All</span>
              <span>&rarr;</span>
            </Link>
          </div>

          <div className="sa-ref-table-wrap" style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}>
            <table className="sa-ref-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: "38px", textAlign: "center" }}>#</th>
                  <th style={{ textAlign: "left", minWidth: "160px" }}>Supermarket Name</th>
                  <th className="sa-ref-col-admin" style={{ textAlign: "left", minWidth: "120px" }}>Admin</th>
                  <th className="sa-ref-col-plan" style={{ textAlign: "left", minWidth: "90px" }}>Plan</th>
                  <th style={{ textAlign: "center", minWidth: "175px" }}>Availability</th>
                  <th style={{ textAlign: "center", minWidth: "85px" }}>Status</th>
                  <th className="sa-ref-col-date" style={{ textAlign: "left", minWidth: "115px" }}>Registered On</th>
                  <th style={{ textAlign: "center", width: "125px", whiteSpace: "nowrap" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentStoresList.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: "48px 20px", color: "#64748b" }}>
                      <Store size={36} color="#94a3b8" style={{ margin: "0 auto 10px auto", display: "block", opacity: 0.7 }} />
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b", marginBottom: "4px" }}>
                        No Supermarkets Registered Yet
                      </div>
                      <div style={{ fontSize: "12.5px", color: "#94a3b8" }}>
                        Click "+ Onboard Supermarket" or Quick Actions to add your first supermarket.
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentStoresList.map((store, idx) => (
                    <tr key={store._id || idx}>
                      <td className="sa-ref-td-num" style={{ textAlign: "center", verticalAlign: "middle" }}>{idx + 1}</td>
                      <td style={{ verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
                            <span className="sa-ref-store-name">{store.name}</span>
                            {store.code && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  fontFamily: "monospace",
                                  color: "#059669",
                                  background: "#ecfdf5",
                                  padding: "1px 5px",
                                  borderRadius: "4px",
                                  border: "1px solid #a7f3d0",
                                }}
                              >
                                {store.code}
                              </span>
                            )}
                          </div>
                          <span className="sa-ref-store-sub-mobile">
                            {store.plan || "Basic"} &bull; {store.adminUsername || store.code || "Store Admin"}
                          </span>
                        </div>
                      </td>
                      <td className="sa-ref-col-admin" style={{ verticalAlign: "middle" }}>
                        <span className="sa-ref-admin-name">
                          {store.adminUsername || store.email || `${store.code || "store"}@grocerease.store`}
                        </span>
                      </td>
                      <td className="sa-ref-col-plan" style={{ verticalAlign: "middle" }}>
                        <span className="sa-ref-plan-name" style={{ fontWeight: 700, color: "#063d2e" }}>
                          {store.plan || "Basic"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: "6px", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 750,
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: store.onlineAvailable === true ? "#dcfce7" : "#fee2e2",
                              color: store.onlineAvailable === true ? "#15803d" : "#991b1b",
                              border: `1px solid ${store.onlineAvailable === true ? "#86efac" : "#fca5a5"}`,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {store.onlineAvailable === true ? "⚡ Online" : "✕ Online"}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 750,
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: store.offlineAvailable === true ? "#dcfce7" : "#fee2e2",
                              color: store.offlineAvailable === true ? "#15803d" : "#991b1b",
                              border: `1px solid ${store.offlineAvailable === true ? "#86efac" : "#fca5a5"}`,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {store.offlineAvailable === true ? "🏪 Offline" : "✕ Offline"}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                        <span className="sa-ref-status-pill">Active</span>
                      </td>
                      <td className="sa-ref-col-date" style={{ verticalAlign: "middle" }}>
                        <span className="sa-ref-date-text">{formatDate(store.createdAt)}</span>
                      </td>
                      <td style={{ textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="sa-ref-view-btn"
                          onClick={() => handleLaunchStore(store)}
                          title={`View detailed performance for ${store.name}`}
                        >
                          <span>View Details</span>
                          <span>&rarr;</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {recentStoresList.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "9px 12px",
                marginTop: "10px",
                borderTop: "1px solid #f1f5f9",
                fontSize: "12px",
                color: "#64748b",
                background: "#f8fafc",
                borderRadius: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: "#10b981",
                    display: "inline-block",
                  }}
                />
                <span style={{ fontWeight: 650, color: "#334155" }}>
                  {recentStoresList.length} {recentStoresList.length === 1 ? "Supermarket" : "Supermarkets"} Registered &bull; Live Realtime Sync
                </span>
              </div>
              <Link
                to="/super-admin/registered-supermarkets"
                style={{ color: "#047857", fontWeight: 750, textDecoration: "none", fontSize: "11.5px" }}
              >
                Manage All &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* Right Card: Quick Actions */}
        <div className="sa-ref-card sa-ref-qa-card">
          <div className="sa-ref-card-header">
            <div className="sa-ref-card-title-wrap">
              <span className="sa-ref-lightning-ico">&#9889;</span>
              <h3>Quick Actions</h3>
            </div>
          </div>

          <div className="sa-ref-qa-grid">
            {/* Action 1: Add New Supermarket */}
            <button
              type="button"
              className="sa-ref-qa-btn primary"
              onClick={() => navigate("/super-admin/add-supermarket")}
            >
              <div className="sa-ref-qa-icon primary">
                <PlusCircle size={16} strokeWidth={2.4} />
              </div>
              <div className="sa-ref-qa-label">
                <span>Add New Supermarket</span>
                <span className="sa-ref-qa-arr">&rarr;</span>
              </div>
            </button>

            {/* Action 2: Chat with Supermarkets */}
            <button
              type="button"
              className="sa-ref-qa-btn chat-action"
              onClick={() => navigate("/super-admin/chat")}
              style={{
                background: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
                color: "#ffffff",
              }}
            >
              <div className="sa-ref-qa-icon chat" style={{ color: "#ffffff" }}>
                <MessageSquare size={16} color="#ffffff" strokeWidth={2.4} />
              </div>
              <div className="sa-ref-qa-label">
                <span>Supermarket Chat</span>
                <span className="sa-ref-qa-arr" style={{ color: "#ffffff" }}>&rarr;</span>
              </div>
            </button>

            {/* Action 3: Manage Plans */}
            <button
              type="button"
              className="sa-ref-qa-btn mint"
              onClick={() => navigate("/super-admin/plans")}
            >
              <div className="sa-ref-qa-icon mint">
                <Crown size={16} color="#059669" strokeWidth={2.2} />
              </div>
              <div className="sa-ref-qa-label">
                <span>Manage SaaS Plans</span>
                <span className="sa-ref-qa-arr">&rarr;</span>
              </div>
            </button>

            {/* Action 4: View Platform Reports */}
            <button
              type="button"
              className="sa-ref-qa-btn mint"
              onClick={() => navigate("/super-admin/reports")}
            >
              <div className="sa-ref-qa-icon mint">
                <FileText size={16} color="#059669" strokeWidth={2.2} />
              </div>
              <div className="sa-ref-qa-label">
                <span>View Platform Reports</span>
                <span className="sa-ref-qa-arr">&rarr;</span>
              </div>
            </button>

            {/* Action 5: Check Subscriptions */}
            <button
              type="button"
              className="sa-ref-qa-btn mint"
              onClick={() => navigate("/super-admin/registered-supermarkets")}
            >
              <div className="sa-ref-qa-icon mint">
                <RefreshCw size={16} color="#059669" strokeWidth={2.2} />
              </div>
              <div className="sa-ref-qa-label">
                <span>All Registered Stores</span>
                <span className="sa-ref-qa-arr">&rarr;</span>
              </div>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
