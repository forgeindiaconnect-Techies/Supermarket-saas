import axios from "axios";

// Smart detection: If running on localhost / private dev IPs, use local backend.
// Otherwise (e.g. Vercel deployment), default to the live Render backend.
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.startsWith("192.168."));

const LIVE_BACKEND_URL = "https://super-market-scan.onrender.com";
const LOCAL_BACKEND_URL = "http://localhost:5001";

const DEFAULT_BACKEND_URL = isLocalhost ? LOCAL_BACKEND_URL : LIVE_BACKEND_URL;

export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : DEFAULT_BACKEND_URL);

export const API_URL =
  import.meta.env.VITE_API_URL || `${BACKEND_URL}/api`;

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || BACKEND_URL;

const API = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: Automatically attach token & tenant supermarket ID to every request
API.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("grocerease_auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach active supermarket context
    const currentSupermarketJson = localStorage.getItem("grocerease_current_supermarket");
    if (currentSupermarketJson) {
      const store = JSON.parse(currentSupermarketJson);
      if (store?._id) {
        config.headers["x-supermarket-id"] = store._id;
      }
      if (store?.code) {
        config.headers["x-supermarket-code"] = store.code;
      }
    }
  } catch (_) {}

  return config;
});

export default API;
