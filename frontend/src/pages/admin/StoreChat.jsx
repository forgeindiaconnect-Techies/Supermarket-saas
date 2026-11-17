import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  MessageSquare,
  Shield,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  Building2,
  Sparkles,
  Phone,
  Mail,
  HelpCircle,
  Crown,
} from "lucide-react";
import { io } from "socket.io-client";
import API, { SOCKET_URL } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "./ProductManagement.css";

export default function StoreChat() {
  const { user, currentSupermarket } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [storeInfo, setStoreInfo] = useState({
    id: currentSupermarket?._id || "",
    name: currentSupermarket?.name || "Supermarket",
    code: currentSupermarket?.code || "",
  });

  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. Initial Load of Messages & Socket Connection
  useEffect(() => {
    let isMounted = true;

    const fetchChatHistory = async () => {
      try {
        setLoading(true);
        // Get fresh user and supermarket identity
        const meRes = await API.get("/auth/me");
        if (meRes.data?.success) {
          const sm = meRes.data.supermarket || currentSupermarket;
          if (sm) {
            setStoreInfo({
              id: sm._id,
              name: sm.name,
              code: sm.code,
            });
          }
        }

        const res = await API.get("/chat/messages");
        if (res.data?.success && isMounted) {
          setMessages(res.data.messages || []);
          setTimeout(scrollToBottom, 100);

          // Mark unread Super Admin messages as read
          if (res.data.supermarketId) {
            API.put(`/chat/read/${res.data.supermarketId}`).catch(() => {});
          }
        }
      } catch (err) {
        console.warn("Fetch chat error:", err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchChatHistory();

    // 2. Setup Socket.IO for real-time private chat
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: {
        role: "STORE_ADMIN",
        supermarketId: currentSupermarket?._id || "",
        supermarketCode: currentSupermarket?.code || "",
        token: localStorage.getItem("grocerease_auth_token") || "",
      },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-tenant", {
        role: "STORE_ADMIN",
        supermarketId: currentSupermarket?._id,
        supermarketCode: currentSupermarket?.code,
      });
    });

    socket.on("chat:new_message", (msg) => {
      if (!isMounted) return;
      setMessages((prev) => {
        // Prevent duplicate append
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      setTimeout(scrollToBottom, 80);

      // If message came from Super Admin, mark as read
      if (msg.senderRole === "SUPER_ADMIN" && msg.supermarketId) {
        API.put(`/chat/read/${msg.supermarketId}`).catch(() => {});
      }
    });

    return () => {
      isMounted = false;
      socket.disconnect();
    };
  }, [currentSupermarket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 3. Send Message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;

    const textToSend = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const res = await API.post("/chat/send", {
        message: textToSend,
      });

      if (res.data?.success && res.data.chatMessage) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === res.data.chatMessage._id)) return prev;
          return [...prev, res.data.chatMessage];
        });
        setTimeout(scrollToBottom, 80);
      }
    } catch (err) {
      console.error("Send message error:", err);
      // Revert text on failure
      setInputText(textToSend);
      alert(err.response?.data?.message || "Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "1.5rem 1rem 2.5rem 1rem" }}>
      {/* 1. Header with Breadcrumb & Supermarket Badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
            }}
          >
            <MessageSquare size={26} strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, color: "#0f172a" }}>
                Super Admin Chat
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "#dcfce7",
                  color: "#15803d",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  fontSize: "0.72rem",
                  fontWeight: 750,
                }}
              >
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
                Online &bull; Private Line
              </span>
            </div>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
              Direct encrypted communication channel with GrocerEase Super Admin
            </p>
          </div>
        </div>

        {/* Store Identifier Badge */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 2px 6px rgba(15, 23, 42, 0.04)",
          }}
        >
          <Building2 size={16} color="#059669" />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.86rem", fontWeight: 750, color: "#0f172a" }}>
              {storeInfo.name}
            </div>
            <div style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 600 }}>
              Tenant ID: {storeInfo.code || "Branch"}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Chat Box Container */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "20px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 20px rgba(15, 23, 42, 0.05)",
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 270px)",
          minHeight: "520px",
          overflow: "hidden",
        }}
      >
        {/* Chat Window Top Bar */}
        <div
          style={{
            padding: "14px 20px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "#065f46",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "14px",
                boxShadow: "0 2px 6px rgba(6, 95, 70, 0.2)",
              }}
            >
              SA
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <strong style={{ fontSize: "0.94rem", color: "#0f172a" }}>
                  GrocerEase Super Admin
                </strong>
                <Crown size={14} color="#d97706" />
              </div>
              <span style={{ fontSize: "0.76rem", color: "#64748b" }}>
                Platform Support &bull; Multi-Tenant Head Office
              </span>
            </div>
          </div>

          <div
            style={{
              fontSize: "0.78rem",
              color: "#15803d",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              padding: "4px 10px",
              borderRadius: "8px",
              fontWeight: 700,
            }}
          >
            Encrypted &bull; Strictly Tenant-Isolated
          </div>
        </div>

        {/* Chat Messages Stream Area */}
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
          {loading ? (
            <div style={{ margin: "auto", textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: "14px", fontWeight: 600 }}>Loading conversation...</div>
            </div>
          ) : messages.length === 0 ? (
            <div
              style={{
                margin: "auto",
                maxWidth: "460px",
                textAlign: "center",
                padding: "2rem",
                background: "#f8fafc",
                borderRadius: "16px",
                border: "1px dashed #cbd5e1",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: "#ecfdf5",
                  color: "#16a34a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px auto",
                }}
              >
                <Sparkles size={24} />
              </div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                Start a Conversation with Super Admin
              </h3>
              <p style={{ margin: "0 0 16px 0", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.5 }}>
                Have questions regarding your subscription plan, POS turnstile clearance, inventory sync, or billing? Messages sent here go directly to the GrocerEase Super Admin console.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => setInputText("Hello Super Admin, I have an inquiry regarding our subscription plan.")}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  Plan Inquiry
                </button>
                <button
                  type="button"
                  onClick={() => setInputText("Hello Super Admin, our POS exit turnstiles are running smoothly.")}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  Turnstile Status
                </button>
              </div>
            </div>
          ) : (
            messages.map((m, idx) => {
              const isMe = m.senderRole === "STORE_ADMIN";
              return (
                <div
                  key={m._id || idx}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isMe ? "flex-end" : "flex-start",
                  }}
                >
                  {/* Sender Label */}
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: isMe ? "#15803d" : "#0369a1",
                      marginBottom: "3px",
                      padding: "0 4px",
                    }}
                  >
                    {isMe ? `${storeInfo.name} (You)` : "GrocerEase Super Admin"}
                  </span>

                  {/* Message Bubble */}
                  <div
                    style={{
                      maxWidth: "75%",
                      padding: "11px 16px",
                      borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: isMe ? "#16a34a" : "#ffffff",
                      color: isMe ? "#ffffff" : "#0f172a",
                      border: isMe ? "none" : "1px solid #e2e8f0",
                      boxShadow: isMe
                        ? "0 3px 12px rgba(22, 163, 74, 0.22)"
                        : "0 2px 8px rgba(15, 23, 42, 0.05)",
                      fontSize: "0.9rem",
                      lineHeight: 1.45,
                      wordBreak: "break-word",
                    }}
                  >
                    {m.message}
                  </div>

                  {/* Timestamp & Status */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      marginTop: "3px",
                      padding: "0 4px",
                      fontSize: "0.68rem",
                      color: "#94a3b8",
                    }}
                  >
                    <span>{formatMessageTime(m.createdAt)}</span>
                    {isMe && (
                      <span>
                        {m.isRead ? (
                          <CheckCheck size={12} color="#16a34a" title="Read by Super Admin" />
                        ) : (
                          <Check size={12} color="#94a3b8" title="Delivered" />
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

        {/* Message Input Bar */}
        <form
          onSubmit={handleSendMessage}
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
            placeholder={`Message Super Admin as ${storeInfo.name}...`}
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
              padding: "11px 22px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.88rem",
              fontWeight: 800,
              cursor: inputText.trim() && !sending ? "pointer" : "not-allowed",
              boxShadow: inputText.trim() && !sending ? "0 4px 12px rgba(6, 95, 70, 0.25)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <span>{sending ? "Sending..." : "Send"}</span>
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}

