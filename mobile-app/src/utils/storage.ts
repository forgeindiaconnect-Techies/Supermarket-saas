import { Platform } from "react-native";

// Synchronous and persistent global cache to survive navigation resets and module reload
declare global {
  var __SUPERMART_CUSTOMER_SESSION__: any;
  var __SUPERMART_CUSTOMER_CART__: any;
}

if (typeof globalThis !== "undefined") {
  if (!(globalThis as any).__SUPERMART_CUSTOMER_SESSION__) {
    (globalThis as any).__SUPERMART_CUSTOMER_SESSION__ = null;
  }
  if (!(globalThis as any).__SUPERMART_CUSTOMER_CART__) {
    (globalThis as any).__SUPERMART_CUSTOMER_CART__ = null;
  }
}

// Dynamically and safely resolve FileSystem methods to guarantee compatibility across SDK 58 and legacy
let legacyFs: any = null;
try {
  legacyFs = require("expo-file-system/legacy");
} catch (_) {
  try {
    legacyFs = require("expo-file-system");
  } catch (_) {}
}

const getSessionFilePath = (): string | null => {
  try {
    const docDir = legacyFs?.documentDirectory;
    if (docDir) {
      return `${docDir}customer_session_v1.json`;
    }
  } catch (_) {}
  return null;
};

/**
 * Returns currently cached customer session synchronously without awaiting
 */
export function getCustomerSessionSync(): any | null {
  if (typeof globalThis !== "undefined" && (globalThis as any).__SUPERMART_CUSTOMER_SESSION__) {
    return (globalThis as any).__SUPERMART_CUSTOMER_SESSION__;
  }
  if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
    try {
      const item = window.localStorage.getItem("customer_session");
      if (item) {
        const parsed = JSON.parse(item);
        (globalThis as any).__SUPERMART_CUSTOMER_SESSION__ = parsed;
        return parsed;
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Saves authenticated customer session to persistent storage & global memory
 */
export async function saveCustomerSession(customer: any): Promise<void> {
  try {
    if (typeof globalThis !== "undefined") {
      (globalThis as any).__SUPERMART_CUSTOMER_SESSION__ = customer;
    }
    const data = JSON.stringify(customer);
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("customer_session", data);
      }
    } else {
      const filePath = getSessionFilePath();
      if (filePath && typeof legacyFs?.writeAsStringAsync === "function") {
        await legacyFs.writeAsStringAsync(filePath, data);
      }
    }
  } catch (e) {
    // Non-blocking catch
  }
}

/**
 * Loads authenticated customer session from persistent disk storage
 */
export async function loadCustomerSession(): Promise<any | null> {
  try {
    const sync = getCustomerSessionSync();
    if (sync) {
      return sync;
    }
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        const item = window.localStorage.getItem("customer_session");
        if (item) {
          const parsed = JSON.parse(item);
          if (typeof globalThis !== "undefined") {
            (globalThis as any).__SUPERMART_CUSTOMER_SESSION__ = parsed;
          }
          return parsed;
        }
      }
    } else {
      const filePath = getSessionFilePath();
      if (filePath && typeof legacyFs?.getInfoAsync === "function" && typeof legacyFs?.readAsStringAsync === "function") {
        const info = await legacyFs.getInfoAsync(filePath);
        if (info && info.exists) {
          const content = await legacyFs.readAsStringAsync(filePath);
          if (content) {
            const parsed = JSON.parse(content);
            if (typeof globalThis !== "undefined") {
              (globalThis as any).__SUPERMART_CUSTOMER_SESSION__ = parsed;
            }
            return parsed;
          }
        }
      }
    }
  } catch (e) {
    // Non-blocking catch
  }
  return null;
}

/**
 * Clears authenticated customer session from storage upon logout
 */
export async function clearCustomerSession(): Promise<void> {
  try {
    if (typeof globalThis !== "undefined") {
      (globalThis as any).__SUPERMART_CUSTOMER_SESSION__ = null;
    }
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem("customer_session");
      }
    } else {
      const filePath = getSessionFilePath();
      if (filePath && typeof legacyFs?.getInfoAsync === "function" && typeof legacyFs?.deleteAsync === "function") {
        const info = await legacyFs.getInfoAsync(filePath);
        if (info && info.exists) {
          await legacyFs.deleteAsync(filePath, { idempotent: true });
        }
      }
    }
  } catch (e) {
    // Non-blocking catch
  }
}

const getCartFilePath = (): string | null => {
  try {
    const docDir = legacyFs?.documentDirectory;
    if (docDir) {
      return `${docDir}customer_cart_v1.json`;
    }
  } catch (_) {}
  return null;
};

/**
 * Returns currently cached customer cart synchronously without awaiting
 */
export function getCartSync(): any[] {
  if (typeof globalThis !== "undefined" && Array.isArray((globalThis as any).__SUPERMART_CUSTOMER_CART__)) {
    return (globalThis as any).__SUPERMART_CUSTOMER_CART__;
  }
  if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
    try {
      const item = window.localStorage.getItem("customer_cart");
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) {
          (globalThis as any).__SUPERMART_CUSTOMER_CART__ = parsed;
          return parsed;
        }
      }
    } catch (_) {}
  }
  return [];
}

/**
 * Saves customer cart to persistent disk storage & global memory
 */
export async function saveCartStorage(cart: any[]): Promise<void> {
  try {
    if (typeof globalThis !== "undefined") {
      (globalThis as any).__SUPERMART_CUSTOMER_CART__ = cart;
    }
    const data = JSON.stringify(cart);
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("customer_cart", data);
      }
    } else {
      const filePath = getCartFilePath();
      if (filePath && typeof legacyFs?.writeAsStringAsync === "function") {
        await legacyFs.writeAsStringAsync(filePath, data);
      }
    }
  } catch (_) {}
}

/**
 * Loads customer cart from disk storage
 */
export async function loadCartStorage(): Promise<any[]> {
  try {
    const sync = getCartSync();
    if (sync && sync.length > 0) return sync;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        const item = window.localStorage.getItem("customer_cart");
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed)) {
            if (typeof globalThis !== "undefined") (globalThis as any).__SUPERMART_CUSTOMER_CART__ = parsed;
            return parsed;
          }
        }
      }
    } else {
      const filePath = getCartFilePath();
      if (filePath && typeof legacyFs?.getInfoAsync === "function" && typeof legacyFs?.readAsStringAsync === "function") {
        const info = await legacyFs.getInfoAsync(filePath);
        if (info && info.exists) {
          const content = await legacyFs.readAsStringAsync(filePath);
          if (content) {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              if (typeof globalThis !== "undefined") (globalThis as any).__SUPERMART_CUSTOMER_CART__ = parsed;
              return parsed;
            }
          }
        }
      }
    }
  } catch (_) {}
  return [];
}

/**
 * Clears stored customer cart
 */
export async function clearCartStorage(): Promise<void> {
  try {
    if (typeof globalThis !== "undefined") {
      (globalThis as any).__SUPERMART_CUSTOMER_CART__ = [];
    }
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem("customer_cart");
      }
    } else {
      const filePath = getCartFilePath();
      if (filePath && typeof legacyFs?.getInfoAsync === "function" && typeof legacyFs?.deleteAsync === "function") {
        const info = await legacyFs.getInfoAsync(filePath);
        if (info && info.exists) {
          await legacyFs.deleteAsync(filePath, { idempotent: true });
        }
      }
    }
  } catch (_) {}
}
