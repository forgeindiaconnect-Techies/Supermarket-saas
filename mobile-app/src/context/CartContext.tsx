import React, { createContext, useContext, useState, useEffect } from "react";
import { API_URL, safeFetch } from "../constants/api";

export type SupermarketInfo = {
  _id: string;
  name: string;
  code: string;
  city?: string;
  state?: string;
  address?: string;
  pincode?: string;
  phone?: string;
  logoUrl?: string;
  deliveryBannerUrl?: string;
  onlineAvailable?: boolean | null;
  offlineAvailable?: boolean | null;
  onlineDeliveryAvailable?: boolean | null;
  selfPickupAvailable?: boolean | null;
  status?: string;
};

export type DeliveryUser = {
  _id: string;
  name: string;
  username: string;
  email?: string;
  phone?: string;
  role: string;
  supermarketId: string;
  supermarketCode: string;
  supermarketName: string;
  logoUrl?: string;
  deliveryBannerUrl?: string;
  token: string;
};

export type FulfillmentType = "DELIVERY" | "SELF_PICKUP" | "IN_STORE";

export type CustomerUser = {
  _id?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  supermarketId?: string;
  supermarketCode?: string;
  supermarketName?: string;
  registeredLocation?: string;
  token?: string;
};

export type CartItem = {
  _id: string;
  name: string;
  brand?: string;
  category?: string;
  barcode?: string;
  price: number;
  discount?: number;
  effectivePrice: number;
  stock: number;
  imageUrl?: string;
  description?: string;
  quantity: number;
  supermarket?: string;
  supermarketCode?: string;
  supermarketName?: string;
};

export type OrderRecord = {
  _id: string;
  orderNumber: string;
  items: CartItem[];
  totalItems: number;
  subtotalAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  exitBarcode: string;
  purchaseMode?: "ONLINE" | "OFFLINE";
  orderType?: string;
  fulfillmentChoice?: string;
  pickupDate?: string;
  pickupTimeSlot?: string;
  pickupStatus?: string;
  deliveryStatus?: string;
  deliveryAddress?: string;
  deliveryPhone?: string;
  deliveryCustomerName?: string;
  deliveryNotes?: string;
  assignedStaff?: any;
  assignedStaffName?: string;
  assignedStaffPhone?: string;
  orderConfirmedAt?: string;
  preparingAt?: string;
  assignedAt?: string;
  pickedUpAt?: string;
  productsCollectedAt?: string;
  deliveryAcceptedAt?: string;
  deliveryOutAt?: string;
  deliveryCompletedAt?: string;
  failedDeliveryAt?: string;
  failedReason?: string;
  estimatedDeliveryTime?: string;
  estimatedDeliveryDate?: string;
  trackingTimeline?: Array<{
    status?: string;
    title?: string;
    description?: string;
    timestamp?: string;
    updatedBy?: string;
    role?: string;
  }>;
  supermarket?: any;
  supermarketCode?: string;
  supermarketName?: string;
  customerName?: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  createdAt: string;
};

export type CustomerInfo = {
  name: string;
  phone: string;
  address?: string;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (product: any, qty?: number) => boolean;
  updateQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  totalCount: number;
  grossAmount: number;
  totalSavings: number;
  totalAmount: number;
  recentOrders: OrderRecord[];
  addRecentOrder: (order: OrderRecord) => void;
  updateRecentOrder: (order: OrderRecord) => void;
  customerInfo: CustomerInfo | null;
  setCustomerInfo: (info: CustomerInfo) => void;

  // Multi-Tenant Purchase Mode & Supermarket Isolation
  purchaseMode: "online" | "offline" | null;
  setPurchaseMode: (mode: "online" | "offline" | null) => void;
  fulfillmentType: FulfillmentType;
  setFulfillmentType: (type: FulfillmentType) => void;
  selectedSupermarket: SupermarketInfo | null;
  setSelectedSupermarket: (store: SupermarketInfo | null) => void;
  customerUser: CustomerUser | null;
  setCustomerUser: (user: CustomerUser | null) => void;
  updateCustomerDetails: (details: { name?: string; phone?: string; address?: string }) => Promise<void>;
  logoutCustomer: () => void;
  verifySupermarketMode: (store: SupermarketInfo, mode: "online" | "offline") => Promise<{ allowed: boolean; message: string }>;

  // Dedicated Delivery Dashboard Auth (Multi-Tenant Scoped)
  deliveryUser: DeliveryUser | null;
  setDeliveryUser: (user: DeliveryUser | null) => void;
  logoutDeliveryUser: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

// Helper to notify backend Admin Dashboard of live cart changes with strict tenant isolation
const notifyAdminCartActivity = (data: {
  productName: string;
  productId?: string;
  quantity: number;
  price: number;
  action: "added" | "updated" | "removed" | "cleared";
  totalCartItems: number;
  totalCartAmount: number;
  customerName?: string;
  customerPhone?: string;
  supermarketId?: string;
  supermarketCode?: string;
}) => {
  if (!API_URL) return;
  fetch(`${API_URL}/orders/cart-activity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: data.customerPhone || "customer-mobile",
      customerName: data.customerName || "Mobile Shopper",
      ...data,
    }),
  }).catch(() => {});
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderRecord[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  // New states for Online vs Offline Purchase Workflows
  const [purchaseMode, setPurchaseMode] = useState<"online" | "offline" | null>(null);
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("DELIVERY");
  const [selectedSupermarket, setSelectedSupermarketState] = useState<SupermarketInfo | null>(null);
  const [customerUser, setCustomerUserState] = useState<CustomerUser | null>(null);
  const [deliveryUser, setDeliveryUserState] = useState<DeliveryUser | null>(null);

  const setDeliveryUser = (user: DeliveryUser | null) => {
    setDeliveryUserState(user);
  };

  const logoutDeliveryUser = () => {
    setDeliveryUserState(null);
  };

  const setSelectedSupermarket = (store: SupermarketInfo | null) => {
    // If switching to a different supermarket, clear cart to maintain absolute supermarket data isolation
    if (store && selectedSupermarket && store._id !== selectedSupermarket._id) {
      setCart([]);
    }
    setSelectedSupermarketState(store);
  };

  const setCustomerUser = (user: CustomerUser | null) => {
    setCustomerUserState(user);
    if (user) {
      setCustomerInfo({
        name: user.name,
        phone: user.phone,
        address: user.address,
      });
      if (user.supermarketId) {
        const smId: string = String(user.supermarketId);
        // Automatically sync customer's connected supermarket with live attributes
        setSelectedSupermarketState((prev: SupermarketInfo | null): SupermarketInfo => {
          return {
            _id: smId,
            name: user.supermarketName || prev?.name || "Selected Supermarket",
            code: user.supermarketCode || prev?.code || "",
            onlineDeliveryAvailable: prev?.onlineDeliveryAvailable ?? null,
            selfPickupAvailable: prev?.selfPickupAvailable ?? null,
            onlineAvailable: true,
            offlineAvailable: true,
          };
        });

        if (API_URL) {
          safeFetch(`${API_URL}/supermarkets/${user.supermarketId}/availability`, {}, 12000)
            .then(async (res) => {
              const ct = res.headers?.get("content-type") || "";
              if (ct.includes("application/json")) {
                return res.json();
              }
              return null;
            })
            .then((data) => {
              if (data?.success && data.supermarket) {
                const sm = data.supermarket;
                setSelectedSupermarketState({
                  _id: String(sm._id || smId),
                  name: String(sm.name || user.supermarketName || "Selected Supermarket"),
                  code: String(sm.code || user.supermarketCode || ""),
                  city: sm.city,
                  address: sm.address,
                  onlineDeliveryAvailable: sm.onlineDeliveryAvailable === true,
                  selfPickupAvailable: sm.selfPickupAvailable === true,
                  onlineAvailable: sm.onlineDeliveryAvailable === true || sm.selfPickupAvailable === true || sm.onlineAvailable === true,
                  offlineAvailable: sm.selfPickupAvailable === true || sm.offlineAvailable === true,
                  logoUrl: sm.logoUrl,
                });
              }
            })
            .catch(() => {});
        }
      }
    }
  };

  const logoutCustomer = () => {
    setCustomerUserState(null);
    setCustomerInfo(null);
    setCart([]);
  };

  const updateCustomerDetails = async (details: { name?: string; phone?: string; address?: string }) => {
    const updatedName = details.name !== undefined ? details.name.trim() : (customerUser?.name || customerInfo?.name || "");
    const rawP = details.phone !== undefined ? details.phone : (customerUser?.phone || customerInfo?.phone || "");
    const updatedPhone = String(rawP).replace(/\D/g, "").slice(-10);
    const updatedAddress = details.address !== undefined ? details.address.trim() : (customerUser?.address || customerInfo?.address || "");

    setCustomerInfo({
      name: updatedName,
      phone: updatedPhone,
      address: updatedAddress,
    });

    if (customerUser) {
      setCustomerUserState({
        ...customerUser,
        name: updatedName,
        phone: updatedPhone,
        address: updatedAddress,
      });
    }

    if (API_URL && (customerUser?._id || updatedPhone)) {
      try {
        await safeFetch(
          `${API_URL}/auth/customer/profile`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerId: customerUser?._id,
              phone: updatedPhone,
              name: updatedName,
              address: updatedAddress,
            }),
          },
          5000
        );
      } catch (_) {}
    }
  };

  /**
   * Verify whether the supermarket currently supports the requested purchase mode
   * Queries the live database configuration set by Super Admin.
   */
  const verifySupermarketMode = async (
    store: SupermarketInfo,
    mode: "online" | "offline"
  ): Promise<{ allowed: boolean; message: string }> => {
    try {
      if (!API_URL) {
        // Fallback to local store properties
        const isOnline = mode === "online" && (store.onlineDeliveryAvailable === true || store.selfPickupAvailable === true || store.onlineAvailable === true);
        const isOffline = mode === "offline" && (store.selfPickupAvailable === true || store.offlineAvailable === true);
        const allowed = isOnline || isOffline;
        return {
          allowed,
          message: allowed
            ? ""
            : `This supermarket does not currently support ${mode === "online" ? "Online Ordering" : "In-Store Shopping"}. Please choose an available option.`,
        };
      }

      const res = await safeFetch(`${API_URL}/supermarkets/validate-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supermarketId: store._id,
          supermarketCode: store.code,
          mode,
        }),
      }, 12000);

      const ct = res.headers?.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await res.json();
        if (data.allowed === true) {
          return { allowed: true, message: "" };
        }
        return {
          allowed: false,
          message: data.message || `This supermarket does not currently support ${mode === "online" ? "Online" : "Offline"} Purchase. Please choose an available option.`,
        };
      }

      // If server returned non-JSON, fall back to local store attributes
      const isOnline = mode === "online" && (store.onlineDeliveryAvailable === true || store.selfPickupAvailable === true || store.onlineAvailable === true);
      const isOffline = mode === "offline" && (store.selfPickupAvailable === true || store.offlineAvailable === true);
      const allowed = isOnline || isOffline;
      return {
        allowed,
        message: allowed
          ? ""
          : `This supermarket does not currently support ${mode === "online" ? "Online Ordering" : "In-Store Shopping"}. Please choose an available option.`,
      };
    } catch (_) {
      // Local check fallback
      const allowed = mode === "online" 
        ? (store.onlineDeliveryAvailable === true || store.selfPickupAvailable === true || store.onlineAvailable === true)
        : (store.selfPickupAvailable === true || store.offlineAvailable === true);
      return {
        allowed,
        message: allowed
          ? ""
          : `This supermarket does not currently support ${mode === "online" ? "Online Ordering" : "In-Store Shopping"}. Please choose an available option.`,
      };
    }
  };

  const addToCart = (product: any, qty: number = 1): boolean => {
    if (!product || product.stock <= 0) return false;
    const addQty = Math.max(1, qty);

    let success = true;
    let updatedCart: CartItem[] = [];

    const rawPrice = Number(product.price || 0);
    const rawCostPrice = Number(product.costPrice || 0);
    const explicitDiscount = Number(product.discount || 0);

    let originalMrp = rawPrice;
    let finalPrice = rawPrice;
    let discountAmount = explicitDiscount;

    if (rawCostPrice > 0 && rawCostPrice !== rawPrice) {
      originalMrp = Math.max(rawPrice, rawCostPrice);
      finalPrice = Math.min(rawPrice, rawCostPrice);
      discountAmount = Math.max(explicitDiscount, originalMrp - finalPrice);
    } else if (explicitDiscount > 0) {
      originalMrp = rawPrice;
      finalPrice = Math.max(0, rawPrice - explicitDiscount);
      discountAmount = explicitDiscount;
    }

    const effectivePrice = finalPrice;

    setCart((current) => {
      // Strict Multi-Tenant Isolation: Ensure cart only accepts products from the active supermarket
      if (selectedSupermarket && product.supermarket) {
        const prodStoreId = typeof product.supermarket === "object" ? product.supermarket._id : product.supermarket;
        if (prodStoreId && String(prodStoreId) !== String(selectedSupermarket._id)) {
          console.warn("Rejected product belonging to another store:", prodStoreId, "!=", selectedSupermarket._id);
          success = false;
          updatedCart = current;
          return current;
        }
      }

      const existing = current.find((item) => item._id === product._id);

      if (existing) {
        if (existing.quantity + addQty > product.stock) {
          success = false;
          updatedCart = current;
          return current;
        }

        updatedCart = current.map((item) =>
          item._id === product._id
            ? {
                ...item,
                quantity: item.quantity + addQty,
                price: originalMrp,
                discount: discountAmount,
                effectivePrice: effectivePrice,
              }
            : item
        );
      } else {
        if (addQty > product.stock) {
          success = false;
          updatedCart = current;
          return current;
        }

        const newItem: CartItem = {
          _id: product._id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          barcode: product.barcode,
          price: originalMrp,
          discount: discountAmount,
          effectivePrice: effectivePrice,
          stock: product.stock,
          imageUrl: product.imageUrl,
          description: product.description,
          quantity: addQty,
          supermarket: selectedSupermarket?._id || product.supermarket,
          supermarketCode: selectedSupermarket?.code || product.supermarketCode,
          supermarketName: selectedSupermarket?.name || product.supermarketName,
        };
        updatedCart = [...current, newItem];
      }

      return updatedCart;
    });

    if (success) {
      const newTotalCount = updatedCart.reduce((s, it) => s + it.quantity, 0);
      const newTotalAmount = updatedCart.reduce((s, it) => s + it.effectivePrice * it.quantity, 0);
      notifyAdminCartActivity({
        productName: product.name,
        productId: product._id,
        quantity: addQty,
        price: effectivePrice,
        action: "added",
        totalCartItems: newTotalCount,
        totalCartAmount: newTotalAmount,
        customerName: customerInfo?.name,
        customerPhone: customerInfo?.phone,
        supermarketId: product.supermarket || selectedSupermarket?._id,
        supermarketCode: product.supermarketCode || selectedSupermarket?.code,
      });
    }

    return success;
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((current) => {
      const item = current.find((it) => it._id === id);
      if (!item) return current;

      const newQty = item.quantity + delta;

      let updated: CartItem[];
      if (newQty <= 0) {
        updated = current.filter((it) => it._id !== id);
        notifyAdminCartActivity({
          productName: item.name,
          productId: item._id,
          quantity: 0,
          price: item.effectivePrice,
          action: "removed",
          totalCartItems: updated.reduce((s, it) => s + it.quantity, 0),
          totalCartAmount: updated.reduce((s, it) => s + it.effectivePrice * it.quantity, 0),
          customerName: customerInfo?.name,
          customerPhone: customerInfo?.phone,
          supermarketId: item.supermarket || selectedSupermarket?._id,
          supermarketCode: item.supermarketCode || selectedSupermarket?.code,
        });
      } else {
        if (newQty > item.stock) return current;
        updated = current.map((it) =>
          it._id === id ? { ...it, quantity: newQty } : it
        );
        notifyAdminCartActivity({
          productName: item.name,
          productId: item._id,
          quantity: newQty,
          price: item.effectivePrice,
          action: "updated",
          totalCartItems: updated.reduce((s, it) => s + it.quantity, 0),
          totalCartAmount: updated.reduce((s, it) => s + it.effectivePrice * it.quantity, 0),
          customerName: customerInfo?.name,
          customerPhone: customerInfo?.phone,
          supermarketId: item.supermarket || selectedSupermarket?._id,
          supermarketCode: item.supermarketCode || selectedSupermarket?.code,
        });
      }

      return updated;
    });
  };

  const removeFromCart = (id: string) => {
    setCart((current) => {
      const item = current.find((it) => it._id === id);
      const updated = current.filter((it) => it._id !== id);
      if (item) {
        notifyAdminCartActivity({
          productName: item.name,
          productId: item._id,
          quantity: 0,
          price: item.effectivePrice,
          action: "removed",
          totalCartItems: updated.reduce((s, it) => s + it.quantity, 0),
          totalCartAmount: updated.reduce((s, it) => s + it.effectivePrice * it.quantity, 0),
          customerName: customerInfo?.name,
          customerPhone: customerInfo?.phone,
          supermarketId: item.supermarket || selectedSupermarket?._id,
          supermarketCode: item.supermarketCode || selectedSupermarket?.code,
        });
      }
      return updated;
    });
  };

  const clearCart = () => {
    setCart([]);
    setCustomerInfo(null);
  };

  const addRecentOrder = (order: OrderRecord) => {
    setRecentOrders((prev) => [order, ...prev.slice(0, 19)]);
  };

  const updateRecentOrder = (updated: OrderRecord) => {
    setRecentOrders((prev) => {
      const idx = prev.findIndex((o) => o._id === updated._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...updated };
        return next;
      }
      return [updated, ...prev];
    });
  };

  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const grossAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalAmount = cart.reduce(
    (sum, item) => sum + item.effectivePrice * item.quantity,
    0
  );
  const totalSavings = Math.max(0, grossAmount - totalAmount);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        totalCount,
        grossAmount,
        totalSavings,
        totalAmount,
        recentOrders,
        addRecentOrder,
        updateRecentOrder,
        customerInfo,
        setCustomerInfo,

        purchaseMode,
        setPurchaseMode,
        fulfillmentType,
        setFulfillmentType,
        selectedSupermarket,
        setSelectedSupermarket,
        customerUser,
        setCustomerUser,
        updateCustomerDetails,
        logoutCustomer,
        verifySupermarketMode,

        deliveryUser,
        setDeliveryUser,
        logoutDeliveryUser,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
