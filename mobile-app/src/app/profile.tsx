import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Theme } from "../constants/colors";
import CustomerBottomNav from "../components/CustomerBottomNav";
import { useCart, SupermarketInfo } from "../context/CartContext";
import SupermarketSearchModal from "../components/SupermarketSearchModal";
import ModeUnavailableModal from "../components/ModeUnavailableModal";
import { formatPhoneNumber } from "../constants/api";

export default function ProfileScreen() {
  const router = useRouter();
  const {
    customerUser,
    selectedSupermarket,
    setSelectedSupermarket,
    purchaseMode,
    setPurchaseMode,
    logoutCustomer,
  } = useCart();

  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [unavailableModal, setUnavailableModal] = useState({
    visible: false,
    mode: "Online",
    storeName: "",
  });

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out from your customer account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            logoutCustomer();
            router.replace("/");
          },
        },
      ]
    );
  };

  const handleStoreSelect = (store: SupermarketInfo) => {
    const mode = (purchaseMode || "online") as "online" | "offline";
    const isAllowed =
      mode === "online" ? store.onlineAvailable === true : store.offlineAvailable === true;

    if (!isAllowed) {
      setSearchModalVisible(false);
      setUnavailableModal({
        visible: true,
        mode: mode === "online" ? "Online" : "Offline",
        storeName: store.name,
      });
      return;
    }

    setSelectedSupermarket(store);
    setSearchModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/")}
          activeOpacity={0.7}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{"My Profile & Store"}</Text>

        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={{ fontSize: 32 }}>👤</Text>
          </View>
          <Text style={styles.userName}>
            {customerUser?.name || "Guest Smart Shopper"}
          </Text>
          <Text style={styles.userPhone}>
            {customerUser?.phone ? formatPhoneNumber(customerUser.phone) : "No account registered"}
          </Text>

          <View style={styles.loyaltyBadge}>
            <Text style={styles.loyaltyBadgeText}>
              {customerUser ? "★ CONNECTED ONLINE MEMBER" : "★ GUEST IN-STORE SHOPPER"}
            </Text>
          </View>
        </View>

        {/* Connected Supermarket Tenant Card */}
        <View style={styles.menuCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.menuSectionTitle}>Connected Supermarket</Text>
            <TouchableOpacity
              onPress={() => setSearchModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.switchLocationText}>Change Location</Text>
            </TouchableOpacity>
          </View>

          {selectedSupermarket ? (
            <View style={styles.storeCardInner}>
              <View style={styles.storeIconWrap}>
                <Text style={{ fontSize: 22 }}>🏪</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.storeNameText}>{selectedSupermarket.name}</Text>
                <Text style={styles.storeLocationText}>
                  📍 {selectedSupermarket.city || "Bangalore"} • Code: {selectedSupermarket.code}
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.chooseStoreBtn}
              onPress={() => setSearchModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.chooseStoreBtnText}>
                🔍 Search and Select Supermarket Location
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Purchase Mode & Navigation Links */}
        <View style={styles.menuCard}>
          <Text style={styles.menuSectionTitle}>Purchase Workflows</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setPurchaseMode("online");
              if (selectedSupermarket && customerUser) {
                router.push("/catalog");
              } else {
                router.push("/auth");
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>🛍️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Online Supermarket Store</Text>
              <Text style={styles.menuSub}>
                Browse {selectedSupermarket?.name || "store"} catalog products
              </Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setPurchaseMode("offline");
              router.push("/scanner");
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>📷</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>In-Store Barcode Scanner</Text>
              <Text style={styles.menuSub}>Scan items on store shelves</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/orders")}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>{"Order Receipts & History"}</Text>
              <Text style={styles.menuSub}>View gate exit passes</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Account Actions */}
        <View style={styles.menuCard}>
          <Text style={styles.menuSectionTitle}>Customer Account</Text>

          {customerUser ? (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>🚪</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuTitle, { color: "#DC2626" }]}>
                  Sign Out of Account
                </Text>
                <Text style={styles.menuSub}>Switch account or clear session</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/auth")}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>🔐</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuTitle, { color: "#4338CA" }]}>
                  Sign In / Register
                </Text>
                <Text style={styles.menuSub}>
                  Connect account to preferred supermarket
                </Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          )}

          {/* Dedicated Delivery Staff Portal Link */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/delivery-login")}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>🚚</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: "#0284C7" }]}>
                Delivery Staff Portal
              </Text>
              <Text style={styles.menuSub}>
                Delivery personnel sign in & order dispatches
              </Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.appVersionText}>
          GrocerEase Mobile App • Strict Multi-Tenant Isolation
        </Text>
      </ScrollView>

      {/* Bottom Nav */}
      <CustomerBottomNav activeTab="profile" />

      {/* Supermarket Search Modal */}
      <SupermarketSearchModal
        visible={searchModalVisible}
        mode={(purchaseMode || "online") as any}
        title="Search Supermarket Location"
        onSelect={handleStoreSelect}
        onUnavailableSelected={(store) => {
          setSearchModalVisible(false);
          setUnavailableModal({
            visible: true,
            mode: purchaseMode === "offline" ? "Offline" : "Online",
            storeName: store.name,
          });
        }}
        onClose={() => setSearchModalVisible(false)}
      />

      {/* Mode Unavailable Modal */}
      <ModeUnavailableModal
        visible={unavailableModal.visible}
        mode={unavailableModal.mode}
        supermarketName={unavailableModal.storeName}
        onClose={() =>
          setUnavailableModal({ visible: false, mode: "Online", storeName: "" })
        }
        onSelectAnother={() => {
          setUnavailableModal({ visible: false, mode: "Online", storeName: "" });
          setSearchModalVisible(true);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: Theme.cardBorder,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Theme.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: {
    fontSize: 26,
    color: Theme.primary,
    fontWeight: "300",
    lineHeight: 28,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: Theme.dark,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 80,
  },
  profileCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Theme.cardBorder,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EEF2FF",
    borderWidth: 2,
    borderColor: "#C7D2FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: "900",
    color: Theme.dark,
  },
  userPhone: {
    fontSize: 13,
    color: Theme.gray,
    fontWeight: "600",
    marginTop: 2,
  },
  loyaltyBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  loyaltyBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#B45309",
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.cardBorder,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  menuSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Theme.dark,
  },
  switchLocationText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#4338CA",
  },
  storeCardInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  storeIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  storeNameText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  storeLocationText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    marginBottom: 6,
  },
  pillsRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  pillGreen: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
  },
  pillGreenText: {
    color: "#15803D",
  },
  pillRed: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  pillRedText: {
    color: "#991B1B",
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  chooseStoreBtn: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1.5,
    borderColor: "#C7D2FE",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  chooseStoreBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4338CA",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
    gap: 12,
  },
  menuIcon: {
    fontSize: 20,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.dark,
  },
  menuSub: {
    fontSize: 11.5,
    color: Theme.gray,
    marginTop: 1,
  },
  menuArrow: {
    fontSize: 20,
    color: Theme.gray,
  },
  appVersionText: {
    textAlign: "center",
    fontSize: 11,
    color: Theme.gray,
    marginTop: 10,
    marginBottom: 20,
  },
});
