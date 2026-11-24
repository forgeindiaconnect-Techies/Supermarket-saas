import React, { useEffect, useState, useRef } from "react";
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
  Platform,
  Alert,
  TextInput,
  Modal as RNModal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useCart, OrderRecord } from "../context/CartContext";
import { API_URL, safeFetch } from "../constants/api";
import ReceiptModal from "../components/ReceiptModal";

const { width } = Dimensions.get("window");

const PENDING_IMG = require("../../assets/images/payment-pending.jpg");

// =========================================================================
// 3D HIGH-FIDELITY CELEBRATION ILLUSTRATION MATCHING REFERENCE IMAGE 2
// =========================================================================
function PaymentSuccessIllustration() {
  return (
    <View style={illustStyles.container}>
      {/* 1. Radiating Sunburst Celebration Rays */}
      <View style={illustStyles.raysWrapper}>
        <View style={[illustStyles.ray, { transform: [{ rotate: "-65deg" }, { translateY: -46 }], backgroundColor: "#F59E0B" }]} />
        <View style={[illustStyles.ray, { transform: [{ rotate: "-45deg" }, { translateY: -48 }], backgroundColor: "#8B5CF6" }]} />
        <View style={[illustStyles.ray, { transform: [{ rotate: "-25deg" }, { translateY: -50 }], backgroundColor: "#22C55E" }]} />
        <View style={[illustStyles.ray, { transform: [{ rotate: "-10deg" }, { translateY: -52 }], backgroundColor: "#38BDF8" }]} />
        <View style={[illustStyles.ray, { transform: [{ rotate: "8deg" }, { translateY: -52 }], backgroundColor: "#FBBF24" }]} />
        <View style={[illustStyles.ray, { transform: [{ rotate: "25deg" }, { translateY: -50 }], backgroundColor: "#EC4899" }]} />
        <View style={[illustStyles.ray, { transform: [{ rotate: "45deg" }, { translateY: -48 }], backgroundColor: "#10B981" }]} />
        <View style={[illustStyles.ray, { transform: [{ rotate: "65deg" }, { translateY: -46 }], backgroundColor: "#F59E0B" }]} />
      </View>

      {/* Floating Confetti Elements */}
      <View style={[illustStyles.confettiBar, { top: 12, left: 28, backgroundColor: "#38BDF8", transform: [{ rotate: "30deg" }] }]} />
      <View style={[illustStyles.confettiBar, { top: 20, right: 34, backgroundColor: "#F59E0B", transform: [{ rotate: "-22deg" }] }]} />
      <View style={[illustStyles.confettiDot, { top: 40, left: 16, backgroundColor: "#A855F7" }]} />
      <View style={[illustStyles.confettiDot, { top: 46, right: 20, backgroundColor: "#22C55E" }]} />

      {/* 2. Centered Vibrant Green Glowing Checkmark Circle */}
      <View style={illustStyles.centerCheckCircleOuter}>
        <View style={illustStyles.centerCheckCircle}>
          <Text style={illustStyles.centerCheckmarkText}>✓</Text>
        </View>
      </View>

      {/* 3. Left: Purple GrocerEase Grocery Shopping Bag */}
      <View style={illustStyles.bagContainer}>
        {/* White Curved Bag Handles */}
        <View style={illustStyles.bagHandles} />
        {/* Purple 3D Bag Body */}
        <View style={illustStyles.bagBody}>
          <Text style={illustStyles.bagCartGlyph}>🛒</Text>
          <Text style={illustStyles.bagBrandText}>GrocerEase</Text>
        </View>
      </View>

      {/* 4. Right: Silver Wire Shopping Cart with Fresh Groceries */}
      <View style={illustStyles.cartContainer}>
        {/* Food Items Peeking from Top of Basket */}
        <View style={illustStyles.groceriesRow}>
          <Text style={illustStyles.foodItem}>🍅</Text>
          <Text style={illustStyles.foodItem}>🥬</Text>
          <Text style={illustStyles.foodItem}>🥛</Text>
          <Text style={illustStyles.foodItem}>🥖</Text>
        </View>

        {/* Wire Cart Mesh Basket */}
        <View style={illustStyles.wireBasket}>
          <View style={illustStyles.wireHLine1} />
          <View style={illustStyles.wireHLine2} />
          <View style={illustStyles.wireVLine1} />
          <View style={illustStyles.wireVLine2} />
        </View>

        {/* Chassis & Little Rolling Wheels */}
        <View style={illustStyles.cartWheelsRow}>
          <View style={illustStyles.cartWheel} />
          <View style={illustStyles.cartWheel} />
        </View>
      </View>

      {/* Soft Ground Shadow */}
      <View style={illustStyles.groundShadow} />
    </View>
  );
}

// =========================================================================
// MAIN PAYMENT STATUS & CONFIRMATION SCREEN
// =========================================================================
export default function PaymentSuccessScreen() {
  const router = useRouter();
  const { orderId, method, status: queryStatus } = useLocalSearchParams<{
    orderId?: string;
    method?: string;
    status?: string;
  }>();
  const { recentOrders, updateRecentOrder, customerUser, clearCart, purchaseMode, startFreshOfflineSession } = useCart();

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Self Pickup 2-Choice Fulfillment States
  const [chosenFulfillment, setChosenFulfillment] = useState<string>("");
  const [doorstepModalOpen, setDoorstepModalOpen] = useState(false);
  const [doorstepAddress, setDoorstepAddress] = useState("");
  const [savingFulfillment, setSavingFulfillment] = useState(false);

  useEffect(() => {
    if ((order as any)?.fulfillmentChoice) {
      setChosenFulfillment((order as any).fulfillmentChoice);
    }
  }, [order]);

  const handleChooseDoorstep = () => {
    const existing = (order as any)?.deliveryAddress || (order as any)?.customer?.address || customerUser?.address || "";
    setDoorstepAddress(existing);
    setDoorstepModalOpen(true);
  };

  const handleConfirmDoorstep = async () => {
    const targetId = order?._id || orderId;
    if (!targetId || !API_URL) return;
    if (!doorstepAddress.trim()) {
      Alert.alert("Address Needed", "Please enter your delivery street address.");
      return;
    }
    setSavingFulfillment(true);
    try {
      const res = await safeFetch(`${API_URL}/orders/${targetId}/fulfillment-choice`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillmentChoice: "DOORSTEP_DELIVERY",
          deliveryAddress: doorstepAddress.trim(),
        }),
      }, 5000);
      const data = await res.json();
      if (data?.success && data?.order) {
        setOrder(data.order);
        updateRecentOrder(data.order);
        setChosenFulfillment("DOORSTEP_DELIVERY");
        setDoorstepModalOpen(false);
        Alert.alert(
          "Doorstep Delivery Confirmed",
          "Your order has been routed to the store delivery fleet. Delivery staff will deliver to your address."
        );
      }
    } catch (_) {
      setChosenFulfillment("DOORSTEP_DELIVERY");
      setDoorstepModalOpen(false);
    } finally {
      setSavingFulfillment(false);
    }
  };

  const handleChooseStoreCollection = async () => {
    const targetId = order?._id || orderId;
    if (!targetId || !API_URL) return;
    setSavingFulfillment(true);
    try {
      const res = await safeFetch(`${API_URL}/orders/${targetId}/fulfillment-choice`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillmentChoice: "STORE_COLLECTION",
        }),
      }, 5000);
      const data = await res.json();
      if (data?.success && data?.order) {
        setOrder(data.order);
        updateRecentOrder(data.order);
        setChosenFulfillment("STORE_COLLECTION");
        Alert.alert(
          "Store Collection Confirmed",
          "The supermarket will pack your order and set an estimated pickup time. You can collect it at the counter and tap Complete when received."
        );
      }
    } catch (_) {
      setChosenFulfillment("STORE_COLLECTION");
    } finally {
      setSavingFulfillment(false);
    }
  };

  const handleCustomerCompletePickup = async () => {
    const targetId = order?._id || orderId;
    if (!targetId || !API_URL) return;
    try {
      const res = await safeFetch(`${API_URL}/orders/${targetId}/customer-complete-pickup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      }, 10000);
      const contentType = res.headers?.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data?.success && data?.order) {
          setOrder(data.order);
          updateRecentOrder(data.order);
          Alert.alert(
            "Pickup Completed!",
            "Thank you for shopping with GrocerEase! Store Admin has been notified that you collected your order."
          );
        }
      }
    } catch (_) {}
  };

  // Pulse animation for pending live verification indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.4,
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

  // Initial load & Real-time Live Polling every 3.5s with concurrency lock
  useEffect(() => {
    let isMounted = true;
    let isFetching = false;

    // 1. Initial hydrate from recentOrders cache if available
    if (orderId && recentOrders.length > 0) {
      const match = recentOrders.find((o) => o._id === orderId);
      if (match) {
        setOrder(match);
      }
    } else if (!orderId && recentOrders.length > 0) {
      setOrder(recentOrders[0]);
    }

    // 2. Fetch live status from backend
    const fetchLiveStatus = async () => {
      const targetId = orderId || (recentOrders.length > 0 ? recentOrders[0]._id : null);
      if (!targetId || !API_URL) {
        if (isMounted) setLoading(false);
        return;
      }

      if (isFetching) return;
      isFetching = true;

      try {
        const cleanTargetId = encodeURIComponent(String(targetId).replace(/^#/, "").trim());
        const res = await safeFetch(`${API_URL}/orders/${cleanTargetId}?_t=${Date.now()}`, {}, 8000);
        const contentType = res.headers?.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          if (isMounted && data?.success && data?.order) {
            setOrder(data.order);
            updateRecentOrder(data.order);
          }
        }
      } catch (_) {
        // silent fail during background polling
      } finally {
        isFetching = false;
        if (isMounted) setLoading(false);
      }
    };

    fetchLiveStatus();

    const interval = setInterval(() => {
      fetchLiveStatus();
    }, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [orderId]);

  // Determine current status (Pending vs Approved/Successful)
  const effectiveStatus = (
    queryStatus ||
    order?.paymentStatus ||
    (method === "Cash" ? "Pending" : "Completed")
  ).toLowerCase();

  const isPending = effectiveStatus === "pending";

  const isOfflineOrder =
    (order as any)?.purchaseMode === "OFFLINE" ||
    (order as any)?.orderType === "IN_STORE" ||
    purchaseMode === "offline" ||
    (!order && purchaseMode !== "online");

  const isSelfPickupOrder =
    !isOfflineOrder &&
    Boolean(
      (order as any)?.orderType === "SELF_PICKUP" ||
        (order as any)?.orderType === "SELF_PICKUP_DOORSTEP" ||
        (order as any)?.orderType === "SELF_PICKUP_STORE_COLLECTION" ||
        (order as any)?.fulfillmentChoice === "PENDING_SELECTION" ||
        (order as any)?.fulfillmentChoice === "DOORSTEP_DELIVERY" ||
        (order as any)?.fulfillmentChoice === "STORE_COLLECTION" ||
        Boolean((order as any)?.pickupStatus)
    );

  const orderNum = order?.orderNumber || (orderId ? `ORD-${orderId.slice(-6).toUpperCase()}` : "ORD-028427-8859");
  const amount = Number(order?.totalAmount || 0);
  const payMethod = order?.paymentMethod || method || "UPI";

  return (
    <View style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Top Bar matching Exact Reference Mockup (Deep Purple) */}
      <View style={styles.purpleHeader}>
        <SafeAreaView edges={["top"]} style={styles.purpleHeaderSafe}>
          <View style={styles.headerRow}>
            {/* Left Circular Back Button */}
            <TouchableOpacity
              style={styles.headerCircleBtn}
              onPress={() => router.replace("/orders")}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.headerBackChevron}>‹</Text>
            </TouchableOpacity>

            {/* Header Title */}
            <Text style={styles.headerTitle}>
              {isPending ? "Payment Status" : "Payment Successful"}
            </Text>

            {/* Right Circular Receipt Action Button */}
            <TouchableOpacity
              style={styles.headerCircleBtn}
              onPress={() => setShowReceiptModal(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.headerReceiptIcon}>📄</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* Main Content Area on Soft Lavender Canvas */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {isPending ? (
          /* ========================================================================= */
          /* 1. PAYMENT PENDING / UNDER VERIFICATION (EXACT MATCH TO IMAGE 1)         */
          /* ========================================================================= */
          <>
            {/* 1. Main Status Card */}
            <View style={styles.mainWhiteCard}>
              {/* 3D Smartphone & Terminal Illustration */}
              <View style={styles.heroIllustWrap}>
                <Image
                  source={PENDING_IMG}
                  style={styles.heroIllustImg}
                  resizeMode="contain"
                />
              </View>

              {/* Status Title */}
              <Text style={styles.pendingTitle}>Payment Under Verification</Text>

              {/* Subtitle */}
              <Text style={styles.pendingSubtitle}>
                Your payment has been received{"\n"}and is awaiting confirmation.
              </Text>

              {/* Status Pill Badge */}
              <View style={styles.pendingPillBadge}>
                <Text style={styles.pendingPillClock}>🕒</Text>
                <Text style={styles.pendingPillText}>Pending Approval</Text>
              </View>

              {/* 3-Step Horizontal Stepper */}
              <View style={styles.stepperContainer}>
                <View style={styles.stepperRow}>
                  {/* Step 1: Order Placed */}
                  <View style={styles.stepCol}>
                    <View style={styles.stepCircleDone}>
                      <Text style={styles.stepCheckmarkDone}>✓</Text>
                    </View>
                    <Text style={styles.stepLabelDone}>Order Placed</Text>
                  </View>

                  {/* Connecting Line 1 */}
                  <View style={styles.stepLineGreen} />

                  {/* Step 2: Payment Verification */}
                  <View style={styles.stepCol}>
                    <Animated.View
                      style={[
                        styles.stepCirclePending,
                        { opacity: pulseAnim },
                      ]}
                    >
                      <Text style={styles.stepHourglassIcon}>⌛</Text>
                    </Animated.View>
                    <Text style={styles.stepLabelPending}>
                      Payment{"\n"}Verification
                    </Text>
                  </View>

                  {/* Connecting Line 2 */}
                  <View style={styles.stepLineGray} />

                  {/* Step 3: Order Confirmed */}
                  <View style={styles.stepCol}>
                    <View style={styles.stepCircleInactive}>
                      <Text style={styles.stepCheckmarkInactive}>✓</Text>
                    </View>
                    <Text style={styles.stepLabelInactive}>Order Confirmed</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 2. Middle Alert Notification Card (Cream / Yellow) */}
            <View style={styles.alertBannerCard}>
              <View style={styles.alertBellWrap}>
                <Text style={styles.alertBellIcon}>🔔</Text>
              </View>

              <View style={styles.alertDivider} />

              <View style={styles.alertTextWrap}>
                <Text style={styles.alertLine1}>We're verifying your payment.</Text>
                <Text style={styles.alertLine2}>
                  This page will update automatically once confirmed.
                </Text>
              </View>
            </View>

            {/* 3. Order Summary Card (White Card with Cart Icon) */}
            <View style={styles.orderSummaryCard}>
              <View style={styles.summaryCartCircle}>
                <Text style={styles.summaryCartIcon}>🛒</Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryDetailsCol}>
                <Text style={styles.summaryOrderText}>
                  Order ID: <Text style={styles.summaryOrderVal}>{orderNum}</Text>
                </Text>
                <Text style={styles.summaryAmountText}>
                  Amount: <Text style={styles.summaryAmountVal}>₹{amount.toFixed(2)}</Text>
                </Text>
                <Text style={styles.summaryPaymentText}>
                  Payment: <Text style={styles.summaryPaymentVal}>{payMethod}</Text>
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowReceiptModal(true)}
                activeOpacity={0.7}
                style={styles.summaryViewLinkWrap}
              >
                <Text style={styles.summaryViewLinkText}>View Order Details &gt;</Text>
              </TouchableOpacity>
            </View>

            {/* 4. Bottom Warning Notice */}
            <View style={styles.bottomWarningRow}>
              <View style={styles.warningIconCircle}>
                <Text style={styles.warningIconExclamation}>!</Text>
              </View>
              <Text style={styles.bottomWarningText}>
                Please do not make another payment.
              </Text>
            </View>
          </>
        ) : (
          /* ========================================================================= */
          /* 2. PAYMENT SUCCESSFUL (EXACT MATCH TO IMAGE 2)                            */
          /* ========================================================================= */
          <>
            {/* 1. Main Status Card */}
            <View style={styles.mainWhiteCard}>
              {/* Celebration 3D Confetti & Cart Illustration */}
              <PaymentSuccessIllustration />

              {/* Status Title */}
              <Text style={styles.successTitle}>Payment Successful!</Text>

              {/* Subtitle */}
              <Text style={styles.successSubtitle}>
                Your payment has been confirmed successfully.
              </Text>

              {/* Total Amount Paid Box */}
              <View style={styles.amountPaidBox}>
                {/* Decorative Green Accent Sparks */}
                <View style={styles.amountSparkLeft}>
                  <Text style={styles.amountSparkGlyph}>\ /</Text>
                </View>
                <View style={styles.amountSparkRight}>
                  <Text style={styles.amountSparkGlyph}>\ /</Text>
                </View>

                {/* Amount Label */}
                <Text style={styles.amountPaidLabel}>TOTAL AMOUNT PAID</Text>

                {/* Amount Value */}
                <Text style={styles.amountPaidValue}>₹{amount.toFixed(2)}</Text>

                {/* Order Confirmed Pill */}
                <View style={styles.orderConfirmedPill}>
                  <View style={styles.confirmedCheckBadge}>
                    <Text style={styles.confirmedCheckGlyph}>✓</Text>
                  </View>
                  <Text style={styles.orderConfirmedText}>Order Confirmed</Text>
                </View>
              </View>
            </View>

            {/* 2. Order Details Section */}
            <View style={styles.orderDetailsSection}>
              {/* Section Header */}
              <View style={styles.orderDetailsHeaderRow}>
                <View style={styles.orderReceiptCircle}>
                  <Text style={styles.orderReceiptGlyph}>📋</Text>
                </View>
                <Text style={styles.orderDetailsTitle}>Order Details</Text>
              </View>

              {/* Order Details Lavender Card */}
              <View style={styles.orderDetailsCard}>
                {/* Left Column: Order ID & Payment Method */}
                <View style={styles.orderColLeft}>
                  {/* Order ID Row */}
                  <View style={styles.metaRow}>
                    <Text style={styles.metaIconGlyph}>#</Text>
                    <View>
                      <Text style={styles.metaLabel}>Order ID</Text>
                      <Text style={styles.metaValue}>{orderNum}</Text>
                    </View>
                  </View>

                  {/* Payment Method Row */}
                  <View style={[styles.metaRow, { marginTop: 12 }]}>
                    <Text style={styles.metaIconGlyph}>💳</Text>
                    <View>
                      <Text style={styles.metaLabel}>Payment Method</Text>
                      <Text style={styles.metaValue}>{payMethod}</Text>
                    </View>
                  </View>

                  {/* Supermarket Name Row */}
                  <View style={[styles.metaRow, { marginTop: 12 }]}>
                    <Text style={styles.metaIconGlyph}>🏬</Text>
                    <View>
                      <Text style={styles.metaLabel}>Supermarket</Text>
                      <Text style={styles.metaValue} numberOfLines={1}>
                        {order?.supermarketName || (order as any)?.supermarket?.name || "Supermarket"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Vertical Divider Line */}
                <View style={styles.orderColDivider} />

                {/* Right Column: Payment Status */}
                <View style={styles.orderColRight}>
                  <View style={styles.metaRow}>
                    <View style={styles.statusCheckCirclePurple}>
                      <Text style={styles.statusCheckGlyphWhite}>✓</Text>
                    </View>
                    <View>
                      <Text style={styles.metaLabel}>Payment Status</Text>
                      <Text style={styles.statusValueGreen}>Successful</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Itemized Purchased Products Card */}
              {order?.items && order.items.length > 0 && (
                <View style={styles.purchasedItemsCard}>
                  <View style={styles.purchasedItemsHeader}>
                    <Text style={styles.purchasedItemsTitle}>Purchased Items ({order.items.length})</Text>
                    <Text style={styles.purchasedItemsStore}>{order.supermarketName || "In-Store Purchase"}</Text>
                  </View>
                  {order.items.map((it, idx) => (
                    <View key={it._id || idx} style={styles.purchasedItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.purchasedItemName} numberOfLines={1}>{it.name}</Text>
                        <Text style={styles.purchasedItemMeta}>Qty: {it.quantity} × ₹{Number(it.price || 0).toFixed(2)}</Text>
                      </View>
                      <Text style={styles.purchasedItemTotal}>₹{(Number(it.price || 0) * it.quantity).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 2b. Self Pickup 2-Choice Fulfillment Flow (Option A: Doorstep vs Option B: Collect from Store) */}
            {isSelfPickupOrder && (
              <View style={styles.fulfillmentChoiceSection}>
                <View style={styles.choiceHeaderRow}>
                  <Text style={styles.choiceHeaderEmoji}>📦</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choiceHeaderTitle}>Choose Fulfillment Method</Text>
                    <Text style={styles.choiceHeaderSubtitle}>
                      {chosenFulfillment === "DOORSTEP_DELIVERY"
                        ? "Option A: Doorstep Delivery Selected"
                        : chosenFulfillment === "STORE_COLLECTION"
                        ? "Option B: Store Collection Selected"
                        : "Please select how you would like to receive your items:"}
                    </Text>
                  </View>
                </View>

                {/* Option A: Deliver to My Doorstep */}
                <TouchableOpacity
                  style={[
                    styles.choiceCard,
                    chosenFulfillment === "DOORSTEP_DELIVERY" && styles.choiceCardActive,
                  ]}
                  onPress={handleChooseDoorstep}
                  activeOpacity={0.85}
                  disabled={savingFulfillment}
                >
                  <View style={styles.choiceIconCircle}>
                    <Text style={styles.choiceIconEmoji}>🚚</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choiceCardTitle}>Option A: Deliver to My Doorstep</Text>
                    <Text style={styles.choiceCardDesc}>
                      Delivery staff will bring your groceries directly to your doorstep address.
                    </Text>
                    {chosenFulfillment === "DOORSTEP_DELIVERY" && (
                      <View style={styles.choiceActivePill}>
                        <Text style={styles.choiceActivePillText}>✓ Doorstep Delivery Active</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Option B: Collect from Store */}
                <TouchableOpacity
                  style={[
                    styles.choiceCard,
                    chosenFulfillment === "STORE_COLLECTION" && styles.choiceCardActive,
                  ]}
                  onPress={handleChooseStoreCollection}
                  activeOpacity={0.85}
                  disabled={savingFulfillment}
                >
                  <View style={styles.choiceIconCircle}>
                    <Text style={styles.choiceIconEmoji}>🏬</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choiceCardTitle}>Option B: Collect from Store</Text>
                    <Text style={styles.choiceCardDesc}>
                      Collect your order from the supermarket counter. Tap Complete when collected.
                    </Text>
                    {chosenFulfillment === "STORE_COLLECTION" && (
                      <View style={styles.choiceActivePill}>
                        <Text style={styles.choiceActivePillText}>✓ Store Pickup Active</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Live Store Pickup Notification & Customer Complete Button */}
                {chosenFulfillment === "STORE_COLLECTION" && (
                  <View style={styles.pickupStatusBox}>
                    {(order as any)?.estimatedReadyTime ? (
                      <View style={styles.pickupReadyBanner}>
                        <Text style={styles.pickupReadyBell}>🔔</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pickupReadyTitle}>
                            Your order will be ready for pickup at {(order as any)?.estimatedReadyTime} ({(order as any)?.estimatedReadyDate || "Today"}).
                          </Text>
                          <Text style={styles.pickupReadySub}>
                            {(order as any)?.pickupInstructions || "Please visit the store and collect your products."}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.pickupWaitingText}>
                        ⏳ Supermarket is preparing your order. You will receive an estimated collection time notification here shortly.
                      </Text>
                    )}

                    {(order as any)?.customerPickupConfirmed ? (
                      <View style={styles.pickupDoneBadge}>
                        <Text style={styles.pickupDoneText}>✓ Order Collected from Store (Completed)</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.pickupCompleteBtn}
                        onPress={handleCustomerCompletePickup}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.pickupCompleteBtnText}>✓ Complete (Collected from Store)</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* In-Store Supermarket Exit Pass (Strictly for OFFLINE Self-Checkout Flow) */}
            {isOfflineOrder && (
              <View style={styles.offlineExitPassCard}>
                <View style={styles.exitPassHeader}>
                  <Text style={{ fontSize: 26 }}>🛡️</Text>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.exitPassTitle}>Supermarket Store Exit Pass</Text>
                    <Text style={styles.exitPassSub}>
                      {order?.supermarketName || "GrocerEase Supermarket"} • In-Store Self-Checkout
                    </Text>
                  </View>
                  <View style={styles.exitPassVerifiedBadge}>
                    <Text style={styles.exitPassVerifiedText}>PAID ✓</Text>
                  </View>
                </View>

                {/* Vertical Barcode Lines */}
                <View style={styles.barcodeBox}>
                  <View style={styles.barcodeBars}>
                    {[4, 2, 5, 1, 3, 2, 6, 2, 4, 1, 5, 3, 2, 6, 1, 4, 2, 5, 3, 2, 4, 1, 6, 2, 3, 5, 2, 4, 3, 6, 1, 4, 2, 5].map((w, i) => (
                      <View
                        key={i}
                        style={{
                          width: w * 1.8,
                          height: 48,
                          backgroundColor: "#0F172A",
                          marginRight: i % 3 === 0 ? 3 : 1.5,
                        }}
                      />
                    ))}
                  </View>
                  <Text style={styles.barcodeNumberText}>
                    {order?.exitBarcode || `EXIT-${orderNum.replace(/\D/g, "") || "8829471"}`}
                  </Text>
                </View>

                <Text style={styles.exitGateNotice}>
                  Show this digital exit barcode to the security personnel at the supermarket exit door.
                </Text>
              </View>
            )}

            {/* 3. Action Buttons */}
            <View style={styles.successActionsWrap}>
              {/* Prominent Track My Order Button (STRICTLY for ONLINE delivery orders) */}
              {!isOfflineOrder && (
                <TouchableOpacity
                  style={styles.trackMyOrderBtn}
                  onPress={() => {
                    const targetId = order?._id || orderId;
                    router.push({
                      pathname: "/order-tracking",
                      params: { orderId: targetId },
                    });
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={styles.trackOrderBtnIcon}>🚚</Text>
                  <Text style={styles.trackMyOrderBtnText}>Track My Order Live</Text>
                </TouchableOpacity>
              )}

              {/* View Order Details Button */}
              <TouchableOpacity
                style={styles.primaryViewOrderBtn}
                onPress={() => setShowReceiptModal(true)}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryBtnIcon}>📄</Text>
                <Text style={styles.primaryViewOrderBtnText}>View Bill Details</Text>
              </TouchableOpacity>

              {/* Start New Shopping / Done Button */}
              <TouchableOpacity
                style={styles.secondaryContinueBtn}
                onPress={() => {
                  startFreshOfflineSession();
                  router.replace(isOfflineOrder ? "/" : "/scanner");
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryBtnIcon}>🛒</Text>
                <Text style={styles.secondaryContinueBtnText}>
                  {isOfflineOrder ? "Done • Start New Shopping" : "Continue Shopping"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Soft Decorative Wave Curve */}
            <View style={styles.bottomWaveDecor}>
              <View style={styles.waveArc} />
            </View>
          </>
        )}
      </ScrollView>

      {/* Doorstep Delivery Address Input Modal */}
      <RNModal
        visible={doorstepModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!savingFulfillment) {
            setDoorstepModalOpen(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCardContent}>
            <Text style={styles.modalHeading}>Confirm Doorstep Delivery Address</Text>
            <Text style={styles.modalSubheading}>
              Please verify or enter the street address where our delivery staff should bring your items.
            </Text>

            <TextInput
              style={styles.addressInput}
              value={doorstepAddress}
              onChangeText={setDoorstepAddress}
              multiline
              numberOfLines={3}
              placeholder="Door No, Street Name, Apartment / Landmark, City"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDoorstepModalOpen(false)}
                disabled={savingFulfillment}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmDoorstep}
                disabled={savingFulfillment}
              >
                <Text style={styles.modalConfirmText}>
                  {savingFulfillment ? "Confirming..." : "Confirm Doorstep Delivery"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </RNModal>

      {/* Interactive In-App Real-Time Tax Receipt Modal */}
      <ReceiptModal
        visible={showReceiptModal}
        order={order}
        onClose={() => setShowReceiptModal(false)}
      />
    </View>
  );
}

// =========================================================================
// STYLES - PIXEL PERFECT REPLICA OF USER REFERENCE MOCKUPS
// =========================================================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#2E0854", // Deep signature purple header background
  },
  purpleHeader: {
    backgroundColor: "#2E0854",
    paddingBottom: 16,
  },
  purpleHeaderSafe: {
    backgroundColor: "#2E0854",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 10 : 6,
  },
  headerCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBackChevron: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "600",
    marginTop: -3,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  headerReceiptIcon: {
    fontSize: 16,
  },
  scrollContent: {
    backgroundColor: "#F4EFFE", // Soft lavender background matching reference canvas
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 36,
  },

  /* ---------------- Main White Status Card ---------------- */
  mainWhiteCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingTop: 16,
    paddingBottom: 22,
    paddingHorizontal: 18,
    alignItems: "center",
    shadowColor: "#3B0764",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },

  /* Pending Hero Image */
  heroIllustWrap: {
    width: "100%",
    height: 145,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  heroIllustImg: {
    width: "100%",
    height: "100%",
  },

  /* Pending Headings */
  pendingTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E1B4B", // Deep navy-purple
    textAlign: "center",
    letterSpacing: -0.3,
    marginTop: 4,
  },
  pendingSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
  },

  /* Pending Pill Badge */
  pendingPillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF9C3", // Light yellow
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  pendingPillClock: {
    fontSize: 12,
  },
  pendingPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B45309", // Amber brown
  },

  /* Horizontal Stepper */
  stepperContainer: {
    width: "100%",
    marginTop: 22,
    paddingHorizontal: 6,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepCol: {
    alignItems: "center",
    width: 76,
  },
  stepCircleDone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  stepCheckmarkDone: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  stepLabelDone: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803D",
    textAlign: "center",
  },
  stepLineGreen: {
    flex: 1,
    height: 2,
    backgroundColor: "#16A34A",
    marginBottom: 20,
  },
  stepCirclePending: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FEF3C7",
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  stepHourglassIcon: {
    fontSize: 13,
  },
  stepLabelPending: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
    textAlign: "center",
    lineHeight: 14,
  },
  stepLineGray: {
    flex: 1,
    height: 2,
    backgroundColor: "#E2E8F0",
    marginBottom: 20,
  },
  stepCircleInactive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  stepCheckmarkInactive: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "700",
  },
  stepLabelInactive: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    textAlign: "center",
  },

  /* ---------------- Middle Alert Banner (Cream / Yellow) ---------------- */
  alertBannerCard: {
    width: "100%",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FEF08A",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  alertBellWrap: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  alertBellIcon: {
    fontSize: 22,
  },
  alertDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#FDE68A",
    marginHorizontal: 12,
  },
  alertTextWrap: {
    flex: 1,
  },
  alertLine1: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#78350F",
  },
  alertLine2: {
    fontSize: 12,
    fontWeight: "500",
    color: "#78350F",
    marginTop: 2,
  },

  /* ---------------- Order Summary Card ---------------- */
  orderSummaryCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryCartCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCartIcon: {
    fontSize: 18,
  },
  summaryDivider: {
    width: 1,
    height: 38,
    backgroundColor: "#F1F5F9",
    marginHorizontal: 12,
  },
  summaryDetailsCol: {
    flex: 1,
  },
  summaryOrderText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155",
  },
  summaryOrderVal: {
    fontWeight: "800",
    color: "#1E1B4B",
  },
  summaryAmountText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155",
    marginTop: 2,
  },
  summaryAmountVal: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#15803D", // Green
  },
  summaryPaymentText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  summaryPaymentVal: {
    fontWeight: "700",
    color: "#1E1B4B",
  },
  summaryViewLinkWrap: {
    paddingLeft: 4,
  },
  summaryViewLinkText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#6B21A8", // Purple link
    textDecorationLine: "underline",
  },

  /* ---------------- Bottom Warning Row ---------------- */
  bottomWarningRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
  },
  warningIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#6B21A8",
    alignItems: "center",
    justifyContent: "center",
  },
  warningIconExclamation: {
    color: "#6B21A8",
    fontSize: 11,
    fontWeight: "800",
    marginTop: -1,
  },
  bottomWarningText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#6B21A8",
  },

  /* ========================================================================= */
  /* SUCCESS STATE STYLES (MATCHING REFERENCE IMAGE 2)                         */
  /* ========================================================================= */
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#16A34A", // Vibrant Green
    textAlign: "center",
    marginTop: 12,
    letterSpacing: -0.3,
  },
  successSubtitle: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
  },

  /* Total Amount Paid Box */
  amountPaidBox: {
    width: "100%",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: 16,
    position: "relative",
  },
  amountSparkLeft: {
    position: "absolute",
    left: 18,
    top: 26,
  },
  amountSparkRight: {
    position: "absolute",
    right: 18,
    top: 26,
  },
  amountSparkGlyph: {
    fontSize: 14,
    color: "#22C55E",
    fontWeight: "800",
    letterSpacing: 2,
  },
  amountPaidLabel: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#6B21A8",
    letterSpacing: 0.6,
  },
  amountPaidValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#15803D",
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  orderConfirmedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 2,
  },
  confirmedCheckBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmedCheckGlyph: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  orderConfirmedText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#15803D",
  },

  /* Order Details Section */
  orderDetailsSection: {
    width: "100%",
    marginTop: 18,
  },
  orderDetailsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  orderReceiptCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  orderReceiptGlyph: {
    fontSize: 14,
  },
  orderDetailsTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  orderDetailsCard: {
    width: "100%",
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#EDE9FE",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  orderColLeft: {
    flex: 1.2,
  },
  orderColDivider: {
    width: 1,
    height: 48,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 10,
  },
  orderColRight: {
    flex: 1,
    paddingLeft: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaIconGlyph: {
    fontSize: 15,
    color: "#7C3AED",
    fontWeight: "700",
    width: 18,
    textAlign: "center",
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  metaValue: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 1,
  },
  statusCheckCirclePurple: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  statusCheckGlyphWhite: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  statusValueGreen: {
    fontSize: 13,
    fontWeight: "800",
    color: "#16A34A",
    marginTop: 1,
  },

  /* In-Store Supermarket Exit Pass Card */
  offlineExitPassCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  exitPassHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  exitPassTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  exitPassSub: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 2,
  },
  exitPassVerifiedBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  exitPassVerifiedText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#15803D",
  },
  barcodeBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  barcodeBars: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    height: 48,
  },
  barcodeNumberText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
    letterSpacing: 2,
    marginTop: 8,
  },
  exitGateNotice: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 16,
    fontWeight: "500",
  },

  /* Action Buttons (Success Screen) */
  successActionsWrap: {
    width: "100%",
    marginTop: 20,
    gap: 12,
  },
  trackMyOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 15,
    backgroundColor: "#059669", // Vibrant Emerald Green / Amazon live tracker
    borderRadius: 26,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  trackOrderBtnIcon: {
    fontSize: 18,
  },
  trackMyOrderBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  primaryViewOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 15,
    backgroundColor: "#4C1D95", // Deep violet button
    borderRadius: 26,
    shadowColor: "#4C1D95",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnIcon: {
    fontSize: 16,
  },
  primaryViewOrderBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secondaryContinueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#4C1D95",
    borderRadius: 26,
  },
  secondaryBtnIcon: {
    fontSize: 16,
  },
  secondaryContinueBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#4C1D95",
  },

  /* Bottom Decorative Soft Wave */
  bottomWaveDecor: {
    width: "100%",
    height: 28,
    marginTop: 16,
    overflow: "hidden",
    alignItems: "center",
  },
  waveArc: {
    width: "120%",
    height: 48,
    borderRadius: 30,
    backgroundColor: "#EDE9FE",
    opacity: 0.5,
  },

  /* Self Pickup 2-Choice Fulfillment Styles */
  fulfillmentChoiceSection: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  choiceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  choiceHeaderEmoji: {
    fontSize: 24,
  },
  choiceHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  choiceHeaderSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  choiceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
  },
  choiceCardActive: {
    backgroundColor: "#F0FDF4",
    borderColor: "#059669",
  },
  choiceIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  choiceIconEmoji: {
    fontSize: 20,
  },
  choiceCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  choiceCardDesc: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },
  choiceActivePill: {
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  choiceActivePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803D",
  },
  pickupStatusBox: {
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    gap: 10,
  },
  pickupReadyBanner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  pickupReadyBell: {
    fontSize: 20,
  },
  pickupReadyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B21A8",
  },
  pickupReadySub: {
    fontSize: 11.5,
    color: "#7E22CE",
    marginTop: 2,
  },
  pickupWaitingText: {
    fontSize: 12,
    color: "#7E22CE",
    fontStyle: "italic",
    textAlign: "center",
  },
  pickupDoneBadge: {
    backgroundColor: "#DCFCE7",
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  pickupDoneText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },
  pickupCompleteBtn: {
    backgroundColor: "#059669",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pickupCompleteBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalCardContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
  },
  modalHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSubheading: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 16,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 12,
    fontSize: 13.5,
    color: "#0F172A",
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalBtnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  modalConfirmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#059669",
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  purchasedItemsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  purchasedItemsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    marginBottom: 8,
  },
  purchasedItemsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  purchasedItemsStore: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  purchasedItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  purchasedItemName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  purchasedItemMeta: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  purchasedItemTotal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginLeft: 10,
  },
});

// =========================================================================
// ILLUSTRATION STYLES (MATCHING REFERENCE IMAGE 2)
// =========================================================================
const illustStyles = StyleSheet.create({
  container: {
    width: "100%",
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  /* Sunburst Celebration Rays */
  raysWrapper: {
    position: "absolute",
    top: 45,
    width: 220,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  ray: {
    position: "absolute",
    width: 3.5,
    height: 14,
    borderRadius: 2,
  },
  confettiBar: {
    position: "absolute",
    width: 4,
    height: 10,
    borderRadius: 2,
  },
  confettiDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  /* Center Green Checkmark Badge */
  centerCheckCircleOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  centerCheckCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },
  centerCheckmarkText: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
  },

  /* Left Purple Bag */
  bagContainer: {
    position: "absolute",
    left: 20,
    bottom: 10,
    width: 74,
    alignItems: "center",
    zIndex: 8,
  },
  bagHandles: {
    width: 26,
    height: 14,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: 3,
    borderColor: "#DDD6FE",
    marginBottom: -2,
  },
  bagBody: {
    width: 72,
    height: 70,
    backgroundColor: "#7C3AED",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4C1D95",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  bagCartGlyph: {
    fontSize: 16,
  },
  bagBrandText: {
    color: "#FFFFFF",
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginTop: 2,
  },

  /* Right Shopping Cart */
  cartContainer: {
    position: "absolute",
    right: 20,
    bottom: 8,
    width: 76,
    alignItems: "center",
    zIndex: 8,
  },
  groceriesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    marginBottom: -4,
    zIndex: 2,
  },
  foodItem: {
    fontSize: 13,
  },
  wireBasket: {
    width: 70,
    height: 50,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#94A3B8",
    borderRadius: 8,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  wireHLine1: {
    position: "absolute",
    top: 15,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#CBD5E1",
  },
  wireHLine2: {
    position: "absolute",
    top: 32,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#CBD5E1",
  },
  wireVLine1: {
    position: "absolute",
    left: 22,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#CBD5E1",
  },
  wireVLine2: {
    position: "absolute",
    right: 22,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#CBD5E1",
  },
  cartWheelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 54,
    marginTop: 3,
  },
  cartWheel: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#334155",
  },

  /* Ground Shadow */
  groundShadow: {
    position: "absolute",
    bottom: 2,
    width: "75%",
    height: 10,
    borderRadius: 15,
    backgroundColor: "rgba(76, 29, 149, 0.06)",
    zIndex: 1,
  },
});
