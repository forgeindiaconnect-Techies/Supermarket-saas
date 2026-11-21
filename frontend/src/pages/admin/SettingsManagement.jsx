import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  Phone,
  Store,
  ShieldCheck,
  Crown,
  Camera,
  Lock,
  Edit3,
  Check,
  X,
  Home,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  MapPin,
  Sparkles,
} from "lucide-react";
import API from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "./ProductManagement.css";
import "./SettingsManagement.css";

// Helper to extract clean 10 digits from any phone string
const extract10Digits = (phoneStr) => {
  if (!phoneStr) return "";
  const digits = String(phoneStr).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
};

export default function SettingsManagement() {
  const { user, currentSupermarket } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // Store & Admin details state
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [storeCity, setStoreCity] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePlan, setStorePlan] = useState("Standard");
  const [storeLogo, setStoreLogo] = useState("");

  // Initial state for Cancel reset
  const [initialData, setInitialData] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
  });

  // Password section state
  const [showPasswordSection, setShowPasswordSection] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Load authenticated Store Admin profile with strict tenant scoping
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await API.get("/auth/me");
        if (res.data?.success && res.data.user) {
          const u = res.data.user;
          const sm = res.data.supermarket || currentSupermarket;

          const uName = u?.name || sm?.adminName || "";
          const uUsername = (u?.username || sm?.adminUsername || "").toLowerCase();
          const uEmail = (u?.email || sm?.email || "").toLowerCase();
          const uPhone = extract10Digits(u?.phone || sm?.phone || "");

          setFullName(uName);
          setUsername(uUsername);
          setEmail(uEmail);
          setPhone(uPhone);

          setStoreName(sm?.name || u?.supermarketName || "Supermarket");
          setStoreCode(sm?.code || u?.supermarketCode || "");
          setStoreCity(sm?.city || "");
          setStoreAddress(sm?.address || "");
          setStorePlan(sm?.plan || "Standard");
          setStoreLogo(sm?.logoUrl || "");

          setInitialData({
            fullName: uName,
            username: uUsername,
            email: uEmail,
            phone: uPhone,
          });
        }
      } catch (err) {
        console.warn("Store profile fetch notice:", err.message);
        // Fallback to authContext data
        if (user) {
          setFullName(user.name || "");
          setUsername((user.username || "").toLowerCase());
          setEmail((user.email || "").toLowerCase());
          setPhone(extract10Digits(user.phone || ""));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [currentSupermarket, user]);

  const showToastMsg = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 4000);
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value.toLowerCase().replace(/\s+/g, ""));
  };

  // Strictly accept only digits and strictly max 10 digits
  const handlePhoneChange = (e) => {
    let clean = e.target.value.replace(/\D/g, "");
    if (clean.length === 12 && clean.startsWith("91")) {
      clean = clean.slice(2);
    }
    if (clean.length > 10) {
      clean = clean.slice(0, 10);
    }
    setPhone(clean);
  };

  const handlePhonePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData?.getData("text") || "";
    let clean = pasted.replace(/\D/g, "");
    if (clean.length === 12 && clean.startsWith("91")) {
      clean = clean.slice(2);
    }
    if (clean.length > 10) {
      clean = clean.slice(0, 10);
    }
    setPhone(clean);
  };

  const handlePhoneKeyDown = (e) => {
    const allowedKeys = [
      "Backspace",
      "Delete",
      "Tab",
      "Escape",
      "Enter",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ];
    if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
      return;
    }
    // Block any non-digit keypress
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    // Block typing beyond 10 digits unless text is highlighted to replace
    const selectionLength = (e.target.selectionEnd || 0) - (e.target.selectionStart || 0);
    if (phone.length >= 10 && selectionLength === 0) {
      e.preventDefault();
    }
  };

  const handleCancel = () => {
    setFullName(initialData.fullName);
    setUsername(initialData.username);
    setEmail(initialData.email);
    setPhone(initialData.phone);
    setShowPasswordSection(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPass(false);
    setShowNewPass(false);
    setShowConfirmPass(false);
    showToastMsg("Changes reverted to original profile.", "info");
  };

  const handleUpdatePassword = async (e) => {
    if (e) e.preventDefault();

    if (!currentPassword) {
      showToastMsg("Current Password is required.", "error");
      return;
    }
    if (!newPassword) {
      showToastMsg("New Password is required.", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToastMsg("New password must be at least 6 characters long.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToastMsg("New password and confirm password do not match.", "error");
      return;
    }
    if (currentPassword === newPassword) {
      showToastMsg("New password cannot be the same as your current password.", "error");
      return;
    }

    try {
      setUpdatingPassword(true);
      const res = await API.post("/auth/change-password", {
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res.data?.success) {
        showToastMsg(
          "✓ Password updated successfully! Super Admin has been notified.",
          "success"
        );
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowCurrentPass(false);
        setShowNewPass(false);
        setShowConfirmPass(false);
      }
    } catch (err) {
      console.error("Change password error:", err);
      showToastMsg(
        err.response?.data?.message || "Failed to update password. Please verify your current password.",
        "error"
      );
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSaveChanges = async (e) => {
    if (e) e.preventDefault();

    if (!fullName.trim()) {
      showToastMsg("Full Name is required.", "error");
      return;
    }
    if (!email.trim()) {
      showToastMsg("Registered Email Address is required.", "error");
      return;
    }

    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    if (!emailRegex.test(email.trim().toLowerCase())) {
      showToastMsg("Please enter a valid lowercase email address.", "error");
      return;
    }

    if (!phone || phone.trim().length !== 10) {
      showToastMsg("Mobile Number must be exactly 10 digits.", "error");
      return;
    }

    if (showPasswordSection && (newPassword || currentPassword || confirmPassword)) {
      if (!currentPassword) {
        showToastMsg("Please enter your current password to proceed.", "error");
        return;
      }
      if (newPassword.length < 6) {
        showToastMsg("New password must be at least 6 characters long.", "error");
        return;
      }
      if (newPassword !== confirmPassword) {
        showToastMsg("New password and confirmation do not match.", "error");
        return;
      }
    }

    try {
      setSaving(true);
      const formattedPhone = `+91 ${phone.trim()}`;
      const payload = {
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: formattedPhone,
      };

      if (showPasswordSection && newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await API.put("/auth/profile", payload);
      if (res.data?.success) {
        showToastMsg("✓ Supermarket Admin profile updated successfully!", "success");
        setInitialData({
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
        });

        // Sync local storage user
        try {
          const currentU = JSON.parse(localStorage.getItem("grocerease_user") || "{}");
          const updatedU = {
            ...currentU,
            name: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: formattedPhone,
          };
          localStorage.setItem("grocerease_user", JSON.stringify(updatedU));
          window.dispatchEvent(new Event("grocerease_storage_updated"));
        } catch (_) {}

        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordSection(false);
      }
    } catch (err) {
      console.error("Store admin profile save error:", err);
      showToastMsg(
        err.response?.data?.message || "Failed to update profile. Please verify your current password.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page-wrapper">
      {/* Toast Notification */}
      {toast.show && (
        <div
          style={{
            position: "fixed",
            bottom: "28px",
            right: "28px",
            background: toast.type === "error" ? "#dc2626" : toast.type === "info" ? "#2563eb" : "#1e40af",
            color: "#ffffff",
            padding: "14px 22px",
            borderRadius: "14px",
            boxShadow: "0 14px 35px rgba(0,0,0,0.22)",
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
            <CheckCircle2 size={18} color="#60a5fa" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. Header with Breadcrumb - Enclosed White Card Box */}
      <div className="settings-header-box">
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "#dbeafe",
              color: "#1d4ed8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(37, 99, 235, 0.15)",
              border: "1.5px solid #93c5fd",
            }}
          >
            <Store size={26} strokeWidth={2.4} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
              My Profile
            </h1>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.86rem", color: "#64748b" }}>
              Manage your supermarket profile information and admin credentials
            </p>
          </div>
        </div>

        {/* Breadcrumb */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.82rem",
            color: "#64748b",
            background: "#ffffff",
            padding: "8px 14px",
            borderRadius: "10px",
            border: "1.5px solid #bfdbfe",
            boxShadow: "0 2px 6px rgba(37, 99, 235, 0.04)",
          }}
        >
          <Home size={14} color="#2563eb" />
          <span style={{ color: "#94a3b8" }}>/</span>
          <span>Settings</span>
          <span style={{ color: "#94a3b8" }}>/</span>
          <strong style={{ color: "#1e40af" }}>My Profile</strong>
        </div>
      </div>

      {/* 2. Main Two-Column Profile Grid */}
      <div className="settings-profile-main-grid">
        {/* Left Column: Supermarket & Admin Card (Blue & Navy SaaS Theme) */}
        <div className="settings-left-card">
          {/* Logo or Store Initial */}
          <div style={{ position: "relative", marginBottom: "1.25rem" }}>
            <div
              style={{
                width: "104px",
                height: "104px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
                fontWeight: 800,
                letterSpacing: "0.05em",
                boxShadow: "0 8px 24px rgba(37, 99, 235, 0.28)",
                border: "4px solid #ffffff",
                overflow: "hidden",
              }}
            >
              {storeLogo ? (
                <img
                  src={storeLogo}
                  alt={storeName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <span>{storeName ? storeName.charAt(0).toUpperCase() : "S"}</span>
              )}
            </div>
            <button
              type="button"
              title="Store Logo / Photo"
              style={{
                position: "absolute",
                bottom: "2px",
                right: "2px",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#1e40af",
                color: "#ffffff",
                border: "2.5px solid #ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              }}
              onClick={() => showToastMsg("Logo synced with Super Admin registry.", "info")}
            >
              <Camera size={15} />
            </button>
          </div>

          {/* Supermarket Name */}
          <h2 style={{ margin: "0 0 4px 0", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>
            {storeName || "Supermarket"}
          </h2>

          <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600, marginBottom: "1rem" }}>
            Admin: {fullName || "Store Admin"}
          </div>

          {/* Badges: Store Admin & Plan */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginBottom: "1.5rem" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "#eff6ff",
                color: "#1e40af",
                padding: "3px 12px",
                borderRadius: "9999px",
                fontSize: "0.76rem",
                fontWeight: 800,
                border: "1px solid #bfdbfe",
              }}
            >
              <Crown size={13} color="#2563eb" />
              <span>Store Admin</span>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "#dbeafe",
                color: "#1d4ed8",
                padding: "3px 12px",
                borderRadius: "9999px",
                fontSize: "0.76rem",
                fontWeight: 800,
                border: "1px solid #bfdbfe",
              }}
            >
              <Sparkles size={13} color="#2563eb" />
              <span>{storePlan} Plan</span>
            </div>
          </div>

          {/* Details List */}
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "0.9rem",
              padding: "1.25rem 0",
              borderTop: "1px solid #e2e8f0",
              borderBottom: "1px solid #e2e8f0",
              marginBottom: "1.5rem",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#2563eb",
                  flexShrink: 0,
                }}
              >
                <Building2 size={16} />
              </div>
              <span style={{ fontSize: "0.85rem", color: "#334155", fontWeight: 700 }}>
                Tenant ID: {storeCode}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#2563eb",
                  flexShrink: 0,
                }}
              >
                <Mail size={16} />
              </div>
              <span style={{ fontSize: "0.85rem", color: "#334155", fontWeight: 600, wordBreak: "break-all" }}>
                {email || "admin@store.com"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#2563eb",
                  flexShrink: 0,
                }}
              >
                <Phone size={16} />
              </div>
              <span style={{ fontSize: "0.85rem", color: "#334155", fontWeight: 600 }}>
                {phone ? `+91 ${phone}` : "+91 9876543210"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#2563eb",
                  flexShrink: 0,
                }}
              >
                <MapPin size={16} />
              </div>
              <span style={{ fontSize: "0.85rem", color: "#334155", fontWeight: 600 }}>
                {storeCity} &bull; {storeAddress}
              </span>
            </div>
          </div>

          {/* Multi-Tenant Cryptographic Isolation Status */}
          <div
            style={{
              width: "100%",
              background: "#eff6ff",
              border: "1.5px solid #bfdbfe",
              borderRadius: "14px",
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "10px",
                background: "#2563eb",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={20} strokeWidth={2.4} />
            </div>
            <span style={{ fontSize: "0.8rem", color: "#1e40af", fontWeight: 750, lineHeight: 1.35 }}>
              Dedicated isolated tenant workspace. Profile data is protected.
            </span>
          </div>

          {/* Purchase Channels Availability (Fixed Policy by Super Admin) */}
          <div
            style={{
              width: "100%",
              marginTop: "12px",
              background: "#f8fafc",
              border: "1.5px solid #e2e8f0",
              borderRadius: "14px",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#334155" }}>
                Store Purchase Channels
              </span>
              <span style={{ fontSize: "0.72rem", color: "#64748b", background: "#e2e8f0", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                Fixed Policy
              </span>
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  backgroundColor: currentSupermarket?.onlineAvailable === true ? "#dcfce7" : currentSupermarket?.onlineAvailable === false ? "#fee2e2" : "#f1f5f9",
                  color: currentSupermarket?.onlineAvailable === true ? "#15803d" : currentSupermarket?.onlineAvailable === false ? "#b91c1c" : "#64748b",
                  border: `1px solid ${currentSupermarket?.onlineAvailable === true ? "#86efac" : currentSupermarket?.onlineAvailable === false ? "#fca5a5" : "#cbd5e1"}`,
                }}
              >
                Online: {currentSupermarket?.onlineAvailable === true ? "Available" : currentSupermarket?.onlineAvailable === false ? "Not Available" : "Not Configured"}
              </span>
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  backgroundColor: currentSupermarket?.offlineAvailable === true ? "#dcfce7" : currentSupermarket?.offlineAvailable === false ? "#fee2e2" : "#f1f5f9",
                  color: currentSupermarket?.offlineAvailable === true ? "#15803d" : currentSupermarket?.offlineAvailable === false ? "#b91c1c" : "#64748b",
                  border: `1px solid ${currentSupermarket?.offlineAvailable === true ? "#86efac" : currentSupermarket?.offlineAvailable === false ? "#fca5a5" : "#cbd5e1"}`,
                }}
              >
                Offline: {currentSupermarket?.offlineAvailable === true ? "Available" : currentSupermarket?.offlineAvailable === false ? "Not Available" : "Not Configured"}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b", lineHeight: 1.35 }}>
              Configured exclusively by Platform Super Admin during onboarding. Store Admin cannot override these channels.
            </p>
          </div>
        </div>

        {/* Right Column: Edit Profile Form */}
        <div className="settings-right-card">
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "1.75rem",
              paddingBottom: "1rem",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#eff6ff",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #bfdbfe",
              }}
            >
              <Edit3 size={18} strokeWidth={2.4} />
            </div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>
              Edit Store Admin Profile
            </h2>
          </div>

          <form onSubmit={handleSaveChanges} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Store Name & Branch Code */}
            <div className="settings-form-row-2col">
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Supermarket Name
                </label>
                <input
                  type="text"
                  value={storeName}
                  disabled
                  readOnly
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: "#0f172a",
                    cursor: "not-allowed",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Branch Unique Code
                </label>
                <input
                  type="text"
                  value={storeCode}
                  disabled
                  readOnly
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid #bfdbfe",
                    background: "#eff6ff",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: "#1e40af",
                    cursor: "not-allowed",
                  }}
                />
              </div>
            </div>

            {/* Admin Full Name */}
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                Admin Full Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onFocus={(e) => {
                  e.target.style.borderColor = "#2563eb";
                  e.target.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#cbd5e1";
                  e.target.style.boxShadow = "none";
                }}
                placeholder="Store Admin Name"
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "#0f172a",
                  outline: "none",
                  transition: "all 0.15s ease",
                }}
              />
            </div>

            {/* Username */}
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                Admin Username <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#2563eb" }}>
                  <User size={16} />
                </span>
                <input
                  type="text"
                  value={username}
                  disabled
                  readOnly
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 40px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: "#64748b",
                    cursor: "not-allowed",
                  }}
                />
              </div>
            </div>

            {/* Registered Email */}
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                Registered Email Address <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#2563eb" }}>
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#2563eb";
                    e.target.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.15)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#cbd5e1";
                    e.target.style.boxShadow = "none";
                  }}
                  placeholder="admin@store.com"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 40px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: "#0f172a",
                    outline: "none",
                    transition: "all 0.15s ease",
                  }}
                />
              </div>
              <small style={{ color: "#64748b", fontSize: "11px", marginTop: "4px", display: "block" }}>
                Strict lowercase enforced. Subscription and account notifications will be sent to this email.
              </small>
            </div>

            {/* Mobile Number */}
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                Mobile Number <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#2563eb", pointerEvents: "none" }}>
                  <Phone size={16} />
                </span>
                <span
                  style={{
                    position: "absolute",
                    left: "38px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    color: "#475569",
                    borderRight: "1.5px solid #cbd5e1",
                    paddingRight: "8px",
                    lineHeight: "18px",
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                >
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={phone}
                  onChange={handlePhoneChange}
                  onKeyDown={handlePhoneKeyDown}
                  onPaste={handlePhonePaste}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#2563eb";
                    e.target.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.15)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#cbd5e1";
                    e.target.style.boxShadow = "none";
                  }}
                  placeholder="9876543210"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 80px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: "#0f172a",
                    outline: "none",
                    letterSpacing: "0.5px",
                    transition: "all 0.15s ease",
                  }}
                />
              </div>
              <small style={{ color: "#64748b", fontSize: "11px", marginTop: "4px", display: "block" }}>
                Enter exactly 10 digits ({phone.length}/10 digits). Numbers beyond 10 digits are blocked.
              </small>
            </div>

            {/* Change Admin Password Section */}
            <div
              style={{
                border: "1.5px solid #bfdbfe",
                borderRadius: "16px",
                padding: "20px 22px",
                background: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
                boxShadow: "0 2px 10px rgba(37, 99, 235, 0.04)",
              }}
            >
              {/* Card Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: "#eff6ff",
                      color: "#2563eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1.5px solid #bfdbfe",
                      boxShadow: "0 2px 6px rgba(37, 99, 235, 0.12)",
                    }}
                  >
                    <Lock size={20} strokeWidth={2.4} />
                  </div>
                  <div>
                    <strong style={{ fontSize: "0.98rem", color: "#0f172a", display: "block" }}>
                      Change Admin Password
                    </strong>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Update and secure your store admin login credentials
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#eff6ff",
                    color: "#1e40af",
                    border: "1px solid #bfdbfe",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    fontSize: "0.76rem",
                    fontWeight: 750,
                  }}
                >
                  <ShieldCheck size={14} color="#2563eb" />
                  <span>Secure Bcrypt Hash</span>
                </div>
              </div>

              {/* 3 Password Fields Grid */}
              <div className="settings-password-grid">
                {/* 1. Current Password */}
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Current Password <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showCurrentPass ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      onFocus={(e) => {
                        e.target.style.borderColor = "#2563eb";
                        e.target.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.15)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#cbd5e1";
                        e.target.style.boxShadow = "none";
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 42px 10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.88rem",
                        color: "#0f172a",
                        background: "#ffffff",
                        outline: "none",
                        transition: "all 0.15s ease",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      title={showCurrentPass ? "Hide current password" : "Show current password"}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        padding: "4px",
                      }}
                    >
                      {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "#64748b", marginTop: "3px", display: "block" }}>
                    Verify your existing password
                  </span>
                </div>

                {/* 2. New Password */}
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    New Password <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showNewPass ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      onFocus={(e) => {
                        e.target.style.borderColor = "#2563eb";
                        e.target.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.15)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#cbd5e1";
                        e.target.style.boxShadow = "none";
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 42px 10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.88rem",
                        color: "#0f172a",
                        background: "#ffffff",
                        outline: "none",
                        transition: "all 0.15s ease",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      title={showNewPass ? "Hide new password" : "Show new password"}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        padding: "4px",
                      }}
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "#64748b", marginTop: "3px", display: "block" }}>
                    Must be at least 6 characters
                  </span>
                </div>

                {/* 3. Confirm Password */}
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Confirm Password <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showConfirmPass ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      onFocus={(e) => {
                        e.target.style.borderColor = "#2563eb";
                        e.target.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.15)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#cbd5e1";
                        e.target.style.boxShadow = "none";
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 42px 10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.88rem",
                        color: "#0f172a",
                        background: "#ffffff",
                        outline: "none",
                        transition: "all 0.15s ease",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      title={showConfirmPass ? "Hide confirm password" : "Show confirm password"}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        padding: "4px",
                      }}
                    >
                      {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmPassword && (
                    <span
                      style={{
                        fontSize: "0.74rem",
                        marginTop: "3px",
                        display: "block",
                        fontWeight: 700,
                        color: newPassword === confirmPassword ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {newPassword === confirmPassword ? "✓ Passwords match" : "✕ Passwords do not match"}
                    </span>
                  )}
                  {!confirmPassword && (
                    <span style={{ fontSize: "0.74rem", color: "#64748b", marginTop: "3px", display: "block" }}>
                      Matches new password
                    </span>
                  )}
                </div>
              </div>

              {/* Dedicated Update Password Button */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: "10px",
                  paddingTop: "8px",
                  borderTop: "1px dashed #cbd5e1",
                }}
              >
                <button
                  type="button"
                  onClick={handleUpdatePassword}
                  disabled={updatingPassword || !currentPassword || !newPassword || !confirmPassword}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    background:
                      updatingPassword || !currentPassword || !newPassword || !confirmPassword
                        ? "#94a3b8"
                        : "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
                    color: "#ffffff",
                    border: "none",
                    padding: "9px 22px",
                    borderRadius: "10px",
                    fontSize: "0.85rem",
                    fontWeight: 750,
                    cursor:
                      updatingPassword || !currentPassword || !newPassword || !confirmPassword
                        ? "not-allowed"
                        : "pointer",
                    boxShadow:
                      updatingPassword || !currentPassword || !newPassword || !confirmPassword
                        ? "none"
                        : "0 4px 14px rgba(37, 99, 235, 0.28)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Lock size={15} />
                  <span>{updatingPassword ? "Updating Password..." : "Update Password"}</span>
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="settings-action-buttons-row">
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  background: "#1e40af",
                  color: "#ffffff",
                  border: "none",
                  padding: "11px 28px",
                  borderRadius: "10px",
                  fontSize: "0.92rem",
                  fontWeight: 800,
                  cursor: saving ? "wait" : "pointer",
                  boxShadow: "0 4px 14px rgba(30, 64, 175, 0.35)",
                  minWidth: "160px",
                }}
              >
                <Check size={18} strokeWidth={2.4} />
                <span>{saving ? "Saving..." : "Save Changes"}</span>
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  background: "#ffffff",
                  color: "#334155",
                  border: "1.5px solid #cbd5e1",
                  padding: "11px 28px",
                  borderRadius: "10px",
                  fontSize: "0.92rem",
                  fontWeight: 750,
                  cursor: "pointer",
                  minWidth: "130px",
                }}
              >
                <X size={18} strokeWidth={2.4} />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
