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

type DashboardTab =
  | "overview"
  | "new"
  | "accepted"
  | "out_for_delivery"
  | "completed"
  | "reports"
  | "profile";

export default function DeliveryDashboardScreen() {
  const router = useRouter();
  const { deliveryUser, logoutDeliveryUser } = useCart();

  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [activeNavTab, setActiveNavTab] = useState<"dashboard" | "deliveries" | "support" | "settings">("dashboard");
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
    totalRevenue: 0,
    completionRate: 0,
  });
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [menuModalOpen, setMenuModalOpen] = useState(false);

  // Guard: If not logged in as delivery staff, route to delivery login
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
          totalRevenue: analyticsData.summary.deliveredRevenue || 0,
          completionRate: parseInt(String(analyticsData.summary.completionRate || "0"), 10) || 0,
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

      Alert.alert("Status Updated", `Order status updated to ${nextStatus}.`);
      fetchDashboardData();
    } catch (err: any) {
      Alert.alert("Update Error", err.message || "Failed to update order.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCallCustomer = (phone?: string) => {
    if (!phone) {
      Alert.alert("No Phone", "No customer contact number available.");
      return;
    }
    const cleanP = phone.replace(/[^\d+]/g, "");
    Linking.openURL(`tel:${cleanP}`);
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout Delivery Staff",
      "Are you sure you want to exit the delivery dashboard?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: () => {
            setMenuModalOpen(false);
            logoutDeliveryUser();
            router.replace("/");
          },
        },
      ]
    );
  };

  if (!deliveryUser) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4C1D95" />
        <Text style={styles.loadingText}>Verifying Delivery Credentials...</Text>
      </View>
    );
  }

  // Filter orders by active sub-tab
  const filteredOrders = orders.filter((o) => {
    const s = (o.deliveryStatus || "Pending").toLowerCase();
    if (activeTab === "new") return s === "pending" || s === "new";
    if (activeTab === "accepted") return s === "accepted" || s === "assigned" || s === "orderpickedup";
    if (activeTab === "out_for_delivery") return s === "outfordelivery" || s === "out_for_delivery";
    if (activeTab === "completed") return s === "delivered" || s === "completed";
    return true; // "overview", "reports", "profile" or all
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* ========================================================================= */}
      {/* 1. TOP HEADER NAVIGATION (White + Soft Lavender, Dark Purple Text)        */}
      {/* ========================================================================= */}
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <View style={styles.topHeaderBar}>
          {/* Left: Hamburger Menu Icon */}
          <TouchableOpacity
            style={styles.hamburgerBtn}
            onPress={() => setMenuModalOpen(true)}
            activeOpacity={0.7}
          >
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
          </TouchableOpacity>

          {/* Center: Branding */}
          <View style={styles.brandingCenter}>
            <Text style={styles.brandTitle}>Smart Supermarket</Text>
            <Text style={styles.brandSubtitle}>Shop Smart • Live Better</Text>
          </View>

          {/* Right: Notifications & Profile Avatar */}
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.notificationBellBtn}
              onPress={() => Alert.alert("Notifications", "You have 2 pending delivery updates.")}
              activeOpacity={0.7}
            >
              <Text style={styles.bellEmoji}>🔔</Text>
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>2</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.staffAvatarBtn}
              onPress={() => {
                setActiveTab("profile");
                setActiveNavTab("settings");
              }}
              activeOpacity={0.8}
            >
              <View style={styles.staffAvatarCircle}>
                <Text style={styles.staffAvatarEmoji}>👨‍🦱</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Main Scroll Content */}
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4C1D95"
            colors={["#4C1D95", "#059669"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================================= */}
        {/* 2. HERO BANNER: 3D SCOOTER RIDER & SUPERMARKET STOREFRONT (EXACT MATCH)   */}
        {/* ========================================================================= */}
        <View style={styles.heroCard}>
          {/* Background Illustration from uploaded master reference */}
          <Image
            source={require("@/assets/images/delivery-hero-banner.jpg")}
            style={styles.heroBannerImage}
            resizeMode="cover"
          />

          {/* Floating Branded Supermarket Card (Left Overlay) */}
          <View style={styles.heroOverlayCard}>
            <View style={styles.heroLogoRow}>
              <View style={styles.heroLogoIconCircle}>
                <Text style={styles.heroLogoCart}>🛒</Text>
              </View>
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.heroLogoTitle}>SMART</Text>
                <Text style={styles.heroLogoSub}>SUPERMARKET</Text>
              </View>
            </View>

            <Text style={styles.heroStoreName} numberOfLines={1}>
              {deliveryUser.supermarketName || "Whole Harvest Co-op"}
            </Text>

            <View style={styles.heroOpsPill}>
              <Text style={styles.heroOpsPillText}>Delivery Operations Dashboard</Text>
            </View>

            <View style={styles.heroStaffStatusRow}>
              <View style={styles.heroLiveGreenDot} />
              <Text style={styles.heroStaffStatusText} numberOfLines={1}>
                Staff: {deliveryUser.name || "Ramesh"} (Delivery)
              </Text>
            </View>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 3. HORIZONTAL STATUS PILL TABS                                            */}
        {/* ========================================================================= */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusTabsRow}
        >
          {/* Tab 1: Overview */}
          <TouchableOpacity
            style={[
              styles.statusPillTab,
              activeTab === "overview" && styles.statusPillTabActive,
            ]}
            onPress={() => setActiveTab("overview")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.statusPillIcon,
                activeTab === "overview" && styles.statusPillIconActive,
              ]}
            >
              🏠
            </Text>
            <Text
              style={[
                styles.statusPillLabel,
                activeTab === "overview" && styles.statusPillLabelActive,
              ]}
            >
              Overview
            </Text>
          </TouchableOpacity>

          {/* Tab 2: New Orders */}
          <TouchableOpacity
            style={[
              styles.statusPillTab,
              activeTab === "new" && styles.statusPillTabActive,
            ]}
            onPress={() => setActiveTab("new")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.statusPillIcon,
                activeTab === "new" && styles.statusPillIconActive,
              ]}
            >
              🕒
            </Text>
            <Text
              style={[
                styles.statusPillLabel,
                activeTab === "new" && styles.statusPillLabelActive,
              ]}
            >
              New Orders ({analytics.pending || 0})
            </Text>
          </TouchableOpacity>

          {/* Tab 3: Accepted */}
          <TouchableOpacity
            style={[
              styles.statusPillTab,
              activeTab === "accepted" && styles.statusPillTabActive,
            ]}
            onPress={() => setActiveTab("accepted")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.statusPillIcon,
                activeTab === "accepted" && styles.statusPillIconActive,
              ]}
            >
              ✓
            </Text>
            <Text
              style={[
                styles.statusPillLabel,
                activeTab === "accepted" && styles.statusPillLabelActive,
              ]}
            >
              Accepted ({analytics.accepted || 0})
            </Text>
          </TouchableOpacity>

          {/* Tab 4: Out for Delivery */}
          <TouchableOpacity
            style={[
              styles.statusPillTab,
              activeTab === "out_for_delivery" && styles.statusPillTabActive,
            ]}
            onPress={() => setActiveTab("out_for_delivery")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.statusPillIcon,
                activeTab === "out_for_delivery" && styles.statusPillIconActive,
              ]}
            >
              🚚
            </Text>
            <Text
              style={[
                styles.statusPillLabel,
                activeTab === "out_for_delivery" && styles.statusPillLabelActive,
              ]}
            >
              Out for Delivery ({analytics.outForDelivery || 0})
            </Text>
          </TouchableOpacity>

          {/* Tab 5: Completed */}
          <TouchableOpacity
            style={[
              styles.statusPillTab,
              activeTab === "completed" && styles.statusPillTabActive,
            ]}
            onPress={() => setActiveTab("completed")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.statusPillIcon,
                activeTab === "completed" && styles.statusPillIconActive,
              ]}
            >
              ✅
            </Text>
            <Text
              style={[
                styles.statusPillLabel,
                activeTab === "completed" && styles.statusPillLabelActive,
              ]}
            >
              Delivered ({analytics.delivered || 0})
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Loading Indicator */}
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#4C1D95" />
            <Text style={styles.syncingText}>Syncing store delivery records...</Text>
          </View>
        ) : null}

        {/* ========================================================================= */}
        {/* VIEW 1: OVERVIEW (EXACT 2x2 LIGHT PASTEL CARDS & REVENUE SUMMARY)         */}
        {/* ========================================================================= */}
        {activeTab === "overview" && (
          <>
            {/* 2x2 Light Pastel KPI Cards Grid */}
            <View style={styles.kpiGrid}>
              {/* Card 1: Total Orders (Soft Lavender Pastel) */}
              <View style={[styles.kpiCard, styles.kpiCardLavender]}>
                <View style={styles.kpiCardTopRow}>
                  <View style={[styles.kpiIconCircle, { backgroundColor: "#7C3AED" }]}>
                    <Text style={styles.kpiIconEmoji}>🛒</Text>
                  </View>
                  <Text style={styles.kpiCornerGraphic}>📈</Text>
                </View>
                <Text style={styles.kpiLabel}>Total Orders</Text>
                <Text style={styles.kpiValue}>{analytics.total || orders.length || 0}</Text>
                <Text style={styles.kpiSub}>Exciting to see new orders!</Text>
              </View>

              {/* Card 2: New / Pending (Soft Amber/Yellow Pastel) */}
              <View style={[styles.kpiCard, styles.kpiCardAmber]}>
                <View style={styles.kpiCardTopRow}>
                  <View style={[styles.kpiIconCircle, { backgroundColor: "#F59E0B" }]}>
                    <Text style={styles.kpiIconEmoji}>🕒</Text>
                  </View>
                  <Text style={styles.kpiCornerGraphic}>⏳</Text>
                </View>
                <Text style={styles.kpiLabel}>New / Pending</Text>
                <Text style={styles.kpiValue}>{analytics.pending || 0}</Text>
                <Text style={styles.kpiSub}>Awaiting acceptance...</Text>
              </View>

              {/* Card 3: Out For Delivery (Soft Mint Green Pastel) */}
              <View style={[styles.kpiCard, styles.kpiCardMint]}>
                <View style={styles.kpiCardTopRow}>
                  <View style={[styles.kpiIconCircle, { backgroundColor: "#10B981" }]}>
                    <Text style={styles.kpiIconEmoji}>🚚</Text>
                  </View>
                  <Text style={styles.kpiCornerGraphic}>📍</Text>
                </View>
                <Text style={styles.kpiLabel}>Out For Delivery</Text>
                <Text style={styles.kpiValue}>{analytics.outForDelivery || 0}</Text>
                <Text style={styles.kpiSub}>On road right now</Text>
              </View>

              {/* Card 4: Delivered Today (Soft Cyan/Emerald Pastel) */}
              <View style={[styles.kpiCard, styles.kpiCardCyan]}>
                <View style={styles.kpiCardTopRow}>
                  <View style={[styles.kpiIconCircle, { backgroundColor: "#059669" }]}>
                    <Text style={styles.kpiIconEmoji}>✓</Text>
                  </View>
                  <Text style={styles.kpiCornerGraphic}>🎁</Text>
                </View>
                <Text style={styles.kpiLabel}>Delivered Today</Text>
                <Text style={styles.kpiValue}>{analytics.todayDelivered || 0}</Text>
                <Text style={styles.kpiSub}>Total: {analytics.delivered || 0}</Text>
              </View>
            </View>

            {/* Total Delivery Revenue & Completion Rate Banner Card */}
            <View style={styles.revenueBannerCard}>
              {/* Left Side: Revenue with Gold Coins */}
              <View style={styles.revenueLeftCol}>
                <Text style={styles.coinsEmoji}>🪙</Text>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.revenueLabel}>Total Delivery Revenue</Text>
                  <Text style={styles.revenueAmount}>
                    ₹{(analytics.totalRevenue || 0).toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Middle Soft Divider */}
              <View style={styles.revenueDivider} />

              {/* Right Side: Completion Rate Circular Badge */}
              <View style={styles.completionRightCol}>
                <View style={styles.completionCircleBadge}>
                  <Text style={styles.completionCircleText}>
                    {analytics.completionRate || 0}%
                  </Text>
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.completionLabel}>Completion Rate</Text>
                  <Text style={styles.completionValue}>
                    {analytics.completionRate || 0}%
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ========================================================================= */}
        {/* RECENT STORE DELIVERIES SECTION HEADER                                    */}
        {/* ========================================================================= */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionClockIcon}>🕒</Text>
            <Text style={styles.sectionTitle}>
              Recent Store Deliveries ({filteredOrders.length})
            </Text>
          </View>
          <TouchableOpacity onPress={fetchDashboardData} activeOpacity={0.7}>
            <Text style={styles.syncBtnText}>Sync 🔄</Text>
          </TouchableOpacity>
        </View>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyOrdersCard}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>📦</Text>
            <Text style={styles.emptyTitle}>No Orders Found</Text>
            <Text style={styles.emptySubtitle}>
              Orders placed for {deliveryUser.supermarketName} will automatically appear here.
            </Text>
          </View>
        ) : (
          filteredOrders.map((ord) => renderOrderCard(ord))
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* 4. BOTTOM NAVIGATION BAR (MATCHING SCREENSHOT)                            */}
      {/* ========================================================================= */}
      <View style={styles.bottomNavContainer}>
        {/* Tab 1: Dashboard (Active Solid Purple Pill) */}
        <TouchableOpacity
          style={
            activeNavTab === "dashboard"
              ? styles.bottomNavTabActive
              : styles.bottomNavTab
          }
          onPress={() => {
            setActiveNavTab("dashboard");
            setActiveTab("overview");
          }}
          activeOpacity={0.85}
        >
          <Text
            style={
              activeNavTab === "dashboard"
                ? styles.bottomNavActiveIcon
                : styles.bottomNavIcon
            }
          >
            🏠
          </Text>
          <Text
            style={
              activeNavTab === "dashboard"
                ? styles.bottomNavActiveText
                : styles.bottomNavText
            }
          >
            Dashboard
          </Text>
        </TouchableOpacity>

        <View style={styles.navDivider} />

        {/* Tab 2: My Deliveries */}
        <TouchableOpacity
          style={
            activeNavTab === "deliveries"
              ? styles.bottomNavTabActive
              : styles.bottomNavTab
          }
          onPress={() => {
            setActiveNavTab("deliveries");
            setActiveTab("accepted");
          }}
          activeOpacity={0.8}
        >
          <Text
            style={
              activeNavTab === "deliveries"
                ? styles.bottomNavActiveIcon
                : styles.bottomNavIcon
            }
          >
            📦
          </Text>
          <Text
            style={
              activeNavTab === "deliveries"
                ? styles.bottomNavActiveText
                : styles.bottomNavText
            }
          >
            My Deliveries
          </Text>
        </TouchableOpacity>

        <View style={styles.navDivider} />

        {/* Tab 3: Support / Reports */}
        <TouchableOpacity
          style={
            activeNavTab === "support"
              ? styles.bottomNavTabActive
              : styles.bottomNavTab
          }
          onPress={() => {
            setActiveNavTab("support");
            setActiveTab("reports");
          }}
          activeOpacity={0.8}
        >
          <Text
            style={
              activeNavTab === "support"
                ? styles.bottomNavActiveIcon
                : styles.bottomNavIcon
            }
          >
            🎧
          </Text>
          <Text
            style={
              activeNavTab === "support"
                ? styles.bottomNavActiveText
                : styles.bottomNavText
            }
          >
            Support
          </Text>
        </TouchableOpacity>

        <View style={styles.navDivider} />

        {/* Tab 4: Settings / Profile */}
        <TouchableOpacity
          style={
            activeNavTab === "settings"
              ? styles.bottomNavTabActive
              : styles.bottomNavTab
          }
          onPress={() => {
            setActiveNavTab("settings");
            setActiveTab("profile");
          }}
          activeOpacity={0.8}
        >
          <Text
            style={
              activeNavTab === "settings"
                ? styles.bottomNavActiveIcon
                : styles.bottomNavIcon
            }
          >
            ⚙️
          </Text>
          <Text
            style={
              activeNavTab === "settings"
                ? styles.bottomNavActiveText
                : styles.bottomNavText
            }
          >
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hamburger Menu Modal */}
      <RNModal
        visible={menuModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.menuModalBackdrop}
          activeOpacity={1}
          onPress={() => setMenuModalOpen(false)}
        >
          <View style={styles.menuModalCard}>
            <View style={styles.menuModalHeader}>
              <Text style={styles.menuStoreName}>{deliveryUser.supermarketName}</Text>
              <Text style={styles.menuStaffBadge}>
                Staff: {deliveryUser.name} ({deliveryUser.username})
              </Text>
            </View>

            <TouchableOpacity
              style={styles.menuItemBtn}
              onPress={() => {
                setMenuModalOpen(false);
                router.replace("/");
              }}
            >
              <Text style={styles.menuItemText}>🛒 Go to Customer Shopping App</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItemBtn, { backgroundColor: "#FEF2F2" }]}
              onPress={handleLogout}
            >
              <Text style={[styles.menuItemText, { color: "#DC2626" }]}>
                🚪 Logout Delivery Account
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuCancelBtn}
              onPress={() => setMenuModalOpen(false)}
            >
              <Text style={styles.menuCancelText}>Close Menu</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </RNModal>
    </View>
  );

  // =========================================================================
  // ORDER CARD RENDERER (EXACT MATCHING REFERENCE DESIGN)
  // =========================================================================
  function renderOrderCard(order: any) {
    const status = order.deliveryStatus || "Pending";
    const isPending = status === "Pending" || status === "New";
    const isAssigned = status === "Assigned";
    const isPickedUp = status === "OrderPickedUp" || status === "Accepted";
    const isOut = status === "OutForDelivery";
    const isDelivered = status === "Delivered" || status === "Completed";

    const customerName = order.deliveryCustomerName || order.customer?.name || "Customer";
    const customerPhone = order.deliveryPhone || order.customer?.phone || "";
    const customerAddress = order.deliveryAddress || order.customer?.address || "Address not provided";

    const formattedDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return (
      <View key={order._id} style={styles.orderCard}>
        {/* Top Header Row: 📦 Box Icon, Order #, Date, Status Pill */}
        <View style={styles.orderCardTopRow}>
          <View style={styles.orderCardLeftHeader}>
            <View style={styles.boxIconCircle}>
              <Text style={styles.boxEmoji}>📦</Text>
            </View>

            <View style={{ marginLeft: 10 }}>
              <Text style={styles.orderNumberText}>{order.orderNumber}</Text>
              <Text style={styles.orderDateText}>📅 {formattedDate}</Text>
            </View>
          </View>

          {/* Status Badge (Green for Delivered) */}
          <View
            style={[
              styles.cardStatusBadge,
              isDelivered && styles.cardStatusDelivered,
              isOut && styles.cardStatusOut,
              (isAssigned || isPickedUp) && styles.cardStatusAccepted,
              isPending && styles.cardStatusPending,
            ]}
          >
            <Text
              style={[
                styles.cardStatusBadgeText,
                isDelivered && styles.cardStatusDeliveredText,
                isOut && styles.cardStatusOutText,
                (isAssigned || isPickedUp) && styles.cardStatusAcceptedText,
                isPending && styles.cardStatusPendingText,
              ]}
            >
              {isDelivered
                ? "✓ Delivered"
                : isOut
                ? "Out for Delivery"
                : isPickedUp
                ? "Picked Up"
                : isAssigned
                ? "Assigned"
                : "New / Pending"}
            </Text>
          </View>
        </View>

        {/* Customer Info & Call Row */}
        <View style={styles.customerRowWrap}>
          <View style={styles.customerTextCol}>
            <View style={styles.customerNameRow}>
              <Text style={styles.userGlyph}>👤</Text>
              <Text style={styles.customerNameText}>{customerName}</Text>
            </View>
            <View style={styles.customerAddressRow}>
              <Text style={styles.pinGlyph}>📍</Text>
              <Text style={styles.customerAddressText} numberOfLines={1}>
                {customerAddress}
              </Text>
            </View>
          </View>

          {customerPhone ? (
            <TouchableOpacity
              style={styles.callPillBtn}
              onPress={() => handleCallCustomer(customerPhone)}
              activeOpacity={0.8}
            >
              <Text style={styles.callPillText}>📞 {customerPhone}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Items Summary & Payment Badge Row */}
        <View style={styles.itemsPaymentRow}>
          <View style={styles.itemsSubtotalRow}>
            <Text style={styles.yellowCoin}>🟡</Text>
            <Text style={styles.itemsSubtotalText}>
              {order.totalItems || order.items?.length || 1} Items • ₹
              {Number(order.totalAmount || 0).toFixed(2)}
            </Text>
          </View>

          <View style={styles.paymentMethodPill}>
            <Text style={styles.paymentMethodText}>
              💳 {order.paymentMethod || "UPI"} ({order.paymentStatus || "Completed"})
            </Text>
          </View>
        </View>

        {/* Status / Action Banner at Bottom of Card */}
        <View style={styles.orderBottomActionWrap}>
          {isDelivered && (
            <View style={styles.deliveredSuccessBanner}>
              <Text style={styles.deliveredCheckmark}>✓</Text>
              <Text style={styles.deliveredSuccessText}>
                Order Successfully Delivered 🎉
              </Text>
            </View>
          )}

          {isOut && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.deliveredActionBtn]}
              onPress={() => handleUpdateStatus(order._id, "Delivered")}
              disabled={updatingId === order._id}
              activeOpacity={0.85}
            >
              {updatingId === order._id ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.actionBtnText}>Confirm Delivered ✅</Text>
              )}
            </TouchableOpacity>
          )}

          {isPickedUp && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.outActionBtn]}
              onPress={() => handleUpdateStatus(order._id, "OutForDelivery")}
              disabled={updatingId === order._id}
              activeOpacity={0.85}
            >
              {updatingId === order._id ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.actionBtnText}>Start Delivery 🚀</Text>
              )}
            </TouchableOpacity>
          )}

          {isAssigned && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.pickupActionBtn]}
              onPress={() => handleUpdateStatus(order._id, "OrderPickedUp")}
              disabled={updatingId === order._id}
              activeOpacity={0.85}
            >
              {updatingId === order._id ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.actionBtnText}>Pick Up Order 📦</Text>
              )}
            </TouchableOpacity>
          )}

          {isPending && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptActionBtn]}
              onPress={() => handleUpdateStatus(order._id, "Accepted")}
              disabled={updatingId === order._id}
              activeOpacity={0.85}
            >
              {updatingId === order._id ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.actionBtnText}>Accept Order 📦</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }
}

// =========================================================================
// STYLES: EXACT THEME (WHITE + SOFT LAVENDER, DARK PURPLE, LIGHT PASTEL CARDS)
// =========================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F5FC", // White + soft lavender background
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#F7F5FC",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#6B21A8",
    marginTop: 12,
    fontSize: 14,
    fontWeight: "600",
  },

  // 1. Top Header Bar
  headerSafeArea: {
    backgroundColor: "#FFFFFF",
  },
  topHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EDE9FE",
  },
  hamburgerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    gap: 4.5,
  },
  hamburgerLine: {
    width: 20,
    height: 2.5,
    backgroundColor: "#3B0764", // Dark purple icons
    borderRadius: 2,
  },
  brandingCenter: {
    flex: 1,
    marginLeft: 10,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#2E0854", // Dark purple text
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7E22CE",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  notificationBellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FAF5FF",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  bellEmoji: {
    fontSize: 18,
  },
  notificationBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#EF4444",
    width: 15,
    height: 15,
    borderRadius: 7.5,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
  staffAvatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#4C1D95",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EDE9FE",
  },
  staffAvatarCircle: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  staffAvatarEmoji: {
    fontSize: 20,
  },

  // Main Scroll View
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },

  // 2. Hero Banner Card (Exact match with reference image)
  heroCard: {
    height: 98,
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
    marginBottom: 14,
    borderWidth: 1.2,
    borderColor: "#E9D5FF",
    backgroundColor: "#F3E8FF",
    shadowColor: "#4C1D95",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  heroBannerImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  heroOverlayCard: {
    position: "absolute",
    top: 6,
    left: 6,
    bottom: 6,
    width: width * 0.52,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 12,
    padding: 7,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  heroLogoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroLogoIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
  },
  heroLogoCart: {
    fontSize: 11,
  },
  heroLogoTitle: {
    fontSize: 8.5,
    fontWeight: "900",
    color: "#2E0854",
    letterSpacing: 0.5,
  },
  heroLogoSub: {
    fontSize: 6,
    fontWeight: "800",
    color: "#7E22CE",
    letterSpacing: 0.2,
  },
  heroStoreName: {
    fontSize: 12,
    fontWeight: "900",
    color: "#1E1B4B",
    marginTop: 1,
  },
  heroOpsPill: {
    backgroundColor: "#4C1D95",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    alignSelf: "flex-start",
  },
  heroOpsPillText: {
    color: "#FFFFFF",
    fontSize: 7.5,
    fontWeight: "700",
  },
  heroStaffStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 1,
  },
  heroLiveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
    marginRight: 4,
  },
  heroStaffStatusText: {
    fontSize: 8.5,
    color: "#374151",
    fontWeight: "600",
  },

  // 3. Horizontal Status Pill Tabs
  statusTabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    paddingVertical: 2,
  },
  statusPillTab: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E9D5FF",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#4C1D95",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statusPillTabActive: {
    backgroundColor: "#4C1D95", // Solid purple active tab matching screenshot
    borderColor: "#4C1D95",
  },
  statusPillIcon: {
    fontSize: 13,
    marginRight: 6,
    color: "#4C1D95",
  },
  statusPillIconActive: {
    color: "#FFFFFF",
  },
  statusPillLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#3B0764",
  },
  statusPillLabelActive: {
    color: "#FFFFFF",
  },

  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 8,
  },
  syncingText: {
    fontSize: 12,
    color: "#6B21A8",
    fontWeight: "600",
  },

  // 4. 2x2 Light Pastel KPI Cards
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  kpiCard: {
    width: (width - 44) / 2,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    shadowColor: "#4C1D95",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiCardLavender: {
    backgroundColor: "#FAF5FF", // Soft lavender
    borderColor: "#E9D5FF",
  },
  kpiCardAmber: {
    backgroundColor: "#FEFCE8", // Soft yellow/amber
    borderColor: "#FEF08A",
  },
  kpiCardMint: {
    backgroundColor: "#F0FDF4", // Soft mint green
    borderColor: "#BBF7D0",
  },
  kpiCardCyan: {
    backgroundColor: "#ECFDF5", // Soft cyan/emerald
    borderColor: "#A7F3D0",
  },
  kpiCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  kpiIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  kpiIconEmoji: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  kpiCornerGraphic: {
    fontSize: 20,
  },
  kpiLabel: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1E1B4B",
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 10.5,
    color: "#6B7280",
    marginTop: 4,
  },

  // Revenue & Completion Rate Banner Card
  revenueBannerCard: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    shadowColor: "#4C1D95",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  revenueLeftCol: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  coinsEmoji: {
    fontSize: 32,
  },
  revenueLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#4C1D95",
  },
  revenueAmount: {
    fontSize: 24,
    fontWeight: "900",
    color: "#16A34A", // Big bold green amount
    marginTop: 2,
  },
  revenueDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#DDD6FE",
    marginHorizontal: 12,
  },
  completionRightCol: {
    flexDirection: "row",
    alignItems: "center",
  },
  completionCircleBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: "#4C1D95",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  completionCircleText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#3B0764",
  },
  completionLabel: {
    fontSize: 10.5,
    color: "#6B7280",
    fontWeight: "600",
  },
  completionValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#3B0764",
    marginTop: 1,
  },

  // 5. Section Header
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionClockIcon: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: "800",
    color: "#1E1B4B",
    letterSpacing: -0.2,
  },
  syncBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4C1D95",
  },

  emptyOrdersCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },

  // 6. Order Card (Matching Reference Image)
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    shadowColor: "#4C1D95",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  orderCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  orderCardLeftHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  boxIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFEDD5", // Soft peach
    justifyContent: "center",
    alignItems: "center",
  },
  boxEmoji: {
    fontSize: 22,
  },
  orderNumberText: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  orderDateText: {
    fontSize: 11.5,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
  },

  // Status Badge
  cardStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cardStatusDelivered: {
    backgroundColor: "#DCFCE7", // Light green
  },
  cardStatusDeliveredText: {
    color: "#15803D",
    fontWeight: "800",
    fontSize: 11.5,
  },
  cardStatusOut: {
    backgroundColor: "#DBEAFE",
  },
  cardStatusOutText: {
    color: "#1D4ED8",
    fontWeight: "800",
    fontSize: 11.5,
  },
  cardStatusAccepted: {
    backgroundColor: "#F3E8FF",
  },
  cardStatusAcceptedText: {
    color: "#6B21A8",
    fontWeight: "800",
    fontSize: 11.5,
  },
  cardStatusPending: {
    backgroundColor: "#FEF3C7",
  },
  cardStatusPendingText: {
    color: "#B45309",
    fontWeight: "800",
    fontSize: 11.5,
  },
  cardStatusBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
  },

  // Customer Row
  customerRowWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  customerTextCol: {
    flex: 1,
  },
  customerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userGlyph: {
    fontSize: 13,
  },
  customerNameText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  customerAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  pinGlyph: {
    fontSize: 12,
  },
  customerAddressText: {
    fontSize: 12,
    color: "#6B7280",
    flex: 1,
  },
  callPillBtn: {
    backgroundColor: "#F3E8FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginLeft: 8,
  },
  callPillText: {
    fontSize: 11.5,
    color: "#6B21A8",
    fontWeight: "700",
  },

  // Items & Payment Row
  itemsPaymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  itemsSubtotalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  yellowCoin: {
    fontSize: 12,
  },
  itemsSubtotalText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  paymentMethodPill: {
    backgroundColor: "#FEF9C3",
    borderWidth: 1,
    borderColor: "#FEF08A",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  paymentMethodText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#854D0E",
  },

  // Bottom Action / Status Banner
  orderBottomActionWrap: {
    marginTop: 6,
  },
  deliveredSuccessBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  deliveredCheckmark: {
    color: "#15803D",
    fontSize: 14,
    fontWeight: "900",
  },
  deliveredSuccessText: {
    color: "#15803D",
    fontSize: 12.5,
    fontWeight: "800",
  },
  actionBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "800",
  },
  acceptActionBtn: {
    backgroundColor: "#4C1D95",
  },
  pickupActionBtn: {
    backgroundColor: "#7C3AED",
  },
  outActionBtn: {
    backgroundColor: "#2563EB",
  },
  deliveredActionBtn: {
    backgroundColor: "#16A34A",
  },

  // 7. Bottom Navigation Bar (Exact Match)
  bottomNavContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1.5,
    borderTopColor: "#EDE9FE",
    shadowColor: "#4C1D95",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  navDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#DDD6FE",
  },
  bottomNavTab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  bottomNavTabActive: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4C1D95", // Solid purple rounded pill matching screenshot
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  bottomNavIcon: {
    fontSize: 18,
    marginBottom: 2,
    color: "#6B7280",
  },
  bottomNavActiveIcon: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  bottomNavText: {
    fontSize: 11,
    color: "#4C1D95",
    fontWeight: "700",
  },
  bottomNavActiveText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "800",
  },

  // Menu Modal
  menuModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  menuModalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "#E9D5FF",
    gap: 12,
  },
  menuModalHeader: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  menuStoreName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2E0854",
  },
  menuStaffBadge: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  menuItemBtn: {
    backgroundColor: "#F8F6FF",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  menuItemText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#4C1D95",
  },
  menuCancelBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  menuCancelText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "600",
  },
});
