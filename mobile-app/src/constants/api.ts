import Constants from "expo-constants";
import { Platform } from "react-native";

// Supermarket API Configuration & Safe Fetch Helper

export const DEFAULT_SERVER_URL = "https://supermarket-saas-hprw.onrender.com/api";

/**
 * Dynamically resolves the development host IP address.
 * On real physical devices, 'localhost' refers to the mobile phone itself, causing
 * java.net.ConnectException. Expo's Metro bundler exposes the development machine's IP.
 */
export function getResolvedHost(): string {
  try {
    // 1. Check Expo SDK config hostUri (standard when bundled by Metro over LAN)
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any)?.manifest?.debuggerHost ||
      (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
      (Constants as any)?.expoGoConfig?.debuggerHost;

    if (hostUri && typeof hostUri === "string") {
      const ip = hostUri.split(":")[0];
      if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
        return ip;
      }
    }

    // 2. Check linking / experience URL
    const expUrl = (Constants as any)?.linkingUri || (Constants as any)?.experienceUrl;
    if (expUrl && typeof expUrl === "string") {
      const match = expUrl.match(/:\/\/(.*?)(:\d+)?(\/|$)/);
      if (match && match[1] && match[1] !== "localhost" && match[1] !== "127.0.0.1") {
        return match[1];
      }
    }
  } catch (_) {}

  // 3. Android emulator fallback (10.0.2.2 maps to PC localhost)
  if (Platform.OS === "android") {
    return "10.0.2.2";
  }

  return "localhost";
}

/**
 * Compute the effective API URL based on platform and environment
 */
export function computeApiUrl(): string {
  // 1. If running under Metro in development on a local LAN network (e.g. 192.168.1.38),
  // automatically connect to the local development backend on port 5001.
  // This guarantees 100% real-time data sync with the Store Admin web portal running locally.
  if (Platform.OS !== "web") {
    const host = getResolvedHost();
    if (host && host !== "localhost" && host !== "127.0.0.1" && host !== "10.0.2.2") {
      return `http://${host}:5001/api`;
    }
  }

  const envUrl = process.env.EXPO_PUBLIC_API_URL || "";
  let base = envUrl.trim() || DEFAULT_SERVER_URL;

  // Guarantee port 5001 even if Metro bundler cached port 5000
  base = base.replace(":5000", ":5001");

  // On native mobile devices, replace localhost/127.0.0.1 with the host machine's LAN IP
  if (Platform.OS !== "web") {
    if (base.includes("localhost") || base.includes("127.0.0.1")) {
      const resolvedHost = getResolvedHost();
      base = base.replace("localhost", resolvedHost).replace("127.0.0.1", resolvedHost);
    }
  }

  return base;
}

export const API_URL = computeApiUrl();
export const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");

/**
 * Resilient fetch with AbortController timeout and automatic dual-direction fallback
 * (Cloud Render Server <-> Local Dev Machine LAN Host).
 */
export async function safeFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const resolvedHost = getResolvedHost();
  const localBase = `http://${resolvedHost}:5001/api`;

  // If targeting local LAN IP, use a snappy timeout (4s) so cellular devices (5G/4G)
  // quickly fall back to the live cloud backend without freezing the UI.
  const isTargetingLocal = url.startsWith(localBase) || url.includes("localhost") || url.includes("127.0.0.1");
  const effectiveTimeout = isTargetingLocal ? Math.min(timeoutMs, 4000) : timeoutMs;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch (primaryErr: any) {
    clearTimeout(timer);

    // Dynamic dual-direction fallback:
    // If the request to Render timed out or failed (e.g. Render instance sleeping),
    // automatically attempt the local computer's LAN IP backend.
    // If the local backend was unreachable (e.g. phone on cellular data),
    // automatically fall back to the live Render cloud server.
    let fallbackUrl: string | null = null;
    if (url.startsWith(DEFAULT_SERVER_URL)) {
      fallbackUrl = url.replace(DEFAULT_SERVER_URL, localBase);
    } else if (url.startsWith(localBase)) {
      fallbackUrl = url.replace(localBase, DEFAULT_SERVER_URL);
    } else if (url.includes("localhost:5001/api") || url.includes("127.0.0.1:5001/api")) {
      fallbackUrl = url.replace(/http:\/\/(localhost|127\.0\.0\.1):5001\/api/, DEFAULT_SERVER_URL);
    }

    if (fallbackUrl && fallbackUrl !== url && Platform.OS !== "web") {
      try {
        const fallbackCtrl = new AbortController();
        const fallbackTimer = setTimeout(() => fallbackCtrl.abort(), 12000);
        const fallbackRes = await fetch(fallbackUrl, {
          ...options,
          signal: fallbackCtrl.signal,
        });
        clearTimeout(fallbackTimer);
        return fallbackRes;
      } catch (_) {
        // Fallback also failed
      }
    }

    const isLocal = url.includes("localhost") || url.includes("127.0.0.1") || url.includes(resolvedHost);
    const msg = (primaryErr?.message || "") + " " + (primaryErr?.cause?.message || "") + " " + String(primaryErr);
    const isTimeoutOrCancel =
      primaryErr?.name === "AbortError" ||
      msg.toLowerCase().includes("cancel") ||
      msg.toLowerCase().includes("abort") ||
      msg.toLowerCase().includes("timeout") ||
      msg.toLowerCase().includes("network request failed") ||
      msg.toLowerCase().includes("fetch failed");

    if (isTimeoutOrCancel) {
      throw new Error(
        "Connecting to the server timed out. The server may be waking up from sleep or network is slow. Please tap Retry."
      );
    }

    if (isLocal && Platform.OS === "android") {
      throw new Error(
        `Cannot reach backend at ${url}.\n\nEnsure your phone and computer are on the same Wi-Fi network, or connect via USB and run 'adb reverse tcp:5001 tcp:5001'.`
      );
    }

    throw primaryErr;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Universal Indian phone formatter: guarantees clean standard '+91 XXXXXXXXXX'
 * without duplicated '+91 +91' or '+91 91'.
 */
export function formatPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return String(phone);
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  return `+91 ${last10}`;
}

/**
 * Extracts clean 10-digit mobile number digits for API payloads and database storage.
 */
export function get10DigitPhone(phone: string | undefined | null): string {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}
