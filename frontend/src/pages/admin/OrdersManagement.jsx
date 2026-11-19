import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ShoppingCart,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  CreditCard,
  QrCode,
  Calendar,
  X,
  Printer,
  Clock,
  Check,
  AlertTriangle,
  TrendingUp,
  IndianRupee,
  ShieldCheck,
  FileText,
  Download,
  Tag,
  Filter,
  Boxes,
  PackageCheck,
  Copy,
  Sparkles,
  BarChart2,
  DollarSign,
  User,
  Phone,
  AlertCircle,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { io } from "socket.io-client";
import API, { SOCKET_URL } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import BarcodeSVG from "../../components/BarcodeSVG";
import ErpPageBanner from "../../components/ErpPageBanner";
import bannerCartImg from "../../assets/banner-cart.png";
import { printSupermarketReceipt } from "../../utils/receiptGenerator";
import { exportStyledExcelReport } from "../../utils/reportsExportGenerator";
import "./ProductManagement.css";

const PAYMENT_METHODS = [
  "All Payment Methods",
  "UPI",
  "Card",
  "Cash",
];

const DATE_PERIODS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week (7 Days)" },
  { value: "month", label: "This Month (30 Days)" },
];

// Universal phone formatter: guarantees standard '+91 XXXXXXXXXX' without duplicated '+91 +91'
const formatPhone = (phone) => {
  if (!phone) return "";
  const cleaned = String(phone).trim();
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length >= 10) {
    return `+91 ${digits.slice(-10)}`;
  }
  return digits ? `+91 ${digits}` : cleaned;
};

export default function OrdersManagement() {
  const [searchParams] = useSearchParams();
  const { user, isSuperAdmin, currentSupermarket } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");

  useEffect(() => {
    const q = searchParams.get("search");
    if (q !== null) {
      setSearch(q);
    }
  }, [searchParams]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [fulfillmentTab, setFulfillmentTab] = useState("ONLINE_ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("All Payment Methods");
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showTopProductsModal, setShowTopProductsModal] = useState(false);

  // Live Supermarket Availability Configuration (Cases 1, 2, 3, 4)
  const [storeAvailability, setStoreAvailability] = useState(() => ({
    onlineDeliveryAvailable: currentSupermarket?.onlineDeliveryAvailable === true,
    selfPickupAvailable: currentSupermarket?.selfPickupAvailable === true,
    storeName: currentSupermarket?.name || "Supermarket",
    storeCode: currentSupermarket?.code || "",
    loaded: false,
  }));

  // Async action tracking
  const [approvingId, setApprovingId] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const fetchStoreAvailability = async () => {
    try {
      const tenantId =
        currentSupermarket?._id ||
        user?.supermarket?._id ||
        (typeof user?.supermarket === "string" ? user.supermarket : null) ||
        currentSupermarket?.code;
      if (tenantId) {
        const res = await API.get(`/supermarkets/${tenantId}/availability`);
        if (res.data?.success && res.data.supermarket) {
          const sm = res.data.supermarket;
          setStoreAvailability({
            onlineDeliveryAvailable: sm.onlineDeliveryAvailable === true,
            selfPickupAvailable: sm.selfPickupAvailable === true,
            storeName: sm.name,
            storeCode: sm.code,
            loaded: true,
          });
        }
      }
    } catch (err) {
      console.warn("Live store availability check:", err.message);
    }
  };

  const fetchOrders = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const res = await API.get("/orders", {
        params: { source: "ONLINE", registrationType: "ONLINE" },
      });
      if (res.data?.success && Array.isArray(res.data.orders)) {
        let orderList = res.data.orders;
        if (!isSuperAdmin) {
          const tenantId = currentSupermarket?._id ? String(currentSupermarket._id) : (user?.supermarket?._id ? String(user.supermarket._id) : (typeof user?.supermarket === "string" ? user.supermarket : null));
          const tenantCode = (currentSupermarket?.code || user?.supermarketCode || "").toUpperCase();
          orderList = orderList.filter((o) => {
            const oId = o.supermarket ? (typeof o.supermarket === "object" ? String(o.supermarket._id || o.supermarket) : String(o.supermarket)) : null;
            const oCode = o.supermarketCode ? String(o.supermarketCode).toUpperCase() : null;
            const matchesTenant = (tenantId && oId && tenantId === oId) || (tenantCode && oCode && tenantCode === oCode);
            // Strict Online filter: never display offline walk-in purchases in Order tab
            const isOnline = o.purchaseMode === "ONLINE" || o.orderType === "DELIVERY" || o.orderType === "SELF_PICKUP";
            return matchesTenant && isOnline;
          });
        }
        setOrders(orderList);
      }
    } catch (err) {
      console.warn("Fetch orders fallback:", err.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(true);
    fetchStoreAvailability();

    // Auto-poll orders every 4 seconds
    const timer = setInterval(() => {
      fetchOrders(false);
    }, 4000);

    let socket;
    try {
      socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
      const refresh = () => fetchOrders(false);
      socket.on("order:created", refresh);
      socket.on("order:updated", refresh);
      socket.on("order:deleted", (data) => {
        if (data?.id) {
          setOrders((prev) => prev.filter((o) => o._id !== data.id && o.orderNumber !== data.orderNumber));
        }
        refresh();
      });
      socket.on("new-order", refresh);
      socket.on("order-status-update", refresh);
      socket.on("platform:stats_updated", refresh);

      socket.on("supermarket:availability_updated", (data) => {
        const tenantId = currentSupermarket?._id ? String(currentSupermarket._id) : (user?.supermarket?._id ? String(user.supermarket._id) : null);
        const tenantCode = (currentSupermarket?.code || user?.supermarketCode || "").toUpperCase();
        if (
          !tenantId ||
          data?.supermarketId === tenantId ||
          (data?.supermarketCode && data.supermarketCode.toUpperCase() === tenantCode)
        ) {
          setStoreAvailability((prev) => ({
            ...prev,
            onlineDeliveryAvailable: data.onlineDeliveryAvailable === true,
            selfPickupAvailable: data.selfPickupAvailable === true,
            loaded: true,
          }));
        }
      });
      socket.on("supermarket:updated", () => {
        fetchStoreAvailability();
      });
    } catch (_) {}

    const handleStorageUpdate = () => {
      fetchOrders(false);
      fetchStoreAvailability();
    };
    window.addEventListener("grocerease_storage_updated", handleStorageUpdate);

    return () => {
      clearInterval(timer);
      if (socket) socket.disconnect();
      window.removeEventListener("grocerease_storage_updated", handleStorageUpdate);
    };
  }, []);

  const handleDeleteOrder = async (orderId, orderNum) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete Order #${orderNum} from the database?\n\nThis will permanently remove this transaction from sales records and customer history. This action cannot be undone.`)) {
      return;
    }
    try {
      setOrders((prev) => prev.filter((o) => o._id !== orderId && o.orderNumber !== orderNum));
      await API.delete(`/orders/${orderId}`);
      setActionMessage(`✓ Order #${orderNum} permanently deleted.`);
      setTimeout(() => setActionMessage(""), 3500);
      fetchOrders(false);
    } catch (err) {
      alert(`Failed to delete order: ${err.response?.data?.message || err.message}`);
    }
  };

  // 1. Super Admin approves customer payment
  const handleApprovePayment = async (orderId, orderNumber) => {
    try {
      setApprovingId(orderId);
      setActionMessage("");
      const res = await API.post(`/orders/${orderId}/approve`);
      if (res.data?.success) {
        setActionMessage(`✓ Order #${orderNumber} payment approved! Customer app updated to "Payment Approved".`);
        window.dispatchEvent(new Event("grocerease_storage_updated"));
        await fetchOrders(false);
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder((prev) => ({ ...prev, paymentStatus: "Approved" }));
        }
        setTimeout(() => setActionMessage(""), 5000);
      }
    } catch (err) {
      console.error("Approve payment error:", err);
      alert(err.response?.data?.message || "Failed to approve payment.");
    } finally {
      setApprovingId(null);
    }
  };

  // 2. Super Admin / Cashier confirms & completes payment (deducts stock)
  const handleCompletePayment = async (orderId, orderNumber) => {
    try {
      setCompletingId(orderId);
      setActionMessage("");
      const res = await API.post(`/orders/${orderId}/complete`);
      if (res.data?.success) {
        setActionMessage(`✓ Order #${orderNumber} marked as Completed & stock verified! Customer app updated to "Payment Completed".`);
        window.dispatchEvent(new Event("grocerease_storage_updated"));
        await fetchOrders(false);
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder((prev) => ({ ...prev, paymentStatus: "Completed" }));
        }
        setTimeout(() => setActionMessage(""), 5000);
      }
    } catch (err) {
      console.error("Complete payment error:", err);
      alert(err.response?.data?.message || "Failed to complete payment.");
    } finally {
      setCompletingId(null);
    }
  };

  // 3. Confirm Cash Received at exit turnstile
  const handleConfirmCash = async (orderId, orderNumber) => {
    try {
      setCompletingId(orderId);
      setActionMessage("");
      const res = await API.post(`/orders/${orderId}/confirm-cash`);
      if (res.data?.success) {
        setActionMessage(`✓ Cash verified for Order #${orderNumber}! Transaction completed & inventory updated.`);
        window.dispatchEvent(new Event("grocerease_storage_updated"));
        await fetchOrders(false);
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder((prev) => ({ ...prev, paymentStatus: "Completed" }));
        }
        setTimeout(() => setActionMessage(""), 5000);
      }
    } catch (err) {
      console.error("Confirm cash error:", err);
      alert(err.response?.data?.message || "Failed to confirm cash payment.");
    } finally {
      setCompletingId(null);
    }
  };

  // 4. Update Self-Pickup status (Pending, ReadyForPickup, Completed, Cancelled)
  const handleUpdatePickupStatus = async (orderId, newStatus) => {
    try {
      const res = await API.put(`/orders/${orderId}/pickup-status`, { pickupStatus: newStatus });
      if (res.data?.success) {
        setActionMessage(`✓ Pickup status updated to "${newStatus}".`);
        setTimeout(() => setActionMessage(""), 3500);
        fetchOrders(false);
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder((prev) => ({ ...prev, pickupStatus: newStatus }));
        }
      }
    } catch (err) {
      alert(`Failed to update pickup status: ${err.response?.data?.message || err.message}`);
    }
  };

  // 5. Update Delivery status (Pending, Assigned, OutForDelivery, Delivered, Failed)
  const handleUpdateDeliveryStatus = async (orderId, newStatus) => {
    try {
      const res = await API.put(`/orders/${orderId}/delivery-status`, { deliveryStatus: newStatus });
      if (res.data?.success) {
        setActionMessage(`✓ Delivery status updated to "${newStatus}".`);
        setTimeout(() => setActionMessage(""), 3500);
        fetchOrders(false);
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder((prev) => ({ ...prev, deliveryStatus: newStatus }));
        }
      }
    } catch (err) {
      alert(`Failed to update delivery status: ${err.response?.data?.message || err.message}`);
    }
  };

  // 6. Simulate a Live Customer Pre-Booking order (for instant testing & verification)
  const handleSimulateCustomerOrder = async () => {
    try {
      setActionMessage("⚡ Simulating real customer self-checkout from mobile app...");
      const prodRes = await API.get("/products");
      const prods = (prodRes.data?.products || []).filter((p) => p.stock > 0);
      const chosenProd = prods[0] || {
        _id: "600000000000000000000001",
        name: "Chocolate",
        price: 352,
      };

      const customerNames = ["Rahul Sharma", "Sneha Reddy", "Vikram Patel", "Divya Nair"];
      const randomName = customerNames[Math.floor(Math.random() * customerNames.length)];
      const randomPhone = `+91 ${Math.floor(7000000000 + Math.random() * 2999999999)}`;
      const randomEmail = `${randomName.toLowerCase().replace(/\s+/g, ".")}@gmail.com`;

      // 1. Log cart activity (triggers live cart item notification)
      await API.post("/orders/cart-activity", {
        customerName: randomName,
        productName: chosenProd.name,
        productId: chosenProd._id,
        quantity: 1,
        price: chosenProd.price,
        action: "added",
      }).catch(() => {});

      const isPickupMode = fulfillmentTab === "PICKUP" || (!storeAvailability.onlineDeliveryAvailable && storeAvailability.selfPickupAvailable);

      // 2. Checkout pre-booking order
      const checkoutRes = await API.post("/orders/checkout", {
        items: [
          {
            _id: chosenProd._id,
            name: chosenProd.name,
            price: chosenProd.price,
            quantity: 1,
          },
        ],
        paymentMethod: "UPI",
        orderType: isPickupMode ? "SELF_PICKUP" : "DELIVERY",
        pickupDate: isPickupMode ? "Today" : undefined,
        pickupTimeSlot: isPickupMode ? "10:00 AM - 12:00 PM" : undefined,
        pickupStatus: isPickupMode ? "Pending" : undefined,
        deliveryAddress: !isPickupMode ? "123 Indiranagar, 100ft Rd, Bangalore" : undefined,
        customer: {
          name: randomName,
          phone: randomPhone,
          email: randomEmail,
          address: "Bangalore",
        },
      });

      if (checkoutRes.data?.success) {
        setActionMessage(`✓ Real-time customer ${isPickupMode ? "pickup" : "delivery"} pre-booking created for ${randomName}! Notification bell updated.`);
        window.dispatchEvent(new Event("grocerease_storage_updated"));
        await fetchOrders(false);
        setStatusFilter("PENDING");
        setTimeout(() => setActionMessage(""), 5000);
      }
    } catch (err) {
      console.error("Simulation error:", err);
      setActionMessage("Notice: " + (err.response?.data?.message || err.message));
      setTimeout(() => setActionMessage(""), 5000);
    }
  };

  // Copy order ID helper
  const handleCopyId = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(""), 2000);
  };

  // Determine Dynamic Fulfillment Tab Scenario based on Super Admin configuration:
  // - Case 1: Only Online Delivery enabled -> Display ONLY Delivery tab
  // - Case 2: Only Self Pickup enabled -> Display ONLY Pickup tab
  // - Case 3: Both enabled -> Display exactly THREE tabs: Online Orders, Pickup, Delivery
  // - Case 4: Both disabled -> Do not display these purchase-order management tabs
  const isOnlineDeliveryEnabled = storeAvailability.onlineDeliveryAvailable === true;
  const isSelfPickupEnabled = storeAvailability.selfPickupAvailable === true;

  const fulfillmentScenario = useMemo(() => {
    if (isSuperAdmin && !currentSupermarket) return "CASE_3_BOTH";

    if (isOnlineDeliveryEnabled && isSelfPickupEnabled) return "CASE_3_BOTH";
    if (isOnlineDeliveryEnabled && !isSelfPickupEnabled) return "CASE_1_DELIVERY_ONLY";
    if (!isOnlineDeliveryEnabled && isSelfPickupEnabled) return "CASE_2_PICKUP_ONLY";
    return "CASE_4_NEITHER";
  }, [isSuperAdmin, currentSupermarket, isOnlineDeliveryEnabled, isSelfPickupEnabled]);

  // Synchronize active fulfillment tab with scenario changes
  useEffect(() => {
    if (fulfillmentScenario === "CASE_1_DELIVERY_ONLY") {
      setFulfillmentTab("DELIVERY");
    } else if (fulfillmentScenario === "CASE_2_PICKUP_ONLY") {
      setFulfillmentTab("PICKUP");
    } else if (fulfillmentScenario === "CASE_3_BOTH") {
      setFulfillmentTab((prev) =>
        prev === "DELIVERY" || prev === "PICKUP" || prev === "ONLINE_ALL" ? prev : "ONLINE_ALL"
      );
    } else {
      setFulfillmentTab("NONE");
    }
  }, [fulfillmentScenario]);

  // Dedicated lists for fulfillment badge counts
  const onlineOrdersList = useMemo(() => {
    return orders.filter(
      (o) => o.purchaseMode === "ONLINE" || o.orderType === "DELIVERY" || o.orderType === "SELF_PICKUP"
    );
  }, [orders]);

  const pickupOrdersList = useMemo(() => {
    return orders.filter(
      (o) => o.orderType === "SELF_PICKUP" || Boolean(o.pickupDate) || Boolean(o.pickupTimeSlot)
    );
  }, [orders]);

  const deliveryOrdersList = useMemo(() => {
    return orders.filter((o) => {
      const isPickup = o.orderType === "SELF_PICKUP" || Boolean(o.pickupDate) || Boolean(o.pickupTimeSlot);
      return (o.orderType === "DELIVERY" || Boolean(o.deliveryAddress)) && !isPickup;
    });
  }, [orders]);

  // Filtered Orders Calculation according to Fulfillment Tab and Status Filter
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return orders.filter((o) => {
      // 1. Fulfillment Tab isolation
      if (fulfillmentScenario === "CASE_4_NEITHER") {
        return false;
      }

      const isPickup = o.orderType === "SELF_PICKUP" || Boolean(o.pickupDate) || Boolean(o.pickupTimeSlot);
      const isDelivery = (o.orderType === "DELIVERY" || Boolean(o.deliveryAddress)) && !isPickup;
      const isOnline = o.purchaseMode === "ONLINE" || isPickup || isDelivery;

      if (fulfillmentTab === "DELIVERY") {
        if (!isDelivery) return false;
      } else if (fulfillmentTab === "PICKUP") {
        if (!isPickup) return false;
      } else if (fulfillmentTab === "ONLINE_ALL") {
        if (!isOnline) return false;
      }

      // 2. Status Tab filter
      if (statusFilter === "PENDING" && o.paymentStatus !== "Pending") return false;
      if (statusFilter === "APPROVED" && o.paymentStatus !== "Approved") return false;
      if (statusFilter === "COMPLETED" && o.paymentStatus !== "Completed") return false;
      if (statusFilter === "FAILED" && o.paymentStatus !== "Failed") return false;

      // 3. Payment Method filter
      if (paymentMethodFilter !== "All Payment Methods" && o.paymentMethod !== paymentMethodFilter) {
        return false;
      }

      // 4. Date range filter
      if (dateFilter !== "all" && o.createdAt) {
        const orderDate = new Date(o.createdAt);
        if (dateFilter === "today" && orderDate < startOfToday) return false;
        if (dateFilter === "week" && orderDate < sevenDaysAgo) return false;
        if (dateFilter === "month" && orderDate < thirtyDaysAgo) return false;
        if (dateFilter === "custom") {
          if (customStartDate) {
            const [sY, sM, sD] = customStartDate.split("-").map(Number);
            const sDate = new Date(sY, sM - 1, sD, 0, 0, 0, 0);
            if (orderDate < sDate) return false;
          }
          if (customEndDate) {
            const [eY, eM, eD] = customEndDate.split("-").map(Number);
            const eDate = new Date(eY, eM - 1, eD, 23, 59, 59, 999);
            if (orderDate > eDate) return false;
          }
        }
      }

      // 5. Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchNumber = o.orderNumber?.toLowerCase().includes(q);
        const matchCustomer = o.customer?.name?.toLowerCase().includes(q);
        const matchEmail = o.customer?.email?.toLowerCase().includes(q);
        const matchPhone = o.customer?.phone?.toLowerCase().includes(q);
        const matchExit = o.exitBarcode?.toLowerCase().includes(q);
        const matchItem = o.items?.some((it) => it.name?.toLowerCase().includes(q));

        if (!matchNumber && !matchCustomer && !matchEmail && !matchPhone && !matchExit && !matchItem) {
          return false;
        }
      }

      return true;
    });
  }, [
    orders,
    fulfillmentScenario,
    fulfillmentTab,
    statusFilter,
    paymentMethodFilter,
    dateFilter,
    customStartDate,
    customEndDate,
    search,
  ]);

  // Executive KPI Metrics
  const totalOrdersCount = orders.length;

  const completedOrders = useMemo(() => {
    return orders.filter((o) => o.paymentStatus === "Completed");
  }, [orders]);

  const pendingOrders = useMemo(() => {
    return orders.filter((o) => o.paymentStatus === "Pending");
  }, [orders]);

  const approvedOrders = useMemo(() => {
    return orders.filter((o) => o.paymentStatus === "Approved");
  }, [orders]);

  const failedOrders = useMemo(() => {
    return orders.filter((o) => o.paymentStatus === "Failed");
  }, [orders]);

  const pendingCashOrders = useMemo(() => {
    return orders.filter((o) => o.paymentStatus === "Pending" && o.paymentMethod === "Cash");
  }, [orders]);

  // Total Verified Sales (Completed orders ONLY)
  const totalVerifiedSales = useMemo(() => {
    return completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  }, [completedOrders]);

  const pendingCashAmount = useMemo(() => {
    return pendingCashOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  }, [pendingCashOrders]);

  // Sales Intelligence breakdown (Today, Week, Month, AOV, Discounts, Net)
  const salesIntelligence = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let todaySales = 0;
    let todayOrdersCount = 0;
    let weekSales = 0;
    let weekOrdersCount = 0;
    let monthSales = 0;
    let monthOrdersCount = 0;

    let totalDiscounts = 0;
    let grossSubtotal = 0;

    completedOrders.forEach((o) => {
      const amt = Number(o.totalAmount || 0);
      const disc = Number(o.discountAmount || 0);
      const sub = Number(o.subtotalAmount || amt + disc);

      totalDiscounts += disc;
      grossSubtotal += sub;

      if (o.createdAt) {
        const d = new Date(o.createdAt);
        if (d >= startOfToday) {
          todaySales += amt;
          todayOrdersCount += 1;
        }
        if (d >= sevenDaysAgo) {
          weekSales += amt;
          weekOrdersCount += 1;
        }
        if (d >= thirtyDaysAgo) {
          monthSales += amt;
          monthOrdersCount += 1;
        }
      }
    });

    const aov = completedOrders.length > 0 ? totalVerifiedSales / completedOrders.length : 0;
    const netSales = Math.max(0, grossSubtotal - totalDiscounts);

    return {
      todaySales,
      todayOrdersCount,
      weekSales,
      weekOrdersCount,
      monthSales,
      monthOrdersCount,
      totalDiscounts,
      netSales,
      aov,
    };
  }, [completedOrders, totalVerifiedSales]);

  // Top Selling Products aggregated from completed orders line items
  const topSellingProducts = useMemo(() => {
    const map = {};

    completedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = item.name || "Unknown Item";
        if (!map[key]) {
          map[key] = {
            name: key,
            brand: item.brand || "",
            category: item.category || "General",
            imageUrl: item.imageUrl || "",
            unitsSold: 0,
            revenue: 0,
          };
        }
        map[key].unitsSold += Number(item.quantity || 1);
        map[key].revenue += Number(item.subtotal || item.price * (item.quantity || 1));
      });
    });

    return Object.values(map).sort((a, b) => b.unitsSold - a.unitsSold);
  }, [completedOrders]);

  // Export Filtered Orders to Styled Excel (.xls) with Colored Headers
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert("No orders available to export for the selected filter.");
      return;
    }

    exportStyledExcelReport({
      orders: filteredOrders,
      activeTab: "sales",
      datePreset: dateFilter,
      customStartDate,
      customEndDate,
    });
    setActionMessage(`✓ Exported ${filteredOrders.length} orders into formatted Excel with colored headers!`);
    setTimeout(() => setActionMessage(""), 4000);
  };

  // Official Tax Invoice / Receipt Printing (Identical to Customer Mobile Receipt)
  const handlePrintTaxInvoice = (order) => {
    printSupermarketReceipt(order);
  };

  return (
    <div className="grocer-page-container">
      {/* ========================================================================= */}
      {/* 1. TOP HERO BANNER - STRICT ONLINE REGISTRATIONS ONLY                     */}
      {/* ========================================================================= */}
      <ErpPageBanner
        title="Orders Management (Online Registrations Only)"
        subtitle="Customer orders and pre-bookings from ONLINE registrations • Digital carts, pickup & delivery dispatch"
        badges={["ONLINE Registrations Only", "Strict Multi-Tenant Scoping", "Real-Time Tracking"]}
        icon={<ShoppingCart size={22} color="#ffffff" strokeWidth={2.4} />}
      />

      {/* Toast Feedback Notification */}
      {actionMessage && (
        <div
          style={{
            background: "#DCFCE7",
            border: "1px solid #86EFAC",
            color: "#166534",
            padding: "12px 18px",
            borderRadius: "14px",
            fontSize: "13.5px",
            fontWeight: "700",
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 12px rgba(22, 101, 52, 0.08)",
          }}
        >
          <CheckCircle2 size={18} />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. FIVE HORIZONTAL EXECUTIVE KPI CARDS                                    */}
      {/* ========================================================================= */}
      <section className="om-kpi-grid-5">
        {/* Card 1: Total Orders */}
        <div className="pm-kpi-card blue-theme">
          <div className="pm-kpi-icon-pill blue">
            <ShoppingCart size={20} color="#2563EB" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">{totalOrdersCount}</h3>
            <span className="pm-kpi-label">Total Customer Orders</span>
            <div className="pm-kpi-trend green">
              <span className="trend-arrow">↑</span>
              <span>
                {totalOrdersCount > 0
                  ? `${Math.round((completedOrders.length / totalOrdersCount) * 100)}% verified`
                  : "0%"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Verified Sales */}
        <div className="pm-kpi-card green-theme">
          <div className="pm-kpi-icon-pill green">
            <IndianRupee size={20} color="#059669" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">₹{totalVerifiedSales.toLocaleString("en-IN")}</h3>
            <span className="pm-kpi-label">Total Verified Sales</span>
            <div className="pm-kpi-trend green">
              <span className="trend-arrow">✓</span>
              <span>Completed Only</span>
            </div>
          </div>
        </div>

        {/* Card 3: Completed Orders */}
        <div className="pm-kpi-card green-theme">
          <div className="pm-kpi-icon-pill green">
            <PackageCheck size={20} color="#059669" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">{completedOrders.length}</h3>
            <span className="pm-kpi-label">Completed Orders</span>
            <div className="pm-kpi-trend green">
              <span className="trend-arrow">✓</span>
              <span>Stock Deducted</span>
            </div>
          </div>
        </div>

        {/* Card 4: Pending Cash at Exit */}
        <div className="pm-kpi-card yellow-theme">
          <div className="pm-kpi-icon-pill yellow">
            <Clock size={20} color="#D97706" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">{pendingOrders.length}</h3>
            <span className="pm-kpi-label">Pending Approval</span>
            <div className="pm-kpi-trend" style={{ color: pendingOrders.length > 0 ? "#D97706" : "#64748B" }}>
              <span className="trend-arrow">⏳</span>
              <span>₹{pendingCashAmount.toLocaleString("en-IN")} Cash at Exit</span>
            </div>
          </div>
        </div>

        {/* Card 5: Approved / In Progress */}
        <div className="pm-kpi-card purple-theme">
          <div className="pm-kpi-icon-pill purple">
            <ShieldCheck size={20} color="#7C3AED" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">{approvedOrders.length}</h3>
            <span className="pm-kpi-label">Approved Orders</span>
            <div className="pm-kpi-trend green">
              <span className="trend-arrow">✓</span>
              <span>Ready for Exit Gate</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. EXECUTIVE SALES INTELLIGENCE & REVENUE LEDGER BANNER                   */}
      

      {/* ========================================================================= */}
      {/* 4. DYNAMIC FULFILLMENT ORDER TABS (STRICT SUPER ADMIN CONFIGURATION)       */}
      {/* ========================================================================= */}
      <div style={{ marginBottom: "16px" }}>
        {fulfillmentScenario === "CASE_4_NEITHER" ? (
          <div
            style={{
              background: "#FEF2F2",
              border: "1.5px solid #FCA5A5",
              borderRadius: "14px",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              color: "#991B1B",
            }}
          >
            <AlertTriangle size={24} color="#DC2626" />
            <div>
              <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 800 }}>
                Online Ordering &amp; Fulfillment Disabled by Super Admin
              </h4>
              <p style={{ margin: 0, fontSize: "12.5px", color: "#B91C1C", lineHeight: 1.4 }}>
                Neither <strong>Online Delivery</strong> nor <strong>Self Pickup</strong> is currently enabled for this supermarket.
                Purchase order management tabs are hidden until permissions are configured by Super Admin.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* Main Fulfillment Tabs */}
            <div className="om-tabs-strip">
              {/* Case 3: Both enabled -> Exactly THREE tabs: 1. Online Orders, 2. Pickup, 3. Delivery */}
              {fulfillmentScenario === "CASE_3_BOTH" && (
                <>
                  <button
                    type="button"
                    className={`om-tab-btn ${fulfillmentTab === "ONLINE_ALL" ? "active" : ""}`}
                    onClick={() => setFulfillmentTab("ONLINE_ALL")}
                    style={{ fontSize: "13px", padding: "8px 18px" }}
                  >
                    <span>🌐 Online Orders</span>
                    <span style={{ opacity: 0.85, fontSize: "11px", fontWeight: 800 }}>
                      ({onlineOrdersList.length})
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`om-tab-btn ${fulfillmentTab === "PICKUP" ? "active" : ""}`}
                    onClick={() => setFulfillmentTab("PICKUP")}
                    style={
                      fulfillmentTab === "PICKUP"
                        ? { background: "#7C3AED", borderColor: "#7C3AED", color: "#FFFFFF" }
                        : { borderColor: "#DDD6FE", color: "#6D28D9" }
                    }
                  >
                    <span>🏪 Pickup</span>
                    <span style={{ opacity: 0.85, fontSize: "11px", fontWeight: 800 }}>
                      ({pickupOrdersList.length})
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`om-tab-btn ${fulfillmentTab === "DELIVERY" ? "active" : ""}`}
                    onClick={() => setFulfillmentTab("DELIVERY")}
                    style={
                      fulfillmentTab === "DELIVERY"
                        ? { background: "#0284C7", borderColor: "#0284C7", color: "#FFFFFF" }
                        : { borderColor: "#BAE6FD", color: "#0369A1" }
                    }
                  >
                    <span>🚚 Delivery</span>
                    <span style={{ opacity: 0.85, fontSize: "11px", fontWeight: 800 }}>
                      ({deliveryOrdersList.length})
                    </span>
                  </button>
                </>
              )}

              {/* Case 1: Only Online Delivery enabled -> Display ONLY Delivery tab */}
              {fulfillmentScenario === "CASE_1_DELIVERY_ONLY" && (
                <button
                  type="button"
                  className={`om-tab-btn ${fulfillmentTab === "DELIVERY" ? "active" : ""}`}
                  onClick={() => setFulfillmentTab("DELIVERY")}
                  style={{
                    fontSize: "13px",
                    padding: "8px 20px",
                    background: "#0284C7",
                    borderColor: "#0284C7",
                    color: "#FFFFFF",
                  }}
                >
                  <span>🚚 Delivery</span>
                  <span style={{ opacity: 0.9, fontSize: "11px", fontWeight: 800 }}>
                    ({deliveryOrdersList.length})
                  </span>
                </button>
              )}

              {/* Case 2: Only Self Pickup enabled -> Display ONLY Pickup tab */}
              {fulfillmentScenario === "CASE_2_PICKUP_ONLY" && (
                <button
                  type="button"
                  className={`om-tab-btn ${fulfillmentTab === "PICKUP" ? "active" : ""}`}
                  onClick={() => setFulfillmentTab("PICKUP")}
                  style={{
                    fontSize: "13px",
                    padding: "8px 20px",
                    background: "#7C3AED",
                    borderColor: "#7C3AED",
                    color: "#FFFFFF",
                  }}
                >
                  <span>🏪 Pickup</span>
                  <span style={{ opacity: 0.9, fontSize: "11px", fontWeight: 800 }}>
                    ({pickupOrdersList.length})
                  </span>
                </button>
              )}
            </div>

            {/* Status Filter Sub-Strip */}
            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", paddingTop: "2px" }}>
              <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#64748B", marginRight: "4px" }}>
                Filter Status:
              </span>
              {[
                { key: "ALL", label: `All (${filteredOrders.length})` },
                { key: "PENDING", label: `⏳ Pending (${pendingOrders.length})` },
                { key: "APPROVED", label: `🛡️ Approved (${approvedOrders.length})` },
                { key: "COMPLETED", label: `✓ Completed (${completedOrders.length})` },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setStatusFilter(st.key)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "16px",
                    border: statusFilter === st.key ? "1.5px solid #2563EB" : "1px solid #E2E8F0",
                    background: statusFilter === st.key ? "#EFF6FF" : "#FFFFFF",
                    color: statusFilter === st.key ? "#1D4ED8" : "#475569",
                    fontWeight: 700,
                    fontSize: "11px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. SEARCH & FILTER TOOLBAR                                                */}
      {/* ========================================================================= */}
      <section className="pm-toolbar-row">
        <div className="pm-toolbar-search">
          <Search size={18} className="pm-search-ico" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Order ID (ORD-...), customer name, phone, item name, or exit barcode..."
          />
        </div>

        <div className="pm-toolbar-filters">
          {/* Payment Method Filter */}
          <div className="pm-select-pill-wrap">
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="pm-select-pill"
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </select>
          </div>

          {/* Date Period Filter */}
          <div className="pm-select-pill-wrap">
            <select
              value={dateFilter}
              onChange={(e) => {
                const val = e.target.value;
                setDateFilter(val);
                if (val === "custom" && !customStartDate && !customEndDate) {
                  const now = new Date();
                  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                  const format = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                  setCustomStartDate(format(sevenDaysAgo));
                  setCustomEndDate(format(now));
                }
              }}
              className="pm-select-pill"
            >
              {DATE_PERIODS.map((dp) => (
                <option key={dp.value} value={dp.value}>
                  {dp.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. ORDERS LEDGER TABLE                                                    */}
      {/* ========================================================================= */}
      <div className="pm-catalog-card">
        <div className="pm-catalog-header">
          <div className="pm-catalog-title-group">
            <div className="pm-catalog-icon-box">
              <ShoppingCart size={18} color="#FFFFFF" />
            </div>
            <h3 className="pm-catalog-heading">
              Orders Ledger ({filteredOrders.length} Records)
              {statusFilter === "PENDING" && " — Awaiting Cash or Staff Verification"}
            </h3>
          </div>

          <div className="om-ledger-actions" style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 600, marginRight: "6px" }}>
              Showing {filteredOrders.length} of {orders.length}
            </span>

            <button
              type="button"
              className="pm-action-btn primary"
              onClick={handleExportCSV}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                background: "#1D4ED8",
                color: "#FFFFFF",
                border: "none",
                cursor: "pointer",
              }}
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              className="pm-action-btn"
              onClick={() => setShowTopProductsModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                background: "#F1F5F9",
                color: "#1E293B",
                border: "1px solid #CBD5E1",
                cursor: "pointer",
              }}
            >
              <BarChart2 size={13} />
              <span>Top Selling</span>
            </button>

            <button
              type="button"
              className="pm-action-btn"
              onClick={handleSimulateCustomerOrder}
              disabled={loading}
              title="Place a real-time customer pre-booking to test live notifications and payment approval"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                background: "#EFF6FF",
                color: "#1D4ED8",
                border: "1px solid #BFDBFE",
                cursor: "pointer",
              }}
            >
              <Sparkles size={13} color="#2563EB" />
              <span>⚡ Place Live Customer Order</span>
            </button>

            <button
              type="button"
              className="pm-action-btn"
              onClick={() => fetchOrders(true)}
              disabled={loading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                background: "#F1F5F9",
                color: "#1E293B",
                border: "1px solid #CBD5E1",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={13} className={loading ? "spin" : ""} />
              <span>{loading ? "Syncing..." : "Sync Orders"}</span>
            </button>
          </div>
        </div>

        <div className="pm-table-wrapper">
          {filteredOrders.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 20px",
                color: "#64748B",
              }}
            >
              <ShoppingCart size={36} color="#CBD5E1" style={{ margin: "0 auto 12px" }} />
              <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>
                No customer orders match the current filter.
              </p>
              <span style={{ fontSize: "13px" }}>
                Orders placed via the Customer Mobile App will appear here instantly.
              </span>
            </div>
          ) : (
            <table className="pm-products-table">
              <thead>
                <tr>
                  <th style={{ width: "13%", whiteSpace: "nowrap" }}>ORDER ID &amp; TIME</th>
                  <th style={{ width: "15%", whiteSpace: "nowrap" }}>CUSTOMER DETAILS</th>
                  <th style={{ width: "13%" }}>PRODUCTS</th>
                  <th style={{ width: "19%" }}>FULFILLMENT &amp; DETAILS</th>
                  <th style={{ width: "9%", whiteSpace: "nowrap" }}>PAYMENT</th>
                  <th style={{ width: "9%", whiteSpace: "nowrap" }}>TOTAL</th>
                  <th style={{ width: "8%", whiteSpace: "nowrap" }}>STATUS</th>
                  <th style={{ width: "7%", whiteSpace: "nowrap" }}>EXIT PASS</th>
                  <th style={{ width: "7%", textAlign: "center", whiteSpace: "nowrap" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((ord) => {
                  const isPending = ord.paymentStatus === "Pending";
                  const isApproved = ord.paymentStatus === "Approved";
                  const isCompleted = ord.paymentStatus === "Completed";
                  const isCash = ord.paymentMethod === "Cash";

                  const orderDate = new Date(ord.createdAt || Date.now());
                  const formattedDate = orderDate.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
                  const formattedTime = orderDate.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  const isPickup = ord.orderType === "SELF_PICKUP" || Boolean(ord.pickupDate) || Boolean(ord.pickupTimeSlot);
                  const isDelivery = (ord.orderType === "DELIVERY" || Boolean(ord.deliveryAddress)) && !isPickup;

                  return (
                    <tr key={ord._id}>
                      {/* Order Number & Timestamp */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span
                              style={{
                                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                fontSize: "13px",
                                fontWeight: 800,
                                letterSpacing: "0.2px",
                                color: "#1D4ED8",
                                background: "#EFF6FF",
                                padding: "4px 9px",
                                borderRadius: "6px",
                                border: "1px solid #DBEAFE",
                                whiteSpace: "nowrap",
                                display: "inline-block",
                              }}
                            >
                              {ord.orderNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyId(ord.orderNumber)}
                              title="Copy Order ID"
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: copiedId === ord.orderNumber ? "#16A34A" : "#94A3B8",
                                padding: "2px",
                                display: "inline-flex",
                              }}
                            >
                              {copiedId === ord.orderNumber ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                          <span style={{ fontSize: "11px", color: "#64748B", whiteSpace: "nowrap" }}>
                            {formattedDate} &bull; {formattedTime}
                          </span>
                        </div>
                      </td>

                      {/* Customer Info: Name, Phone & Email */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <strong style={{ fontSize: "13px", color: "#0F172A", whiteSpace: "nowrap" }}>
                              {ord.customer?.name || "Customer"}
                            </strong>
                            <span
                              style={{
                                fontSize: "9.5px",
                                fontWeight: 800,
                                padding: "1px 6px",
                                borderRadius: "4px",
                                background: "#EFF6FF",
                                color: "#1D4ED8",
                                border: "1px solid #BFDBFE",
                                letterSpacing: "0.3px",
                              }}
                            >
                              ONLINE
                            </span>
                          </div>
                          {ord.customer?.phone && (
                            <span style={{ fontSize: "11px", color: "#64748B", display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
                              <Phone size={11} /> {formatPhone(ord.customer.phone)}
                            </span>
                          )}
                          {ord.customer?.email && (
                            <span style={{ fontSize: "10.5px", color: "#2563EB", fontWeight: 600, whiteSpace: "nowrap" }}>
                              ✉️ {ord.customer.email}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Purchased Products */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span
                            style={{
                              fontSize: "11.5px",
                              fontWeight: 800,
                              background: "#F1F5F9",
                              color: "#334155",
                              padding: "2px 7px",
                              borderRadius: "6px",
                              width: "fit-content",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {ord.totalItems || ord.items?.reduce((s, i) => s + i.quantity, 0) || 1} items
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#475569",
                              maxWidth: "180px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "block",
                            }}
                            title={(ord.items || []).map((i) => `${i.name} (x${i.quantity})`).join(", ")}
                          >
                            {(ord.items || []).map((i) => `${i.name} (x${i.quantity})`).join(", ") || "Purchased Goods"}
                          </span>
                        </div>
                      </td>

                      {/* Fulfillment Details (Pickup / Delivery / In-Store) */}
                      <td>
                        {isPickup ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 800,
                                background: "#F5F3FF",
                                color: "#7C3AED",
                                border: "1px solid #DDD6FE",
                                padding: "2px 7px",
                                borderRadius: "5px",
                                width: "fit-content",
                                whiteSpace: "nowrap",
                              }}
                            >
                              🏪 Self Pickup
                            </span>
                            <span style={{ fontSize: "11px", color: "#1E293B", fontWeight: 700, whiteSpace: "nowrap" }}>
                              📅 {ord.pickupDate || "Today"} &bull; ⏰ {ord.pickupTimeSlot || "Standard"}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "2px" }}>
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background:
                                    ord.pickupStatus === "Completed"
                                      ? "#DCFCE7"
                                      : ord.pickupStatus === "ReadyForPickup"
                                      ? "#DBEAFE"
                                      : "#FEF3C7",
                                  color:
                                    ord.pickupStatus === "Completed"
                                      ? "#166534"
                                      : ord.pickupStatus === "ReadyForPickup"
                                      ? "#1E40AF"
                                      : "#92400E",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {ord.pickupStatus === "ReadyForPickup"
                                  ? "Ready for Pickup"
                                  : ord.pickupStatus === "Completed"
                                  ? "✓ Picked Up"
                                  : "⏳ Awaiting Pickup"}
                              </span>
                              {ord.pickupStatus !== "Completed" && (
                                <select
                                  value={ord.pickupStatus || "Pending"}
                                  onChange={(e) => handleUpdatePickupStatus(ord._id, e.target.value)}
                                  style={{
                                    fontSize: "10px",
                                    padding: "2px 4px",
                                    borderRadius: "4px",
                                    border: "1px solid #CBD5E1",
                                    background: "#FFFFFF",
                                    cursor: "pointer",
                                  }}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="ReadyForPickup">Ready</option>
                                  <option value="Completed">Completed</option>
                                </select>
                              )}
                            </div>
                          </div>
                        ) : isDelivery ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 800,
                                background: "#EFF6FF",
                                color: "#0284C7",
                                border: "1px solid #BAE6FD",
                                padding: "2px 7px",
                                borderRadius: "5px",
                                width: "fit-content",
                                whiteSpace: "nowrap",
                              }}
                            >
                              🚚 Online Delivery
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#334155",
                                maxWidth: "180px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={ord.deliveryAddress || ord.customer?.address}
                            >
                              📍 {ord.deliveryAddress || ord.customer?.address || "Address on file"}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "2px" }}>
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background:
                                    ord.deliveryStatus === "Delivered"
                                      ? "#DCFCE7"
                                      : ord.deliveryStatus === "OutForDelivery"
                                      ? "#DBEAFE"
                                      : "#FEF3C7",
                                  color:
                                    ord.deliveryStatus === "Delivered"
                                      ? "#166534"
                                      : ord.deliveryStatus === "OutForDelivery"
                                      ? "#1E40AF"
                                      : "#92400E",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {ord.deliveryStatus || "Pending"}
                              </span>
                              {ord.deliveryStatus !== "Delivered" && (
                                <select
                                  value={ord.deliveryStatus || "Pending"}
                                  onChange={(e) => handleUpdateDeliveryStatus(ord._id, e.target.value)}
                                  style={{
                                    fontSize: "10px",
                                    padding: "2px 4px",
                                    borderRadius: "4px",
                                    border: "1px solid #CBD5E1",
                                    background: "#FFFFFF",
                                    cursor: "pointer",
                                  }}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Assigned">Assigned</option>
                                  <option value="OutForDelivery">Out for Delivery</option>
                                  <option value="Delivered">Delivered</option>
                                </select>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 800,
                                background: "#F0FDF4",
                                color: "#16A34A",
                                border: "1px solid #BBF7D0",
                                padding: "2px 7px",
                                borderRadius: "5px",
                                width: "fit-content",
                                whiteSpace: "nowrap",
                              }}
                            >
                              🛒 In-Store POS
                            </span>
                            <span style={{ fontSize: "10.5px", color: "#64748B" }}>
                              Self Clearance
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span
                          className={`om-method-tag ${
                            ord.paymentMethod?.toLowerCase().includes("upi")
                              ? "upi"
                              : ord.paymentMethod?.toLowerCase().includes("card")
                              ? "card"
                              : "cash"
                          }`}
                        >
                          {ord.paymentMethod === "Cash" ? "Cash at Exit" : ord.paymentMethod || "UPI"}
                        </span>
                      </td>

                      {/* Amount Details */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                          <span className="pm-price-bold" style={{ fontSize: "14.5px" }}>
                            ₹{Number(ord.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                          {ord.discountAmount > 0 && (
                            <span style={{ fontSize: "10.5px", color: "#059669", fontWeight: 700 }}>
                              Saved ₹{Number(ord.discountAmount).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Dedicated Payment Status Column */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        {isPending ? (
                          <span className="om-status-pill pending">⏳ Pending</span>
                        ) : isApproved ? (
                          <span className="om-status-pill approved">🛡️ Approved</span>
                        ) : isCompleted ? (
                          <span className="om-status-pill completed">✓ Completed</span>
                        ) : (
                          <span className="om-status-pill failed">✕ Failed</span>
                        )}
                      </td>

                      {/* Exit Barcode */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span
                            style={{
                              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                              fontSize: "12.5px",
                              fontWeight: 700,
                              color: "#0F172A",
                              letterSpacing: "0.4px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {ord.exitBarcode}
                          </span>
                          <span style={{ fontSize: "10px", color: isCompleted ? "#059669" : "#D97706", fontWeight: 700, whiteSpace: "nowrap" }}>
                            {isCompleted ? "● Gate Pass Active" : "● Requires Payment"}
                          </span>
                        </div>
                      </td>

                      {/* Unified Actions Column */}
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          {/* Workflow buttons */}
                          {isPending && (
                            <>
                              <button
                                type="button"
                                className="om-action-btn approve"
                                onClick={() => handleApprovePayment(ord._id, ord.orderNumber)}
                                disabled={approvingId === ord._id}
                                title="Approve payment request"
                              >
                                {approvingId === ord._id ? "..." : (
                                  <>
                                    <Check size={12} /> <span>Approve</span>
                                  </>
                                )}
                              </button>
                              {isCash && (
                                <button
                                  type="button"
                                  className="om-action-btn complete"
                                  onClick={() => handleConfirmCash(ord._id, ord.orderNumber)}
                                  disabled={completingId === ord._id}
                                  title="Confirm cash received"
                                >
                                  {completingId === ord._id ? "..." : <span>Cash</span>}
                                </button>
                              )}
                            </>
                          )}

                          {isApproved && (
                            <button
                              type="button"
                              className="om-action-btn complete"
                              onClick={() => handleCompletePayment(ord._id, ord.orderNumber)}
                              disabled={completingId === ord._id}
                              title="Mark payment completed & verify"
                            >
                              {completingId === ord._id ? "..." : (
                                <>
                                  <CheckCircle2 size={12} /> <span>Complete</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* View & Print Action Circles matching ProductManagement */}
                          <button
                            type="button"
                            className="pm-action-circle blue"
                            onClick={() => setSelectedOrder(ord)}
                            title="View Full Tax Receipt Details"
                            style={{ width: "30px", height: "30px" }}
                          >
                            <Eye size={14} color="#2563EB" />
                          </button>

                          <button
                            type="button"
                            className="pm-action-circle blue"
                            onClick={() => handlePrintTaxInvoice(ord)}
                            title="Print Tax Invoice / Cash Memo"
                            style={{ width: "30px", height: "30px" }}
                          >
                            <Printer size={14} color="#2563EB" />
                          </button>

                          <button
                            type="button"
                            className="pm-action-circle"
                            onClick={() => handleDeleteOrder(ord._id, ord.orderNumber)}
                            title={`Permanently delete Order #${ord.orderNumber}`}
                            style={{ width: "30px", height: "30px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                          >
                            <Trash2 size={13} color="#dc2626" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. DIGITAL TAX RECEIPT & EXIT VERIFICATION MODAL                           */}
      {/* ========================================================================= */}
      {selectedOrder && (
        <div className="pm-modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div
            className="pm-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "520px", padding: "20px 24px" }}
          >
            <div className="pm-modal-header" style={{ marginBottom: "12px" }}>
              <div>
                <h3 className="pm-modal-title">Customer Tax Invoice / Cash Memo</h3>
                <span style={{ fontSize: "11px", color: "#64748B" }}>
                  Verified Autonomous Self-Checkout Record
                </span>
              </div>
              <button
                type="button"
                className="pm-modal-close"
                onClick={() => setSelectedOrder(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="om-receipt-container">
              {/* Store Header */}
              <div className="om-receipt-header">
                <h3>🛒 GROCEREASE SUPERMARKET</h3>
                <p>Smart Autonomous Retail & Self-Checkout System</p>
                <p>Register #01 &bull; GSTIN: 29AABCU9603R1ZM</p>
              </div>

              {/* Order Meta */}
              <div className="om-receipt-row">
                <span>Customer Name:</span>
                <strong>{selectedOrder.customer?.name || "Customer"}</strong>
              </div>
              {selectedOrder.customer?.phone && (
                <div className="om-receipt-row">
                  <span>Mobile Number:</span>
                  <span>{formatPhone(selectedOrder.customer.phone)}</span>
                </div>
              )}
              {selectedOrder.customer?.email && (
                <div className="om-receipt-row">
                  <span>Customer Email:</span>
                  <span style={{ color: "#2563EB", fontWeight: 700 }}>{selectedOrder.customer.email}</span>
                </div>
              )}
              {/* Fulfillment Type & Details */}
              <div className="om-receipt-row">
                <span>Fulfillment Mode:</span>
                <strong style={{ color: selectedOrder.orderType === "SELF_PICKUP" ? "#7C3AED" : (selectedOrder.orderType === "DELIVERY" ? "#0284C7" : "#16A34A") }}>
                  {selectedOrder.orderType === "SELF_PICKUP" ? "🏪 Self Pickup" : (selectedOrder.orderType === "DELIVERY" ? "🚚 Online Delivery" : "🛒 In-Store Scan & Go")}
                </strong>
              </div>
              {selectedOrder.pickupDate && (
                <div className="om-receipt-row">
                  <span>Pickup Date &amp; Slot:</span>
                  <span>{selectedOrder.pickupDate} • {selectedOrder.pickupTimeSlot || "Standard"}</span>
                </div>
              )}
              {selectedOrder.pickupStatus && (
                <div className="om-receipt-row">
                  <span>Pickup Status:</span>
                  <strong style={{ color: "#7C3AED" }}>{selectedOrder.pickupStatus}</strong>
                </div>
              )}
              {(selectedOrder.deliveryAddress || selectedOrder.customer?.address) && (
                <div className="om-receipt-row">
                  <span>Delivery Address:</span>
                  <span style={{ maxWidth: "260px", textAlign: "right" }}>{selectedOrder.deliveryAddress || selectedOrder.customer.address}</span>
                </div>
              )}
              {selectedOrder.deliveryPhone && (
                <div className="om-receipt-row">
                  <span>Delivery Contact:</span>
                  <span>{formatPhone(selectedOrder.deliveryPhone)}</span>
                </div>
              )}
              {selectedOrder.assignedStaffName && (
                <div className="om-receipt-row">
                  <span>Delivery Staff:</span>
                  <span>{selectedOrder.assignedStaffName}</span>
                </div>
              )}
              {selectedOrder.deliveryStatus && (
                <div className="om-receipt-row">
                  <span>Delivery Status:</span>
                  <strong style={{ color: "#0284C7" }}>{selectedOrder.deliveryStatus}</strong>
                </div>
              )}
              <div className="om-receipt-row">
                <span>Invoice Number:</span>
                <strong>{selectedOrder.orderNumber}</strong>
              </div>
              <div className="om-receipt-row">
                <span>Transaction ID:</span>
                <strong>
                  {selectedOrder.paymentId || selectedOrder.transactionId || `TXN-${(selectedOrder.orderNumber || "").replace(/^ORD-/, "")}`}
                </strong>
              </div>
              <div className="om-receipt-row">
                <span>Date & Time:</span>
                <span>
                  {new Date(selectedOrder.createdAt || Date.now()).toLocaleDateString("en-IN")},{" "}
                  {new Date(selectedOrder.createdAt || Date.now()).toLocaleTimeString("en-IN")}
                </span>
              </div>
              <div className="om-receipt-row">
                <span>Terminal:</span>
                <span>Register #01 (Self-Checkout)</span>
              </div>
              <div className="om-receipt-row">
                <span>Payment Method:</span>
                <strong>{selectedOrder.paymentMethod === "Cash" ? "Cash at Exit" : selectedOrder.paymentMethod}</strong>
              </div>
              <div className="om-receipt-row">
                <span>Payment Status:</span>
                <span
                  style={{
                    color:
                      selectedOrder.paymentStatus === "Completed"
                        ? "#16A34A"
                        : selectedOrder.paymentStatus === "Approved"
                        ? "#4F46E5"
                        : "#D97706",
                    fontWeight: 800,
                  }}
                >
                  {selectedOrder.paymentStatus}
                </span>
              </div>

              {/* Line Items Table */}
              <table className="om-receipt-table">
                <thead>
                  <tr>
                    <th style={{ width: "24px", textAlign: "center" }}>#</th>
                    <th>ITEM DESCRIPTION</th>
                    <th style={{ textAlign: "center" }}>RATE</th>
                    <th style={{ textAlign: "center" }}>QTY</th>
                    <th style={{ textAlign: "right" }}>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrder.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "#64748B", fontSize: "11px" }}>{idx + 1}</td>
                      <td>
                        <strong>{it.name}</strong>
                        {it.brand && (
                          <span style={{ fontSize: "11px", color: "#64748B", display: "block" }}>
                            {it.brand}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>₹{Number(it.price).toFixed(2)}</td>
                      <td style={{ textAlign: "center" }}>{it.quantity}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        ₹{Number(it.subtotal || it.price * it.quantity).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Box */}
              <div className="om-receipt-total-box">
                <div className="om-receipt-row">
                  <span>Total Items Count:</span>
                  <span>{(selectedOrder.items || []).length} items ({(selectedOrder.items || []).reduce((s, i) => s + (i.quantity || 1), 0)} units)</span>
                </div>
                <div className="om-receipt-row">
                  <span>Gross Subtotal:</span>
                  <span>₹{Number(selectedOrder.subtotalAmount || selectedOrder.totalAmount).toFixed(2)}</span>
                </div>
                {selectedOrder.discountAmount > 0 && (
                  <div className="om-receipt-row" style={{ color: "#059669", fontWeight: 700 }}>
                    <span>Supermarket Promotional Savings:</span>
                    <span>-₹{Number(selectedOrder.discountAmount).toFixed(2)}</span>
                  </div>
                )}
                {(() => {
                  const total = Number(selectedOrder.totalAmount || 0);
                  const taxable = total / 1.05;
                  const gst = total - taxable;
                  const cgst = (gst / 2).toFixed(2);
                  const sgst = (gst / 2).toFixed(2);
                  return (
                    <div className="om-receipt-row" style={{ fontSize: "11px", color: "#64748B" }}>
                      <span>Taxes (CGST 2.5% + SGST 2.5% Included):</span>
                      <span>₹{cgst} + ₹{sgst}</span>
                    </div>
                  );
                })()}
                <div className="om-receipt-grand-total">
                  <span>NET AMOUNT PAID:</span>
                  <span style={{ color: "#15803D" }}>
                    ₹{Number(selectedOrder.totalAmount).toFixed(2)}
                  </span>
                </div>
              </div>

              {selectedOrder.discountAmount > 0 && (
                <div
                  style={{
                    background: "#ECFDF5",
                    border: "1px dashed #10B981",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    textAlign: "center",
                    color: "#047857",
                    fontWeight: 800,
                    fontSize: "12px",
                    margin: "12px 0 6px",
                  }}
                >
                  ★ YOU SAVED ₹{Number(selectedOrder.discountAmount).toFixed(2)} ON THIS ORDER ★
                </div>
              )}

              {/* Legal Terms & Footer (NO BARCODES) */}
              <div
                style={{
                  textAlign: "center",
                  borderTop: "1px dashed #CBD5E1",
                  paddingTop: "12px",
                  marginTop: "12px",
                  fontSize: "11px",
                  color: "#64748B",
                  lineHeight: 1.5,
                }}
              >
                Goods once sold can be returned within 7 days with original tax invoice.<br />
                Paperless Autonomous Self-Checkout System &bull; Computer Generated Tax Invoice<br />
                <strong>*** THANK YOU FOR SHOPPING AT GROCEREASE! PLEASE VISIT AGAIN ***</strong>
              </div>

              {/* Action Buttons in Modal */}
              <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="action-pill-btn primary"
                  style={{ flex: 1, justifyContent: "center", padding: "10px" }}
                  onClick={() => handlePrintTaxInvoice(selectedOrder)}
                >
                  <Printer size={15} />
                  <span>Print Tax Invoice</span>
                </button>

                {selectedOrder.paymentStatus === "Pending" && (
                  <>
                    <button
                      type="button"
                      className="action-pill-btn"
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        padding: "10px",
                        background: "#4F46E5",
                        borderColor: "#4F46E5",
                        color: "#FFFFFF",
                      }}
                      onClick={() => handleApprovePayment(selectedOrder._id, selectedOrder.orderNumber)}
                      disabled={approvingId === selectedOrder._id}
                    >
                      <Check size={15} />
                      <span>{approvingId === selectedOrder._id ? "Approving..." : "Approve Payment"}</span>
                    </button>

                    <button
                      type="button"
                      className="action-pill-btn"
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        padding: "10px",
                        background: "#10B981",
                        borderColor: "#10B981",
                        color: "#FFFFFF",
                      }}
                      onClick={() => {
                        if (selectedOrder.paymentMethod === "Cash") {
                          handleConfirmCash(selectedOrder._id, selectedOrder.orderNumber);
                        } else {
                          handleCompletePayment(selectedOrder._id, selectedOrder.orderNumber);
                        }
                      }}
                      disabled={completingId === selectedOrder._id}
                    >
                      <CheckCircle2 size={15} />
                      <span>{completingId === selectedOrder._id ? "Processing..." : "Confirm & Complete"}</span>
                    </button>
                  </>
                )}

                {selectedOrder.paymentStatus === "Approved" && (
                  <button
                    type="button"
                    className="action-pill-btn"
                    style={{
                      flex: 1,
                      justifyContent: "center",
                      padding: "10px",
                      background: "#10B981",
                      borderColor: "#10B981",
                      color: "#FFFFFF",
                    }}
                    onClick={() => handleCompletePayment(selectedOrder._id, selectedOrder.orderNumber)}
                    disabled={completingId === selectedOrder._id}
                  >
                    <CheckCircle2 size={15} />
                    <span>{completingId === selectedOrder._id ? "Processing..." : "Confirm & Complete"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. TOP-SELLING PRODUCTS INTELLIGENCE MODAL                                */}
      {/* ========================================================================= */}
      {showTopProductsModal && (
        <div className="pm-modal-overlay" onClick={() => setShowTopProductsModal(false)}>
          <div
            className="pm-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px", padding: "20px 24px" }}
          >
            <div className="pm-modal-header" style={{ marginBottom: "16px" }}>
              <div>
                <h3 className="pm-modal-title">Top Selling Products Intelligence</h3>
                <span style={{ fontSize: "12px", color: "#64748B" }}>
                  Aggregated from all verified completed customer orders
                </span>
              </div>
              <button
                type="button"
                className="pm-modal-close"
                onClick={() => setShowTopProductsModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            {topSellingProducts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 20px", color: "#64748B" }}>
                No completed order line items found yet. Once customer orders are completed, sales rankings will appear here.
              </div>
            ) : (
              <div style={{ maxHeight: "360px", overflowY: "auto" }}>
                <table className="pm-products-table">
                  <thead>
                    <tr>
                      <th>PRODUCT</th>
                      <th>CATEGORY</th>
                      <th style={{ textAlign: "center" }}>UNITS SOLD</th>
                      <th style={{ textAlign: "right" }}>REVENUE (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSellingProducts.map((p, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{p.name}</strong>
                          {p.brand && (
                            <span style={{ fontSize: "11px", color: "#64748B", display: "block" }}>
                              {p.brand}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="pm-category-text">{p.category}</span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span
                            style={{
                              background: "#EFF6FF",
                              color: "#1D4ED8",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              fontWeight: 800,
                              fontSize: "12px",
                            }}
                          >
                            {p.unitsSold} units
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 800, color: "#0F172A" }}>
                          ₹{p.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: "16px", textAlign: "right" }}>
              <button
                type="button"
                className="action-pill-btn refresh"
                onClick={() => setShowTopProductsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
