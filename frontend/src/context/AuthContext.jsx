import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import API, { SOCKET_URL } from "../services/api";

const AuthContext = createContext(null);

export const INITIAL_SUPERMARKETS_CATALOG = [];

export function AuthProvider({ children }) {
  // 1. Initial State from localStorage (Strictly requires real authentication; no auto-logged-in mock fallback)
  const [token, setToken] = useState(() => {
    try {
      const savedToken = localStorage.getItem("grocerease_auth_token");
      // Clean up legacy auto-assigned mock tokens
      if (!savedToken || savedToken.startsWith("mock_")) {
        localStorage.removeItem("grocerease_auth_token");
        return null;
      }
      return savedToken;
    } catch (_) {
      return null;
    }
  });

  const [user, setUser] = useState(() => {
    try {
      const savedToken = localStorage.getItem("grocerease_auth_token");
      if (!savedToken || savedToken.startsWith("mock_")) {
        localStorage.removeItem("grocerease_auth_token");
        localStorage.removeItem("grocerease_user");
        return null;
      }
      const savedUser = localStorage.getItem("grocerease_user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed?.role === "SUPER_ADMIN" && !savedToken.startsWith("eyJ")) {
          localStorage.removeItem("grocerease_auth_token");
          localStorage.removeItem("grocerease_user");
          return null;
        }
        return parsed;
      }
    } catch (_) {}
    return null;
  });

  const [currentSupermarket, setCurrentSupermarket] = useState(() => {
    try {
      const saved = localStorage.getItem("grocerease_current_supermarket");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return null;
  });

  const [supermarkets, setSupermarkets] = useState([]);
  const [loading, setLoading] = useState(false);

  // Sync currentSupermarket to localStorage
  useEffect(() => {
    if (currentSupermarket) {
      try {
        localStorage.setItem("grocerease_current_supermarket", JSON.stringify(currentSupermarket));
      } catch (_) {}
    }
  }, [currentSupermarket]);

  // Live session profile sync from backend for authenticated store admin
  useEffect(() => {
    const syncLiveProfile = async () => {
      const activeToken = localStorage.getItem("grocerease_auth_token");
      if (!activeToken || activeToken.startsWith("mock_")) return;

      try {
        const res = await API.get("/auth/me");
        if (res.data?.success && res.data.user) {
          const u = res.data.user;
          const sm = res.data.supermarket;
          setUser((prev) => ({ ...prev, ...u }));
          localStorage.setItem("grocerease_user", JSON.stringify(u));
          if (sm && u.role === "STORE_ADMIN") {
            setCurrentSupermarket(sm);
            localStorage.setItem("grocerease_current_supermarket", JSON.stringify(sm));
          }
        }
      } catch (err) {
        console.warn("Session live profile sync notice:", err.message);
      }
    };

    syncLiveProfile();
  }, [token]);

  // Load all supermarkets from backend
  const loadSupermarkets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/super-admin/supermarkets");
      if (res.data?.success && Array.isArray(res.data.supermarkets)) {
        setSupermarkets(res.data.supermarkets);

        // If current supermarket ID matches one from DB, sync updated attributes
        const activeId = currentSupermarket?._id;
        const matched = res.data.supermarkets.find((s) => s._id === activeId || s.code === currentSupermarket?.code);
        if (matched) {
          setCurrentSupermarket(matched);
        } else if (res.data.supermarkets.length > 0 && !currentSupermarket) {
          setCurrentSupermarket(res.data.supermarkets[0]);
        }
      }
    } catch (err) {
      console.warn("Supermarkets load notice:", err.message);
    } finally {
      setLoading(false);
    }
  }, [currentSupermarket?.code, currentSupermarket?._id]);

  useEffect(() => {
    if (user?.role === "SUPER_ADMIN") {
      loadSupermarkets();
    }
  }, [user?.role, loadSupermarkets]);

  // Real-time synchronization via Socket.IO for supermarkets & platform stats
  useEffect(() => {
    let socket;
    try {
      socket = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
      });

      socket.on("supermarket:deleted", (data) => {
        if (!data) return;
        setSupermarkets((prev) =>
          prev.filter((s) => s._id !== data.id && s.code !== data.code)
        );
        setCurrentSupermarket((prev) => {
          if (prev && (prev._id === data.id || prev.code === data.code)) {
            return null;
          }
          return prev;
        });
        window.dispatchEvent(new Event("grocerease_storage_updated"));
      });

      socket.on("supermarket:created", (data) => {
        if (data?.supermarket) {
          setSupermarkets((prev) => {
            const exists = prev.some((s) => s._id === data.supermarket._id || s.code === data.supermarket.code);
            return exists ? prev : [data.supermarket, ...prev];
          });
          window.dispatchEvent(new Event("grocerease_storage_updated"));
        }
      });

      socket.on("supermarket:updated", (data) => {
        if (data?.supermarket) {
          setSupermarkets((prev) =>
            prev.map((s) => (s._id === data.supermarket._id || s.code === data.supermarket.code ? data.supermarket : s))
          );
          setCurrentSupermarket((prev) => {
            if (prev && (prev._id === data.supermarket._id || prev.code === data.supermarket.code)) {
              return data.supermarket;
            }
            return prev;
          });
          window.dispatchEvent(new Event("grocerease_storage_updated"));
        }
      });

      socket.on("supermarket:availability_updated", (data) => {
        if (!data) return;
        setSupermarkets((prev) =>
          prev.map((s) => {
            if (s._id === data.supermarketId || s.code === data.supermarketCode) {
              return {
                ...s,
                onlineAvailable: data.onlineAvailable,
                offlineAvailable: data.offlineAvailable,
              };
            }
            return s;
          })
        );
        setCurrentSupermarket((prev) => {
          if (prev && (prev._id === data.supermarketId || prev.code === data.supermarketCode)) {
            const updated = {
              ...prev,
              onlineAvailable: data.onlineAvailable,
              offlineAvailable: data.offlineAvailable,
            };
            try {
              localStorage.setItem("grocerease_current_supermarket", JSON.stringify(updated));
            } catch (_) {}
            return updated;
          }
          return prev;
        });
        window.dispatchEvent(new Event("grocerease_storage_updated"));
      });

      socket.on("platform:stats_updated", () => {
        loadSupermarkets();
      });
    } catch (_) {}

    return () => {
      if (socket) socket.disconnect();
    };
  }, [loadSupermarkets]);

  // Delete supermarket permanently from database and update state immediately
  const deleteSupermarketById = async (id) => {
    try {
      const res = await API.delete(`/super-admin/supermarkets/${id}`);
      if (res.data?.success) {
        setSupermarkets((prev) => prev.filter((s) => s._id !== id && s.code !== id));
        setCurrentSupermarket((prev) => {
          if (prev && (prev._id === id || prev.code === id)) {
            return null;
          }
          return prev;
        });
        window.dispatchEvent(new Event("grocerease_storage_updated"));
      }
      return res.data;
    } catch (err) {
      throw err;
    }
  };

  // Login handler - Strict server-side authentication
  const login = async (username, password) => {
    try {
      const res = await API.post("/auth/login", { username, password });
      if (res.data?.success) {
        const { token: receivedToken, user: receivedUser } = res.data;
        const authenticatedUser = { ...receivedUser, isRealLogin: true };

        localStorage.setItem("grocerease_auth_token", receivedToken);
        localStorage.setItem("grocerease_user", JSON.stringify(authenticatedUser));

        setToken(receivedToken);
        setUser(authenticatedUser);

        if (authenticatedUser.role === "STORE_ADMIN") {
          const storeObj = res.data.supermarket || (typeof authenticatedUser.supermarket === "object" ? authenticatedUser.supermarket : null) || {
            _id: authenticatedUser.supermarket,
            code: authenticatedUser.supermarketCode || "",
            name: authenticatedUser.supermarketName || "Supermarket",
          };

          localStorage.setItem("grocerease_current_supermarket", JSON.stringify(storeObj));
          setCurrentSupermarket(storeObj);
        } else if (authenticatedUser.role === "SUPER_ADMIN") {
          localStorage.removeItem("grocerease_current_supermarket");
          setCurrentSupermarket(null);
        }

        window.dispatchEvent(new Event("grocerease_storage_updated"));
        return { success: true, user: authenticatedUser };
      }
      return { success: false, message: res.data?.message || "Invalid credentials." };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Invalid credentials. Please verify your Email and Password.";
      return { success: false, message: msg };
    }
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem("grocerease_auth_token");
    localStorage.removeItem("grocerease_user");
    localStorage.removeItem("grocerease_current_supermarket");
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  // Switch supermarket (Super Admin privilege)
  const switchSupermarket = (supermarketOrId) => {
    let storeToSet = null;
    if (typeof supermarketOrId === "object" && supermarketOrId !== null) {
      storeToSet = supermarketOrId;
    } else {
      storeToSet = supermarkets.find((s) => s._id === supermarketOrId || s.code === supermarketOrId);
    }

    if (storeToSet) {
      setCurrentSupermarket(storeToSet);
      try {
        localStorage.setItem("grocerease_current_supermarket", JSON.stringify(storeToSet));
      } catch (_) {}
      window.dispatchEvent(new Event("grocerease_storage_updated"));
      return storeToSet;
    }
    return null;
  };

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isStoreAdmin = user?.role === "STORE_ADMIN";

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        role: user?.role || null,
        isSuperAdmin,
        isStoreAdmin,
        currentSupermarket,
        supermarkets,
        loading,
        login,
        logout,
        switchSupermarket,
        loadSupermarkets,
        deleteSupermarketById,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

