import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Leaf,
  Store,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  X,
  TrendingUp,
  Package,
  Receipt,
  Users,
  Headphones,
  ShieldCheck,
  Zap,
  Rocket,
  Handshake,
  KeyRound,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Login form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Modals state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);

  const usernameInputRef = useRef(null);

  // Clear autofill on mount
  useEffect(() => {
    setUsername("");
    setPassword("");
    const timer = setTimeout(() => {
      setUsername("");
      setPassword("");
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage("Please enter both Supermarket Name/ID and Password.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const result = await login(username, password);

      if (result.success) {
        if (result.user.role === "SUPER_ADMIN") {
          navigate("/super-admin");
        } else {
          navigate("/admin");
        }
      } else {
        setErrorMessage(result.message || "Invalid credentials. Please verify your username and password.");
        setLoading(false);
      }
    } catch (err) {
      setErrorMessage(err.message || "Authentication failed. Please check network connection.");
      setLoading(false);
    }
  };

  const handleQuickFill = (u, p) => {
    setUsername(u);
    setPassword(p);
    setErrorMessage("");
    setShowForgotModal(false);
    setShowDemoModal(false);
    if (usernameInputRef.current) {
      usernameInputRef.current.focus();
    }
  };

  return (
    <div className="ref-login-page">
      {/* Top Left Decorative Fresh Leaf Cluster */}
      <div className="ref-top-leaf" aria-hidden="true">
        <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="ref-top-leaf-svg">
          {/* Main Leaf */}
          <path
            d="M0 0 C 60 10, 130 50, 150 120 C 95 125, 30 85, 0 0 Z"
            fill="url(#leafGrad1)"
            opacity="0.95"
          />
          <path
            d="M0 0 C 50 35, 90 70, 150 120"
            stroke="#15803d"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.5"
          />
          {/* Secondary Leaf */}
          <path
            d="M0 35 C 30 50, 65 95, 75 140 C 40 135, 15 100, 0 35 Z"
            fill="url(#leafGrad2)"
            opacity="0.88"
          />
          {/* Small accent leaf */}
          <path
            d="M25 0 C 60 5, 95 25, 110 55 C 75 55, 45 30, 25 0 Z"
            fill="url(#leafGrad3)"
            opacity="0.82"
          />
          <defs>
            <linearGradient id="leafGrad1" x1="0" y1="0" x2="150" y2="120" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="50%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>
            <linearGradient id="leafGrad2" x1="0" y1="35" x2="75" y2="140" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#166534" />
            </linearGradient>
            <linearGradient id="leafGrad3" x1="25" y1="0" x2="110" y2="55" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#bbf7d0" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* =========================================================================
          1. TOP NAVIGATION BAR (Exact Match to Reference Image)
          ========================================================================= */}
      <header className="ref-header">
        <div className="ref-header-container">
          {/* Brand Lockup */}
          <div className="ref-brand" onClick={() => window.location.reload()}>
            <div className="ref-brand-icon-wrap">
              <ShoppingCart size={22} color="#15803d" strokeWidth={2.4} />
              <Leaf size={12} color="#16a34a" className="ref-brand-sprout" strokeWidth={2.8} />
            </div>
            <div className="ref-brand-names">
              <span className="ref-brand-title">GrocerEase</span>
              <span className="ref-brand-sub">
                Smart Supermarket Solutions <span className="ref-dash">&mdash;</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. MAIN HERO & AUTH STAGE (Exact 1:1 Layout)
          ========================================================================= */}
      <main className="ref-main-stage">
        {/* Crisp Supermarket Aisle Background Visual in Center-Right */}
        <div className="ref-supermarket-bg" />

        {/* Right-Side Organic Emerald Framing Wave (Behind Login Card) */}
        <div className="ref-right-framing-wave" aria-hidden="true">
          <svg
            viewBox="0 0 340 760"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            className="ref-right-wave-svg"
          >
            {/* Soft Luminous Outer Wave */}
            <path
              d="M340 0 C 230 110, 140 270, 180 460 C 215 580, 275 660, 340 760 L 340 0 Z"
              fill="url(#rightWaveGrad1)"
              opacity="0.88"
            />
            {/* Rich Emerald Main Framing Wave */}
            <path
              d="M340 70 C 250 190, 180 340, 215 510 C 245 615, 290 685, 340 760 L 340 70 Z"
              fill="url(#rightWaveGrad2)"
            />
            <defs>
              <linearGradient id="rightWaveGrad1" x1="180" y1="0" x2="340" y2="760" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="40%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#15803d" />
              </linearGradient>
              <linearGradient id="rightWaveGrad2" x1="210" y1="70" x2="340" y2="760" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#16a34a" />
                <stop offset="60%" stopColor="#15803d" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Ambient Organic Bottom Waves (Emerald Gradient Flow) */}
        <div className="ref-wave-wrap" aria-hidden="true">
          <svg
            viewBox="0 0 1440 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            className="ref-wave-svg"
          >
            {/* Luminous Green Outer Wave */}
            <path
              d="M0 135 C 340 185, 620 120, 920 155 C 1160 180, 1320 110, 1440 55 L 1440 240 L 0 240 Z"
              fill="url(#waveNeonGrad)"
              opacity="0.9"
            />
            {/* Vibrant Emerald Main Wave */}
            <path
              d="M0 158 C 380 205, 680 142, 980 175 C 1220 200, 1360 125, 1440 85 L 1440 240 L 0 240 Z"
              fill="url(#waveEmeraldGrad)"
            />
            <defs>
              <linearGradient id="waveNeonGrad" x1="0" y1="135" x2="1440" y2="240" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#86efac" />
                <stop offset="45%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#16a34a" />
              </linearGradient>
              <linearGradient id="waveEmeraldGrad" x1="0" y1="158" x2="1440" y2="240" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#16a34a" />
                <stop offset="50%" stopColor="#15803d" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="ref-stage-grid">
          {/* ---------------------------------------------------------------------
              LEFT COLUMN: Platform Badge + Headlines + 4 Cards + Cursive Tagline
              --------------------------------------------------------------------- */}
          <section className="ref-left-col">
            {/* Launch Badge */}
            <div className="ref-launch-badge">
              <Rocket size={14} color="#15803d" />
              <span>Smart Grocery Management Platform</span>
            </div>

            {/* Main Headline */}
            <div className="ref-headlines">
              <h1 className="ref-main-heading">
                Welcome to Your <br />
                <span className="ref-heading-green">Supermarket</span> Portal
              </h1>
              <p className="ref-main-subtext">
                Smarter Operations. Happier Customers. Greater Growth.
              </p>
            </div>

            {/* 4 Feature Blocks (2x2 Grid with Arrows) */}
            <div className="ref-features-grid">
              {/* Card 1: Sales */}
              <div className="ref-feature-card">
                <div className="ref-feat-icon green">
                  <TrendingUp size={20} color="#15803d" />
                </div>
                <div className="ref-feat-meta">
                  <strong>Real-Time Sales</strong>
                  <span>Live store revenue &amp; analytics</span>
                </div>
                <div className="ref-feat-arrow">
                  <ArrowRight size={14} color="#15803d" />
                </div>
              </div>

              {/* Card 2: Inventory */}
              <div className="ref-feature-card">
                <div className="ref-feat-icon blue">
                  <Package size={20} color="#0284c7" />
                </div>
                <div className="ref-feat-meta">
                  <strong>Smart Inventory</strong>
                  <span>Low-stock alerts &amp; SKU tracking</span>
                </div>
                <div className="ref-feat-arrow">
                  <ArrowRight size={14} color="#0284c7" />
                </div>
              </div>

              {/* Card 3: Billing */}
              <div className="ref-feature-card">
                <div className="ref-feat-icon purple">
                  <Receipt size={20} color="#7c3aed" />
                </div>
                <div className="ref-feat-meta">
                  <strong>Easy Billing</strong>
                  <span>Instant POS checkout &amp; clearance</span>
                </div>
                <div className="ref-feat-arrow">
                  <ArrowRight size={14} color="#7c3aed" />
                </div>
              </div>

              {/* Card 4: CRM */}
              <div className="ref-feature-card">
                <div className="ref-feat-icon amber">
                  <Users size={20} color="#d97706" />
                </div>
                <div className="ref-feat-meta">
                  <strong>Customer CRM</strong>
                  <span>Manage profiles &amp; loyalty programs</span>
                </div>
                <div className="ref-feat-arrow">
                  <ArrowRight size={14} color="#d97706" />
                </div>
              </div>
            </div>

            {/* Cursive Brand Callout */}
            <div className="ref-cursive-wrap">
              <span className="ref-cursive-text">Shop Smart... Live Better...</span>
            </div>

            {/* 3 Trust Indicators */}
            <div className="ref-trust-pills-row">
              <div className="ref-trust-pill-item">
                <ShieldCheck size={15} color="#15803d" />
                <span>Secure &amp; Reliable</span>
              </div>
              <span className="ref-trust-sep">|</span>
              <div className="ref-trust-pill-item">
                <Zap size={15} color="#15803d" />
                <span>Fast &amp; Efficient</span>
              </div>
              <span className="ref-trust-sep">|</span>
              <div className="ref-trust-pill-item">
                <Handshake size={15} color="#15803d" />
                <span>Built for Growth</span>
              </div>
            </div>
          </section>

          {/* Center Shopping Trolley Foreground Showcase (Crisp Produce & Chrome Cart Matching Reference) */}
          <div className="ref-trolley-foreground" aria-hidden="true">
            <svg
              viewBox="0 0 340 300"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="ref-trolley-svg"
            >
              <defs>
                <linearGradient id="trolleyChrome" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f8fafc" />
                  <stop offset="50%" stopColor="#94a3b8" />
                  <stop offset="100%" stopColor="#475569" />
                </linearGradient>
                <linearGradient id="baguetteGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fef3c7" />
                  <stop offset="40%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#92400e" />
                </linearGradient>
                <linearGradient id="pepperRed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" />
                  <stop offset="60%" stopColor="#dc2626" />
                  <stop offset="100%" stopColor="#991b1b" />
                </linearGradient>
                <linearGradient id="pepperYellow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="60%" stopColor="#eab308" />
                  <stop offset="100%" stopColor="#ca8a04" />
                </linearGradient>
                <linearGradient id="pineappleBody" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fde047" />
                  <stop offset="70%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#78350f" />
                </linearGradient>
                <linearGradient id="leafGradTrolley" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ade80" />
                  <stop offset="100%" stopColor="#15803d" />
                </linearGradient>
              </defs>

              {/* Ambient Natural Ground Shadow resting on Green Wave */}
              <ellipse cx="170" cy="248" rx="105" ry="12" fill="#064e3b" opacity="0.32" />

              {/* 1. Trolley Undercarriage & Wheels Chassis */}
              <g stroke="#475569" strokeWidth="3.5" strokeLinecap="round">
                <path d="M 85 240 L 225 242 L 235 210 L 95 210 Z" fill="#334155" opacity="0.18" />
                <line x1="90" y1="210" x2="80" y2="242" stroke="url(#trolleyChrome)" />
                <line x1="225" y1="210" x2="235" y2="242" stroke="url(#trolleyChrome)" />
                <line x1="140" y1="210" x2="155" y2="242" stroke="url(#trolleyChrome)" />
                <line x1="75" y1="242" x2="240" y2="242" stroke="url(#trolleyChrome)" strokeWidth="4" />
              </g>

              {/* Wheels */}
              <g fill="#1e293b" stroke="#cbd5e1" strokeWidth="2">
                <circle cx="82" cy="244" r="9" />
                <circle cx="82" cy="244" r="3" fill="#ffffff" />
                <circle cx="236" cy="244" r="9" />
                <circle cx="236" cy="244" r="3" fill="#ffffff" />
                <circle cx="102" cy="248" r="8" opacity="0.7" />
                <circle cx="218" cy="248" r="8" opacity="0.7" />
              </g>

              {/* 2. Fresh Groceries & Produce (Layered inside basket) */}
              {/* Crusty French Baguette angled up */}
              <g transform="rotate(32 205 110)">
                <rect x="180" y="45" width="28" height="135" rx="14" fill="url(#baguetteGrad)" />
                <ellipse cx="194" cy="70" rx="9" ry="3" fill="#fef3c7" opacity="0.9" />
                <ellipse cx="194" cy="95" rx="9" ry="3" fill="#fef3c7" opacity="0.9" />
                <ellipse cx="194" cy="120" rx="9" ry="3" fill="#fef3c7" opacity="0.9" />
                <ellipse cx="194" cy="145" rx="9" ry="3" fill="#fef3c7" opacity="0.9" />
              </g>

              {/* Pineapple with lush green crown */}
              <g transform="translate(130, 75)">
                <path d="M 18 20 C 15 2, 8 -8, 2 -18 C 15 -10, 22 2, 24 18 Z" fill="#15803d" />
                <path d="M 24 18 C 24 -4, 30 -22, 32 -30 C 35 -18, 38 -2, 34 18 Z" fill="#22c55e" />
                <path d="M 32 18 C 36 2, 45 -10, 52 -18 C 44 -6, 38 4, 36 20 Z" fill="#166534" />
                <path d="M 22 18 C 26 0, 32 -14, 38 -24 C 36 -12, 30 2, 28 20 Z" fill="#4ade80" />
                <ellipse cx="30" cy="48" rx="22" ry="32" fill="url(#pineappleBody)" />
                <ellipse cx="30" cy="48" rx="20" ry="30" stroke="#78350f" strokeWidth="1" strokeDasharray="4 4" fill="none" />
              </g>

              {/* Fresh Greens & Curly Kale */}
              <g>
                <path d="M 85 155 C 70 140, 65 115, 80 95 C 105 105, 110 135, 100 160 Z" fill="url(#leafGradTrolley)" />
                <path d="M 100 160 C 90 135, 105 110, 125 105 C 135 125, 130 150, 110 165 Z" fill="#22c55e" opacity="0.9" />
                <path d="M 65 150 C 55 130, 70 115, 85 120 C 85 140, 75 155, 65 150 Z" fill="#86efac" />
              </g>

              {/* Glossy Red Bell Pepper */}
              <g transform="translate(155, 130)">
                <path d="M 12 8 C 8 2, 10 -4, 14 -8 C 16 -4, 17 2, 15 8 Z" fill="#15803d" />
                <path d="M 4 12 C 0 25, 8 46, 24 46 C 38 46, 44 25, 38 12 C 32 20, 10 20, 4 12 Z" fill="url(#pepperRed)" />
                <ellipse cx="14" cy="22" rx="4" ry="10" fill="#fca5a5" opacity="0.6" transform="rotate(-15 14 22)" />
              </g>

              {/* Glossy Yellow Bell Pepper */}
              <g transform="translate(195, 138)">
                <path d="M 12 8 C 8 2, 10 -4, 14 -8 C 16 -4, 17 2, 15 8 Z" fill="#15803d" />
                <path d="M 4 12 C 0 24, 7 42, 22 42 C 35 42, 40 24, 34 12 C 28 19, 10 19, 4 12 Z" fill="url(#pepperYellow)" />
                <ellipse cx="12" cy="20" rx="3" ry="8" fill="#fef9c3" opacity="0.7" transform="rotate(-15 12 20)" />
              </g>

              {/* Oranges & Citrus Fruits */}
              <circle cx="145" cy="170" r="15" fill="#f97316" />
              <circle cx="140" cy="165" r="4" fill="#fdba74" opacity="0.6" />
              <circle cx="178" cy="174" r="13" fill="#ea580c" />
              <circle cx="230" cy="166" r="14" fill="#fb923c" />

              {/* 3. Chrome Shopping Cart Metallic Wire Basket */}
              <g>
                <path
                  d="M 68 140 L 255 132 L 235 212 L 85 212 Z"
                  fill="rgba(255, 255, 255, 0.08)"
                  stroke="url(#trolleyChrome)"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                />

                {/* Horizontal Basket Wires */}
                <line x1="71" y1="155" x2="250" y2="148" stroke="#cbd5e1" strokeWidth="1.8" opacity="0.85" />
                <line x1="75" y1="170" x2="245" y2="164" stroke="#cbd5e1" strokeWidth="1.8" opacity="0.85" />
                <line x1="79" y1="185" x2="241" y2="180" stroke="#cbd5e1" strokeWidth="1.8" opacity="0.85" />
                <line x1="82" y1="200" x2="237" y2="196" stroke="#cbd5e1" strokeWidth="1.8" opacity="0.85" />

                {/* Vertical Basket Wires */}
                <line x1="90" y1="140" x2="98" y2="212" stroke="#cbd5e1" strokeWidth="1.5" opacity="0.75" />
                <line x1="110" y1="139" x2="116" y2="212" stroke="#cbd5e1" strokeWidth="1.5" opacity="0.75" />
                <line x1="130" y1="138" x2="134" y2="212" stroke="#cbd5e1" strokeWidth="1.5" opacity="0.75" />
                <line x1="150" y1="137" x2="152" y2="212" stroke="#cbd5e1" strokeWidth="1.5" opacity="0.75" />
                <line x1="170" y1="136" x2="170" y2="212" stroke="#cbd5e1" strokeWidth="1.5" opacity="0.75" />
                <line x1="190" y1="135" x2="188" y2="212" stroke="#cbd5e1" strokeWidth="1.5" opacity="0.75" />
                <line x1="210" y1="134" x2="206" y2="212" stroke="#cbd5e1" strokeWidth="1.5" opacity="0.75" />
                <line x1="230" y1="133" x2="224" y2="212" stroke="#cbd5e1" strokeWidth="1.5" opacity="0.75" />

                {/* Top Rim & Handle Strut */}
                <path
                  d="M 52 118 L 68 140 L 255 132"
                  stroke="url(#trolleyChrome)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                {/* Push Handle with Green Grip */}
                <rect x="42" y="112" width="22" height="9" rx="4.5" fill="#16a34a" stroke="#15803d" strokeWidth="1.5" />
              </g>
            </svg>
          </div>

          {/* ---------------------------------------------------------------------
              RIGHT COLUMN: Pristine White Floating Login Card
              --------------------------------------------------------------------- */}
          <section className="ref-right-col">
            <div className="ref-login-card">
              {/* Circular Emblem with Green Cart */}
              <div className="ref-card-avatar">
                <ShoppingCart size={28} color="#15803d" strokeWidth={2.4} />
                <Leaf size={13} color="#16a34a" className="ref-avatar-sprout" strokeWidth={2.8} />
              </div>

              {/* Title & Subtitle */}
              <h2 className="ref-card-title">GrocerEase</h2>
              <div className="ref-card-divider">
                <span className="ref-card-sub">Access your store dashboard</span>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="ref-error-alert" role="alert">
                  <AlertCircle size={15} color="#dc2626" style={{ flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="ref-form" autoComplete="off">
                {/* Field 1: Supermarket Name or ID */}
                <div className="ref-field">
                  <div className="ref-input-box">
                    <span className="ref-input-icon">
                      <Store size={18} color="#64748b" />
                    </span>
                    <input
                      ref={usernameInputRef}
                      type="text"
                      required
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (errorMessage) setErrorMessage("");
                      }}
                      placeholder="Supermarket Name or ID"
                      className="ref-input"
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* Field 2: Password */}
                <div className="ref-field">
                  <div className="ref-input-box">
                    <span className="ref-input-icon">
                      <Lock size={18} color="#64748b" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage("");
                      }}
                      placeholder="Password"
                      className="ref-input"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="ref-eye-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} color="#15803d" /> : <Eye size={18} color="#94a3b8" />}
                    </button>
                  </div>
                </div>

                {/* Options Row */}
                <div className="ref-options-row">
                  <label className="ref-remember">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="ref-checkbox"
                    />
                    <span>Remember Me</span>
                  </label>

                  <button
                    type="button"
                    className="ref-forgot-link"
                    onClick={() => setShowForgotModal(true)}
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Primary Action Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="ref-login-btn"
                >
                  {loading ? (
                    <span className="ref-spinner" />
                  ) : (
                    <>
                      <span>Login</span>
                      <div className="ref-btn-arrow">
                        <ArrowRight size={16} strokeWidth={2.8} />
                      </div>
                    </>
                  )}
                </button>
              </form>

              {/* Or Divider */}
              <div className="ref-or-divider">
                <span className="ref-or-line" />
                <span className="ref-or-text">or</span>
                <span className="ref-or-line" />
              </div>

              {/* Continue with Label */}
              <div className="ref-continue-label">Continue with</div>

              {/* 4 Social / SSO / Demo Icons Row */}
              <div className="ref-social-row">
                {/* Google */}
                <button
                  type="button"
                  className="ref-social-btn"
                  title="Google Login"
                  onClick={() => handleQuickFill("admin", "Admin@123")}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7 0-1.2.2-2 .4-2.7L1.6 6.4C.6 8.3 0 10.1 0 12c0 1.9.6 3.7 1.6 5.6l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16C3.5 19.8 7.4 23 12 23z"
                    />
                  </svg>
                </button>

                {/* Microsoft */}
                <button
                  type="button"
                  className="ref-social-btn"
                  title="Microsoft Login"
                  onClick={() => handleQuickFill("agila", "Agila@123")}
                >
                  <svg width="17" height="17" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M1 1h10v10H1z" />
                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                    <path fill="#ffba08" d="M12 12h10v10H12z" />
                  </svg>
                </button>

                {/* Apple */}
                <button
                  type="button"
                  className="ref-social-btn"
                  title="Apple Login"
                  onClick={() => handleQuickFill("pooja", "pooja@123")}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#0f172a">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.98.6-2.62 1.35-.56.65-.99 1.71-.86 2.73.99.08 2.02-.51 2.56-1.23z" />
                  </svg>
                </button>

                {/* Demo Logins Pill / Store */}
                <button
                  type="button"
                  className="ref-social-btn demo"
                  title="Quick Demo Accounts"
                  onClick={() => setShowDemoModal(true)}
                >
                  <KeyRound size={17} color="#15803d" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* =========================================================================
          3. BOTTOM GREEN FOOTER (Exact Match to Reference Image)
          ========================================================================= */}
      <footer className="ref-footer">
        <div className="ref-footer-inner">
          <div className="ref-footer-left">
            <ShieldCheck size={16} color="#86efac" />
            <span className="ref-footer-brand">GrocerEase</span>
            <span className="ref-footer-pipe">|</span>
            <span className="ref-footer-tag">Your Trusted Supermarket Partner</span>
          </div>

          <div className="ref-footer-right">
            &copy; 2025 GrocerEase. All rights reserved.
          </div>
        </div>
      </footer>

      {/* =========================================================================
          MODAL 1: Password Recovery
          ========================================================================= */}
      {showForgotModal && (
        <div className="ref-modal-backdrop" onClick={() => setShowForgotModal(false)}>
          <div className="ref-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ref-modal-header">
              <div className="ref-modal-icon">
                <Lock size={20} color="#15803d" />
              </div>
              <div>
                <h3 className="ref-modal-title">Password Recovery</h3>
                <p className="ref-modal-sub">Authorized credentials for Super Admin portal</p>
              </div>
              <button
                type="button"
                className="ref-modal-close"
                onClick={() => setShowForgotModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="ref-modal-body">
              <div className="ref-demo-card">
                <div className="ref-demo-head">
                  <strong>Central Super Admin</strong>
                  <span className="ref-pill sa">Root</span>
                </div>
                <div className="ref-demo-line">
                  <span>Username:</span> <code>admin</code>
                </div>
                <div className="ref-demo-line">
                  <span>Password:</span> <code>Admin@123</code>
                </div>
                <button
                  type="button"
                  className="ref-quick-fill-btn"
                  onClick={() => handleQuickFill("admin", "Admin@123")}
                >
                  Quick Fill Super Admin &rarr;
                </button>
              </div>
            </div>

            <div className="ref-modal-footer">
              <button
                type="button"
                className="ref-modal-btn"
                onClick={() => setShowForgotModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: Demo Credentials Directory
          ========================================================================= */}
      {showDemoModal && (
        <div className="ref-modal-backdrop" onClick={() => setShowDemoModal(false)}>
          <div className="ref-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ref-modal-header">
              <div className="ref-modal-icon">
                <KeyRound size={20} color="#15803d" />
              </div>
              <div>
                <h3 className="ref-modal-title">Supermarket Demo Accounts</h3>
                <p className="ref-modal-sub">Click any account to instant fill login credentials</p>
              </div>
              <button
                type="button"
                className="ref-modal-close"
                onClick={() => setShowDemoModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="ref-modal-body">
              {/* Super Admin */}
              <div className="ref-demo-card">
                <div className="ref-demo-head">
                  <strong>Central Super Admin</strong>
                  <span className="ref-pill sa">Super Admin</span>
                </div>
                <div className="ref-demo-line">
                  <span>User:</span> <code>admin</code> &bull; <span>Pass:</span> <code>Admin@123</code>
                </div>
                <button
                  type="button"
                  className="ref-quick-fill-btn"
                  onClick={() => handleQuickFill("admin", "Admin@123")}
                >
                  Fill Super Admin &rarr;
                </button>
              </div>

              {/* 24/7 Freshmart */}
              <div className="ref-demo-card">
                <div className="ref-demo-head">
                  <strong>24/7 Freshmart (Agila)</strong>
                  <span className="ref-pill store">STR-003</span>
                </div>
                <div className="ref-demo-line">
                  <span>User:</span> <code>agila</code> &bull; <span>Pass:</span> <code>Agila@123</code>
                </div>
                <button
                  type="button"
                  className="ref-quick-fill-btn"
                  onClick={() => handleQuickFill("agila", "Agila@123")}
                >
                  Fill 24/7 Freshmart &rarr;
                </button>
              </div>

              {/* GrocerEase */}
              <div className="ref-demo-card">
                <div className="ref-demo-head">
                  <strong>GrocerEase (Pooja)</strong>
                  <span className="ref-pill store">STR-001</span>
                </div>
                <div className="ref-demo-line">
                  <span>User:</span> <code>pooja</code> &bull; <span>Pass:</span> <code>pooja@123</code>
                </div>
                <button
                  type="button"
                  className="ref-quick-fill-btn"
                  onClick={() => handleQuickFill("pooja", "pooja@123")}
                >
                  Fill GrocerEase &rarr;
                </button>
              </div>

              {/* FreshMart */}
              <div className="ref-demo-card">
                <div className="ref-demo-head">
                  <strong>FreshMart (Rohan)</strong>
                  <span className="ref-pill store">STR-002</span>
                </div>
                <div className="ref-demo-line">
                  <span>User:</span> <code>storeb</code> &bull; <span>Pass:</span> <code>StoreB@123</code>
                </div>
                <button
                  type="button"
                  className="ref-quick-fill-btn"
                  onClick={() => handleQuickFill("storeb", "StoreB@123")}
                >
                  Fill FreshMart &rarr;
                </button>
              </div>

              {/* Akshaya */}
              <div className="ref-demo-card">
                <div className="ref-demo-head">
                  <strong>Akshaya Supermarket</strong>
                  <span className="ref-pill store">SM-7087</span>
                </div>
                <div className="ref-demo-line">
                  <span>User:</span> <code>akshaya</code> &bull; <span>Pass:</span> <code>Akshaya@123</code>
                </div>
                <button
                  type="button"
                  className="ref-quick-fill-btn"
                  onClick={() => handleQuickFill("akshaya", "Akshaya@123")}
                >
                  Fill Akshaya &rarr;
                </button>
              </div>
            </div>

            <div className="ref-modal-footer">
              <button
                type="button"
                className="ref-modal-btn"
                onClick={() => setShowDemoModal(false)}
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
