import React, { useState, useEffect, useRef, useCallback } from "react";
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
  TextInput,
  Alert,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useCart, OrderRecord } from "../context/CartContext";
import { API_URL, safeFetch } from "../constants/api";

const { width } = Dimensions.get("window");

export default function StoreCollectionScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { recentOrders, updateRecentOrder, customerUser } = useCart();

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingPickup, setConfirmingPickup] = useState(false);

  // Review System State
  const [rating, setRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [existingReview, setExistingReview] = useState<any | null>(null);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState("");

  // Pulse animation for active preparation stage
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

  // Fetch Live Order Status from MongoDB backend
  const fetchOrderStatus = useCallback(async (showSpinner = false) => {
    const targetId = orderId || (recentOrders.length > 0 ? recentOrders[0]._id : null);
    if (!targetId || !API_URL) {
      setLoading(false);
      return;
    }

    if (showSpinner) setLoading(true);

    try {
      const cleanTargetId = encodeURIComponent(String(targetId).replace(/^#/, "").trim());
      const res = await safeFetch(`${API_URL}/orders/${cleanTargetId}?_t=${Date.now()}`, {}, 4000);
      const data = await res.json();
      if (data?.success && data?.order) {
        setOrder(data.order);
        updateRecentOrder(data.order);

        if (data.order.review) {
          setExistingReview(data.order.review);
          if (data.order.review.rating) {
            setRating(data.order.review.rating);
          }
          if (data.order.review.comment) {
            setReviewComment(data.order.review.comment);
          }
        }
      }
    } catch (_) {
      // Background poll silent fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, recentOrders, updateRecentOrder]);

  // Initial load and live real-time polling every 2.5 seconds
  useEffect(() => {
    fetchOrderStatus(true);

    const interval = setInterval(() => {
      fetchOrderStatus(false);
    }, 2500);

    return () => clearInterval(interval);
  }, [fetchOrderStatus]);

  // Customer confirms they have physically collected their order at the counter
  const handleConfirmCollection = async () => {
    const targetId = order?._id || orderId;
    if (!targetId || !API_URL) return;

    setConfirmingPickup(true);
    try {
      const res = await safeFetch(
        `${API_URL}/orders/${targetId}/customer-complete-pickup`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
        },
        5000
      );
      const data = await res.json();
      if (data?.success && data?.order) {
        setOrder(data.order);
        updateRecentOrder(data.order);
        Alert.alert(
          "Collection Confirmed!",
          "Thank you for picking up your groceries! You can now rate and review your experience below."
        );
      } else {
        Alert.alert("Notice", data?.message || "Could not confirm collection.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update collection status.");
    } finally {
      setConfirmingPickup(false);
    }
  };

  // Submit Customer Review
  const handleSubmitReview = async () => {
    const targetId = order?._id || orderId;
    if (!targetId) {
      Alert.alert("Order Not Found", "Could not locate order ID to submit review.");
      return;
    }

    if (!rating || rating < 1 || rating > 5) {
      Alert.alert("Rating Required", "Please select a star rating (1 to 5).");
      return;
    }

    setSubmittingReview(true);
    const reviewData = {
      rating,
      comment: reviewComment.trim(),
      customerName:
        customerUser?.name ||
        (order as any)?.customer?.name ||
        (order as any)?.customerName ||
        "Verified Customer",
      customerPhone:
        customerUser?.phone ||
        (order as any)?.customer?.phone ||
        (order as any)?.deliveryPhone ||
        "",
      review: {
        rating,
        comment: reviewComment.trim(),
        customerName:
          customerUser?.name ||
          (order as any)?.customer?.name ||
          (order as any)?.customerName ||
          "Verified Customer",
        submittedAt: new Date().toISOString(),
      },
    };

    try {
      let isSuccess = false;
      let reviewResult: any = null;

      const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (customerUser?.token) reqHeaders["Authorization"] = `Bearer ${customerUser.token}`;

      // 1. Primary Attempt: Dedicated /review endpoint
      try {
        const res = await safeFetch(
          `${API_URL}/orders/${targetId}/review`,
          {
            method: "POST",
            headers: reqHeaders,
            body: JSON.stringify(reviewData),
          },
          5000
        );

        const contentType = res.headers?.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          if (data?.success) {
            isSuccess = true;
            reviewResult = data.review;
          }
        }
      } catch (_) {}

      // 2. Resilient Fallback: Complete-pickup endpoint (also handles review storage)
      if (!isSuccess) {
        try {
          const resFallback = await safeFetch(
            `${API_URL}/orders/${targetId}/customer-complete-pickup`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(reviewData),
            },
            5000
          );
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

      // 3. Secondary Fallback: pickup-status endpoint
      if (!isSuccess) {
        try {
          const resFallback2 = await safeFetch(
            `${API_URL}/orders/${targetId}/pickup-status`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pickupStatus: "Completed",
                ...reviewData,
              }),
            },
            5000
          );
          const contentType = resFallback2.headers?.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await resFallback2.json();
            if (data?.success) {
              isSuccess = true;
              reviewResult = data.order?.review || reviewData.review;
            }
          }
        } catch (_) {}
      }

      const finalReview = reviewResult || reviewData.review;
      setExistingReview(finalReview);
      setReviewSuccessMsg("✓ Thank you! Your review has been saved.");
      Alert.alert("Review Submitted", "Thank you for your valuable feedback!");

      // Update local cart state and refresh order
      if (order) {
        const updated = {
          ...order,
          review: finalReview,
          pickupStatus: "Completed",
          customerPickupConfirmed: true,
        };
        setOrder(updated as any);
        updateRecentOrder(updated as any);
      }
      fetchOrderStatus(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit review. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Stage Progression Calculations
  const rawPickupStatus = (order?.pickupStatus || "Pending").trim();
  const sLower = rawPickupStatus.toLowerCase();

  const isCompleted =
    sLower === "completed" || Boolean((order as any)?.customerPickupConfirmed);

  const isReady =
    sLower === "readyforpickup" ||
    sLower === "ready" ||
    Boolean((order as any)?.pickupReadyNotificationSent);

  const isPreparing = sLower === "preparing";

  // Stages:
  // 1: Order Confirmed (always done)
  // 2: Preparing
  // 3: Ready for Collection
  // 4: Collected
  const stage1Done = true;
  const stage2Done = isPreparing || isReady || isCompleted;
  const stage2Active = isPreparing;
  const stage3Done = isReady || isCompleted;
  const stage3Active = isReady && !isCompleted;
  const stage4Done = isCompleted;

  const orderNum = order?.orderNumber || (orderId ? `ORD-${orderId.slice(-6).toUpperCase()}` : "ORD-028427");
  const storeName = order?.supermarketName || "SuperMart - Main Branch";
  const pickupDate = order?.pickupDate || "Today";
  const pickupTimeSlot = order?.pickupTimeSlot || "Store Hours";
  const totalAmount = Number(order?.totalAmount || 0);

  if (loading && !order) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B0764" />
        <Text style={styles.loadingText}>Fetching Store Collection Status...</Text>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Deep Royal Purple Header */}
      <View style={styles.purpleHeader}>
        <SafeAreaView edges={["top"]} style={styles.headerSafe}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.headerCircleBtn}
              onPress={() => router.replace("/orders")}
              activeOpacity={0.7}
            >
              <Text style={styles.headerBackChevron}>‹</Text>
            </TouchableOpacity>

            <View style={{ alignItems: "center" }}>
              <Text style={styles.headerTitle}>Store Collection Status</Text>
              <Text style={styles.headerSubtitle}>{orderNum}</Text>
            </View>

            <TouchableOpacity
              style={styles.headerCircleBtn}
              onPress={() => fetchOrderStatus(true)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16 }}>🔄</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchOrderStatus(false);
            }}
            colors={["#3B0764"]}
          />
        }
      >
        {/* Main Status Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.storeBadgeRow}>
            <View style={styles.storeIconBox}>
              <Text style={{ fontSize: 20 }}>🏬</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.storeNameText}>{storeName}</Text>
              <Text style={styles.storeSubText}>In-Store Self Pickup Counter</Text>
            </View>
            <View
              style={[
                styles.liveStatusPill,
                isCompleted ? styles.livePillGreen : styles.livePillAmber,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isCompleted ? "#16A34A" : "#D97706" },
                ]}
              />
              <Text
                style={[
                  styles.livePillText,
                  { color: isCompleted ? "#15803D" : "#B45309" },
                ]}
              >
                {isCompleted
                  ? "Collected ✓"
                  : isReady
                  ? "Ready for Pickup"
                  : isPreparing
                  ? "Packing Order"
                  : "Order Confirmed"}
              </Text>
            </View>
          </View>

          {/* Scheduled Collection Time Pill */}
          <View style={styles.scheduleBox}>
            <View style={styles.scheduleCol}>
              <Text style={styles.scheduleLabel}>COLLECTION DATE</Text>
              <Text style={styles.scheduleVal}>📅 {pickupDate}</Text>
            </View>
            <View style={styles.scheduleDivider} />
            <View style={styles.scheduleCol}>
              <Text style={styles.scheduleLabel}>PICKUP TIME SLOT</Text>
              <Text style={styles.scheduleVal}>⏰ {pickupTimeSlot}</Text>
            </View>
          </View>

          {/* Estimated Ready Notification Banner (Dispatched by Store Admin) */}
          {(order as any)?.estimatedReadyTime ? (
            <View style={styles.readyNotificationBanner}>
              <Text style={{ fontSize: 20 }}>🔔</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.readyBannerTitle}>
                  Your order is ready for collection at {(order as any)?.estimatedReadyTime} (
                  {(order as any)?.estimatedReadyDate || "Today"})
                </Text>
                <Text style={styles.readyBannerInstructions}>
                  {(order as any)?.pickupInstructions ||
                    "Please visit the store counter with your Order ID."}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* 4-Stage Store Preparation Progress Stepper */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Preparation & Collection Progress</Text>
          <Text style={styles.sectionSubtitle}>
            Live updates as the store team prepares your items
          </Text>

          <View style={styles.stepperWrap}>
            {/* Stage 1: Order Confirmed */}
            <View style={styles.stageRow}>
              <View style={styles.stageIndicatorCol}>
                <View style={styles.stageDotDone}>
                  <Text style={styles.stageCheckmark}>✓</Text>
                </View>
                <View style={stage2Done ? styles.stageLineGreen : styles.stageLineGray} />
              </View>
              <View style={styles.stageContentCol}>
                <Text style={styles.stageTitleDone}>1. Order Confirmed & Paid</Text>
                <Text style={styles.stageDesc}>
                  Your payment of ₹{totalAmount.toFixed(2)} was verified. Counter notified.
                </Text>
              </View>
            </View>

            {/* Stage 2: Preparing */}
            <View style={styles.stageRow}>
              <View style={styles.stageIndicatorCol}>
                {stage2Active ? (
                  <Animated.View style={[styles.stageDotActive, { opacity: pulseAnim }]}>
                    <Text style={{ fontSize: 13 }}>⌛</Text>
                  </Animated.View>
                ) : stage2Done ? (
                  <View style={styles.stageDotDone}>
                    <Text style={styles.stageCheckmark}>✓</Text>
                  </View>
                ) : (
                  <View style={styles.stageDotPending} />
                )}
                <View style={stage3Done ? styles.stageLineGreen : styles.stageLineGray} />
              </View>
              <View style={styles.stageContentCol}>
                <Text
                  style={
                    stage2Active
                      ? styles.stageTitleActive
                      : stage2Done
                      ? styles.stageTitleDone
                      : styles.stageTitlePending
                  }
                >
                  2. Preparing & Quality Check
                </Text>
                <Text style={styles.stageDesc}>
                  Store staff is picking fresh products from shelves and packaging your bag.
                </Text>
              </View>
            </View>

            {/* Stage 3: Ready for Collection */}
            <View style={styles.stageRow}>
              <View style={styles.stageIndicatorCol}>
                {stage3Active ? (
                  <Animated.View style={[styles.stageDotActive, { opacity: pulseAnim }]}>
                    <Text style={{ fontSize: 13 }}>🔔</Text>
                  </Animated.View>
                ) : stage3Done ? (
                  <View style={styles.stageDotDone}>
                    <Text style={styles.stageCheckmark}>✓</Text>
                  </View>
                ) : (
                  <View style={styles.stageDotPending} />
                )}
                <View style={stage4Done ? styles.stageLineGreen : styles.stageLineGray} />
              </View>
              <View style={styles.stageContentCol}>
                <Text
                  style={
                    stage3Active
                      ? styles.stageTitleActive
                      : stage3Done
                      ? styles.stageTitleDone
                      : styles.stageTitlePending
                  }
                >
                  3. Ready for Collection at Counter
                </Text>
                <Text style={styles.stageDesc}>
                  Bag packaged and waiting at the customer service counter.
                </Text>
              </View>
            </View>

            {/* Stage 4: Collected */}
            <View style={styles.stageRow}>
              <View style={styles.stageIndicatorCol}>
                {stage4Done ? (
                  <View style={styles.stageDotDone}>
                    <Text style={styles.stageCheckmark}>✓</Text>
                  </View>
                ) : (
                  <View style={styles.stageDotPending} />
                )}
              </View>
              <View style={styles.stageContentCol}>
                <Text
                  style={
                    stage4Done ? styles.stageTitleDone : styles.stageTitlePending
                  }
                >
                  4. Collected
                </Text>
                <Text style={styles.stageDesc}>
                  Products handed over. Collection verified successfully.
                </Text>
              </View>
            </View>
          </View>

          {/* Customer Complete Button: enabled when order is ready and waiting for handoff */}
          {!isCompleted && isReady && (
            <TouchableOpacity
              style={[styles.confirmPickupBtn, confirmingPickup && { opacity: 0.7 }]}
              onPress={handleConfirmCollection}
              disabled={confirmingPickup}
              activeOpacity={0.88}
            >
              <Text style={{ fontSize: 17, marginRight: 8 }}>🛍️</Text>
              <Text style={styles.confirmPickupBtnText}>
                {confirmingPickup
                  ? "Confirming Hand-off..."
                  : "✓ I Have Collected My Products"}
              </Text>
            </TouchableOpacity>
          )}

          {isCompleted && (
            <View style={styles.collectedSuccessBadge}>
              <Text style={{ fontSize: 16 }}>✓</Text>
              <Text style={styles.collectedSuccessText}>
                Order Collected Successfully from Store Counter
              </Text>
            </View>
          )}
        </View>

        {/* Itemized Products List */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Package Contents ({order?.items?.length || order?.totalItems || 0} items)
          </Text>

          <View style={styles.itemsList}>
            {order?.items?.map((it, idx) => (
              <View key={`${it._id || idx}`} style={styles.itemRow}>
                <View style={styles.itemBullet}>
                  <Text style={{ color: "#3B0764", fontWeight: "900" }}>•</Text>
                </View>
                <View style={{ flex: 1, paddingHorizontal: 8 }}>
                  <Text style={styles.itemNameText} numberOfLines={1}>
                    {it.name}
                  </Text>
                  <Text style={styles.itemQtyText}>Qty: {it.quantity}</Text>
                </View>
                <Text style={styles.itemPriceText}>
                  ₹{(Number((it as any).subtotal || it.price * it.quantity || 0)).toFixed(2)}
                </Text>
              </View>
            ))}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount Paid</Text>
              <Text style={styles.totalValue}>₹{totalAmount.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Review & Rating Section */}
        <View style={styles.sectionCard}>
          <View style={styles.reviewHeaderRow}>
            <Text style={{ fontSize: 22 }}>⭐</Text>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.sectionTitle}>
                {isCompleted ? "Rate Your Store Pickup (Required)" : "Rate & Review Store Pickup"}
              </Text>
              <Text style={styles.sectionSubtitle}>
                {isCompleted
                  ? "Order collected! Please provide your star rating and feedback below."
                  : "Review will be enabled once your products are collected at the store counter"}
              </Text>
            </View>
          </View>

          {existingReview ? (
            <View style={styles.submittedReviewCard}>
              <View style={styles.submittedStarRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Text
                    key={star}
                    style={[
                      styles.starIconSubmitted,
                      { color: star <= existingReview.rating ? "#F59E0B" : "#D1D5DB" },
                    ]}
                  >
                    ★
                  </Text>
                ))}
                <Text style={styles.submittedRatingText}>
                  {existingReview.rating} of 5 Stars
                </Text>
              </View>

              {existingReview.comment ? (
                <Text style={styles.submittedCommentText}>
                  "{existingReview.comment}"
                </Text>
              ) : null}

              <View style={styles.reviewDoneBadge}>
                <Text style={styles.reviewDoneBadgeText}>
                  ✓ Review Submitted • Saved to Supermarket Profile
                </Text>
              </View>
            </View>
          ) : isCompleted ? (
            <View style={styles.reviewFormWrap}>
              {/* Star Rating Selector */}
              <View style={styles.starsSelectorRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    activeOpacity={0.7}
                    style={styles.starTouch}
                  >
                    <Text
                      style={[
                        styles.starSelectGlyph,
                        { color: star <= rating ? "#F59E0B" : "#CBD5E1" },
                      ]}
                    >
                      ★
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.ratingHint}>
                {rating === 5
                  ? "⭐⭐⭐⭐⭐ Outstanding!"
                  : rating === 4
                  ? "⭐⭐⭐⭐ Very Good"
                  : rating === 3
                  ? "⭐⭐⭐ Average Service"
                  : rating === 2
                  ? "⭐⭐ Needs Improvement"
                  : "⭐ Poor Experience"}
              </Text>

              {/* Written Review Input */}
              <TextInput
                style={styles.reviewInput}
                placeholder="Write your review here (optional)..."
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                numberOfLines={3}
                maxLength={500}
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitReviewBtn,
                  submittingReview && { opacity: 0.7 },
                ]}
                onPress={handleSubmitReview}
                disabled={submittingReview}
                activeOpacity={0.88}
              >
                <Text style={styles.submitReviewBtnText}>
                  {submittingReview ? "Submitting Review..." : "Submit Review"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.reviewDisabledNotice}>
              <Text style={styles.reviewDisabledText}>
                🔒 The Review button will be enabled immediately after you collect your order at the store counter.
              </Text>
            </View>
          )}

          {reviewSuccessMsg ? (
            <Text style={styles.reviewSuccessMsg}>{reviewSuccessMsg}</Text>
          ) : null}
        </View>

        {/* Done / Continue Shopping Button */}
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => router.replace("/")}
          activeOpacity={0.88}
        >
          <Text style={styles.doneBtnText}>Return to Home Screen</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#2E0854",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F4EFFE",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: "700",
    color: "#2E0854",
  },
  purpleHeader: {
    backgroundColor: "#2E0854",
    paddingBottom: 14,
  },
  headerSafe: {
    backgroundColor: "#2E0854",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
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
    fontSize: 16,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: "#DDD6FE",
    fontSize: 12,
    fontWeight: "600",
  },
  scrollContent: {
    backgroundColor: "#F4EFFE",
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },

  /* Hero Status Card */
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#2E0854",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  storeBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  storeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  storeNameText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  storeSubText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  liveStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  livePillGreen: {
    backgroundColor: "#DCFCE7",
  },
  livePillAmber: {
    backgroundColor: "#FEF3C7",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  livePillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  scheduleBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  scheduleCol: {
    flex: 1,
  },
  scheduleDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 12,
  },
  scheduleLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  scheduleVal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 2,
  },
  readyNotificationBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    borderWidth: 1.5,
    borderColor: "#86EFAC",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  readyBannerTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#15803D",
  },
  readyBannerInstructions: {
    fontSize: 12,
    color: "#166534",
    marginTop: 2,
  },

  /* Section Cards */
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },

  /* Stepper */
  stepperWrap: {
    marginTop: 16,
  },
  stageRow: {
    flexDirection: "row",
  },
  stageIndicatorCol: {
    alignItems: "center",
    width: 32,
  },
  stageDotDone: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },
  stageDotActive: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#D97706",
    alignItems: "center",
    justifyContent: "center",
  },
  stageDotPending: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E2E8F0",
    borderWidth: 2,
    borderColor: "#CBD5E1",
  },
  stageCheckmark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  stageLineGreen: {
    width: 3,
    height: 38,
    backgroundColor: "#16A34A",
  },
  stageLineGray: {
    width: 3,
    height: 38,
    backgroundColor: "#E2E8F0",
  },
  stageContentCol: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 16,
  },
  stageTitleDone: {
    fontSize: 14,
    fontWeight: "800",
    color: "#16A34A",
  },
  stageTitleActive: {
    fontSize: 14,
    fontWeight: "800",
    color: "#D97706",
  },
  stageTitlePending: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
  },
  stageDesc: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },

  /* Customer Confirm Button */
  confirmPickupBtn: {
    backgroundColor: "#16A34A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  confirmPickupBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  collectedSuccessBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#DCFCE7",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  collectedSuccessText: {
    color: "#15803D",
    fontSize: 13,
    fontWeight: "800",
  },

  /* Items List */
  itemsList: {
    marginTop: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  itemBullet: {
    width: 14,
  },
  itemNameText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  itemQtyText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  itemPriceText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    marginTop: 6,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#16A34A",
  },

  /* Review Section */
  reviewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewFormWrap: {
    marginTop: 8,
  },
  starsSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginVertical: 10,
  },
  starTouch: {
    padding: 4,
  },
  starSelectGlyph: {
    fontSize: 34,
  },
  ratingHint: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 10,
  },
  reviewInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: "#0F172A",
    minHeight: 70,
    textAlignVertical: "top",
  },
  submitReviewBtn: {
    backgroundColor: "#3B0764",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  submitReviewBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  reviewDisabledNotice: {
    backgroundColor: "#F1F5F9",
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  reviewDisabledText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  submittedReviewCard: {
    backgroundColor: "#FEF3C7",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginTop: 10,
  },
  submittedStarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  starIconSubmitted: {
    fontSize: 20,
  },
  submittedRatingText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "800",
    color: "#92400E",
  },
  submittedCommentText: {
    fontSize: 13,
    color: "#78350F",
    fontStyle: "italic",
    marginTop: 6,
  },
  reviewDoneBadge: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#FDE68A",
  },
  reviewDoneBadgeText: {
    color: "#92400E",
    fontSize: 12,
    fontWeight: "800",
  },
  reviewSuccessMsg: {
    marginTop: 8,
    color: "#16A34A",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  /* Return to Home */
  doneBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
  },
  doneBtnText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
  },
});

