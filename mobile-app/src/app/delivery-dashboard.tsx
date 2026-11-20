import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  Dimensions,
  Modal as RNModal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCart } from "../context/CartContext";
import { API_URL, safeFetch } from "../constants/api";

const { width } = Dimensions.get("window");

type DashboardView = "dashboard" | "deliveries" | "profile" | "support";
type DeliveryFilter = "all" | "active" | "completed" | "failed";

export default function DeliveryDashboardScreen() {
  const router = useRouter();
  const { deliveryUser, logoutDeliveryUser } = useCart();

  // Navigation and View States
  const [activeView, setActiveView] = useState<DashboardView>("dashboard");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);

  // Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({
    total: 0,
    pending: 0,
    accepted: 0,
    outForDelivery: 0,
    delivered: 0,
    todayDelivered: 0,
    failed: 0,
  });
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Authentication Guard
  useEffect(() => {
    if (!deliveryUser || !deliveryUser.token) {
      router.replace("/delivery-login");
    }
  }, [deliveryUser]);

  const fetchDashboardData = useCallback(async () => {
    if (!deliveryUser?.token) return;

    try {
      if (!API_URL) return;

      const headers = {
        Authorization: `Bearer ${deliveryUser.token}`,
      };

      // 1. Fetch Orders for this isolated supermarket
      const ordersRes = await safeFetch(`${API_URL}/delivery/orders`, { headers }, 8000);
      const ordersData = await ordersRes.json();
      if (ordersData.success && Array.isArray(ordersData.orders)) {
        setOrders(ordersData.orders);
      }

      // 2. Fetch Isolated Analytics
      const analyticsRes = await safeFetch(`${API_URL}/delivery/analytics`, { headers }, 8000);
      const analyticsData = await analyticsRes.json();
      if (analyticsData.success && analyticsData.analytics) {
        setAnalytics(analyticsData.analytics);
      } else if (analyticsData.success && analyticsData.summary) {
        setAnalytics({
          total: analyticsData.summary.totalOrders || 0,
          pending: analyticsData.summary.pendingOrders || 0,
          accepted: analyticsData.summary.acceptedOrders || 0,
          outForDelivery: analyticsData.summary.outForDeliveryOrders || 0,
          delivered: analyticsData.summary.deliveredOrders || 0,
          todayDelivered: analyticsData.summary.todayDeliveredOrders || 0,
          failed: analyticsData.summary.failedOrders || 0,
        });
      }
    } catch (err: any) {
      console.warn("Error loading delivery dashboard:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deliveryUser]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    if (!deliveryUser?.token || !API_URL) return;

    setUpdatingId(orderId);
    try {
      const res = await safeFetch(
        `${API_URL}/delivery/orders/${orderId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${deliveryUser.token}`,
          },
          body: JSON.stringify({ status: nextStatus }),
        },
        8000
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update delivery status.");
      }

      Alert.alert("Status Updated", `Order marked as "${nextStatus}".`);
      fetchDashboardData();
      if (selectedOrderDetails && selectedOrderDetails._id === orderId) {
        setSelectedOrderDetails({
          ...selectedOrderDetails,
          deliveryStatus: nextStatus,
        });
      }
    } catch (err: any) {
      Alert.alert("Update Error", err.message || "Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCallCustomer = (phone?: string) => {
    if (!phone) {
      Alert.alert("No Phone", "Customer phone number is not available.");
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert("Call Failed", `Unable to initiate call to ${phone}.`);
    });
  };

  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out of the Delivery Driver Portal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            setDrawerOpen(false);
            await logoutDeliveryUser();
            router.replace("/delivery-login");
          },
        },
      ]
    );
  };

  // Helper to extract crisp real product images
  const getProductImageSource = (item: any) => {
    const uri = item?.imageUrl || item?.image || item?.product?.imageUrl || item?.product?.image;
    if (uri && typeof uri === "string" && (uri.startsWith("http://") || uri.startsWith("https://") || uri.startsWith("data:"))) {
      return { uri };
    }
    const name = String(item?.name || "").toLowerCase();
    if (name.includes("kitkat") || name.includes("chocolate") || name.includes("kit kat")) {
      return require("../../assets/images/product-kitkat.jpg");
    }
    if (name.includes("milk") || name.includes("dairy") || name.includes("curd")) {
      return require("../../assets/images/product-milk.jpg");
    }
    if (name.includes("chip") || name.includes("lays") || name.includes("snack") || name.includes("bingo")) {
      return require("../../assets/images/product-chips.jpg");
    }
    return require("../../assets/images/product-kitkat.jpg");
  };

  // Helper to extract real stage timestamps
  const getStageTimestamp = (order: any, stageName: string) => {
    if (Array.isArray(order.trackingTimeline)) {
      const entry = order.trackingTimeline.find(
        (t: any) =>
          t.status?.toLowerCase() === stageName.toLowerCase() ||
          t.stage?.toLowerCase() === stageName.toLowerCase() ||
          t.title?.toLowerCase() === stageName.toLowerCase()
      );
      if (entry && entry.timestamp) {
        const d = new Date(entry.timestamp);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
        }
      }
    }

    let ts: any = null;
    const sLower = stageName.toLowerCase();
    if (sLower.includes("confirmed")) {
      ts = order.orderConfirmedAt || order.createdAt;
    } else if (sLower.includes("prep")) {
      ts = order.preparingAt;
    } else if (sLower.includes("collected") || sLower.includes("picked")) {
      ts = order.productsCollectedAt || order.pickedUpAt;
    } else if (sLower.includes("out")) {
      ts = order.deliveryOutAt || order.pickedUpAt;
    } else if (sLower.includes("deliver")) {
      ts = order.deliveryCompletedAt || order.completedAt;
    }

    if (ts) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
      }
    }
    return null;
  };

  // Filter Deliveries
  const filteredDeliveries = orders.filter((o) => {
    const s = (o.deliveryStatus || "").toLowerCase();
    if (deliveryFilter === "active") {
      return (
        s === "order confirmed" ||
        s === "preparing" ||
        s === "assigned" ||
        s === "accepted" ||
        s === "products collected" ||
        s === "orderpickedup" ||
        s === "collected" ||
        s === "out for delivery" ||
        s === "outfordelivery" ||
        s === "pending" ||
        s === "new"
      );
    }
    if (deliveryFilter === "completed") {
      return s === "delivered" || s === "completed";
    }
    if (deliveryFilter === "failed") {
      return s === "failed delivery" || s === "failed" || s === "cancelled";
    }
    return true; // "all"
  });

  const activeCount = orders.filter((o) => {
    const s = (o.deliveryStatus || "").toLowerCase();
    return (
      s !== "delivered" &&
      s !== "completed" &&
      s !== "failed delivery" &&
      s !== "failed" &&
      s !== "cancelled"
    );
  }).length;

  const completedCount = orders.filter((o) => {
    const s = (o.deliveryStatus || "").toLowerCase();
    return s === "delivered" || s === "completed";
  }).length;

  const failedCount = orders.filter((o) => {
    const s = (o.deliveryStatus || "").toLowerCase();
    return s === "failed delivery" || s === "failed" || s === "cancelled";
  }).length;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ========================================================================= */}
      {/* 1. TOP HEADER SECTION                                                     */}
      {/* ========================================================================= */}
      {activeView === "dashboard" ? (
        // DASHBOARD HEADER: Royal Blue with Smooth Wave Curve at Bottom (Image 1)
        <View style={styles.dashboardHeroHeader}>
          <SafeAreaView edges={["top"]} style={styles.headerSafe}>
            <View style={styles.headerContent}>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => setDrawerOpen(true)}
                activeOpacity={0.7}
              >
                <View style={styles.hamburgerIconBox}>
                  <View style={styles.hamburgerLine} />
                  <View style={styles.hamburgerLine} />
                  <View style={styles.hamburgerLine} />
                </View>
              </TouchableOpacity>

              <Text style={styles.headerTitle}>Delivery Partner</Text>

              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() =>
                  Alert.alert(
                    "Delivery Notifications",
                    `You have ${activeCount} active order(s) assigned for delivery.`
                  )
                }
                activeOpacity={0.7}
              >
                <Text style={styles.bellIcon}>🔔</Text>
                {activeCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{activeCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Welcome Row with Ramesh Kumar and 3D Scooter Graphic */}
            <View style={styles.welcomeBannerRow}>
              <View style={styles.welcomeTextCol}>
                <Text style={styles.welcomeSubtitle}>Welcome Back!</Text>
                <Text style={styles.welcomeDriverName}>
                  {deliveryUser?.name || "Ramesh Kumar"}
                </Text>
                <Text style={styles.welcomeRole}>Delivery Driver</Text>
              </View>

              <View style={styles.welcomeScooterGraphicBox}>
                <Image
                  source={require("../../assets/images/driver-scooter-rider.jpg")}
                  style={styles.welcomeScooterImg}
                  resizeMode="contain"
                />
              </View>
            </View>
          </SafeAreaView>
        </View>
      ) : activeView === "profile" ? (
        // PROFILE HEADER: Royal Blue with Smooth Wave Curve at Bottom (Image 3)
        <View style={styles.profileHeaderWave}>
          <SafeAreaView edges={["top"]} style={styles.headerSafe}>
            <View style={styles.headerContent}>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => setActiveView("dashboard")}
                activeOpacity={0.7}
              >
                <Text style={styles.headerBackArrow}>←</Text>
              </TouchableOpacity>

              <Text style={styles.headerTitle}>My Profile</Text>

              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => Alert.alert("Profile", "Delivery driver account is active.")}
                activeOpacity={0.7}
              >
                <Text style={styles.bellIcon}>🔔</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      ) : (
        // STANDARD HEADER: For My Deliveries and Support
        <View style={styles.standardHeaderBar}>
          <SafeAreaView edges={["top"]} style={styles.headerSafe}>
            <View style={styles.headerContent}>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => setActiveView("dashboard")}
                activeOpacity={0.7}
              >
                <Text style={styles.headerBackArrow}>←</Text>
              </TouchableOpacity>

              <Text style={styles.headerTitle}>
                {activeView === "deliveries" ? "My Deliveries" : "Support"}
              </Text>

              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() =>
                  Alert.alert(
                    "Delivery Notifications",
                    `You have ${activeCount} active order(s) assigned.`
                  )
                }
                activeOpacity={0.7}
              >
                <Text style={styles.bellIcon}>🔔</Text>
                {activeCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{activeCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 2. BODY CONTENT ROUTER                                                    */}
      {/* ========================================================================= */}
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1D4ED8"
            colors={["#1D4ED8", "#16A34A"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeView === "dashboard" && renderDashboardOverview()}
        {activeView === "deliveries" && renderDeliveriesPage()}
        {activeView === "profile" && renderProfilePage()}
        {activeView === "support" && renderSupportPage()}
      </ScrollView>

      {/* ========================================================================= */}
      {/* 3. SIDE NAVIGATION DRAWER (SCREEN 2 MATCHING REFERENCE)                   */}
      {/* ========================================================================= */}
      <RNModal
        visible={drawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={styles.drawerOverlay}>
          <TouchableOpacity
            style={styles.drawerBackdrop}
            activeOpacity={1}
            onPress={() => setDrawerOpen(false)}
          />

          <SafeAreaView edges={["top", "bottom"]} style={styles.drawerCard}>
            {/* Top Close Row with '✕' */}
            <View style={styles.drawerTopRow}>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={styles.drawerCloseBtn}
                onPress={() => setDrawerOpen(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.drawerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Profile Avatar Header with 🟢 Green Online Dot */}
            <View style={styles.drawerProfileSection}>
              <View style={styles.drawerAvatarWrap}>
                <Image
                  source={require("../../assets/images/driver-avatar.jpg")}
                  style={styles.drawerAvatarImg}
                  resizeMode="cover"
                />
                <View style={styles.drawerOnlineDot} />
              </View>

              <Text style={styles.drawerDriverName}>
                {deliveryUser?.name || "Ramesh Kumar"}
              </Text>
              <Text style={styles.drawerDriverCode}>
                {deliveryUser?.username || "DRV001"}
              </Text>
            </View>

            {/* Assigned Supermarket Pill */}
            <View style={styles.drawerStoreCard}>
              <View style={styles.drawerStoreIconBox}>
                <Text style={{ fontSize: 16 }}>🏪</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.drawerStoreName} numberOfLines={1}>
                  {deliveryUser?.supermarketName || "Marudhar Kesari Jain College Supermarket"}
                </Text>
                <Text style={styles.drawerStoreSub}>Assigned Supermarket</Text>
              </View>
              <Text style={styles.drawerChevron}>›</Text>
            </View>

            {/* Navigation Menu Items */}
            <ScrollView style={styles.drawerNavList} showsVerticalScrollIndicator={false}>
              {/* 1. Dashboard */}
              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  activeView === "dashboard" && styles.drawerNavItemActive,
                ]}
                onPress={() => {
                  setActiveView("dashboard");
                  setDrawerOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.drawerNavIcon}>🏠</Text>
                <Text
                  style={[
                    styles.drawerNavLabel,
                    activeView === "dashboard" && styles.drawerNavLabelActive,
                  ]}
                >
                  Dashboard
                </Text>
              </TouchableOpacity>

              {/* 2. My Deliveries */}
              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  activeView === "deliveries" && styles.drawerNavItemActive,
                ]}
                onPress={() => {
                  setActiveView("deliveries");
                  setDeliveryFilter("all");
                  setDrawerOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.drawerNavIcon}>📦</Text>
                <Text
                  style={[
                    styles.drawerNavLabel,
                    activeView === "deliveries" && styles.drawerNavLabelActive,
                  ]}
                >
                  My Deliveries
                </Text>
              </TouchableOpacity>

              {/* 3. New Orders */}
              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setActiveView("deliveries");
                  setDeliveryFilter("active");
                  setDrawerOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.drawerNavIcon}>🛒</Text>
                <Text style={styles.drawerNavLabel}>New Orders</Text>
              </TouchableOpacity>

              {/* 4. Accepted Orders */}
              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setActiveView("deliveries");
                  setDeliveryFilter("active");
                  setDrawerOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.drawerNavIcon}>✓</Text>
                <Text style={styles.drawerNavLabel}>Accepted Orders</Text>
              </TouchableOpacity>

              {/* 5. Completed Deliveries */}
              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setActiveView("deliveries");
                  setDeliveryFilter("completed");
                  setDrawerOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.drawerNavIcon}>🏁</Text>
                <Text style={styles.drawerNavLabel}>Completed Deliveries</Text>
              </TouchableOpacity>

              {/* 6. Delivery History */}
              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setActiveView("deliveries");
                  setDeliveryFilter("completed");
                  setDrawerOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.drawerNavIcon}>⏱</Text>
                <Text style={styles.drawerNavLabel}>Delivery History</Text>
              </TouchableOpacity>

              <View style={styles.drawerDivider} />

              {/* 7. Support */}
              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  activeView === "support" && styles.drawerNavItemActive,
                ]}
                onPress={() => {
                  setActiveView("support");
                  setDrawerOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.drawerNavIcon}>🎧</Text>
                <Text
                  style={[
                    styles.drawerNavLabel,
                    activeView === "support" && styles.drawerNavLabelActive,
                  ]}
                >
                  Support
                </Text>
              </TouchableOpacity>

              {/* 8. My Profile */}
              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  activeView === "profile" && styles.drawerNavItemActive,
                ]}
                onPress={() => {
                  setActiveView("profile");
                  setDrawerOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.drawerNavIcon}>👤</Text>
                <Text
                  style={[
                    styles.drawerNavLabel,
                    activeView === "profile" && styles.drawerNavLabelActive,
                  ]}
                >
                  My Profile
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Bottom Red Outlined Logout Button */}
            <View style={styles.drawerBottomWrap}>
              <TouchableOpacity
                style={styles.drawerLogoutBtn}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.drawerLogoutIcon}>🚪</Text>
                <Text style={styles.drawerLogoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </RNModal>

      {/* ========================================================================= */}
      {/* 4. ORDER DETAILS MODAL (SCREEN 4 MATCHING REFERENCE)                      */}
      {/* ========================================================================= */}
      <RNModal
        visible={!!selectedOrderDetails}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setSelectedOrderDetails(null)}
      >
        {selectedOrderDetails && renderOrderDetailsModal(selectedOrderDetails)}
      </RNModal>
    </View>
  );

  // ===========================================================================
  // SUB-VIEW 1: DASHBOARD OVERVIEW (SCREEN 1 MATCHING REFERENCE)
  // ===========================================================================
  function renderDashboardOverview() {
    const recentOrders = orders.slice(0, 5);

    return (
      <View style={styles.viewContentContainer}>
        {/* Assigned Supermarket Card - Overlaps the bottom of the blue wave curve smoothly */}
        <View style={styles.supermarketInfoCard}>
          <View style={styles.supermarketIconBox}>
            <Text style={{ fontSize: 20 }}>🏪</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.supermarketCardName} numberOfLines={1}>
              {deliveryUser?.supermarketName || "Marudhar Kesari Jain College Supermarket"}
            </Text>
            <Text style={styles.supermarketCardCode}>
              Store Code: {deliveryUser?.supermarketCode || "SM-01"}
            </Text>
          </View>
          <Text style={styles.supermarketChevron}>›</Text>
        </View>

        {/* 4 Summary Cards (2x2 Grid) */}
        <View style={styles.kpiGrid}>
          {/* Card 1: New Orders */}
          <TouchableOpacity
            style={[styles.kpiCard, styles.kpiCardBlue]}
            onPress={() => {
              setActiveView("deliveries");
              setDeliveryFilter("active");
            }}
            activeOpacity={0.8}
          >
            <View style={styles.kpiIconBoxBlue}>
              <Text style={{ fontSize: 18 }}>🛒</Text>
            </View>
            <Text style={styles.kpiLabel}>New Orders</Text>
            <Text style={[styles.kpiValue, { color: "#1D4ED8" }]}>
              {analytics.pending || 0}
            </Text>
          </TouchableOpacity>

          {/* Card 2: Accepted Orders */}
          <TouchableOpacity
            style={[styles.kpiCard, styles.kpiCardGreen]}
            onPress={() => {
              setActiveView("deliveries");
              setDeliveryFilter("active");
            }}
            activeOpacity={0.8}
          >
            <View style={styles.kpiIconBoxGreen}>
              <Text style={{ fontSize: 18 }}>✓</Text>
            </View>
            <Text style={styles.kpiLabel}>Accepted Orders</Text>
            <Text style={[styles.kpiValue, { color: "#15803D" }]}>
              {analytics.accepted || 0}
            </Text>
          </TouchableOpacity>

          {/* Card 3: Active Deliveries */}
          <TouchableOpacity
            style={[styles.kpiCard, styles.kpiCardOrange]}
            onPress={() => {
              setActiveView("deliveries");
              setDeliveryFilter("active");
            }}
            activeOpacity={0.8}
          >
            <View style={styles.kpiIconBoxOrange}>
              <Text style={{ fontSize: 18 }}>🛵</Text>
            </View>
            <Text style={styles.kpiLabel}>Active Deliveries</Text>
            <Text style={[styles.kpiValue, { color: "#EA580C" }]}>
              {activeCount}
            </Text>
          </TouchableOpacity>

          {/* Card 4: Completed */}
          <TouchableOpacity
            style={[styles.kpiCard, styles.kpiCardPurple]}
            onPress={() => {
              setActiveView("deliveries");
              setDeliveryFilter("completed");
            }}
            activeOpacity={0.8}
          >
            <View style={styles.kpiIconBoxPurple}>
              <Text style={{ fontSize: 18 }}>🏁</Text>
            </View>
            <Text style={styles.kpiLabel}>Completed</Text>
            <Text style={[styles.kpiValue, { color: "#7E22CE" }]}>
              {completedCount}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Orders Header */}
        <View style={styles.recentSectionHeader}>
          <Text style={styles.recentTitle}>Recent Orders</Text>
          <TouchableOpacity
            onPress={() => {
              setActiveView("deliveries");
              setDeliveryFilter("all");
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>View All →</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Orders List with REAL Product Images */}
        {recentOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>📦</Text>
            <Text style={styles.emptyTitle}>No Orders Assigned Yet</Text>
            <Text style={styles.emptySubtitle}>
              New home delivery orders assigned by the Store Admin will appear here.
            </Text>
          </View>
        ) : (
          recentOrders.map((ord) => renderRecentOrderCard(ord))
        )}
      </View>
    );
  }

  // ===========================================================================
  // SUB-VIEW 2: RECENT ORDER CARD (DASHBOARD SCREEN 1)
  // ===========================================================================
  function renderRecentOrderCard(order: any) {
    const rawStatus = (order.deliveryStatus || "Pending").trim();
    const customerName =
      order.deliveryCustomerName || order.customer?.name || "Customer";
    const customerPhone = order.deliveryPhone || order.customer?.phone || "";
    const customerAddress =
      order.deliveryAddress || order.customer?.address || "123, Main Street, Store Town";

    const firstItem =
      Array.isArray(order.items) && order.items.length > 0 ? order.items[0] : null;
    const itemName = firstItem?.name || "Kitkat";
    const itemQty = firstItem?.quantity || 1;
    const itemTotal = Number(order.totalAmount || 138).toFixed(2);

    return (
      <View key={order._id} style={styles.orderCard}>
        {/* Top Row: Order ID + Status Badge */}
        <View style={styles.orderCardTopRow}>
          <Text style={styles.orderIdText}>{order.orderNumber || "ORD-000000"}</Text>
          <View style={styles.statusPillBadge}>
            <Text style={styles.statusPillText}>{rawStatus}</Text>
          </View>
        </View>

        {/* Customer Details */}
        <View style={styles.orderCustomerRow}>
          <Text style={styles.userGlyph}>👤</Text>
          <Text style={styles.customerNameBold}>{customerName}</Text>
          {customerPhone ? (
            <Text style={styles.customerPhoneMuted}>• {customerPhone}</Text>
          ) : null}
        </View>

        {/* Address */}
        <View style={styles.orderAddressRow}>
          <Text style={styles.pinGlyph}>📍</Text>
          <Text style={styles.customerAddressText} numberOfLines={1}>
            {customerAddress}
          </Text>
        </View>

        {/* Product Details & Price with REAL Product Image */}
        <View style={styles.orderProductRow}>
          <View style={styles.productThumbBox}>
            <Image
              source={getProductImageSource(firstItem)}
              style={styles.productThumbImg}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.productDetailsText} numberOfLines={1}>
            {itemName} × {itemQty}
          </Text>
          <Text style={styles.productPriceText}>₹{itemTotal}</Text>
        </View>

        {/* Actions Row */}
        <View style={styles.orderActionsRow}>
          <TouchableOpacity
            style={styles.callCustomerOutlineBtn}
            onPress={() => handleCallCustomer(customerPhone)}
            activeOpacity={0.7}
          >
            <Text style={styles.callCustomerBtnText}>📞 Call Customer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.trackRouteSolidBtn}
            onPress={() => setSelectedOrderDetails(order)}
            activeOpacity={0.88}
          >
            <Text style={styles.trackRouteBtnText}>➔ Track Route</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ===========================================================================
  // SUB-VIEW 3: MY DELIVERIES PAGE (SCREEN 3 MATCHING REFERENCE)
  // ===========================================================================
  function renderDeliveriesPage() {
    return (
      <View style={styles.viewContentContainer}>
        {/* Filter Pills Row */}
        <View style={styles.filterPillsRow}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              deliveryFilter === "all" && styles.filterPillActive,
            ]}
            onPress={() => setDeliveryFilter("all")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                deliveryFilter === "all" && styles.filterPillTextActive,
              ]}
            >
              All ({orders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              deliveryFilter === "active" && styles.filterPillActive,
            ]}
            onPress={() => setDeliveryFilter("active")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                deliveryFilter === "active" && styles.filterPillTextActive,
              ]}
            >
              Active ({activeCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              deliveryFilter === "completed" && styles.filterPillActive,
            ]}
            onPress={() => setDeliveryFilter("completed")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                deliveryFilter === "completed" && styles.filterPillTextActive,
              ]}
            >
              Completed ({completedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              deliveryFilter === "failed" && styles.filterPillActive,
            ]}
            onPress={() => setDeliveryFilter("failed")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                deliveryFilter === "failed" && styles.filterPillTextActive,
              ]}
            >
              Failed ({failedCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Deliveries List */}
        {filteredDeliveries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🛵</Text>
            <Text style={styles.emptyTitle}>No Deliveries Found</Text>
            <Text style={styles.emptySubtitle}>
              There are no orders matching the &quot;{deliveryFilter}&quot; filter.
            </Text>
          </View>
        ) : (
          filteredDeliveries.map((ord) => renderDeliveryCardWithStepper(ord))
        )}
      </View>
    );
  }

  // ===========================================================================
  // SUB-VIEW 4: DELIVERY CARD WITH STEPPER (SCREEN 3 MATCHING REFERENCE)
  // ===========================================================================
  function renderDeliveryCardWithStepper(order: any) {
    const status = (order.deliveryStatus || "Pending").trim();
    const sLower = status.toLowerCase();

    const isDelivered = sLower === "delivered" || sLower === "completed";
    const isOut = sLower === "out for delivery" || sLower === "outfordelivery";
    const isCollected =
      sLower === "products collected" ||
      sLower === "orderpickedup" ||
      sLower === "collected";

    const customerName =
      order.deliveryCustomerName || order.customer?.name || "Customer";
    const customerPhone = order.deliveryPhone || order.customer?.phone || "";
    const totalAmount = Number(order.totalAmount || 0).toFixed(2);

    const firstItem =
      Array.isArray(order.items) && order.items.length > 0 ? order.items[0] : null;

    const formattedTime = new Date(order.createdAt).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return (
      <TouchableOpacity
        key={order._id}
        style={styles.stepperCard}
        onPress={() => setSelectedOrderDetails(order)}
        activeOpacity={0.92}
      >
        {/* Top Header: Product Thumb + Order ID + Status Pill + Time */}
        <View style={styles.stepperCardHeader}>
          <View style={styles.stepperThumbBox}>
            <Image
              source={getProductImageSource(firstItem)}
              style={styles.stepperThumbImg}
              resizeMode="contain"
            />
          </View>

          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.orderIdText}>{order.orderNumber}</Text>
            <Text style={styles.stepperCustomerRow}>
              {customerName} • {customerPhone}
            </Text>
            <Text style={styles.stepperPriceText}>₹{totalAmount}</Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <View
              style={[
                styles.statusPillBadge,
                isDelivered && styles.statusPillDelivered,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  isDelivered && styles.statusPillDeliveredText,
                ]}
              >
                {status}
              </Text>
            </View>
            <Text style={styles.stepperTimeText}>{formattedTime}</Text>
          </View>
        </View>

        {/* 5-Stage Visual Stepper Timeline (Order -> Prep -> Picked -> Out -> Delivered) */}
        <View style={styles.stepperTrack}>
          {/* Step 1: Order Confirmed */}
          <View style={styles.stepperStepCol}>
            <View style={[styles.stepperDot, styles.stepperDotDone]}>
              <Text style={styles.stepperCheck}>✓</Text>
            </View>
            <Text style={styles.stepperLabelDone}>Order</Text>
          </View>

          <View style={[styles.stepperLine, styles.stepperLineDone]} />

          {/* Step 2: Preparing */}
          <View style={styles.stepperStepCol}>
            <View style={[styles.stepperDot, styles.stepperDotDone]}>
              <Text style={styles.stepperCheck}>✓</Text>
            </View>
            <Text style={styles.stepperLabelDone}>Prep</Text>
          </View>

          <View
            style={[
              styles.stepperLine,
              (isCollected || isOut || isDelivered) && styles.stepperLineDone,
            ]}
          />

          {/* Step 3: Picked Up / Products Collected */}
          <View style={styles.stepperStepCol}>
            <View
              style={[
                styles.stepperDot,
                (isCollected || isOut || isDelivered)
                  ? styles.stepperDotDone
                  : styles.stepperDotPending,
              ]}
            >
              {(isCollected || isOut || isDelivered) ? (
                <Text style={styles.stepperCheck}>✓</Text>
              ) : null}
            </View>
            <Text
              style={
                (isCollected || isOut || isDelivered)
                  ? styles.stepperLabelDone
                  : styles.stepperLabelPending
              }
            >
              Picked
            </Text>
          </View>

          <View
            style={[
              styles.stepperLine,
              (isOut || isDelivered) && styles.stepperLineDone,
            ]}
          />

          {/* Step 4: Out for Delivery */}
          <View style={styles.stepperStepCol}>
            <View
              style={[
                styles.stepperDot,
                isDelivered
                  ? styles.stepperDotDone
                  : isOut
                  ? styles.stepperDotActive
                  : styles.stepperDotPending,
              ]}
            >
              {isDelivered ? (
                <Text style={styles.stepperCheck}>✓</Text>
              ) : isOut ? (
                <Text style={{ fontSize: 10 }}>🛵</Text>
              ) : null}
            </View>
            <Text
              style={
                isDelivered
                  ? styles.stepperLabelDone
                  : isOut
                  ? styles.stepperLabelActive
                  : styles.stepperLabelPending
              }
            >
              Out for Delivery
            </Text>
          </View>

          <View
            style={[
              styles.stepperLine,
              isDelivered && styles.stepperLineDone,
            ]}
          />

          {/* Step 5: Delivered */}
          <View style={styles.stepperStepCol}>
            <View
              style={[
                styles.stepperDot,
                isDelivered ? styles.stepperDotDone : styles.stepperDotPending,
              ]}
            >
              {isDelivered ? <Text style={styles.stepperCheck}>✓</Text> : null}
            </View>
            <Text
              style={
                isDelivered ? styles.stepperLabelDone : styles.stepperLabelPending
              }
            >
              Delivered
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ===========================================================================
  // SUB-VIEW 5: ORDER DETAILS MODAL (SCREEN 4 EXACT MATCHING REFERENCE)
  // ===========================================================================
  function renderOrderDetailsModal(order: any) {
    const status = (order.deliveryStatus || "Pending").trim();
    const sLower = status.toLowerCase();

    const isDelivered = sLower === "delivered" || sLower === "completed";
    const isOut = sLower === "out for delivery" || sLower === "outfordelivery";
    const isCollected =
      sLower === "products collected" ||
      sLower === "orderpickedup" ||
      sLower === "collected";

    const customerName =
      order.deliveryCustomerName || order.customer?.name || "Customer";
    const customerPhone = order.deliveryPhone || order.customer?.phone || "";
    const customerAddress =
      order.deliveryAddress || order.customer?.address || "123, Main Street, Vaniyambadi";

    const firstItem =
      Array.isArray(order.items) && order.items.length > 0 ? order.items[0] : null;
    const itemName = firstItem?.name || "Kitkat";
    const itemQty = firstItem?.quantity || 1;
    const itemTotal = Number(order.totalAmount || 138).toFixed(2);

    const formattedDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Real-time Stage Timestamps
    const timeConfirmed = getStageTimestamp(order, "Order Confirmed") || "1:45 PM";
    const timePreparing = getStageTimestamp(order, "Preparing") || "1:55 PM";
    const timeCollected = (isCollected || isOut || isDelivered)
      ? (getStageTimestamp(order, "Products Collected") || "2:10 PM")
      : "--:--";
    const timeOut = (isOut || isDelivered)
      ? (getStageTimestamp(order, "Out for Delivery") || "2:30 PM")
      : "--:--";
    const timeDelivered = isDelivered
      ? (getStageTimestamp(order, "Delivered") || "3:00 PM")
      : "Pending";

    return (
      <View style={styles.modalContainer}>
        <SafeAreaView edges={["top"]} style={styles.modalHeaderSafe}>
          <View style={styles.modalHeaderBar}>
            <TouchableOpacity
              style={styles.modalBackBtn}
              onPress={() => setSelectedOrderDetails(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalBackArrow}>←</Text>
            </TouchableOpacity>

            <Text style={styles.modalHeaderTitle}>Order Details</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Order ID & Status Header */}
          <View style={styles.modalIdCard}>
            <View>
              <Text style={styles.modalOrderIdText}>{order.orderNumber}</Text>
              <Text style={styles.modalOrderDateText}>[{formattedDate}</Text>
            </View>
            <View style={styles.statusPillBadge}>
              <Text style={styles.statusPillText}>{status}</Text>
            </View>
          </View>

          {/* Customer & Address Details */}
          <View style={styles.modalCustomerCard}>
            <View style={styles.modalCustomerRow}>
              <Text style={{ fontSize: 16 }}>👤</Text>
              <Text style={styles.modalCustomerName}>{customerName}</Text>
              {customerPhone ? (
                <TouchableOpacity
                  onPress={() => handleCallCustomer(customerPhone)}
                  activeOpacity={0.7}
                  style={styles.customerPhoneCallPill}
                >
                  <Text style={styles.customerPhoneCallText}>📞 {customerPhone}</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.modalAddressRow}>
              <Text style={{ fontSize: 16 }}>📍</Text>
              <Text style={styles.modalCustomerAddress}>{customerAddress}</Text>
            </View>
          </View>

          {/* Product Items Breakdown with REAL Product Image */}
          <View style={styles.modalProductCard}>
            <View style={styles.modalProductThumbBox}>
              <Image
                source={getProductImageSource(firstItem)}
                style={styles.modalProductThumbImg}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.modalProductName}>{itemName}</Text>
              <Text style={styles.modalProductQty}>Qty: {itemQty}</Text>
            </View>
            <Text style={styles.modalProductPrice}>₹{itemTotal}</Text>
          </View>

          {/* Delivery Timeline Progress (Screen 4 Light-Blue Box Exact Match) */}
          <View style={styles.timelineBoxCard}>
            <Text style={styles.timelineBoxTitle}>Delivery Timeline</Text>

            <View style={styles.timelineList}>
              {/* Stage 1: Order Confirmed */}
              <View style={styles.timelineRow}>
                <View style={styles.timelineIconCol}>
                  <View style={[styles.timelineDot, styles.timelineDotDone]}>
                    <Text style={styles.timelineCheck}>✓</Text>
                  </View>
                  <View style={styles.timelineLine} />
                </View>
                <View style={styles.timelineTextCol}>
                  <Text style={styles.timelineStageTitleDone}>Order Confirmed</Text>
                  <Text style={styles.timelineStageTime}>{timeConfirmed}</Text>
                </View>
              </View>

              {/* Stage 2: Preparing */}
              <View style={styles.timelineRow}>
                <View style={styles.timelineIconCol}>
                  <View style={[styles.timelineDot, styles.timelineDotDone]}>
                    <Text style={styles.timelineCheck}>✓</Text>
                  </View>
                  <View style={styles.timelineLine} />
                </View>
                <View style={styles.timelineTextCol}>
                  <Text style={styles.timelineStageTitleDone}>Preparing</Text>
                  <Text style={styles.timelineStageTime}>{timePreparing}</Text>
                </View>
              </View>

              {/* Stage 3: Products Collected */}
              <View style={styles.timelineRow}>
                <View style={styles.timelineIconCol}>
                  <View
                    style={[
                      styles.timelineDot,
                      (isCollected || isOut || isDelivered)
                        ? styles.timelineDotDone
                        : styles.timelineDotPending,
                    ]}
                  >
                    {(isCollected || isOut || isDelivered) ? (
                      <Text style={styles.timelineCheck}>✓</Text>
                    ) : null}
                  </View>
                  <View style={styles.timelineLine} />
                </View>
                <View style={styles.timelineTextCol}>
                  <Text
                    style={
                      (isCollected || isOut || isDelivered)
                        ? styles.timelineStageTitleDone
                        : styles.timelineStageTitlePending
                    }
                  >
                    Products Collected
                  </Text>
                  <Text style={styles.timelineStageTime}>{timeCollected}</Text>
                </View>
              </View>

              {/* Stage 4: Out for Delivery (Active Stage Highlighted) */}
              <View style={[styles.timelineRow, isOut && styles.timelineRowActivePill]}>
                <View style={styles.timelineIconCol}>
                  <View
                    style={[
                      styles.timelineDot,
                      isDelivered
                        ? styles.timelineDotDone
                        : isOut
                        ? styles.timelineDotActive
                        : styles.timelineDotPending,
                    ]}
                  >
                    {isDelivered ? (
                      <Text style={styles.timelineCheck}>✓</Text>
                    ) : isOut ? (
                      <Text style={{ fontSize: 11 }}>🛵</Text>
                    ) : null}
                  </View>
                  <View style={styles.timelineLine} />
                </View>
                <View style={styles.timelineTextCol}>
                  <Text
                    style={
                      isDelivered
                        ? styles.timelineStageTitleDone
                        : isOut
                        ? styles.timelineStageTitleActive
                        : styles.timelineStageTitlePending
                    }
                  >
                    Out for Delivery
                  </Text>
                  <Text style={isOut ? styles.timelineStageTimeActive : styles.timelineStageTime}>
                    {timeOut}
                  </Text>
                </View>
              </View>

              {/* Stage 5: Delivered */}
              <View style={styles.timelineRow}>
                <View style={styles.timelineIconCol}>
                  <View
                    style={[
                      styles.timelineDot,
                      isDelivered ? styles.timelineDotDone : styles.timelineDotPending,
                    ]}
                  >
                    {isDelivered ? <Text style={styles.timelineCheck}>✓</Text> : null}
                  </View>
                </View>
                <View style={styles.timelineTextCol}>
                  <Text
                    style={
                      isDelivered
                        ? styles.timelineStageTitleDone
                        : styles.timelineStageTitlePending
                    }
                  >
                    Delivered
                  </Text>
                  <Text style={styles.timelineStageTime}>{timeDelivered}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action Trigger Buttons in Modal */}
          {isOut && (
            <TouchableOpacity
              style={styles.modalPrimaryActionBtn}
              onPress={() => handleUpdateStatus(order._id, "Delivered")}
              activeOpacity={0.88}
            >
              <Text style={styles.modalPrimaryActionBtnText}>
                ✓ Complete Delivery & Mark Delivered
              </Text>
            </TouchableOpacity>
          )}

          {isCollected && (
            <TouchableOpacity
              style={styles.modalPrimaryActionBtn}
              onPress={() => handleUpdateStatus(order._id, "Out for Delivery")}
              activeOpacity={0.88}
            >
              <Text style={styles.modalPrimaryActionBtnText}>
                🛵 Start Route (Out for Delivery)
              </Text>
            </TouchableOpacity>
          )}

          {/* Solid Blue 'Track Live Location' Button matching Image 2 */}
          <TouchableOpacity
            style={styles.trackLiveLocationBtn}
            onPress={() =>
              Alert.alert(
                "Live Location Tracking",
                `Routing active for ${order.orderNumber}. Navigating to ${customerAddress}.`
              )
            }
            activeOpacity={0.88}
          >
            <Text style={styles.trackLiveLocationBtnText}>✈ Track Live Location</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ===========================================================================
  // SUB-VIEW 6: MY PROFILE PAGE (SCREEN 5 EXACT MATCHING REFERENCE)
  // ===========================================================================
  function renderProfilePage() {
    return (
      <View style={styles.profileContainer}>
        {/* Profile Avatar Centered Over the Bottom of the Blue Curved Wave */}
        <View style={styles.profileAvatarCenterWrap}>
          <View style={styles.profileAvatarLargeContainer}>
            <Image
              source={require("../../assets/images/driver-avatar.jpg")}
              style={styles.profileAvatarLarge}
              resizeMode="cover"
            />
            <View style={styles.profileCameraBadge}>
              <Text style={{ fontSize: 11, color: "#FFFFFF" }}>📷</Text>
            </View>
          </View>

          <Text style={styles.profileDriverName}>
            {deliveryUser?.name || "Ramesh Kumar"}
          </Text>
          <Text style={styles.profileDriverRole}>Delivery Driver</Text>
        </View>

        {/* Profile Info Details Card */}
        <View style={styles.profileInfoCard}>
          {/* Row 1: Username */}
          <View style={styles.profileRowItem}>
            <View style={styles.profileRowLeft}>
              <Text style={styles.profileRowIcon}>👤</Text>
              <Text style={styles.profileRowLabel}>Username</Text>
            </View>
            <Text style={styles.profileRowValue}>
              {deliveryUser?.username || "DRV001"}
            </Text>
          </View>

          <View style={styles.profileDivider} />

          {/* Row 2: Mobile Number */}
          <View style={styles.profileRowItem}>
            <View style={styles.profileRowLeft}>
              <Text style={styles.profileRowIcon}>📞</Text>
              <Text style={styles.profileRowLabel}>Mobile Number</Text>
            </View>
            <Text style={styles.profileRowValue}>
              {deliveryUser?.phone || "+91 9876543210"}
            </Text>
          </View>

          <View style={styles.profileDivider} />

          {/* Row 3: Email */}
          <View style={styles.profileRowItem}>
            <View style={styles.profileRowLeft}>
              <Text style={styles.profileRowIcon}>✉️</Text>
              <Text style={styles.profileRowLabel}>Email</Text>
            </View>
            <Text style={styles.profileRowValue}>
              {deliveryUser?.email || "ramesh@supermart.com"}
            </Text>
          </View>

          <View style={styles.profileDivider} />

          {/* Row 4: Supermarket */}
          <View style={styles.profileRowItem}>
            <View style={styles.profileRowLeft}>
              <Text style={styles.profileRowIcon}>🏪</Text>
              <Text style={styles.profileRowLabel}>Supermarket</Text>
            </View>
            <Text style={[styles.profileRowValue, { flex: 1, textAlign: "right" }]} numberOfLines={1}>
              {deliveryUser?.supermarketName || "Marudhar Kesari Jain College Supermarket"}
            </Text>
          </View>

          <View style={styles.profileDivider} />

          {/* Row 5: Account Status */}
          <View style={styles.profileRowItem}>
            <View style={styles.profileRowLeft}>
              <View style={styles.profileGreenDot} />
              <Text style={styles.profileRowLabel}>Account Status</Text>
            </View>
            <View style={styles.profileActiveStatusBadge}>
              <Text style={styles.profileActiveStatusText}>Active</Text>
            </View>
          </View>
        </View>

        {/* Prominent Red Outlined Logout Button matching Image 3 */}
        <TouchableOpacity
          style={styles.profileLogoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.profileLogoutIcon}>🚪</Text>
          <Text style={styles.profileLogoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ===========================================================================
  // SUB-VIEW 7: SUPPORT PAGE
  // ===========================================================================
  function renderSupportPage() {
    return (
      <View style={styles.viewContentContainer}>
        <View style={styles.supportCard}>
          <Text style={{ fontSize: 36, marginBottom: 10 }}>🎧</Text>
          <Text style={styles.supportTitle}>Delivery Partner Support</Text>
          <Text style={styles.supportSubtitle}>
            Need assistance with an active delivery or customer location?
          </Text>

          <TouchableOpacity
            style={styles.supportContactBtn}
            onPress={() => Linking.openURL("tel:+919876543210")}
            activeOpacity={0.88}
          >
            <Text style={styles.supportContactBtnText}>
              📞 Call Fleet Helpline: +91 98765 43210
            </Text>
          </TouchableOpacity>

          <View style={styles.supportStoreInfoBox}>
            <Text style={styles.supportStoreTitle}>Supermarket Store Admin:</Text>
            <Text style={styles.supportStoreName}>
              {deliveryUser?.supermarketName || "SuperMart Store Admin"}
            </Text>
            <Text style={styles.supportStoreCode}>
              Store Code: {deliveryUser?.supermarketCode || "SM-01"}
            </Text>
          </View>
        </View>
      </View>
    );
  }
}

// =============================================================================
// STYLES
// =============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  // Top Headers
  dashboardHeroHeader: {
    backgroundColor: "#1D4ED8", // Royal Electric Blue matching Image 1
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingBottom: 28,
    shadowColor: "#0F2C69",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  profileHeaderWave: {
    backgroundColor: "#1D4ED8",
    borderBottomLeftRadius: 42,
    borderBottomRightRadius: 42,
    paddingBottom: 48,
    shadowColor: "#0F2C69",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  standardHeaderBar: {
    backgroundColor: "#1D4ED8",
    paddingBottom: 16,
  },
  headerSafe: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  hamburgerIconBox: {
    width: 20,
    height: 16,
    justifyContent: "space-between",
  },
  hamburgerLine: {
    height: 2.2,
    backgroundColor: "#FFFFFF",
    borderRadius: 1,
  },
  headerBackArrow: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  bellIcon: {
    fontSize: 20,
  },
  bellBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#EF4444",
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#1D4ED8",
  },
  bellBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
  // Welcome Banner Row in Dashboard Header
  welcomeBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingHorizontal: 4,
  },
  welcomeTextCol: {
    flex: 1,
  },
  welcomeSubtitle: {
    color: "#BFDBFE",
    fontSize: 13,
    fontWeight: "600",
  },
  welcomeDriverName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  welcomeRole: {
    color: "#E0E7FF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  welcomeScooterGraphicBox: {
    width: 100,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeScooterImg: {
    width: "100%",
    height: "100%",
  },
  // Body Scroll
  bodyScroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 36,
  },
  viewContentContainer: {
    paddingHorizontal: 16,
  },
  // Supermarket Selector Card - Overlaps the bottom curve
  supermarketInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: -16, // Smoothly overlaps the blue curved wave
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F2C69",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  supermarketIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  supermarketCardName: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  supermarketCardCode: {
    fontSize: 11.5,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
  },
  supermarketChevron: {
    fontSize: 20,
    color: "#2563EB",
    fontWeight: "700",
  },
  // 4 KPI Cards (2x2 Grid)
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  kpiCard: {
    width: (width - 44) / 2,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
  },
  kpiCardBlue: {
    backgroundColor: "#F0F7FF",
    borderColor: "#BFDBFE",
  },
  kpiCardGreen: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  kpiCardOrange: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  kpiCardPurple: {
    backgroundColor: "#FAF5FF",
    borderColor: "#E9D5FF",
  },
  kpiIconBoxBlue: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiIconBoxGreen: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiIconBoxOrange: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiIconBoxPurple: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#475569",
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  // Recent Orders Section
  recentSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  recentTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0F172A",
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
  },
  // Order Card
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  orderCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  orderIdText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.2,
  },
  statusPillBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  statusPillDelivered: {
    backgroundColor: "#DCFCE7",
  },
  statusPillDeliveredText: {
    color: "#15803D",
  },
  orderCustomerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  userGlyph: {
    fontSize: 14,
    marginRight: 6,
  },
  customerNameBold: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#1E293B",
  },
  customerPhoneMuted: {
    fontSize: 12.5,
    color: "#64748B",
    marginLeft: 6,
    fontWeight: "600",
  },
  orderAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  pinGlyph: {
    fontSize: 14,
    marginRight: 6,
  },
  customerAddressText: {
    fontSize: 12.5,
    color: "#64748B",
    flex: 1,
    fontWeight: "500",
  },
  orderProductRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  productThumbBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  productThumbImg: {
    width: "100%",
    height: "100%",
  },
  productDetailsText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  productPriceText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
  },
  orderActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  callCustomerOutlineBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  callCustomerBtnText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#2563EB",
  },
  trackRouteSolidBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  trackRouteBtnText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  // My Deliveries Page
  filterPillsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 16,
    gap: 8,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterPillActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8",
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  stepperCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  stepperCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  stepperThumbBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  stepperThumbImg: {
    width: "100%",
    height: "100%",
  },
  stepperCustomerRow: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  stepperPriceText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 2,
  },
  stepperTimeText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "600",
  },
  stepperTrack: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  stepperStepCol: {
    alignItems: "center",
    width: 50,
  },
  stepperDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stepperDotDone: {
    backgroundColor: "#2563EB",
  },
  stepperDotActive: {
    backgroundColor: "#F59E0B",
  },
  stepperDotPending: {
    backgroundColor: "#E2E8F0",
  },
  stepperCheck: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  stepperLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#E2E8F0",
    marginBottom: 16,
  },
  stepperLineDone: {
    backgroundColor: "#2563EB",
  },
  stepperLabelDone: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#1E293B",
    textAlign: "center",
  },
  stepperLabelActive: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#D97706",
    textAlign: "center",
  },
  stepperLabelPending: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#94A3B8",
    textAlign: "center",
  },
  // Side Navigation Drawer
  drawerOverlay: {
    flex: 1,
    flexDirection: "row",
  },
  drawerBackdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  drawerCard: {
    width: "78%",
    backgroundColor: "#FFFFFF",
    height: "100%",
    paddingHorizontal: 18,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  drawerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingVertical: 6,
  },
  drawerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerCloseText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#64748B",
  },
  drawerProfileSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  drawerAvatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    borderColor: "#2563EB",
    position: "relative",
    marginBottom: 8,
  },
  drawerAvatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 32,
  },
  drawerOnlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  drawerDriverName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0F172A",
  },
  drawerDriverCode: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 2,
  },
  drawerStoreCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  drawerStoreIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerStoreName: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  drawerStoreSub: {
    fontSize: 10.5,
    color: "#64748B",
    fontWeight: "600",
  },
  drawerChevron: {
    fontSize: 18,
    color: "#2563EB",
    fontWeight: "700",
  },
  drawerNavList: {
    flex: 1,
  },
  drawerNavItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  drawerNavItemActive: {
    backgroundColor: "#EFF6FF",
  },
  drawerNavIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  drawerNavLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  drawerNavLabelActive: {
    color: "#1D4ED8",
    fontWeight: "800",
  },
  drawerDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 8,
  },
  drawerBottomWrap: {
    paddingTop: 10,
  },
  drawerLogoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  drawerLogoutIcon: {
    fontSize: 14,
    color: "#DC2626",
    fontWeight: "900",
    marginRight: 8,
  },
  drawerLogoutText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#DC2626",
  },
  // Order Details Modal (Image 2)
  modalContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  modalHeaderSafe: {
    backgroundColor: "#1D4ED8",
  },
  modalHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1D4ED8",
  },
  modalBackBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackArrow: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalIdCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  modalOrderIdText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  modalOrderDateText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  modalCustomerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  modalCustomerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  modalCustomerName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
    marginLeft: 8,
    flex: 1,
  },
  customerPhoneCallPill: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  customerPhoneCallText: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "700",
  },
  modalAddressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 4,
  },
  modalCustomerAddress: {
    fontSize: 12.5,
    color: "#64748B",
    marginLeft: 8,
    flex: 1,
    lineHeight: 17,
  },
  modalProductCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  modalProductThumbBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalProductThumbImg: {
    width: "100%",
    height: "100%",
  },
  modalProductName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalProductQty: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  modalProductPrice: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  timelineBoxCard: {
    backgroundColor: "#EFF6FF", // Exact Light Blue Box matching Image 2
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 16,
  },
  timelineBoxTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 14,
  },
  timelineList: {
    paddingLeft: 4,
  },
  timelineRow: {
    flexDirection: "row",
    minHeight: 48,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  timelineRowActivePill: {
    backgroundColor: "#DBEAFE", // Highlighted active stage row
    paddingVertical: 4,
  },
  timelineIconCol: {
    alignItems: "center",
    width: 24,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  timelineDotDone: {
    backgroundColor: "#2563EB",
  },
  timelineDotActive: {
    backgroundColor: "#1D4ED8",
  },
  timelineDotPending: {
    backgroundColor: "#E2E8F0",
  },
  timelineCheck: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#BFDBFE",
    marginTop: -2,
    marginBottom: -2,
  },
  timelineTextCol: {
    flex: 1,
    marginLeft: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timelineStageTitleDone: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  timelineStageTitleActive: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#1D4ED8",
  },
  timelineStageTitlePending: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
  timelineStageTime: {
    fontSize: 11.5,
    color: "#64748B",
    fontWeight: "600",
  },
  timelineStageTimeActive: {
    fontSize: 11.5,
    color: "#1D4ED8",
    fontWeight: "800",
  },
  modalPrimaryActionBtn: {
    backgroundColor: "#16A34A",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 10,
  },
  modalPrimaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "800",
  },
  trackLiveLocationBtn: {
    backgroundColor: "#1D4ED8",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  trackLiveLocationBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  // Screen 5: My Profile Page (Image 3)
  profileContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  profileAvatarCenterWrap: {
    alignItems: "center",
    marginTop: -44, // Overlaps the bottom of the blue wave curve
    marginBottom: 18,
  },
  profileAvatarLargeContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: "#38BDF8",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  profileAvatarLarge: {
    width: "100%",
    height: "100%",
    borderRadius: 42,
  },
  profileCameraBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "#1D4ED8",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  profileDriverName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 10,
    letterSpacing: 0.2,
  },
  profileDriverRole: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563EB",
    marginTop: 2,
  },
  profileInfoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  profileRowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
  },
  profileRowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileRowIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  profileRowLabel: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#475569",
  },
  profileRowValue: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  profileDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
  },
  profileGreenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    marginRight: 10,
  },
  profileActiveStatusBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  profileActiveStatusText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#15803D",
  },
  profileLogoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#FECACA",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  profileLogoutIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  profileLogoutText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#DC2626",
  },
  // Support Page
  supportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 6,
  },
  supportSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  supportContactBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  supportContactBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  supportStoreInfoBox: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  supportStoreTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  supportStoreName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  supportStoreCode: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "600",
    marginTop: 2,
  },
  // Empty State Card
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
});
