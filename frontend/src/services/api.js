import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";
export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || API_URL).replace(/\/api\/?$/, "");

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
