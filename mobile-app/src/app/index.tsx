import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useCart, SupermarketInfo } from "../context/CartContext";
import ModeUnavailableModal from "../components/ModeUnavailableModal";
import SupermarketSearchModal from "../components/SupermarketSearchModal";

const { width, height } = Dimensions.get("window");

export default function WelcomeHomeScreen() {
  const router = useRouter();
  const {
    customerUser,
    selectedSupermarket,
    setSelectedSupermarket,
    setPurchaseMode,
    clearCart,
  } = useCart();

  const [verifying] = useState(false);
  const [unavailableModal, setUnavailableModal] = useState<{
    visible: boolean;
    mode: "Online" | "Offline" | string;
    storeName?: string;
  }>({
    visible: false,
    mode: "Online",
    storeName: "",
  });

  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [pendingMode, setPendingMode] = useState<"online" | "offline">("online");

  // Handle Online Purchase selection:
  const handleSelectOnline = () => {
    setPurchaseMode("online");
    setPendingMode("online");
    setSearchModalVisible(true);
  };

  // Handle Offline Purchase selection (Enforce supermarket identification before scanning)
  const handleSelectOffline = () => {
    setPurchaseMode("offline");
    if (!selectedSupermarket) {
      setPendingMode("offline");
      setSearchModalVisible(true);
    } else {
      clearCart();
      router.push({ pathname: "/scanner", params: { fresh: "true" } });
    }
  };

  // Handle Delivery / Track Orders selection:
  const handleSelectDelivery = () => {
    if (customerUser) {
      router.push("/order-tracking");
    } else {
      // Guide customer to sign in to track their active deliveries
      router.push("/auth");
    }
  };

  const handleSelectOtherStore = () => {
    setUnavailableModal({ visible: false, mode: "Online", storeName: "" });
    setPendingMode("online");
    setSearchModalVisible(true);
  };

  const handleStoreChosenFromModal = (store: SupermarketInfo) => {
    setSelectedSupermarket(store);
    setSearchModalVisible(false);

    if (pendingMode === "offline") {
      // Offline mode sequence: Select Supermarket -> Fresh Scanner Session
      setPurchaseMode("offline");
      clearCart();
      router.push({ pathname: "/scanner", params: { fresh: "true" } });
    } else {
      // Online mode sequence: Select Supermarket -> Customer Registration / Login Page (/auth)
      router.push("/auth");
    }
  };

  const handleProfilePress = () => {
    if (customerUser) {
      router.push("/profile");
    } else {
      router.push("/auth");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* 1. Royal Purple Top Header Background */}
      <View style={styles.royalHeaderWrap}>
        <SafeAreaView edges={["top"]} style={styles.headerSafe}>
          <View style={styles.headerRow}>
            {/* Left Brand Area */}
            <View style={styles.brandRow}>
              <View style={styles.logoBadgeCircle}>
                <Text style={{ fontSize: 20 }}>🛒</Text>
              </View>
              <View style={{ marginLeft: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                  <Text style={styles.brandNameSuper}>Super</Text>
                  <Text style={styles.brandNameMart}>Mart</Text>
                </View>
                <Text style={styles.brandTagline}>Smart Shopping. Smarter Life.</Text>
              </View>
            </View>

            {/* Right Customer Avatar with Active 🟢 Badge */}
            <TouchableOpacity
              style={styles.avatarTouchBox}
              onPress={handleProfilePress}
              activeOpacity={0.8}
            >
              <View style={styles.avatarFrame}>
                <Image
                  source={require("../../assets/images/customer-avatar-shopper.jpg")}
                  style={styles.avatarImg}
                  resizeMode="cover"
                />
                <View style={styles.onlineDot} />
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* 2. Main Scroll Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero Banner Card with Shopper & Modern Typography */}
        <View style={styles.heroCardContainer}>
          <Image
            source={require("../../assets/images/purple-hero-card.jpg")}
            style={styles.heroCardImage}
            resizeMode="cover"
          />
          {/* Left Text Overlay */}
          <View style={styles.heroTextOverlay}>
            <Text style={styles.heroWelcomeSub}>WELCOME TO</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text style={styles.heroTitleSuper}>Super</Text>
              <Text style={styles.heroTitleMart}>Mart</Text>
            </View>
            <View style={styles.heroUnderlineBar} />
            <Text style={styles.heroTagline}>Shop Smart, Live Better</Text>
          </View>
        </View>

        {/* Action Cards Section (ONLINE, OFFLINE, DELIVERY) */}
        <View style={styles.cardsSection}>
          {verifying ? (
            <View style={styles.verifyingBox}>
              <ActivityIndicator color="#7C3AED" size="small" />
              <Text style={styles.verifyingText}>Verifying supermarket availability...</Text>
            </View>
          ) : (
            <>
              {/* Card 1: ONLINE */}
              <TouchableOpacity
                style={[styles.actionCard, styles.onlineCardBorder]}
                onPress={handleSelectOnline}
                activeOpacity={0.88}
              >
                <View style={styles.cardIconBoxPurple}>
                  <Image
                    source={require("../../assets/images/icon-online-exact.jpg")}
                    style={styles.card3DIcon}
                    resizeMode="contain"
                  />
                </View>

                <View style={styles.cardTextCol}>
                  <View style={styles.pillBadgeRow}>
                    <View style={styles.onlinePill}>
                      <Text style={styles.onlinePillText}>ONLINE</Text>
                    </View>
                  </View>
                  <Text style={styles.cardSubText}>
                    Browse products, add to cart and order.
                  </Text>
                </View>

                <View style={styles.purpleCircleBtn}>
                  <Text style={styles.arrowText}>→</Text>
                </View>
              </TouchableOpacity>

              {/* Card 2: OFFLINE */}
              <TouchableOpacity
                style={[styles.actionCard, styles.offlineCardBorder]}
                onPress={handleSelectOffline}
                activeOpacity={0.88}
              >
                <View style={styles.cardIconBoxGreen}>
                  <Image
                    source={require("../../assets/images/icon-offline-exact.jpg")}
                    style={styles.card3DIcon}
                    resizeMode="contain"
                  />
                </View>

                <View style={styles.cardTextCol}>
                  <View style={styles.pillBadgeRow}>
                    <View style={styles.offlinePill}>
                      <Text style={styles.offlinePillText}>OFFLINE</Text>
                    </View>
                  </View>
                  <Text style={styles.cardSubText}>
                    Scan products, add to cart and pay.
                  </Text>
                </View>

                <View style={styles.greenCircleBtn}>
                  <Text style={styles.arrowText}>→</Text>
                </View>
              </TouchableOpacity>

              {/* Card 3: DELIVERY */}
              <TouchableOpacity
                style={[styles.actionCard, styles.deliveryCardBorder]}
                onPress={handleSelectDelivery}
                activeOpacity={0.88}
              >
                <View style={styles.cardIconBoxOrange}>
                  <Image
                    source={require("../../assets/images/icon-delivery-exact.jpg")}
                    style={styles.card3DIcon}
                    resizeMode="contain"
                  />
                </View>

                <View style={styles.cardTextCol}>
                  <View style={styles.pillBadgeRow}>
                    <View style={styles.deliveryPill}>
                      <Text style={styles.deliveryPillText}>DELIVERY</Text>
                    </View>
                  </View>
                  <Text style={styles.cardSubText}>
                    Track your orders & get home delivery.
                  </Text>
                </View>

                <View style={styles.orangeCircleBtn}>
                  <Text style={styles.arrowText}>→</Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* 4 Trust & Value Badges Row */}
          <View style={styles.trustBarCard}>
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🛡️</Text>
              <Text style={styles.trustLabel}>Secure & Trusted</Text>
            </View>

            <View style={styles.trustDivider} />

            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🛒</Text>
              <Text style={styles.trustLabel}>Best Prices</Text>
            </View>

            <View style={styles.trustDivider} />

            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🏷️</Text>
              <Text style={styles.trustLabel}>Great Offers</Text>
            </View>

            <View style={styles.trustDivider} />

            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🎧</Text>
              <Text style={styles.trustLabel}>24/7 Support</Text>
            </View>
          </View>

          {/* 5. Promotional Offer Banner: Fresh Products, Better Life */}
          <TouchableOpacity
            style={styles.promoBannerContainer}
            onPress={handleSelectOnline}
            activeOpacity={0.92}
          >
            <Image
              source={require("../../assets/images/purple-promo-banner.jpg")}
              style={styles.promoBannerImg}
              resizeMode="cover"
            />
            {/* Promo Left Content */}
            <View style={styles.promoOverlayCol}>
              <Text style={styles.promoSmallTitle}>Fresh Products</Text>
              <Text style={styles.promoBigTitle}>Better Life</Text>
              <View style={styles.shopNowBtn}>
                <Text style={styles.shopNowBtnText}>Shop Now →</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* 6. Footer Link for Delivery Fleet Portal */}
          <TouchableOpacity
            style={styles.fleetLinkRow}
            onPress={() => router.push("/delivery-login")}
            activeOpacity={0.7}
          >
            <Text style={styles.fleetLinkText}>
              Are you a Delivery Partner?{" "}
              <Text style={styles.fleetLinkBold}>Login to Fleet Portal →</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Mode Unavailable Modal */}
      <ModeUnavailableModal
        visible={unavailableModal.visible}
        mode={unavailableModal.mode}
        supermarketName={unavailableModal.storeName}
        onClose={() =>
          setUnavailableModal({ visible: false, mode: "Online", storeName: "" })
        }
        onSelectAnother={handleSelectOtherStore}
      />

      {/* Store Search Modal */}
      <SupermarketSearchModal
        visible={searchModalVisible}
        mode={pendingMode}
        onSelect={handleStoreChosenFromModal}
        onUnavailableSelected={(store) => {
          setSearchModalVisible(false);
          setUnavailableModal({
            visible: true,
            mode: pendingMode === "online" ? "Online" : "Offline",
            storeName: store.name,
          });
        }}
        onClose={() => setSearchModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F7FF", // Premium light lavender canvas matching Reference Image
  },
  // Top Royal Purple Curved Header
  royalHeaderWrap: {
    backgroundColor: "#4C1D95", // Deep Royal Purple (#4C1D95 to #5B21B6)
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingBottom: 18,
    shadowColor: "#3B0764",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 8,
  },
  headerSafe: {
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoBadgeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#7C3AED",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  brandNameSuper: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  brandNameMart: {
    fontSize: 22,
    fontWeight: "900",
    color: "#F59E0B",
    letterSpacing: 0.3,
  },
  brandTagline: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#E9D5FF",
    marginTop: 1,
  },
  avatarTouchBox: {
    padding: 2,
  },
  avatarFrame: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  onlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981", // Active online status dot
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  // Main Scroll Content
  scrollContent: {
    flexGrow: 1,
    paddingTop: 16,
    paddingBottom: 32,
  },
  // Hero Card Container
  heroCardContainer: {
    marginHorizontal: 16,
    height: Math.min(Math.round(height * 0.22), 175),
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    shadowColor: "#4C1D95",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    position: "relative",
  },
  heroCardImage: {
    width: "100%",
    height: "100%",
  },
  heroTextOverlay: {
    position: "absolute",
    left: 18,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    width: "56%",
  },
  heroWelcomeSub: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#7C3AED",
    letterSpacing: 0.8,
  },
  heroTitleSuper: {
    fontSize: 25,
    fontWeight: "900",
    color: "#2E1065",
    letterSpacing: 0.2,
    marginTop: 1,
  },
  heroTitleMart: {
    fontSize: 25,
    fontWeight: "900",
    color: "#F59E0B",
    letterSpacing: 0.2,
    marginTop: 1,
  },
  heroUnderlineBar: {
    width: 44,
    height: 3,
    backgroundColor: "#F59E0B",
    borderRadius: 2,
    marginTop: 4,
    marginBottom: 5,
  },
  heroTagline: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    fontStyle: "italic",
  },
  // Action Cards Section
  cardsSection: {
    paddingHorizontal: 16,
    marginTop: 14,
    gap: 12,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    shadowColor: "#4C1D95",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  onlineCardBorder: {
    borderColor: "#DDD6FE",
  },
  offlineCardBorder: {
    borderColor: "#A7F3D0",
  },
  deliveryCardBorder: {
    borderColor: "#FED7AA",
  },
  cardIconBoxPurple: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  cardIconBoxGreen: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  cardIconBoxOrange: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  card3DIcon: {
    width: 42,
    height: 42,
  },
  cardTextCol: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  pillBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  onlinePill: {
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  onlinePillText: {
    color: "#6D28D9",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  offlinePill: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  offlinePillText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  deliveryPill: {
    backgroundColor: "#FFEDD5",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  deliveryPillText: {
    color: "#C2410C",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cardSubText: {
    fontSize: 12.5,
    color: "#475569",
    fontWeight: "500",
    lineHeight: 16,
  },
  purpleCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  greenCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  orangeCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EA580C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EA580C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  arrowText: {
    fontSize: 17,
    color: "#FFFFFF",
    fontWeight: "800",
  },
  // Trust Bar Card
  trustBarCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    shadowColor: "#4C1D95",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  trustItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  trustIcon: {
    fontSize: 18,
    marginBottom: 3,
  },
  trustLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6D28D9",
    textAlign: "center",
  },
  trustDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#F1F5F9",
  },
  // Promotional Offer Banner
  promoBannerContainer: {
    height: 120,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
    marginTop: 4,
    backgroundColor: "#4C1D95",
    shadowColor: "#3B0764",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  promoBannerImg: {
    width: "100%",
    height: "100%",
  },
  promoOverlayCol: {
    position: "absolute",
    left: 18,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    width: "60%",
  },
  promoSmallTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E9D5FF",
    letterSpacing: 0.3,
  },
  promoBigTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#FDE047", // Vibrant Yellow
    marginTop: 1,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  shopNowBtn: {
    backgroundColor: "#FBBF24",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  shopNowBtnText: {
    color: "#1E1B4B",
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  // Fleet Portal Footer Link
  fleetLinkRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginTop: 2,
  },
  fleetLinkText: {
    fontSize: 12.5,
    color: "#64748B",
    fontWeight: "600",
  },
  fleetLinkBold: {
    color: "#7C3AED",
    fontWeight: "800",
  },
  verifyingBox: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  verifyingText: {
    color: "#6D28D9",
    fontSize: 13,
    fontWeight: "600",
  },
});
