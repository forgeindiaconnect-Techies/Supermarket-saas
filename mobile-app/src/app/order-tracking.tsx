import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Animated,
  Linking,
  RefreshControl,
  Platform,
  Alert,
  TextInput,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useCart, OrderRecord } from "../context/CartContext";
import { API_URL, safeFetch } from "../constants/api";
import CustomerBottomNav from "../components/CustomerBottomNav";

const { width } = Dimensions.get("window");

interface TrackingStage {
  step: number;
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isActive: boolean;
  isPending: boolean;
  timestamp?: string | Date;
}

interface DeliveryPartner {
  _id?: string;
  name: string;
  phone: string;
  photoUrl?: string;
  status: string;
}

export default function OrderTrackingScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { recentOrders, selectedSupermarket, customerUser, updateRecentOrder } = useCart();

  const [selectedActiveOrderId, setSelectedActiveOrderId] = useState<string>(orderId || "");
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [stages, setStages] = useState<TrackingStage[]>([]);
  const [deliveryPartner, setDeliveryPartner] = useState<DeliveryPartner | null>(null);
  const [etaTime, setEtaTime] = useState<string>("");
  const [etaDate, setEtaDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [customerOrdersList, setCustomerOrdersList] = useState<OrderRecord[]>([]);

  // Review & Rating State
  const [rating, setRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [existingReview, setExistingReview] = useState<{
    rating: number;
    comment: string;
    submittedAt?: string;
  } | null>(null);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string>("");

  // Glowing pulse animation for live tracking badge & active stage
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isFetchingRef = useRef<boolean>(false);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Compute Real-Time Tracking Stages (Both Store Pickup & Doorstep Delivery)
  const computeStages = useCallback((ord: OrderRecord): {
    stages: TrackingStage[];
    partner: DeliveryPartner | null;
    estimatedTime: string;
    estimatedDate: string;
  } => {
    const oType = String(ord.orderType || "").toUpperCase();
    const fChoice = String(ord.fulfillmentChoice || "").toUpperCase();
    const hasPickup = Boolean(ord.pickupStatus && String(ord.pickupStatus).trim() !== "");
    const isPickup = oType.includes("PICKUP") || fChoice === "STORE_COLLECTION" || hasPickup;

    if (isPickup) {
      const pStatus = String(ord.pickupStatus || "Pending").toLowerCase().trim();

      // STRICT LIFECYCLE: Pickup is ONLY completed when status is explicitly "completed"!
      // If store admin has not updated the order (status is Pending or New), it is strictly NEVER completed!
      const isInitialPending = pStatus === "pending" || pStatus === "new" || pStatus === "order confirmed" || pStatus === "";
      const isPickupCompleted = !isInitialPending && (pStatus === "completed" || ((ord as any).customerPickupConfirmed === true && Boolean((ord as any).customerPickupCompletedAt)));
      const isPickupReady = !isInitialPending && !isPickupCompleted && (pStatus === "readyforpickup" || pStatus === "ready");
      const isPickupPreparing = !isInitialPending && !isPickupReady && !isPickupCompleted && pStatus === "preparing";

      // Stage 1: Order Placed & Confirmed
      const s1Completed = true;
      const s1Active = isInitialPending;

      // Stage 2: Preparing at Store
      const s2Completed = isPickupReady || isPickupCompleted;
      const s2Active = isPickupPreparing;

      // Stage 3: Ready for Pickup
      const s3Completed = isPickupCompleted;
      const s3Active = isPickupReady;

      // Stage 4: Order Completed & Collected
      const s4Completed = isPickupCompleted;
      const s4Active = false;

      const timeline: TrackingStage[] = [
        {
          step: 1,
          id: "ORDER_CONFIRMED",
          title: "Order Placed & Confirmed",
          description: "Your store pickup order has been placed and received by the supermarket.",
          isCompleted: s1Completed,
          isActive: s1Active,
          isPending: false,
          timestamp: ord.orderConfirmedAt || ord.createdAt,
        },
        {
          step: 2,
          id: "PREPARING",
          title: "Preparing at Store",
          description: "Supermarket store staff is packing and inspecting your items fresh from the shelves.",
          isCompleted: s2Completed,
          isActive: s2Active,
          isPending: !s2Completed && !s2Active,
          timestamp: (s2Completed || s2Active) ? ((ord as any).preparingAt || undefined) : undefined,
        },
        {
          step: 3,
          id: "READY_FOR_PICKUP",
          title: "Ready for Pickup",
          description: (ord as any).estimatedReadyTime
            ? `Your items are packaged! Please collect at the store pickup counter (Scheduled: ${(ord as any).estimatedReadyTime}).`
            : "Your items are packaged and ready for collection at the store pickup counter.",
          isCompleted: s3Completed,
          isActive: s3Active,
          isPending: !s3Completed && !s3Active,
          timestamp: (s3Completed || s3Active) ? ((ord as any).pickupReadyAt || undefined) : undefined,
        },
        {
          step: 4,
          id: "PICKUP_COMPLETED",
          title: "Order Completed & Collected",
          description: "Items verified and successfully collected by customer at the supermarket counter. Thank you!",
          isCompleted: s4Completed,
          isActive: false,
          isPending: !s4Completed,
          timestamp: s4Completed ? ((ord as any).customerPickupCompletedAt || undefined) : undefined,
        },
      ];

      return {
        stages: timeline,
        partner: null,
        estimatedTime: (ord as any).estimatedReadyTime || ord.pickupTimeSlot || "Today",
        estimatedDate: (ord as any).estimatedReadyDate || ord.pickupDate || "Today",
      };
    }

    // Doorstep Delivery
    const rawStatus = (ord.deliveryStatus || "New").toLowerCase().trim();
    const payStatus = String(ord.paymentStatus || "").toLowerCase().trim();
    const isFailed = rawStatus.includes("fail") || rawStatus.includes("cancel");

    // CRITICAL: isDelivered is strictly when delivery is completed by delivery partner, NEVER automatically on payment!
    const isDelivered =
      rawStatus === "delivered" ||
      (rawStatus === "completed" && Boolean((ord as any).deliveryCompletedAt)) ||
      Boolean((ord as any).deliveryCompletedAt);

    // Stage 1: Order Confirmed
    const s1Completed = true;
    const s1Active =
      (rawStatus === "new" || rawStatus === "pending" || rawStatus === "order confirmed" || rawStatus === "confirmed") &&
      !isDelivered &&
      !isFailed;
    const s1Time = ord.orderConfirmedAt || ord.createdAt;

    // Stage 2: Preparing Your Order
    const isPrepOrPast =
      isDelivered ||
      [
        "preparing",
        "assigned",
        "accepted",
        "delivery partner assigned",
        "products collected",
        "productscollected",
        "orderpickedup",
        "collected",
        "picked up",
        "out for delivery",
        "outfordelivery",
        "delivered",
      ].includes(rawStatus);
    const s2Active = rawStatus === "preparing" && !isDelivered && !isFailed;
    const s2Completed =
      (isPrepOrPast &&
        !s2Active &&
        rawStatus !== "order confirmed" &&
        rawStatus !== "confirmed" &&
        rawStatus !== "new" &&
        rawStatus !== "pending") ||
      isDelivered;
    const s2Time = s2Completed ? (ord.preparingAt || undefined) : undefined;

    // Stage 3: Delivery Partner Assigned
    const isAssignedOrPast =
      isDelivered ||
      [
        "assigned",
        "accepted",
        "delivery partner assigned",
        "products collected",
        "productscollected",
        "orderpickedup",
        "collected",
        "picked up",
        "out for delivery",
        "outfordelivery",
        "delivered",
      ].includes(rawStatus);
    const s3Active =
      (rawStatus === "assigned" || rawStatus === "accepted" || rawStatus === "delivery partner assigned") &&
      !isDelivered &&
      !isFailed;
    const s3Completed =
      (isAssignedOrPast &&
        !s3Active &&
        !s2Active &&
        rawStatus !== "order confirmed" &&
        rawStatus !== "confirmed" &&
        rawStatus !== "new" &&
        rawStatus !== "pending") ||
      isDelivered;
    const s3Time = s3Completed ? (ord.assignedAt || ord.deliveryAcceptedAt || undefined) : undefined;

    // Stage 4: Products Collected
    const isCollectedOrPast =
      isDelivered ||
      [
        "products collected",
        "productscollected",
        "orderpickedup",
        "collected",
        "picked up",
        "out for delivery",
        "outfordelivery",
        "delivered",
      ].includes(rawStatus);
    const s4Active =
      ["products collected", "productscollected", "orderpickedup", "collected", "picked up"].includes(rawStatus) &&
      !isDelivered &&
      !isFailed;
    const s4Completed =
      (isCollectedOrPast &&
        !s4Active &&
        !s3Active &&
        !s2Active &&
        rawStatus !== "order confirmed" &&
        rawStatus !== "confirmed" &&
        rawStatus !== "new" &&
        rawStatus !== "pending") ||
      isDelivered;
    const s4Time = s4Completed ? ((ord as any).productsCollectedAt || ord.pickedUpAt || undefined) : undefined;

    // Stage 5: Out for Delivery
    const isOutOrDelivered = isDelivered || ["out for delivery", "outfordelivery", "delivered"].includes(rawStatus);
    const s5Active = (rawStatus === "out for delivery" || rawStatus === "outfordelivery") && !isDelivered && !isFailed;
    const s5Completed = isDelivered;
    const s5Time = s5Completed ? (ord.deliveryOutAt || undefined) : undefined;

    // Stage 6: Delivered
    const s6Completed = isDelivered;
    const s6Active = false;
    const s6Time = s6Completed ? (ord.deliveryCompletedAt || undefined) : undefined;

    const timeline: TrackingStage[] = [
      {
        step: 1,
        id: "CONFIRMED",
        title: "Order Confirmed",
        description: "Your order has been placed and received by the supermarket.",
        isCompleted: s1Completed,
        isActive: s1Active,
        isPending: false,
        timestamp: s1Time,
      },
      {
        step: 2,
        id: "PREPARING",
        title: "Preparing",
        description: "Supermarket store staff is packing and inspecting your items fresh from the shelves.",
        isCompleted: s2Completed,
        isActive: s2Active,
        isPending: !s2Completed && !s2Active && !isFailed,
        timestamp: s2Time,
      },
      {
        step: 3,
        id: "ASSIGNED",
        title: "Delivery Partner Assigned",
        description: ord.assignedStaffName
          ? `${ord.assignedStaffName} has been assigned to deliver your package.`
          : "A dedicated delivery partner will be assigned shortly.",
        isCompleted: s3Completed,
        isActive: s3Active,
        isPending: !s3Completed && !s3Active && !isFailed,
        timestamp: s3Time,
      },
      {
        step: 4,
        id: "COLLECTED",
        title: "Products Collected",
        description: ord.assignedStaffName
          ? `${ord.assignedStaffName} collected your packaged items from the supermarket.`
          : "Delivery partner has collected packaged items from the supermarket.",
        isCompleted: s4Completed,
        isActive: s4Active,
        isPending: !s4Completed && !s4Active && !isFailed,
        timestamp: s4Time,
      },
      {
        step: 5,
        id: "OUT_FOR_DELIVERY",
        title: "Out for Delivery",
        description: "Your delivery partner is on route to your delivery address.",
        isCompleted: s5Completed,
        isActive: s5Active,
        isPending: !s5Completed && !s5Active && !isFailed,
        timestamp: s5Time,
      },
      {
        step: 6,
        id: "DELIVERED",
        title: "Delivered",
        description: "Package safely delivered to your doorstep. Thank you for shopping with us!",
        isCompleted: s6Completed,
        isActive: s6Active,
        isPending: !s6Completed && !isFailed,
        timestamp: s6Time,
      },
    ];

    // Delivery Partner Details (Strictly displayed when assigned)
    let partner: DeliveryPartner | null = null;
    const hasAssignedStaff = Boolean(ord.assignedStaff || ord.assignedStaffName);
    if ((s3Completed || s3Active || isDelivered) && hasAssignedStaff) {
      const staffObj = typeof ord.assignedStaff === "object" ? ord.assignedStaff : null;
      partner = {
        _id: staffObj?._id || (typeof ord.assignedStaff === "string" ? ord.assignedStaff : undefined),
        name: ord.assignedStaffName || staffObj?.name || "Delivery Partner",
        phone: ord.assignedStaffPhone || staffObj?.phone || "",
        photoUrl: staffObj?.photoUrl || "",
        status:
          isDelivered
            ? "Delivered"
            : rawStatus === "out for delivery" || rawStatus === "outfordelivery"
            ? "Out for Delivery"
            : "Assigned",
      };
    }

    // ETA calculation
    const createD = ord.createdAt ? new Date(ord.createdAt) : new Date();
    const etaD = new Date(createD.getTime() + 35 * 60 * 1000);
    const estimatedTime =
      ord.estimatedDeliveryTime ||
      etaD.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const estimatedDate =
      ord.estimatedDeliveryDate ||
      etaD.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

    return {
      stages: timeline,
      partner,
      estimatedTime,
      estimatedDate,
    };
  }, []);

  // Fetch Order and Tracking Metadata from Backend API
  const fetchOrderTracking = useCallback(async (isSilent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    let targetId = selectedActiveOrderId || orderId;

    if (!isSilent) setLoading(true);

    try {
      // If no explicit orderId is specified, locate customer's active order (Pickup or Delivery)
      if (!targetId) {
        const isOnlineOrd = (o: OrderRecord) => {
          const mode = (o.purchaseMode || "").toUpperCase();
          const type = (o.orderType || "").toUpperCase();
          return mode === "ONLINE" || type !== "OFFLINE" || Boolean(o.deliveryStatus) || Boolean(o.pickupStatus);
        };

        const isStillActive = (o: any) => {
          const dStat = String(o.deliveryStatus || "").toLowerCase();
          const pStat = String(o.pickupStatus || "").toLowerCase();
          return dStat !== "delivered" && pStat !== "completed" && pStat !== "pickup_completed";
        };

        const activeInCache =
          recentOrders.find((o) => isOnlineOrd(o) && isStillActive(o)) ||
          recentOrders.find(isOnlineOrd);

        if (activeInCache) {
          targetId = activeInCache._id || activeInCache.orderNumber;
          if (targetId) setSelectedActiveOrderId(targetId);
        } else if (API_URL && customerUser?.phone) {
          // Query backend for this customer's orders
          const phoneParam = encodeURIComponent(customerUser.phone);
          const reqHeaders: Record<string, string> = {};
          if (customerUser?.token) reqHeaders["Authorization"] = `Bearer ${customerUser.token}`;
          const res = await safeFetch(`${API_URL}/orders?phone=${phoneParam}`, { headers: reqHeaders }, 12000);
          const contentType = res.headers?.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const ordData = await res.json();
            if (ordData.success && Array.isArray(ordData.orders)) {
              const customerOnlineOrders = ordData.orders.filter(isOnlineOrd);
              setCustomerOrdersList(customerOnlineOrders);
              const activeOrder =
                customerOnlineOrders.find((o: any) => isStillActive(o)) ||
                customerOnlineOrders[0];
              if (activeOrder) {
                targetId = activeOrder._id || activeOrder.orderNumber;
                if (targetId) setSelectedActiveOrderId(String(targetId));
              }
            }
          }
        }
      }

      if (!targetId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (API_URL) {
        const reqHeaders: Record<string, string> = {};
        if (customerUser?.token) reqHeaders["Authorization"] = `Bearer ${customerUser.token}`;
        const cleanTargetId = encodeURIComponent(String(targetId).replace(/^#/, "").trim());

        let data: any = null;

        // 1. Primary: Fetch from dedicated tracking endpoint
        try {
          const res = await safeFetch(`${API_URL}/orders/${cleanTargetId}/tracking`, { headers: reqHeaders }, 8000);
          const contentType = res.headers?.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const jsonRes = await res.json();
            if (jsonRes?.success && jsonRes?.order) {
              data = jsonRes;
            }
          }
        } catch (_) {}

        // 2. Fallback: Fetch directly from order details endpoint
        if (!data || !data.order) {
          try {
            const resFallback = await safeFetch(`${API_URL}/orders/${cleanTargetId}`, { headers: reqHeaders }, 8000);
            const ct = resFallback.headers?.get("content-type") || "";
            if (ct.includes("application/json")) {
              const jsonFallback = await resFallback.json();
              if (jsonFallback?.success && jsonFallback?.order) {
                data = {
                  success: true,
                  order: jsonFallback.order,
                  stages: jsonFallback.tracking?.stages,
                  deliveryPartner: jsonFallback.tracking?.deliveryPartner,
                  isPickup: jsonFallback.tracking?.isPickup,
                  fulfillmentType: jsonFallback.tracking?.fulfillmentType,
                  fulfillmentBadge: jsonFallback.tracking?.fulfillmentBadge,
                  statusTitle: jsonFallback.tracking?.statusTitle,
                  isCompleted: jsonFallback.tracking?.isCompleted,
                  estimatedDeliveryTime: jsonFallback.tracking?.estimatedDeliveryTime,
                  estimatedDeliveryDate: jsonFallback.tracking?.estimatedDeliveryDate,
                };
              }
            }
          } catch (_) {}
        }

        if (data && data.order) {
          const ord = data.order;
          const oType = String(ord.orderType || "").toUpperCase();
          const fChoice = String(ord.fulfillmentChoice || "").toUpperCase();
          const hasPickup = Boolean(ord.pickupStatus && String(ord.pickupStatus).trim() !== "");
          const isPickupResolved =
            data.isPickup !== undefined
              ? data.isPickup
              : (oType.includes("PICKUP") || fChoice === "STORE_COLLECTION" || hasPickup);

          const fetchedOrder: any = {
            ...ord,
            isPickup: isPickupResolved,
            fulfillmentType: data.fulfillmentType || ord.fulfillmentType || (isPickupResolved ? "SELF_PICKUP" : "DELIVERY"),
            fulfillmentBadge: data.fulfillmentBadge || (isPickupResolved ? "Store Pickup" : "Doorstep Delivery"),
          };
          setOrder(fetchedOrder);
          updateRecentOrder(fetchedOrder); // Live sync to app CartContext!

          if (fetchedOrder?.review?.rating) {
            setExistingReview(fetchedOrder.review);
          }

          if (Array.isArray(data.stages) && data.stages.length >= 4) {
            setStages(data.stages);
            setDeliveryPartner(data.deliveryPartner || null);
            setEtaTime(data.estimatedDeliveryTime || "");
            setEtaDate(data.estimatedDeliveryDate || "");
          } else {
            const calculated = computeStages(fetchedOrder);
            setStages(calculated.stages);
            setDeliveryPartner(calculated.partner);
            setEtaTime(calculated.estimatedTime);
            setEtaDate(calculated.estimatedDate);
          }
          setLastUpdated(new Date());
          return;
        }
      }

      // Fallback: Check local cache in recentOrders
      const matched = recentOrders.find(
        (o) => o._id === targetId || o.orderNumber === targetId
      );
      if (matched) {
        setOrder(matched);
        const calculated = computeStages(matched);
        setStages(calculated.stages);
        setDeliveryPartner(calculated.partner);
        setEtaTime(calculated.estimatedTime);
        setEtaDate(calculated.estimatedDate);
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      const msg = err?.message || "";
      const isCanceled =
        err?.name === "AbortError" ||
        msg.toLowerCase().includes("cancel") ||
        msg.toLowerCase().includes("abort");

      if (!isCanceled) {
        console.log("Order tracking sync notice:", msg);
      }

      if (targetId) {
        const matched = recentOrders.find(
          (o) => o._id === targetId || o.orderNumber === targetId
        );
        if (matched) {
          setOrder(matched);
          const calculated = computeStages(matched);
          setStages(calculated.stages);
          setDeliveryPartner(calculated.partner);
          setEtaTime(calculated.estimatedTime);
          setEtaDate(calculated.estimatedDate);
        }
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, selectedActiveOrderId, recentOrders, customerUser, computeStages, updateRecentOrder]);

  // Initial load
  useEffect(() => {
    fetchOrderTracking(false);
  }, [fetchOrderTracking]);

  // Real-Time Auto-Polling: Refreshes every 3s for live updates without overlapping requests
  useEffect(() => {
    const timer = setInterval(() => {
      fetchOrderTracking(true);
    }, 3000);

    return () => clearInterval(timer);
  }, [fetchOrderTracking]);

  const handleSubmitReview = async () => {
    const targetId = order?._id || (order as any)?.orderNumber;
    if (!targetId) return;
    if (!rating || rating < 1) {
      Alert.alert("Rating Required", "Please select a star rating from 1 to 5.");
      return;
    }
    setSubmittingReview(true);
    const custName =
      customerUser?.name ||
      (order as any)?.customerName ||
      (order as any)?.customer?.name ||
      "Verified Customer";
    const custPhone =
      customerUser?.phone ||
      (order as any)?.customerPhone ||
      (order as any)?.customer?.phone ||
      (order as any)?.deliveryPhone ||
      "";
    const reviewData = {
      rating,
      comment: reviewComment.trim(),
      customerName: custName,
      customerPhone: custPhone,
      review: {
        rating,
        comment: reviewComment.trim(),
        customerName: custName,
        submittedAt: new Date().toISOString(),
      },
    };

    try {
      let isSuccess = false;
      let reviewResult: any = null;

      const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (customerUser?.token) reqHeaders["Authorization"] = `Bearer ${customerUser.token}`;

      try {
        const res = await safeFetch(`${API_URL}/orders/${targetId}/review`, {
          method: "POST",
          headers: reqHeaders,
          body: JSON.stringify(reviewData),
        });
        const contentType = res.headers?.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          if (data?.success) {
            isSuccess = true;
            reviewResult = data.review;
          }
        }
      } catch (_) {}

      // Fallback: pickup-review endpoint
      if (!isSuccess) {
        try {
          const resFallback = await safeFetch(`${API_URL}/orders/${targetId}/pickup-review`, {
            method: "POST",
            headers: reqHeaders,
            body: JSON.stringify(reviewData),
          });
          const contentType = resFallback.headers?.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await resFallback.json();
            if (data?.success) {
              isSuccess = true;
              reviewResult = data.review;
            }
          }
        } catch (_) {}
      }

      // Fallback 2: customer-complete-pickup endpoint
      if (!isSuccess) {
        try {
          const resFallback = await safeFetch(`${API_URL}/orders/${targetId}/customer-complete-pickup`, {
            method: "PUT",
            headers: reqHeaders,
            body: JSON.stringify(reviewData),
          });
          const contentType = resFallback.headers?.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await resFallback.json();
            if (data?.success) {
              isSuccess = true;
              reviewResult = data.order?.review || reviewData.review;
            }
          }
        } catch (_) {}
      }

      const finalReview = reviewResult || reviewData.review;
      setExistingReview(finalReview);
      if (order) {
        const updated = { ...order, review: finalReview };
        setOrder(updated);
        updateRecentOrder(updated);
      }
      setReviewSuccessMsg("Thank you! Your review has been saved to the supermarket profile.");
      Alert.alert(
        "Review Submitted",
        isPickupOrder()
          ? "Thank you for rating your store pickup experience!"
          : "Thank you for rating your delivery experience!"
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not submit review. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrderTracking(true);
  };

  const handleCallPartner = (phone?: string) => {
    if (!phone) {
      Alert.alert("No Contact Number", "Delivery partner phone number is currently not available.");
      return;
    }
    const cleanNumber = phone.replace(/[^\d+]/g, "");
    Linking.openURL(`tel:${cleanNumber}`);
  };

  const formatTimestamp = (ts?: string | Date) => {
    if (!ts) return "";
    try {
      const d = new Date(ts);
      return (
        d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
        " • " +
        d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      );
    } catch {
      return String(ts);
    }
  };

  const isPickupOrder = () => {
    if (!order) return false;
    if ((order as any)?.isPickup === true || (order as any)?.fulfillmentType === "SELF_PICKUP") return true;
    const oType = String((order as any)?.orderType || (order as any)?.fulfillmentType || "").toUpperCase();
    const fChoice = String((order as any)?.fulfillmentChoice || "").toUpperCase();
    const hasPickupStatus = Boolean((order as any)?.pickupStatus && String((order as any)?.pickupStatus).trim() !== "");
    return (
      oType.includes("PICKUP") ||
      fChoice === "STORE_COLLECTION" ||
      hasPickupStatus ||
      Boolean((order as any)?.pickupOtp) ||
      Boolean((order as any)?.scheduledPickupTime)
    );
  };

  const isOrderCompleted = () => {
    if (!order) return false;
    if (isPickupOrder()) {
      const pickSt = String((order as any)?.pickupStatus || "").toLowerCase().trim();
      // STRICT CHECK: If store admin has not updated or order is pending/preparing/ready, strictly NOT completed!
      if (pickSt === "pending" || pickSt === "new" || pickSt === "order confirmed" || pickSt === "preparing" || pickSt === "readyforpickup" || pickSt === "ready" || pickSt === "") {
        return false;
      }
      return pickSt === "completed" || ((order as any)?.customerPickupConfirmed === true && Boolean((order as any)?.customerPickupCompletedAt));
    }
    const delSt = String(order.deliveryStatus || "").toLowerCase().trim();
    if (
      delSt === "order confirmed" ||
      delSt === "confirmed" ||
      delSt === "new" ||
      delSt === "pending" ||
      delSt === "preparing" ||
      delSt === "assigned" ||
      delSt === "products collected" ||
      delSt === "productscollected" ||
      delSt === "out for delivery" ||
      delSt === "outfordelivery" ||
      delSt === ""
    ) {
      return false;
    }
    return delSt === "delivered" || (delSt === "completed" && Boolean((order as any)?.deliveryCompletedAt));
  };

  // Calculate Progress percentage for progress bar
  const getProgressPercentage = () => {
    if (!order) return 15;
    if (isOrderCompleted()) return 100;
    if (isPickupOrder()) {
      const pickSt = String((order as any)?.pickupStatus || "").toLowerCase().trim();
      if (pickSt === "readyforpickup" || pickSt === "ready") return 75;
      if (pickSt === "preparing") return 50;
      return 25; // Pending / Order Confirmed
    }
    // Doorstep Delivery
    const dSt = String(order.deliveryStatus || "New").toLowerCase().trim();
    if (dSt === "delivered") return 100;
    if (dSt === "out for delivery" || dSt === "outfordelivery") return 80;
    if (["orderpickedup", "products collected", "productscollected", "collected", "picked up"].includes(dSt)) return 65;
    if (["assigned", "accepted", "delivery partner assigned"].includes(dSt)) return 50;
    if (dSt === "preparing") return 35;
    return 20; // Order Confirmed
  };

  const currentStatusTitle = () => {
    if (!order) return "Processing Order";
    if (isOrderCompleted()) {
      return isPickupOrder() ? "Order Completed & Collected!" : "Delivered to Your Doorstep";
    }
    if (isPickupOrder()) {
      const pickSt = String((order as any)?.pickupStatus || "").toLowerCase().trim();
      if (pickSt === "readyforpickup" || pickSt === "ready") return "Ready for Pickup at Store Counter";
      if (pickSt === "preparing") return "Preparing at Store";
      return "Order Placed & Confirmed";
    }
    const st = (order.deliveryStatus || "New").toLowerCase().trim();
    if (st === "delivered" || st === "completed") return "Delivered to Your Doorstep";
    if (st === "out for delivery" || st === "outfordelivery") return "Out for Delivery";
    if (st === "products collected" || st === "orderpickedup" || st === "collected") return "Products Collected";
    if (st === "assigned" || st === "accepted") return "Delivery Partner Assigned";
    if (st === "preparing") return "Preparing Your Order";
    if (st === "failed delivery" || st === "failed") return "Delivery Failed";
    return "Order Confirmed";
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Top Amazon-Style Brand Header */}
      <View style={styles.header}>
        <SafeAreaView edges={["top"]} style={styles.safeHeader}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.backBtnArrow}>‹</Text>
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Order Tracking</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {order?.supermarketName || selectedSupermarket?.name || "GrocerEase Supermarket"}
              </Text>
            </View>

            {/* Real-time Tracking Pulse Indicator */}
            <View style={styles.liveIndicatorPill}>
              <Animated.View
                style={[
                  styles.liveDot,
                  { opacity: pulseAnim },
                ]}
              />
              <Text style={styles.liveIndicatorText}>LIVE</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B0764"
            colors={["#3B0764", "#059669"]}
          />
        }
      >
        {loading && !order ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#3B0764" />
            <Text style={styles.loadingText}>Connecting to real-time order tracking...</Text>
          </View>
        ) : !order ? (
          <View style={styles.notFoundBox}>
            <Text style={{ fontSize: 50, marginBottom: 12 }}>🚚</Text>
            <Text style={styles.notFoundTitle}>No Active Delivery Orders</Text>
            <Text style={styles.notFoundDesc}>
              You do not have any active doorstep delivery orders right now. Order fresh groceries online and track delivery progress live!
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.actionOutlineBtn, { backgroundColor: "#3B0764", borderWidth: 0 }]}
                onPress={() => router.replace("/catalog")}
              >
                <Text style={[styles.actionOutlineBtnText, { color: "#FFF" }]}>Order Groceries</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionOutlineBtn}
                onPress={() => router.replace("/orders")}
              >
                <Text style={styles.actionOutlineBtnText}>Order History</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* ========================================================= */}
            {/* 1. HERO ETA & LIVE STATUS BANNER                          */}
            {/* ========================================================= */}
            <View style={styles.etaHeroCard}>
              <View style={styles.etaTopRow}>
                <View style={[styles.etaBadge, isPickupOrder() && { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" }]}>
                  <Text style={styles.etaBadgeEmoji}>{isPickupOrder() ? "🏪" : "🚚"}</Text>
                  <Text style={[styles.etaBadgeText, isPickupOrder() && { color: "#166534" }]}>
                    {isPickupOrder() ? "Store Pickup" : "Doorstep Delivery"}
                  </Text>
                </View>

                <Text style={styles.orderNumberPill}>
                  #{order.orderNumber}
                </Text>
              </View>

              <Text style={styles.currentStatusHeading}>
                {currentStatusTitle()}
              </Text>

              {isOrderCompleted() ? (
                <View style={styles.deliveredHighlight}>
                  <Text style={styles.deliveredHighlightEmoji}>✅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deliveredHighlightText}>
                      {isPickupOrder() ? "Order Collected & Completed ✓" : "Successfully Delivered"}
                    </Text>
                    {isPickupOrder() ? (
                      <View style={{ marginTop: 4 }}>
                        <Text style={{ fontSize: 13, color: "#166534", fontWeight: "800" }}>
                          Actual Collection Time: {formatTimestamp((order as any).actualCollectionTime || (order as any).customerPickupCompletedAt || (order as any).completedAt)}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: "#166534", fontWeight: "600", marginTop: 2 }}>
                          Booked Slot: {(order as any).pickupTimeSlot || "10:00 AM – 12:00 PM"} ({(order as any).pickupDate || "Today"})
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 13, color: "#166534", fontWeight: "700", marginTop: 2 }}>
                        Delivered on {formatTimestamp(order.deliveryCompletedAt || (order as any).completedAt)}
                      </Text>
                    )}
                  </View>
                </View>
              ) : isPickupOrder() ? (
                <View style={styles.etaTimeBox}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={styles.etaLabel}>Booked Pickup Slot:</Text>
                    <Text style={{ fontSize: 12, color: "#059669", fontWeight: "800" }}>
                      📅 {(order as any).pickupDate || "Today"}
                    </Text>
                  </View>
                  <Text style={styles.etaTimeVal}>
                    ⏰ {(order as any).pickupTimeSlot || "10:00 AM – 12:00 PM"}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: "#1E1B4B", fontWeight: "800", marginTop: 4 }}>
                    Status: {currentStatusTitle()}
                  </Text>
                </View>
              ) : (
                <View style={styles.etaTimeBox}>
                  <Text style={styles.etaLabel}>Estimated Arrival:</Text>
                  <Text style={styles.etaTimeVal}>
                    {etaTime ? `${etaTime} (${etaDate || "Today"})` : "Within 30–45 Mins"}
                  </Text>
                </View>
              )}

              {/* Dynamic Horizontal Progress Bar */}
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${getProgressPercentage()}%`,
                      backgroundColor:
                        isOrderCompleted() ? "#16A34A" : "#3B0764",
                    },
                  ]}
                />
              </View>

              <View style={styles.etaFooterRow}>
                <Text style={styles.etaFooterHint}>
                  {isOrderCompleted()
                    ? (isPickupOrder() ? "Store pickup verified and completed." : "Order completed and verified.")
                    : (isPickupOrder() ? "Real-time updates synced with store pickup desk" : "Real-time updates synced with store delivery fleet")}
                </Text>
                <Text style={styles.etaSyncTime}>
                  Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>



            {/* ========================================================= */}
            {/* 2. DELIVERY PARTNER CARD (Strictly shown once assigned)   */}
            {/* ========================================================= */}
            {deliveryPartner ? (
              <View style={styles.partnerCard}>
                <View style={styles.partnerHeader}>
                  <View style={styles.partnerAvatarCircle}>
                    {deliveryPartner.photoUrl ? (
                      <Image
                        source={{ uri: deliveryPartner.photoUrl }}
                        style={styles.partnerPhoto}
                      />
                    ) : (
                      <Text style={styles.partnerAvatarInitial}>
                        {deliveryPartner.name.slice(0, 2).toUpperCase()}
                      </Text>
                    )}
                  </View>

                  <View style={styles.partnerInfo}>
                    <View style={styles.partnerNameRow}>
                      <Text style={styles.partnerName}>{deliveryPartner.name}</Text>
                      <View style={styles.verifiedBadge}>
                        <Text style={styles.verifiedBadgeText}>✓ Verified</Text>
                      </View>
                    </View>
                    <Text style={styles.partnerRoleText}>
                      Authorized GrocerEase Delivery Partner
                    </Text>
                    <View style={styles.partnerStatusPill}>
                      <View style={styles.partnerGreenDot} />
                      <Text style={styles.partnerStatusText}>
                        Status: {deliveryPartner.status}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Call Delivery Partner Action Button */}
                {deliveryPartner.phone ? (
                  <TouchableOpacity
                    style={styles.callPartnerBtn}
                    onPress={() => handleCallPartner(deliveryPartner.phone)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.callPartnerBtnIcon}>📞</Text>
                    <Text style={styles.callPartnerBtnText}>
                      Call Delivery Partner ({deliveryPartner.phone})
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <View style={styles.partnerSecurityNotice}>
                  <Text style={styles.shieldEmoji}>🛡️</Text>
                  <Text style={styles.securityNoticeText}>
                    Contact details are private & delivery is protected by GrocerEase security protocols.
                  </Text>
                </View>
              </View>
            ) : null}

            {/* ========================================================= */}
            {/* 3. MULTI-STAGE VERTICAL TIMELINE                          */}
            {/* ========================================================= */}
            <View style={styles.timelineCard}>
              <Text style={styles.sectionTitle}>
                {isPickupOrder() ? "Store Pickup Progress" : "Delivery Progress"}
              </Text>
              <Text style={styles.sectionSubtitle}>
                {isPickupOrder()
                  ? "Step-by-step counter pickup fulfillment timeline"
                  : "Step-by-step fulfillment timeline for your order"}
              </Text>

              <View style={styles.timelineList}>
                {stages.map((stage, idx) => {
                  const isLast = idx === stages.length - 1;
                  const isCompleted = stage.isCompleted;
                  const isActive = stage.isActive;
                  const isPending = stage.isPending;

                  return (
                    <View key={stage.id} style={styles.timelineItemRow}>
                      {/* Left Column: Icon/Indicator & Connecting Line */}
                      <View style={styles.timelineIndicatorCol}>
                        <View
                          style={[
                            styles.timelineNode,
                            isCompleted && styles.timelineNodeCompleted,
                            isActive && styles.timelineNodeActive,
                            isPending && styles.timelineNodePending,
                          ]}
                        >
                          {isCompleted ? (
                            <Text style={styles.nodeCheckmark}>✓</Text>
                          ) : isActive ? (
                            <Animated.View
                              style={[
                                styles.nodeActivePulse,
                                { opacity: pulseAnim },
                              ]}
                            />
                          ) : (
                            <Text style={styles.nodeStepNum}>{stage.step}</Text>
                          )}
                        </View>

                        {/* Connecting Line to next step */}
                        {!isLast && (
                          <View
                            style={[
                              styles.timelineLine,
                              isCompleted
                                ? styles.timelineLineCompleted
                                : styles.timelineLinePending,
                            ]}
                          />
                        )}
                      </View>

                      {/* Right Column: Stage Title, Description, Timestamp */}
                      <View style={styles.timelineContentCol}>
                        <View style={styles.stageTitleRow}>
                          <Text
                            style={[
                              styles.stageTitle,
                              isCompleted && styles.stageTitleCompleted,
                              isActive && styles.stageTitleActive,
                              isPending && styles.stageTitlePending,
                            ]}
                          >
                            {stage.title}
                          </Text>

                          {isActive && (
                            <View style={styles.currentPill}>
                              <Text style={styles.currentPillText}>In Progress</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.stageDescription}>
                          {stage.description}
                        </Text>

                        {stage.isCompleted && stage.timestamp ? (
                          <Text style={styles.stageTimestamp}>
                            ⏱ {formatTimestamp(stage.timestamp)}
                          </Text>
                        ) : isPending ? (
                          <Text style={styles.stagePendingNotice}>Pending</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Store Collection Notification Banner & Action for Customer */}
            {isPickupOrder() && (order as any).pickupStatus === "ReadyForPickup" && !(order as any).customerPickupConfirmed && (
              <View style={[styles.detailCard, { backgroundColor: "#F0FDF4", borderColor: "#86EFAC", borderWidth: 1.5 }]}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#166534", marginBottom: 6 }}>
                  🔔 Ready for Store Collection!
                </Text>
                <Text style={{ fontSize: 13, color: "#15803D", lineHeight: 18, marginBottom: 12 }}>
                  Your items are packaged and waiting at the customer pickup counter. Once you collect your products, tap below to confirm.
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: "#16A34A",
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    alignItems: "center",
                  }}
                  onPress={async () => {
                    try {
                      const res = await safeFetch(`${API_URL}/orders/${order._id || order.orderNumber}/customer-complete-pickup`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                      });
                      const d = await res.json();
                      if (d?.success) {
                        fetchOrderTracking(true);
                      }
                    } catch (_) {}
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
                    ✓ I Have Collected My Order
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ========================================================= */}
            {/* 4. ADDRESS / STORE PICKUP LOCATION CARD                   */}
            {/* ========================================================= */}
            <View style={styles.detailCard}>
              <View style={styles.detailCardHeader}>
                <Text style={styles.detailHeaderIcon}>{isPickupOrder() ? "🏪" : "📍"}</Text>
                <Text style={styles.detailCardTitle}>
                  {isPickupOrder() ? "Store Pickup Location" : "Delivery Address"}
                </Text>
              </View>

              {isPickupOrder() ? (
                <>
                  <Text style={styles.recipientName}>
                    {order.supermarketName || selectedSupermarket?.name || "GrocerEase Supermarket"}
                  </Text>
                  <Text style={styles.recipientAddress}>
                    {selectedSupermarket?.address || "Main Store Customer Service & Pickup Counter"}
                  </Text>
                  <View style={[styles.notesBox, { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }]}>
                    <Text style={styles.notesLabel}>Customer Details:</Text>
                    <Text style={styles.notesText}>
                      {order.deliveryCustomerName || order.customer?.name || "Customer"} • {order.deliveryPhone || order.customer?.phone || ""}
                    </Text>
                    {(order as any).pickupOtp ? (
                      <Text style={{ marginTop: 4, fontWeight: "bold", color: "#15803D", fontSize: 14 }}>
                        Pickup Verification OTP: {(order as any).pickupOtp}
                      </Text>
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.recipientName}>
                    {order.deliveryCustomerName || order.customer?.name || "Customer"}
                  </Text>
                  {order.deliveryPhone || order.customer?.phone ? (
                    <Text style={styles.recipientPhone}>
                      Phone: {order.deliveryPhone || order.customer?.phone}
                    </Text>
                  ) : null}

                  <Text style={styles.recipientAddress}>
                    {order.deliveryAddress || order.customer?.address || "Address provided at checkout"}
                  </Text>

                  {order.deliveryNotes ? (
                    <View style={styles.notesBox}>
                      <Text style={styles.notesLabel}>Delivery Instructions:</Text>
                      <Text style={styles.notesText}>{order.deliveryNotes}</Text>
                    </View>
                  ) : null}
                </>
              )}
            </View>

            {/* ========================================================= */}
            {/* 5. ORDERED PRODUCTS BREAKDOWN                             */}
            {/* ========================================================= */}
            <View style={styles.detailCard}>
              <View style={styles.detailCardHeader}>
                <Text style={styles.detailHeaderIcon}>🛍️</Text>
                <Text style={styles.detailCardTitle}>
                  Items in this Order ({order.totalItems || order.items?.length || 1})
                </Text>
              </View>

              <View style={styles.itemsList}>
                {order.items && order.items.length > 0 ? (
                  order.items.map((it, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <View style={styles.itemThumbWrap}>
                        <Image
                          source={
                            it.imageUrl
                              ? { uri: it.imageUrl }
                              : require("../../assets/images/icon.png")
                          }
                          style={styles.itemThumb}
                          resizeMode="contain"
                        />
                      </View>

                      <View style={styles.itemMeta}>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {it.name}
                        </Text>
                        {it.brand ? (
                          <Text style={styles.itemBrand}>{it.brand}</Text>
                        ) : null}
                        <Text style={styles.itemQtyPrice}>
                          Qty: {it.quantity} × ₹{Number(it.price).toFixed(2)}
                        </Text>
                      </View>

                      <Text style={styles.itemSubtotal}>
                        ₹{(Number(it.price) * it.quantity).toFixed(2)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noItemsText}>Order item details recorded.</Text>
                )}
              </View>

              {/* Price Calculation Summary */}
              <View style={styles.priceSummaryDivider} />

              <View style={styles.priceRow}>
                <Text style={styles.priceRowLabel}>Subtotal</Text>
                <Text style={styles.priceRowVal}>
                  ₹{(order.subtotalAmount || order.totalAmount).toFixed(2)}
                </Text>
              </View>

              {order.discountAmount ? (
                <View style={styles.priceRow}>
                  <Text style={[styles.priceRowLabel, { color: "#16A34A" }]}>Savings / Discount</Text>
                  <Text style={[styles.priceRowVal, { color: "#16A34A" }]}>
                    -₹{Number(order.discountAmount).toFixed(2)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.priceRow}>
                <Text style={styles.priceRowLabel}>
                  {isPickupOrder() ? "Pickup Counter Fee" : "Delivery Fee"}
                </Text>
                <Text style={[styles.priceRowVal, { color: "#16A34A" }]}>FREE</Text>
              </View>

              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalRowLabel}>Total Paid</Text>
                <Text style={styles.totalRowVal}>₹{Number(order.totalAmount).toFixed(2)}</Text>
              </View>

              <View style={styles.paymentMethodPill}>
                <Text style={styles.paymentMethodText}>
                  💳 Paid via {order.paymentMethod || "UPI"} • Ref: {order.paymentStatus || "Completed"}
                </Text>
              </View>
            </View>

            {/* ========================================================= */}
            {/* 5.5 CUSTOMER REVIEW (ENABLED ONLY AFTER ORDER COMPLETION) */}
            {/* ========================================================= */}
            {isOrderCompleted() && (
              <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewEmoji}>⭐</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewTitle}>
                      {isPickupOrder() ? "Rate Your Store Pickup Experience" : "Rate Your Delivery Experience"}
                    </Text>
                    <Text style={styles.reviewSubtitle}>
                      Share verified feedback about your packaged groceries and service
                    </Text>
                  </View>
                </View>

                {existingReview || (order as any).review?.rating ? (
                  <View style={styles.reviewSubmittedBox}>
                    <View style={styles.reviewStarsRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Text
                          key={star}
                          style={[
                            styles.reviewStarLarge,
                            star <= (existingReview?.rating || (order as any).review?.rating || 5)
                              ? styles.starFilled
                              : styles.starEmpty,
                          ]}
                        >
                          ★
                        </Text>
                      ))}
                    </View>
                    {(existingReview?.comment || (order as any).review?.comment) ? (
                      <Text style={styles.reviewSubmittedComment}>
                        "{existingReview?.comment || (order as any).review?.comment}"
                      </Text>
                    ) : null}
                    <View style={styles.reviewVerifiedBadge}>
                      <Text style={styles.reviewVerifiedText}>
                        ✓ Review Submitted • Saved to Supermarket Profile
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.reviewFormBox}>
                    <Text style={styles.reviewRatingLabel}>Your Overall Rating:</Text>
                    <View style={styles.reviewInteractiveStarsRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity
                          key={star}
                          onPress={() => setRating(star)}
                          activeOpacity={0.7}
                          style={styles.starTouchable}
                        >
                          <Text
                            style={[
                              styles.starInteractive,
                              star <= rating ? styles.starFilled : styles.starEmpty,
                            ]}
                          >
                            ★
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TextInput
                      style={styles.reviewTextInput}
                      placeholder="Write a brief review (e.g. quick packaging, fresh items, courteous service)..."
                      placeholderTextColor="#94A3B8"
                      value={reviewComment}
                      onChangeText={setReviewComment}
                      multiline
                      numberOfLines={3}
                    />

                    {reviewSuccessMsg ? (
                      <Text style={styles.reviewSuccessMsg}>{reviewSuccessMsg}</Text>
                    ) : null}

                    <TouchableOpacity
                      style={[styles.submitReviewBtn, submittingReview && { opacity: 0.7 }]}
                      onPress={handleSubmitReview}
                      disabled={submittingReview}
                      activeOpacity={0.85}
                    >
                      {submittingReview ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.submitReviewBtnText}>Submit Customer Review ⭐</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ========================================================= */}
            {/* 6. BOTTOM NAVIGATION ACTIONS                              */}
            {/* ========================================================= */}
            <View style={styles.bottomActions}>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => router.replace("/orders")}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryActionBtnText}>View All My Orders 📋</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={() => router.replace("/catalog")}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryActionBtnText}>Continue Shopping 🛒</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      {/* Customer Bottom Navigation */}
      <CustomerBottomNav activeTab="tracking" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    backgroundColor: "#3B0764", // Deep rich GrocerEase purple
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  safeHeader: {
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  backBtnArrow: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "300",
    marginTop: -3,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#E9D5FF",
    marginTop: 2,
    fontWeight: "500",
  },
  liveIndicatorPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderWidth: 1,
    borderColor: "#22C55E",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    marginRight: 6,
  },
  liveIndicatorText: {
    color: "#22C55E",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  centerLoading: {
    paddingVertical: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 14,
    color: "#64748B",
    fontSize: 14,
    fontWeight: "500",
  },
  notFoundBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    marginTop: 40,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  notFoundDesc: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  actionOutlineBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#3B0764",
  },
  actionOutlineBtnText: {
    color: "#3B0764",
    fontSize: 14,
    fontWeight: "700",
  },

  // 1. ETA Hero Card
  etaHeroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#3B0764",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  etaTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  etaBadgeEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  etaBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B21A8",
  },
  orderNumberPill: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentStatusHeading: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  etaTimeBox: {
    marginBottom: 14,
  },
  etaLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  etaTimeVal: {
    fontSize: 18,
    fontWeight: "800",
    color: "#059669",
    marginTop: 2,
  },
  deliveredHighlight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  deliveredHighlightEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  deliveredHighlightText: {
    fontSize: 13,
    color: "#166534",
    fontWeight: "700",
    flex: 1,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
    marginVertical: 10,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  etaFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  etaFooterHint: {
    fontSize: 11,
    color: "#64748B",
    flex: 1,
  },
  etaSyncTime: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    marginLeft: 8,
  },

  // 2. Partner Card
  partnerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#E0E7FF",
    shadowColor: "#4338CA",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  partnerHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  partnerAvatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    overflow: "hidden",
  },
  partnerPhoto: {
    width: "100%",
    height: "100%",
  },
  partnerAvatarInitial: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  partnerInfo: {
    flex: 1,
  },
  partnerNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  partnerName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  verifiedBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803D",
  },
  partnerRoleText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  partnerStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  partnerGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#16A34A",
    marginRight: 5,
  },
  partnerStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16A34A",
  },
  callPartnerBtn: {
    marginTop: 14,
    backgroundColor: "#059669",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#059669",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  callPartnerBtnIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  callPartnerBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  partnerSecurityNotice: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  shieldEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  securityNoticeText: {
    fontSize: 11,
    color: "#64748B",
    flex: 1,
    lineHeight: 15,
  },

  // 3. Amazon-Style Vertical Timeline
  timelineCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    marginBottom: 18,
  },
  timelineList: {
    marginTop: 4,
  },
  timelineItemRow: {
    flexDirection: "row",
    minHeight: 80,
  },
  timelineIndicatorCol: {
    alignItems: "center",
    width: 32,
    marginRight: 14,
  },
  timelineNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  timelineNodeCompleted: {
    backgroundColor: "#16A34A",
  },
  timelineNodeActive: {
    backgroundColor: "#3B0764",
    borderWidth: 3,
    borderColor: "#E9D5FF",
  },
  timelineNodePending: {
    backgroundColor: "#F1F5F9",
    borderWidth: 2,
    borderColor: "#CBD5E1",
  },
  nodeCheckmark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  nodeActivePulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
  },
  nodeStepNum: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
  },
  timelineLine: {
    width: 3,
    flex: 1,
    marginVertical: -2,
    zIndex: 1,
  },
  timelineLineCompleted: {
    backgroundColor: "#16A34A",
  },
  timelineLinePending: {
    backgroundColor: "#E2E8F0",
  },
  timelineContentCol: {
    flex: 1,
    paddingBottom: 22,
  },
  stageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stageTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  stageTitleCompleted: {
    color: "#0F172A",
  },
  stageTitleActive: {
    color: "#3B0764",
    fontWeight: "800",
  },
  stageTitlePending: {
    color: "#94A3B8",
  },
  currentPill: {
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6B21A8",
  },
  stageDescription: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 18,
  },
  stageTimestamp: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "600",
    marginTop: 4,
  },
  stagePendingNotice: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
    fontStyle: "italic",
  },

  // 4. Detail Cards (Address & Items)
  detailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  detailCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  detailHeaderIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  detailCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  recipientName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  recipientPhone: {
    fontSize: 13,
    color: "#475569",
    marginTop: 2,
  },
  recipientAddress: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 19,
  },
  notesBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
  },
  notesText: {
    fontSize: 12,
    color: "#78350F",
    marginTop: 2,
  },

  // Items List
  itemsList: {
    marginTop: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  itemThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  itemThumb: {
    width: 36,
    height: 36,
  },
  itemMeta: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  itemBrand: {
    fontSize: 11,
    color: "#64748B",
  },
  itemQtyPrice: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginLeft: 8,
  },
  noItemsText: {
    color: "#94A3B8",
    fontSize: 13,
    paddingVertical: 10,
  },
  priceSummaryDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 12,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  priceRowLabel: {
    fontSize: 13,
    color: "#64748B",
  },
  priceRowVal: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  totalRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  totalRowLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  totalRowVal: {
    fontSize: 18,
    fontWeight: "800",
    color: "#3B0764",
  },
  paymentMethodPill: {
    marginTop: 12,
    backgroundColor: "#F1F5F9",
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  paymentMethodText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },

  // 1.5 Compulsory Review Banner
  compulsoryReviewBanner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#FCD34D",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  compulsoryReviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  compulsoryReviewIcon: {
    fontSize: 26,
    marginRight: 10,
  },
  compulsoryReviewTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#92400E",
  },
  compulsoryReviewSubtitle: {
    fontSize: 12,
    color: "#78350F",
    marginTop: 2,
    lineHeight: 16,
  },

  // 5.5 Review & Rating Card
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#FEF08A",
    shadowColor: "#CA8A04",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  reviewEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  reviewSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  reviewSubmittedBox: {
    backgroundColor: "#FEFCE8",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FEF08A",
    alignItems: "center",
  },
  reviewStarsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  reviewStarLarge: {
    fontSize: 26,
  },
  starFilled: {
    color: "#EAB308",
  },
  starEmpty: {
    color: "#CBD5E1",
  },
  reviewSubmittedComment: {
    fontSize: 13,
    color: "#475569",
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 12,
  },
  reviewVerifiedBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reviewVerifiedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803D",
  },
  reviewFormBox: {
    backgroundColor: "#FAFAFA",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  reviewRatingLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  reviewInteractiveStarsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  starTouchable: {
    padding: 2,
  },
  starInteractive: {
    fontSize: 32,
  },
  reviewTextInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 12,
    fontSize: 13,
    color: "#0F172A",
    textAlignVertical: "top",
    minHeight: 70,
    marginBottom: 12,
  },
  reviewSuccessMsg: {
    fontSize: 12,
    color: "#15803D",
    fontWeight: "600",
    marginBottom: 10,
    textAlign: "center",
  },
  submitReviewBtn: {
    backgroundColor: "#16A34A",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  submitReviewBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  reviewDisabledNotice: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  reviewDisabledText: {
    fontSize: 12,
    color: "#94A3B8",
    fontStyle: "italic",
  },

  // 6. Bottom Actions
  bottomActions: {
    marginTop: 8,
  },
  primaryActionBtn: {
    backgroundColor: "#3B0764",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#3B0764",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryActionBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#3B0764",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryActionBtnText: {
    color: "#3B0764",
    fontSize: 15,
    fontWeight: "700",
  },
});

