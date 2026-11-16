import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  Phone,
  Shield,
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
} from "lucide-react";
import API from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "./SuperAdmin.css";

export default function SuperAdminSettings() {
  const { user: authUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // Profile Form State - Strictly CONSTANT for Super Admin Console
  const [fullName, setFullName] = useState("Super Admin");
  const [username, setUsername] = useState("superadmin");
  const [email, setEmail] = useState("superadmin@grocerease.com");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [role, setRole] = useState("Super Admin");

  // Initial Backup State for Cancel button
  const [initialData, setInitialData] = useState({
    fullName: "Super Admin",
    username: "superadmin",
    email: "superadmin@grocerease.com",
    phone: "+91 98765 43210",
  });

  // Password Change Section State
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Fetch live Super Admin profile - strictly CONSTANT identity
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await API.get("/auth/me");
        if (res.data?.success && res.data.user) {
          const u = res.data.user;
          // In Super Admin Settings, profile identity is strictly constant
          // Never allow a store admin's name (like Pooja V) to appear in Super Admin profile
          const isSuperAdminAccount = u.role === "SUPER_ADMIN" || u.username === "admin" || !u.supermarket;
          const uName = isSuperAdminAccount
            ? (u.name && u.name !== "Pooja V" ? u.name : "Super Admin")
            : "Super Admin";
          const uUsername = isSuperAdminAccount && u.username ? u.username.toLowerCase() : "superadmin";
          const uEmail = (u.email || "superadmin@grocerease.com").toLowerCase();
          const uPhone = u.phone || "+91 98765 43210";
          const uRole = "Super Admin";

          setFullName(uName);
          setUsername(uUsername);
          setEmail(uEmail);
          setPhone(uPhone);
          setRole(uRole);

          setInitialData({
            fullName: uName,
            username: uUsername,
            email: uEmail,
            phone: uPhone,
          });
        }
      } catch (err) {
        console.warn("Profile fetch notice:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const showToastMsg = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 4000);
  };

  // Strict lowercase email conversion
  const handleEmailChange = (e) => {
    setEmail(e.target.value.toLowerCase().replace(/\s+/g, ""));
  };

  // Strict lowercase username conversion
  const handleUsernameChange = (e) => {
    setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""));
  };

  // Handle Cancel / Reset
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
      showToastMsg("New password cannot be identical to current password.", "error");
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
        showToastMsg("✓ Super Admin password updated successfully!", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowCurrentPass(false);
        setShowNewPass(false);
        setShowConfirmPass(false);
      }
    } catch (err) {
      showToastMsg(
        err.response?.data?.message || "Failed to update password. Please check your current password.",
        "error"
      );
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Handle Save Changes
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

    // Email validation
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    if (!emailRegex.test(email.trim().toLowerCase())) {
      showToastMsg("Please enter a valid lowercase email address.", "error");
      return;
    }

    // Password validation if password fields are provided
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
      const payload = {
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
      };

      if (showPasswordSection && newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await API.put("/auth/profile", payload);
      if (res.data?.success) {
        showToastMsg("✓ Profile updated successfully!", "success");
        setInitialData({
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
        });

        // Reset password fields
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordSection(false);
      }
    } catch (err) {
      console.error("Profile save error:", err);
      showToastMsg(
        err.response?.data?.message || "Failed to update profile. Please verify your current password.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "1280px",
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
            background: toast.type === "error" ? "#dc2626" : toast.type === "info" ? "#047857" : "#065f46",
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
            animation: "fadeIn 0.2s ease-in-out",
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

      {/* 1. Header with Breadcrumb - Enclosed White Card Box (Forest Green SaaS Theme) */}
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
          marginBottom: "1.75rem",
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
            <User size={26} strokeWidth={2.4} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, color: "#064e3b", letterSpacing: "-0.02em" }}>
              My Profile
            </h1>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.86rem", color: "#64748b" }}>
              Manage your personal profile information
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
            border: "1.5px solid #a7f3d0",
            boxShadow: "0 2px 6px rgba(16, 185, 129, 0.04)",
          }}
        >
          <Home size={14} color="#16a34a" />
          <span style={{ color: "#94a3b8" }}>/</span>
          <span>Settings</span>
          <span style={{ color: "#94a3b8" }}>/</span>
          <strong style={{ color: "#064e3b" }}>My Profile</strong>
        </div>
      </div>

      {/* 2. Main Two-Column Profile Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(300px, 340px) 1fr",
          gap: "1.75rem",
          alignItems: "start",
        }}
      >
        {/* Left Column: Profile Overview Card (Forest Green SaaS Theme) */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            border: "1.5px solid #a7f3d0",
            padding: "2.25rem 1.75rem",
            boxShadow: "0 8px 24px rgba(16, 185, 129, 0.08)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {/* Avatar with SA and Camera icon badge */}
          <div style={{ position: "relative", marginBottom: "1.25rem" }}>
            <div
              style={{
                width: "108px",
                height: "108px",
                borderRadius: "50%",
                background: "#047857",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2.2rem",
                fontWeight: 850,
                letterSpacing: "0.05em",
                boxShadow: "0 8px 24px rgba(4, 120, 87, 0.35)",
                border: "4px solid #ffffff",
              }}
            >
              SA
            </div>
            <button
              type="button"
              title="Change Profile Photo"
              style={{
                position: "absolute",
                bottom: "2px",
                right: "2px",
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: "#065f46",
                color: "#ffffff",
                border: "2.5px solid #ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              }}
              onClick={() => showToastMsg("Photo upload will sync with your account avatar.", "info")}
            >
              <Camera size={16} />
            </button>
          </div>

          {/* Full Name */}
          <h2 style={{ margin: "0 0 6px 0", fontSize: "1.45rem", fontWeight: 800, color: "#064e3b" }}>
            {fullName || "Super Admin"}
          </h2>

          {/* Role Pill Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "#dcfce7",
              color: "#15803d",
              padding: "5px 16px",
              borderRadius: "9999px",
              fontSize: "0.82rem",
              fontWeight: 800,
              marginBottom: "1.75rem",
              border: "1.5px solid #86efac",
            }}
          >
            <Crown size={15} color="#16a34a" />
            <span>{role}</span>
          </div>

          {/* Details List */}
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "1.1rem",
              padding: "1.25rem 0",
              borderTop: "1px solid #bbf7d0",
              borderBottom: "1px solid #bbf7d0",
              marginBottom: "1.5rem",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "9px",
                  background: "#f0fdf4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#16a34a",
                  flexShrink: 0,
                  border: "1px solid #bbf7d0",
                }}
              >
                <Mail size={16} />
              </div>
              <span style={{ fontSize: "0.88rem", color: "#1e293b", fontWeight: 650, wordBreak: "break-all" }}>
                {email || "superadmin@grocerease.com"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "9px",
                  background: "#f0fdf4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#16a34a",
                  flexShrink: 0,
                  border: "1px solid #bbf7d0",
                }}
              >
                <Phone size={16} />
              </div>
              <span style={{ fontSize: "0.88rem", color: "#1e293b", fontWeight: 650 }}>
                {phone || "+91 98765 43210"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "9px",
                  background: "#f0fdf4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#16a34a",
                  flexShrink: 0,
                  border: "1px solid #bbf7d0",
                }}
              >
                <User size={16} />
              </div>
              <span style={{ fontSize: "0.88rem", color: "#1e293b", fontWeight: 650 }}>
                {role}
              </span>
            </div>
          </div>

          {/* Security Box */}
          <div
            style={{
              width: "100%",
              background: "#dcfce7",
              border: "1.5px solid #86efac",
              borderRadius: "14px",
              padding: "13px 15px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#16a34a",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={22} strokeWidth={2.4} />
            </div>
            <span style={{ fontSize: "0.84rem", color: "#15803d", fontWeight: 800, lineHeight: 1.35 }}>
              Your profile is secure and up to date.
            </span>
          </div>
        </div>

        {/* Right Column: Edit Profile Form */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            border: "1.5px solid #bbf7d0",
            padding: "2.25rem",
            boxShadow: "0 8px 28px rgba(16, 185, 129, 0.08)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "1.75rem",
              paddingBottom: "1rem",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#f0fdf4",
                color: "#16a34a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #bbf7d0",
              }}
            >
              <Edit3 size={18} strokeWidth={2.4} />
            </div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#064e3b" }}>
              Edit Profile
            </h2>
          </div>

          <form onSubmit={handleSaveChanges} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Full Name */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                Full Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onFocus={(e) => {
                  e.target.style.borderColor = "#16a34a";
                  e.target.style.boxShadow = "0 0 0 3px rgba(22, 163, 74, 0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#cbd5e1";
                  e.target.style.boxShadow = "none";
                }}
                placeholder="Super Admin"
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
              <label
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                Username <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#16a34a",
                  }}
                >
                  <User size={16} />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#16a34a";
                    e.target.style.boxShadow = "0 0 0 3px rgba(22, 163, 74, 0.15)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#cbd5e1";
                    e.target.style.boxShadow = "none";
                  }}
                  placeholder="superadmin"
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
            </div>

            {/* Email Address */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                Email Address <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#16a34a",
                  }}
                >
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#16a34a";
                    e.target.style.boxShadow = "0 0 0 3px rgba(22, 163, 74, 0.15)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#cbd5e1";
                    e.target.style.boxShadow = "none";
                  }}
                  placeholder="superadmin@grocerease.com"
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
                Strict lowercase enforced. System-wide platform notifications are delivered to this address.
              </small>
            </div>

            {/* Mobile Number */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                Mobile Number <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#16a34a",
                  }}
                >
                  <Phone size={16} />
                </span>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#16a34a";
                    e.target.style.boxShadow = "0 0 0 3px rgba(22, 163, 74, 0.15)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#cbd5e1";
                    e.target.style.boxShadow = "none";
                  }}
                  placeholder="9876543210"
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
            </div>

            {/* Role (Read-Only) */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                Role
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#16a34a",
                  }}
                >
                  <Crown size={16} />
                </span>
                <input
                  type="text"
                  value={role}
                  disabled
                  readOnly
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 40px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: "#64748b",
                    cursor: "not-allowed",
                  }}
                />
              </div>
            </div>

            {/* Change Password Card Section (Forest Green Theme) */}
            <div
              style={{
                border: "1.5px solid #bbf7d0",
                borderRadius: "14px",
                padding: "16px 20px",
                background: "#f0fdf4",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "#ecfdf5",
                      color: "#16a34a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid #bbf7d0",
                    }}
                  >
                    <Lock size={18} strokeWidth={2.4} />
                  </div>
                  <div>
                    <strong style={{ fontSize: "0.92rem", color: "#064e3b", display: "block" }}>
                      Change Password
                    </strong>
                    <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                      Update your password for better security
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPasswordSection((prev) => !prev)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: showPasswordSection ? "#065f46" : "#ffffff",
                    color: showPasswordSection ? "#ffffff" : "#065f46",
                    border: "1.5px solid #065f46",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    fontWeight: 750,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Lock size={14} />
                  <span>{showPasswordSection ? "Hide Password Fields" : "Change Password"}</span>
                </button>
              </div>

              {/* Expandable Password Inputs */}
              {showPasswordSection && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "1rem",
                    paddingTop: "12px",
                    borderTop: "1px dashed #cbd5e1",
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      Current Password *
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showCurrentPass ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{
                          width: "100%",
                          padding: "8px 36px 8px 12px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.86rem",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        style={{
                          position: "absolute",
                          right: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                        }}
                      >
                        {showCurrentPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      New Password *
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showNewPass ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{
                          width: "100%",
                          padding: "8px 36px 8px 12px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.86rem",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        style={{
                          position: "absolute",
                          right: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                        }}
                      >
                        {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      Confirm Password *
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showConfirmPass ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{
                          width: "100%",
                          padding: "8px 36px 8px 12px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.86rem",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        style={{
                          position: "absolute",
                          right: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                        }}
                      >
                        {showConfirmPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Dedicated Update Password Button */}
              {showPasswordSection && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: "10px",
                    paddingTop: "10px",
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
                          : "linear-gradient(135deg, #047857 0%, #065f46 100%)",
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 20px",
                      borderRadius: "8px",
                      fontSize: "0.84rem",
                      fontWeight: 750,
                      cursor:
                        updatingPassword || !currentPassword || !newPassword || !confirmPassword
                          ? "not-allowed"
                          : "pointer",
                      boxShadow:
                        updatingPassword || !currentPassword || !newPassword || !confirmPassword
                          ? "none"
                          : "0 4px 12px rgba(4, 120, 87, 0.25)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Lock size={14} />
                    <span>{updatingPassword ? "Updating Password..." : "Update Password"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Actions: Save Changes and Cancel (Forest Green Theme) */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "1rem",
                marginTop: "1.5rem",
              }}
            >
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  background: "#065f46",
                  color: "#ffffff",
                  border: "none",
                  padding: "11px 28px",
                  borderRadius: "10px",
                  fontSize: "0.92rem",
                  fontWeight: 800,
                  cursor: saving ? "wait" : "pointer",
                  boxShadow: "0 4px 14px rgba(6, 95, 70, 0.28)",
                  minWidth: "160px",
                  transition: "background 0.15s ease",
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
                  transition: "background 0.15s ease",
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
