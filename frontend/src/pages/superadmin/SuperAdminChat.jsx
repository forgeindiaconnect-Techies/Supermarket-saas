import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Send,
  MessageSquare,
  Search,
  Building2,
  Crown,
  Check,
  CheckCheck,
  Clock,
  Sparkles,
  Phone,
  Mail,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Filter,
  User,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Layers,
} from "lucide-react";
import { io } from "socket.io-client";
import API from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "./SuperAdmin.css";

// Formats timestamp for conversation list: "Today, 01:25 PM" or "16 Nov, 01:25 PM"
function formatConvTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";

  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  if (isToday) return `Today, ${timeStr}`;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = d.getDate();
  const month = months[d.getMonth()];
  return `${day} ${month}, ${timeStr}`;
}

// Formats timestamp for individual chat bubbles
function formatBubbleTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";

  const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return `Today, ${timeStr}`;
  }
  return `${day} ${month} ${year}, ${timeStr}`;
}

export default function SuperAdminChat() {
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "unread" | "new" | "replied" | "resolved"
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const selectedStoreRef = useRef(selectedStore);

  useEffect(() => {
    selectedStoreRef.current = selectedStore;
  }, [selectedStore]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. Fetch all supermarket conversations dynamically from database
  const fetchConversations = async (autoSelectFirst = true) => {
    try {
      setLoadingList(true);
      const res = await API.get("/chat/conversations");
      if (res.data?.success && Array.isArray(res.data.conversations)) {
        setConversations(res.data.conversations);

        // Auto-select first supermarket or preserve active selection
        if (autoSelectFirst && res.data.conversations.length > 0 && !selectedStoreRef.current) {
          handleSelectSupermarket(res.data.conversations[0]);
        } else if (selectedStoreRef.current) {
          const updatedActive = res.data.conversations.find(
            (c) => String(c.supermarketId) === String(selectedStoreRef.current.supermarketId)
          );
          if (updatedActive) {
            setSelectedStore(updatedActive);
            selectedStoreRef.current = updatedActive;
          }
        }
      }
    } catch (err) {
      console.warn("Fetch conversations notice:", err.message);
    } finally {
      setLoadingList(false);
    }
  };

  // 2. Select a Supermarket to load private thread
  const handleSelectSupermarket = async (store) => {
    setSelectedStore(store);
    selectedStoreRef.current = store;
    setInputText("");
    setStatusDropdownOpen(false);

    try {
      setLoadingMessages(true);
      const res = await API.get(`/chat/messages/${store.supermarketId}`);
      if (res.data?.success) {
        setMessages(res.data.messages || []);
        setTimeout(scrollToBottom, 60);

        // Mark incoming messages as read in database
        API.put(`/chat/read/${store.supermarketId}`).catch(() => {});

        // Clear local unread badge and refresh status
        setConversations((prev) =>
          prev.map((c) =>
            c.supermarketId === store.supermarketId
              ? {
                  ...c,
                  unreadCount: 0,
                  chatStatus: c.chatStatus === "Unread" ? "Replied" : c.chatStatus,
                }
              : c
          )
        );
      }
    } catch (err) {
      console.warn("Fetch store messages notice:", err.message);
    } finally {
      setLoadingMessages(false);
    }
  };

  // 3. Update Chat Status (New, Unread, Replied, Resolved)
  const handleUpdateStatus = async (newStatus) => {
    if (!selectedStore) return;
    setStatusDropdownOpen(false);

    try {
      const res = await API.put(`/chat/status/${selectedStore.supermarketId}`, { status: newStatus });
      if (res.data?.success) {
        setSelectedStore((prev) => ({ ...prev, chatStatus: newStatus }));
        setConversations((prev) =>
          prev.map((c) =>
            c.supermarketId === selectedStore.supermarketId ? { ...c, chatStatus: newStatus } : c
          )
        );
      }
    } catch (err) {
      console.error("Update status error:", err);
      alert(err.response?.data?.message || "Failed to update chat status.");
    }
  };

  // 4. Setup Socket.IO listener for real-time multi-tenant messages
  useEffect(() => {
    fetchConversations(true);

    const socket = io("http://localhost:5001", {
      transports: ["websocket", "polling"],
      auth: {
        role: "SUPER_ADMIN",
        supermarketCode: "ALL",
        token: localStorage.getItem("grocerease_auth_token") || "",
      },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-tenant", { role: "SUPER_ADMIN", supermarketCode: "ALL" });
    });

    socket.on("chat:new_message", (msg) => {
      const currentActive = selectedStoreRef.current;
      const isCurrentThread = currentActive && String(currentActive.supermarketId) === String(msg.supermarketId);

      // Append message if looking at this supermarket
      if (isCurrentThread) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        setTimeout(scrollToBottom, 60);

        if (msg.senderRole === "STORE_ADMIN") {
          API.put(`/chat/read/${msg.supermarketId}`).catch(() => {});
        }
      }

      // Update directory preview, status and unread counter
      setConversations((prev) => {
        return prev.map((c) => {
          if (String(c.supermarketId) === String(msg.supermarketId)) {
            const willBeUnread = !isCurrentThread && msg.senderRole === "STORE_ADMIN";
            return {
              ...c,
              latestMessage: {
                text: msg.message,
                createdAt: msg.createdAt,
                senderRole: msg.senderRole,
                senderName: msg.senderName,
              },
              unreadCount: willBeUnread ? (c.unreadCount || 0) + 1 : 0,
              chatStatus: msg.senderRole === "SUPER_ADMIN" ? "Replied" : (willBeUnread ? "Unread" : "Replied"),
            };
          }
          return c;
        });
      });
    });

    socket.on("chat:status_updated", ({ supermarketId, chatStatus }) => {
      setConversations((prev) =>
        prev.map((c) => (String(c.supermarketId) === String(supermarketId) ? { ...c, chatStatus } : c))
      );
      if (selectedStoreRef.current && String(selectedStoreRef.current.supermarketId) === String(supermarketId)) {
        setSelectedStore((prev) => ({ ...prev, chatStatus }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 5. Send Reply directly to the selected Supermarket
  const handleSendReply = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedStore || sending) return;

    const textToSend = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const res = await API.post("/chat/send", {
        supermarketId: selectedStore.supermarketId,
        message: textToSend,
      });

      if (res.data?.success && res.data.chatMessage) {
        const newMsg = res.data.chatMessage;
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });

        // Update latest message and status in conversation list
        setConversations((prev) =>
          prev.map((c) =>
            c.supermarketId === selectedStore.supermarketId
              ? {
                  ...c,
                  chatStatus: "Replied",
                  latestMessage: {
                    text: textToSend,
                    createdAt: new Date().toISOString(),
                    senderRole: "SUPER_ADMIN",
                    senderName: "GrocerEase Super Admin",
                  },
                }
              : c
          )
        );

        setSelectedStore((prev) => ({ ...prev, chatStatus: "Replied" }));
        setTimeout(scrollToBottom, 60);
      }
    } catch (err) {
      console.error("Super Admin send reply error:", err);
      setInputText(textToSend);
      alert(err.response?.data?.message || "Failed to send reply. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Status Filter Counts
  const counts = useMemo(() => {
    const res = {
      all: conversations.length,
      unread: 0,
      new: 0,
      replied: 0,
      resolved: 0,
    };
    conversations.forEach((c) => {
      const st = (c.chatStatus || "new").toLowerCase();
      if (c.unreadCount > 0 || st === "unread") {
        res.unread += 1;
      }
      if (st === "new") res.new += 1;
      if (st === "replied") res.replied += 1;
      if (st === "resolved") res.resolved += 1;
    });
    return res;
  }, [conversations]);

  // Filtered Conversations based on search query and status filter
  const filteredConversations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter((c) => {
      // 1. Search matching
      const matchesSearch =
        !q ||
        c.supermarketName.toLowerCase().includes(q) ||
        c.supermarketCode.toLowerCase().includes(q) ||
        (c.adminName && c.adminName.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // 2. Status filter matching
      const st = (c.chatStatus || "new").toLowerCase();
      if (statusFilter === "all") return true;
      if (statusFilter === "unread") return c.unreadCount > 0 || st === "unread";
      if (statusFilter === "new") return st === "new";
      if (statusFilter === "replied") return st === "replied";
      if (statusFilter === "resolved") return st === "resolved";
      return true;
    });
  }, [conversations, searchQuery, statusFilter]);

  // Render Status Badge Pill
  const renderStatusBadge = (status, unreadCount = 0) => {
    const normalized = (status || "New").toLowerCase();

    if (unreadCount > 0 || normalized === "unread") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "#fef2f2",
            color: "#dc2626",
            border: "1px solid #fecaca",
            padding: "2px 8px",
            borderRadius: "9999px",
            fontSize: "0.68rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.3px",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#dc2626",
              boxShadow: "0 0 6px #dc2626",
            }}
          />
          <span>Unread</span>
        </span>
      );
    }

    if (normalized === "new") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "#eff6ff",
            color: "#1d4ed8",
            border: "1px solid #bfdbfe",
            padding: "2px 8px",
            borderRadius: "9999px",
            fontSize: "0.68rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.3px",
          }}
        >
          <Sparkles size={10} color="#2563eb" />
          <span>New</span>
        </span>
      );
    }

    if (normalized === "replied") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "#ecfdf5",
            color: "#047857",
            border: "1px solid #a7f3d0",
            padding: "2px 8px",
            borderRadius: "9999px",
            fontSize: "0.68rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.3px",
          }}
        >
          <Check size={11} color="#059669" strokeWidth={2.4} />
          <span>Replied</span>
        </span>
      );
    }

    // Resolved
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          background: "#f1f5f9",
          color: "#475569",
          border: "1px solid #cbd5e1",
          padding: "2px 8px",
          borderRadius: "9999px",
          fontSize: "0.68rem",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.3px",
        }}
      >
        <CheckCircle2 size={11} color="#64748b" />
        <span>Resolved</span>
      </span>
    );
  };

  return (
    <div className="sa-page-container" style={{ maxWidth: "1440px", margin: "0 auto", paddingBottom: "2rem" }}>
      {/* 1. Header with Live SaaS Platform Communications Badge */}
      <div className="sa-page-header">
        <div className="sa-page-header-content">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span className="sa-badge active">Multi-Tenant Communications</span>
            <span style={{ fontSize: "12px", color: "#64748b" }}>Dedicated Two-Way Supermarket Channels</span>
          </div>
          <h1 style={{ margin: "0 0 4px 0", fontSize: "1.45rem", fontWeight: 800, color: "#0f172a" }}>
            Supermarket Support &amp; Chat Management
          </h1>
          <p style={{ margin: 0, fontSize: "0.86rem", color: "#64748b" }}>
            Centralized multi-tenant communication console. Easily identify each supermarket, monitor chat status, and send instant real-time replies.
          </p>
        </div>

        <div className="sa-page-header-actions">
          <button
            type="button"
            className="sa-btn-secondary"
            onClick={() => fetchConversations(false)}
            title="Refresh conversations"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 16px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={15} className={loadingList ? "spin-icon" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Main Two-Column Chat Command Center */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "390px 1fr",
          gap: "1.25rem",
          height: "calc(100vh - 250px)",
          minHeight: "620px",
        }}
      >
        {/* ================= Left Column: Supermarket Conversation Directory ================= */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 2px 12px rgba(15, 23, 42, 0.04)",
          }}
        >
          {/* Search Bar */}
          <div style={{ padding: "14px 16px 10px 16px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ position: "relative" }}>
              <Search
                size={15}
                color="#94a3b8"
                style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search supermarket, ID, admin or email..."
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 36px",
                  borderRadius: "10px",
                  border: "1.5px solid #cbd5e1",
                  fontSize: "0.85rem",
                  outline: "none",
                  fontWeight: 500,
                  color: "#0f172a",
                }}
              />
            </div>

            {/* Status Filter Tabs (All, Unread/Needs Reply, New, Replied, Resolved) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                marginTop: "10px",
                overflowX: "auto",
                paddingBottom: "2px",
              }}
            >
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                style={{
                  padding: "5px 10px",
                  borderRadius: "8px",
                  border: statusFilter === "all" ? "1.5px solid #065f46" : "1px solid #e2e8f0",
                  background: statusFilter === "all" ? "#065f46" : "#ffffff",
                  color: statusFilter === "all" ? "#ffffff" : "#475569",
                  fontSize: "0.74rem",
                  fontWeight: 750,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>All</span>
                <span style={{ opacity: 0.85 }}>({counts.all})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("unread")}
                style={{
                  padding: "5px 10px",
                  borderRadius: "8px",
                  border: statusFilter === "unread" ? "1.5px solid #dc2626" : "1px solid #fecaca",
                  background: statusFilter === "unread" ? "#dc2626" : "#fef2f2",
                  color: statusFilter === "unread" ? "#ffffff" : "#b91c1c",
                  fontSize: "0.74rem",
                  fontWeight: 750,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>Unread</span>
                <span
                  style={{
                    background: statusFilter === "unread" ? "rgba(255,255,255,0.25)" : "#dc2626",
                    color: "#ffffff",
                    borderRadius: "9999px",
                    padding: "1px 5px",
                    fontSize: "0.65rem",
                    fontWeight: 800,
                  }}
                >
                  {counts.unread}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("new")}
                style={{
                  padding: "5px 10px",
                  borderRadius: "8px",
                  border: statusFilter === "new" ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                  background: statusFilter === "new" ? "#2563eb" : "#eff6ff",
                  color: statusFilter === "new" ? "#ffffff" : "#1d4ed8",
                  fontSize: "0.74rem",
                  fontWeight: 750,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>New</span>
                <span>({counts.new})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("replied")}
                style={{
                  padding: "5px 10px",
                  borderRadius: "8px",
                  border: statusFilter === "replied" ? "1.5px solid #059669" : "1px solid #e2e8f0",
                  background: statusFilter === "replied" ? "#059669" : "#ecfdf5",
                  color: statusFilter === "replied" ? "#ffffff" : "#047857",
                  fontSize: "0.74rem",
                  fontWeight: 750,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>Replied</span>
                <span>({counts.replied})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("resolved")}
                style={{
                  padding: "5px 10px",
                  borderRadius: "8px",
                  border: statusFilter === "resolved" ? "1.5px solid #475569" : "1px solid #e2e8f0",
                  background: statusFilter === "resolved" ? "#475569" : "#f1f5f9",
                  color: statusFilter === "resolved" ? "#ffffff" : "#475569",
                  fontSize: "0.74rem",
                  fontWeight: 750,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>Resolved</span>
                <span>({counts.resolved})</span>
              </button>
            </div>
          </div>

          {/* Supermarket Conversation List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingList ? (
              <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                <RefreshCw size={20} className="spin-icon" style={{ marginBottom: "8px" }} />
                <div>Loading conversations from database...</div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: "#64748b" }}>
                <MessageSquare size={32} color="#cbd5e1" style={{ marginBottom: "8px" }} />
                <h4 style={{ margin: "0 0 4px 0", color: "#0f172a", fontSize: "0.95rem" }}>No conversations found</h4>
                <p style={{ margin: 0, fontSize: "0.8rem" }}>
                  Try adjusting your search query or status filter.
                </p>
              </div>
            ) : (
              filteredConversations.map((store) => {
                const isSelected = selectedStore?.supermarketId === store.supermarketId;
                const hasUnread = store.unreadCount > 0;

                return (
                  <div
                    key={store.supermarketId}
                    onClick={() => handleSelectSupermarket(store)}
                    style={{
                      padding: "13px 15px",
                      borderBottom: "1px solid #f1f5f9",
                      background: isSelected ? "#f0fdf4" : hasUnread ? "#fff8f8" : "#ffffff",
                      borderLeft: isSelected
                        ? "4px solid #16a34a"
                        : hasUnread
                        ? "4px solid #ef4444"
                        : "4px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {/* Top Row: Store Logo, Name, ID & Status Badge */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      {/* Logo / Avatar */}
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "12px",
                          background: isSelected ? "#065f46" : "#dcfce7",
                          color: isSelected ? "#ffffff" : "#16a34a",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 850,
                          fontSize: "14px",
                          flexShrink: 0,
                          border: "1.5px solid #bbf7d0",
                          overflow: "hidden",
                        }}
                      >
                        {store.logoUrl ? (
                          <img
                            src={store.logoUrl}
                            alt={store.supermarketName}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          store.supermarketName.charAt(0).toUpperCase()
                        )}
                      </div>

                      {/* Store Name, Unique ID & Status */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                          <strong
                            style={{
                              fontSize: "0.92rem",
                              color: "#0f172a",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              letterSpacing: "-0.01em",
                            }}
                            title={store.supermarketName}
                          >
                            {store.supermarketName}
                          </strong>

                          {/* Chat Status Badge */}
                          {renderStatusBadge(store.chatStatus, store.unreadCount)}
                        </div>

                        {/* Unique ID & Plan */}
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                          <span
                            style={{
                              background: "#dcfce7",
                              color: "#15803d",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              fontSize: "0.68rem",
                              fontWeight: 800,
                              letterSpacing: "0.2px",
                            }}
                          >
                            {store.supermarketCode}
                          </span>
                          <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                            {store.plan} Plan
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle Row: Admin Name, Email & Phone */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "0.72rem",
                        color: "#64748b",
                        background: isSelected ? "rgba(255,255,255,0.7)" : "#f8fafc",
                        padding: "5px 8px",
                        borderRadius: "6px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <User size={12} color="#16a34a" />
                        <span style={{ fontWeight: 650, color: "#334155" }}>{store.adminName}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Mail size={12} color="#94a3b8" />
                        <span style={{ wordBreak: "break-all" }}>{store.email}</span>
                      </div>
                      {store.phone && (
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Phone size={11} color="#94a3b8" />
                          <span>{store.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Last Message Preview, Time & Unread Badge */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.78rem",
                          color: hasUnread ? "#0f172a" : "#64748b",
                          fontWeight: hasUnread ? 750 : 450,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "220px",
                        }}
                      >
                        {store.latestMessage ? (
                          <>
                            <span style={{ color: store.latestMessage.senderRole === "SUPER_ADMIN" ? "#047857" : "#0284c7", fontWeight: 700 }}>
                              {store.latestMessage.senderRole === "SUPER_ADMIN" ? "You: " : `${store.adminName.split(" ")[0]}: `}
                            </span>
                            <span>{store.latestMessage.text}</span>
                          </>
                        ) : (
                          <span style={{ fontStyle: "italic", color: "#94a3b8" }}>No messages yet</span>
                        )}
                      </p>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {store.latestMessage && (
                          <span style={{ fontSize: "0.68rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                            {formatConvTime(store.latestMessage.createdAt)}
                          </span>
                        )}

                        {hasUnread && (
                          <span
                            style={{
                              background: "#dc2626",
                              color: "#ffffff",
                              fontSize: "0.68rem",
                              fontWeight: 850,
                              borderRadius: "9999px",
                              padding: "2px 7px",
                              lineHeight: 1,
                              boxShadow: "0 2px 6px rgba(220, 38, 38, 0.4)",
                            }}
                          >
                            {store.unreadCount} New
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= Right Column: Private Supermarket Thread ================= */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 2px 12px rgba(15, 23, 42, 0.04)",
          }}
        >
          {selectedStore ? (
            <>
              {/* Selected Supermarket Header with Full Details */}
              <div
                style={{
                  padding: "16px 22px",
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "14px",
                }}
              >
                {/* Store Profile Details */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "14px",
                      background: "#065f46",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 850,
                      fontSize: "17px",
                      border: "2px solid #bbf7d0",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {selectedStore.logoUrl ? (
                      <img
                        src={selectedStore.logoUrl}
                        alt={selectedStore.supermarketName}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      selectedStore.supermarketName.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div>
                    {/* Supermarket Name & Unique ID */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <h2 style={{ margin: 0, fontSize: "1.18rem", fontWeight: 850, color: "#0f172a" }}>
                        {selectedStore.supermarketName}
                      </h2>
                      <span
                        style={{
                          background: "#dcfce7",
                          color: "#15803d",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          border: "1px solid #86efac",
                          letterSpacing: "0.3px",
                        }}
                      >
                        ID: {selectedStore.supermarketCode}
                      </span>
                      {renderStatusBadge(selectedStore.chatStatus, selectedStore.unreadCount)}
                    </div>

                    {/* Admin Contact Details Row */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        fontSize: "0.8rem",
                        color: "#475569",
                        marginTop: "4px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <User size={13} color="#16a34a" />
                        <strong>Admin:</strong> {selectedStore.adminName}
                      </span>
                      <span>&bull;</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Mail size={13} color="#16a34a" />
                        <strong>Email:</strong> {selectedStore.email}
                      </span>
                      {selectedStore.phone && (
                        <>
                          <span>&bull;</span>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Phone size={13} color="#16a34a" />
                            <strong>Contact:</strong> {selectedStore.phone}
                          </span>
                        </>
                      )}
                      <span>&bull;</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Crown size={13} color="#d97706" />
                        <span>{selectedStore.plan} Plan</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Toggle & Tenant Security Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}>
                  {/* Status Dropdown Menu */}
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setStatusDropdownOpen((prev) => !prev)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 12px",
                        borderRadius: "8px",
                        border: "1.5px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#1e293b",
                        fontSize: "0.78rem",
                        fontWeight: 750,
                        cursor: "pointer",
                      }}
                    >
                      <span>Status:</span>
                      <strong style={{ color: "#065f46" }}>{selectedStore.chatStatus || "New"}</strong>
                      <ChevronDown size={14} color="#64748b" />
                    </button>

                    {statusDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 4px)",
                          right: 0,
                          width: "160px",
                          background: "#ffffff",
                          borderRadius: "10px",
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
                          padding: "4px",
                          zIndex: 50,
                        }}
                      >
                        {["New", "Unread", "Replied", "Resolved"].map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleUpdateStatus(st)}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "7px 10px",
                              borderRadius: "6px",
                              border: "none",
                              background: selectedStore.chatStatus === st ? "#f0fdf4" : "transparent",
                              color: selectedStore.chatStatus === st ? "#16a34a" : "#334155",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            <span>{st}</span>
                            {selectedStore.chatStatus === st && <Check size={14} color="#16a34a" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tenant Line Security Pill */}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      background: "#f0fdf4",
                      border: "1.5px solid #bbf7d0",
                      color: "#15803d",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "0.76rem",
                      fontWeight: 750,
                    }}
                  >
                    <ShieldCheck size={14} color="#16a34a" />
                    <span>Tenant Isolated</span>
                  </span>
                </div>
              </div>

              {/* Messages History Area */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "1.5rem",
                  background: "#fdfefe",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {loadingMessages ? (
                  <div style={{ margin: "auto", color: "#64748b", fontSize: "14px", textAlign: "center" }}>
                    <RefreshCw size={20} className="spin-icon" style={{ marginBottom: "6px" }} />
                    <div>Loading private message history...</div>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ margin: "auto", textAlign: "center", color: "#64748b", padding: "2rem" }}>
                    <div
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "16px",
                        background: "#ecfdf5",
                        color: "#16a34a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 12px auto",
                      }}
                    >
                      <MessageSquare size={28} />
                    </div>
                    <h3 style={{ margin: "0 0 6px 0", color: "#0f172a", fontSize: "1.05rem" }}>
                      Direct Communication Channel Active
                    </h3>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", maxWidth: "340px" }}>
                      Send an official reply or welcome notice to <strong>{selectedStore.supermarketName}</strong>. All messages are securely isolated to this supermarket.
                    </p>
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isSuperAdmin = m.senderRole === "SUPER_ADMIN";
                    return (
                      <div
                        key={m._id || idx}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: isSuperAdmin ? "flex-end" : "flex-start",
                        }}
                      >
                        {/* Sender Label */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginBottom: "3px",
                            padding: "0 4px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 750,
                              color: isSuperAdmin ? "#059669" : "#0284c7",
                            }}
                          >
                            {isSuperAdmin
                              ? "GrocerEase Super Admin (You)"
                              : `${selectedStore.supermarketName} (${selectedStore.adminName})`}
                          </span>
                          {!isSuperAdmin && (
                            <span
                              style={{
                                background: "#e0f2fe",
                                color: "#0369a1",
                                fontSize: "0.62rem",
                                fontWeight: 800,
                                padding: "1px 5px",
                                borderRadius: "4px",
                              }}
                            >
                              {selectedStore.supermarketCode}
                            </span>
                          )}
                        </div>

                        {/* Bubble */}
                        <div
                          style={{
                            maxWidth: "75%",
                            padding: "11px 16px",
                            borderRadius: isSuperAdmin ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                            background: isSuperAdmin ? "#065f46" : "#ffffff",
                            color: isSuperAdmin ? "#ffffff" : "#0f172a",
                            border: isSuperAdmin ? "none" : "1.5px solid #e2e8f0",
                            boxShadow: isSuperAdmin
                              ? "0 3px 12px rgba(6, 95, 70, 0.22)"
                              : "0 2px 8px rgba(15, 23, 42, 0.05)",
                            fontSize: "0.9rem",
                            lineHeight: 1.5,
                            wordBreak: "break-word",
                          }}
                        >
                          {m.message}
                        </div>

                        {/* Accurate Timestamp & Read Receipt */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            marginTop: "3px",
                            padding: "0 4px",
                            fontSize: "0.68rem",
                            color: "#94a3b8",
                          }}
                        >
                          <Clock size={11} color="#94a3b8" />
                          <span>{formatBubbleTime(m.createdAt)}</span>
                          {isSuperAdmin && (
                            <span style={{ display: "inline-flex", alignItems: "center", marginLeft: "2px" }}>
                              {m.isRead ? (
                                <CheckCheck size={13} color="#16a34a" title="Read by Store Admin" />
                              ) : (
                                <Check size={13} color="#94a3b8" title="Delivered to Store" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer Bar */}
              <form
                onSubmit={handleSendReply}
                style={{
                  padding: "14px 20px",
                  background: "#ffffff",
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Reply to ${selectedStore.supermarketName} (ID: ${selectedStore.supermarketCode})...`}
                  disabled={sending}
                  style={{
                    flex: 1,
                    padding: "11px 16px",
                    borderRadius: "12px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    outline: "none",
                    color: "#0f172a",
                    transition: "border 0.15s ease",
                  }}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || sending}
                  style={{
                    background: inputText.trim() && !sending ? "#065f46" : "#cbd5e1",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "12px",
                    padding: "11px 24px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.88rem",
                    fontWeight: 800,
                    cursor: inputText.trim() && !sending ? "pointer" : "not-allowed",
                    boxShadow: inputText.trim() && !sending ? "0 4px 14px rgba(6, 95, 70, 0.28)" : "none",
                    transition: "all 0.15s ease",
                    minWidth: "100px",
                    justifyContent: "center",
                  }}
                >
                  <span>{sending ? "Sending..." : "Reply"}</span>
                  <Send size={15} />
                </button>
              </form>
            </>
          ) : (
            <div style={{ margin: "auto", textAlign: "center", color: "#64748b", padding: "2rem" }}>
              <Building2 size={40} color="#cbd5e1" style={{ marginBottom: "12px" }} />
              <h3 style={{ margin: "0 0 6px 0", color: "#0f172a" }}>Select a Supermarket</h3>
              <p style={{ margin: 0, fontSize: "0.86rem", maxWidth: "340px" }}>
                Select a registered supermarket from the left directory to track messages and send private replies.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
