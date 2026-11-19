import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
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
    selectedSupermarket,
    setSelectedSupermarket,
    setPurchaseMode,
    verifySupermarketMode,
    customerUser,
    deliveryUser,
  } = useCart();

  const [verifying, setVerifying] = useState(false);
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

  // Handle Online Purchase selection
  const handleSelectOnline = async () => {
    setPurchaseMode("online");

    if (selectedSupermarket) {
      setVerifying(true);
      const check = await verifySupermarketMode(selectedSupermarket, "online");
      setVerifying(false);

      if (!check.allowed) {
        setUnavailableModal({
          visible: true,
          mode: "Online",
          storeName: selectedSupermarket.name,
        });
        return;
      }

      // If customer account already exists and is verified
      if (customerUser) {
        router.push("/catalog");
      } else {
        router.push("/auth");
      }
    } else {
      // If no store selected yet, open Auth page where location is searched & selected
      router.push("/auth");
    }
  };

  // Handle Offline Purchase selection (Direct to Scanner, never show login page)
  const handleSelectOffline = async () => {
    setPurchaseMode("offline");

    if (selectedSupermarket) {
      setVerifying(true);
      const check = await verifySupermarketMode(selectedSupermarket, "offline");
      setVerifying(false);

      if (!check.allowed) {
        setUnavailableModal({
          visible: true,
          mode: "Offline",
          storeName: selectedSupermarket.name,
        });
        return;
      }
    }

    // Direct to Scanner without login/registration page
    router.push("/scanner");
  };

  const handleSelectOtherStore = () => {
    setUnavailableModal({ visible: false, mode: "Online", storeName: "" });
    setPendingMode(unavailableModal.mode.toLowerCase() as any);
    setSearchModalVisible(true);
  };

  const handleStoreChosenFromModal = (store: SupermarketInfo) => {
    setSelectedSupermarket(store);
    setSearchModalVisible(false);
    if (pendingMode === "online") {
      if (customerUser) {
        router.push("/catalog");
      } else {
        router.push("/auth");
      }
    } else {
      router.push("/scanner");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Atmospheric Background Glows matching Design */}
      <View style={styles.radialAuraTop} />
      <View style={styles.radialAuraRight} />
      <View style={styles.ambientBottomShade} />

      <SafeAreaView style={styles.content}>
        {/* Top Header Row with Delivery Portal Access */}
        <View style={styles.topUtilityRow}>
          <TouchableOpacity
            style={styles.deliveryPortalBtn}
            onPress={() => router.push(deliveryUser ? "/delivery-dashboard" : "/delivery-login")}
            activeOpacity={0.8}
          >
            <Text style={styles.deliveryPortalBtnText}>
              {deliveryUser ? `🚚 ${deliveryUser.supermarketName} Delivery` : "🚚 Delivery Portal"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Top Branding Section */}
        <View style={styles.brandSection}>
          <View style={styles.cartIconWrapper}>
            <Image
              source={require("@/assets/images/gold-cart-logo.png")}
              style={styles.cartLogoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.titlePrimary}>Smart</Text>
          <Text style={styles.titleSecondary}>Supermarket</Text>
          <Text style={styles.tagline}>Scan • Shop • Pay</Text>

          {/* Current Connected Supermarket Pill if selected */}
          {selectedSupermarket ? (
            <TouchableOpacity
              style={styles.currentStorePill}
              onPress={() => setSearchModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.currentStorePillText}>
                📍 {selectedSupermarket.name} ({selectedSupermarket.city || "Bangalore"}) ▼
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Centerpiece Hero Grocery Bag */}
        <View style={styles.heroSection}>
          <View style={styles.heroImageContainer}>
            <Image
              source={require("@/assets/images/grocery-hero.png")}
              style={styles.heroImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Bottom Options: Online Shopping vs In-Store Scan & Go */}
        <View style={styles.bottomSection}>
          {verifying ? (
            <View style={styles.verifyingBox}>
              <ActivityIndicator color="#F6BC45" size="small" />
              <Text style={styles.verifyingText}>Verifying supermarket availability...</Text>
            </View>
          ) : (
            <>
              {/* Option 1: ONLINE */}
              <TouchableOpacity
                style={styles.onlineButton}
                onPress={handleSelectOnline}
                activeOpacity={0.88}
              >
                <View style={styles.buttonInner}>
                  <Text style={styles.btnIcon}>🛍️</Text>
                  <View style={styles.btnTextCol}>
                    <Text style={styles.onlineButtonText}>ONLINE</Text>
                    <Text style={styles.onlineSubText}>
                      Home Delivery &amp; Self Pickup
                    </Text>
                  </View>
                  <Text style={styles.btnArrow}>→</Text>
                </View>
              </TouchableOpacity>

              {/* Option 2: OFFLINE */}
              <TouchableOpacity
                style={styles.offlineButton}
                onPress={handleSelectOffline}
                activeOpacity={0.88}
              >
                <View style={styles.buttonInner}>
                  <Text style={styles.btnIcon}>⚡</Text>
                  <View style={styles.btnTextCol}>
                    <Text style={styles.offlineButtonText}>OFFLINE</Text>
                    <Text style={styles.offlineSubText}>
                      In-Store Barcode Scan &amp; Go
                    </Text>
                  </View>
                  <Text style={styles.btnArrow}>→</Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.welcomeFooter}>
            Choose your preferred shopping mode
          </Text>
        </View>
      </SafeAreaView>

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
    backgroundColor: "#2E0854", // Deep rich purple
    position: "relative",
  },
  radialAuraTop: {
    position: "absolute",
    top: -100,
    left: -60,
    right: -60,
    height: 380,
    borderRadius: 220,
    backgroundColor: "#5B16A6",
    opacity: 0.55,
  },
  radialAuraRight: {
    position: "absolute",
    top: height * 0.28,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#7C22DE",
    opacity: 0.25,
  },
  ambientBottomShade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: "#1F0438",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 20,
  },
  topUtilityRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  deliveryPortalBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  deliveryPortalBtnText: {
    color: "#FDE68A",
    fontSize: 12,
    fontWeight: "700",
  },
  brandSection: {
    alignItems: "center",
    marginTop: 4,
  },
  cartIconWrapper: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  cartLogoImage: {
    width: 74,
    height: 74,
  },
  titlePrimary: {
    fontSize: 30,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    lineHeight: 34,
    textAlign: "center",
  },
  titleSecondary: {
    fontSize: 30,
    fontWeight: "900",
    color: "#F6BC45", // Metallic golden champagne
    letterSpacing: -0.5,
    lineHeight: 34,
    textAlign: "center",
  },
  tagline: {
    fontSize: 13,
    color: "#FDE68A",
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 0.8,
  },
  currentStorePill: {
    marginTop: 8,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(253, 230, 138, 0.4)",
  },
  currentStorePillText: {
    fontSize: 11.5,
    color: "#FDE68A",
    fontWeight: "700",
  },
  heroSection: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 4,
  },
  heroImageContainer: {
    width: width * 0.88,
    height: height * 0.38,
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  bottomSection: {
    width: "100%",
    alignItems: "center",
    gap: 10,
  },
  onlineButton: {
    width: "100%",
    backgroundColor: "#F6BC45", // Metallic Gold
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 22,
    shadowColor: "#F6BC45",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  offlineButton: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.14)", // Glassy Violet
    borderWidth: 1.5,
    borderColor: "#CBB2FE",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 22,
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  btnIcon: {
    fontSize: 22,
  },
  btnTextCol: {
    flex: 1,
  },
  onlineButtonText: {
    color: "#2E0854",
    fontSize: 16,
    fontWeight: "900",
  },
  onlineSubText: {
    color: "#581C87",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 1,
  },
  offlineButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  offlineSubText: {
    color: "#DDD6FE",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  btnArrow: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  welcomeFooter: {
    color: "#CBB2FE",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
  },
  verifyingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 18,
  },
  verifyingText: {
    color: "#FDE68A",
    fontSize: 13,
    fontWeight: "700",
  },
});
