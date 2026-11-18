import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCart, SupermarketInfo } from "../context/CartContext";
import { Theme } from "../constants/colors";
import ModeUnavailableModal from "../components/ModeUnavailableModal";
import SupermarketSearchModal from "../components/SupermarketSearchModal";

const PAYMENT_METHODS = [
  {
    id: "UPI",
    label: "UPI (PhonePe, GPay, Paytm)",
    icon: "UPI",
    iconBg: "#7C3AED",
  },
  {
    id: "Card",
    label: "Card Payment",
    icon: "💳",
    iconBg: "#0284C7",
  },
];

export default function CheckoutScreen() {
  const router = useRouter();
  const {
    cart,
    grossAmount,
    totalSavings,
    totalAmount,
    purchaseMode,
    selectedSupermarket,
    setSelectedSupermarket,
    verifySupermarketMode,
  } = useCart();

  const [selectedMethod, setSelectedMethod] = useState("UPI");
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [unavailableModal, setUnavailableModal] = useState<{
    visible: boolean;
    mode: string;
    storeName?: string;
  }>({
    visible: false,
    mode: "Offline",
    storeName: "",
  });

  const displayDiscount = totalSavings;
  const displayTotal = totalAmount;

  const handleSelectStoreFromModal = async (store: SupermarketInfo) => {
    const mode = (purchaseMode || "offline") as "online" | "offline";
    const check = await verifySupermarketMode(store, mode);

    if (!check.allowed) {
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

  const handleProceed = async () => {
    if (cart.length === 0) {
      Alert.alert("Empty Cart", "Please scan items before proceeding to checkout.");
      return;
    }

    const currentMode = (purchaseMode || "offline") as "online" | "offline";

    // Requirement: Before payment, ask the customer to search for and select the supermarket by its registered name
    if (!selectedSupermarket) {
      setSearchModalVisible(true);
      return;
    }

    // Strict Super Admin mode verification
    const check = await verifySupermarketMode(selectedSupermarket, currentMode);
    if (!check.allowed) {
      setUnavailableModal({
        visible: true,
        mode: currentMode === "online" ? "Online" : "Offline",
        storeName: selectedSupermarket.name,
      });
      return;
    }

    // Always navigate to the Customer Details page when clicking Pay Now
    router.push({
      pathname: "/customer-details",
      params: { method: selectedMethod },
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Deep Purple Top Header matching Screen 5 of reference */}
      <View style={styles.purpleHeader}>
        <SafeAreaView edges={["top"]} style={styles.headerSafe}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.headerBackArrow}>‹</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Checkout</Text>

            <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
              <Text style={styles.scissorIcon}>✂</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* Main Curved White Container Sheet matching Screen 5 */}
      <View style={styles.whiteSheet}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Supermarket In-Store Verification Card */}
          <View style={styles.storeSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {purchaseMode === "online" ? "Online Supermarket" : "Supermarket Verification"}
              </Text>
              <TouchableOpacity
                onPress={() => setSearchModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.changeLinkText}>
                  {selectedSupermarket ? "Change Store" : "Select Store"}
                </Text>
              </TouchableOpacity>
            </View>

            {selectedSupermarket ? (
              <View style={styles.storeCard}>
                <View style={styles.storeCardIcon}>
                  <Text style={{ fontSize: 22 }}>🏪</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.storeNameText}>{selectedSupermarket.name}</Text>
                  <Text style={styles.storeCodeText}>
                    📍 {selectedSupermarket.city || "Bangalore"} • Code: {selectedSupermarket.code}
                  </Text>
                  <View style={styles.storeStatusBadge}>
                    <Text style={styles.storeStatusBadgeText}>
                      ✓ {purchaseMode === "online" ? "Online Purchase Verified" : "Offline Checkout Verified"}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.selectStorePrompt}
                onPress={() => setSearchModalVisible(true)}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 24 }}>🏪</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectStoreTitle}>
                    Select Supermarket by Registered Name <Text style={{ color: "#EF4444" }}>*</Text>
                  </Text>
                  <Text style={styles.selectStoreSub}>
                    Required before payment to link transaction exclusively to this store
                  </Text>
                </View>
                <Text style={styles.selectStoreArrow}>›</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Order Items Header matching Screen 5 */}
          <Text style={styles.sectionTitle}>Order Items ({cart.length})</Text>

          <View style={styles.itemsList}>
            {cart.map((item) => (
              <View key={item._id} style={styles.itemRow}>
                {/* Rounded product thumbnail */}
                <View style={styles.itemThumbBox}>
                  <Image
                    source={
                      item.imageUrl
                        ? { uri: item.imageUrl }
                        : require("@/assets/images/react-logo.png")
                    }
                    style={styles.itemThumb as any}
                    resizeMode="contain"
                  />
                </View>

                {/* Name & Qty */}
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemQtyPrice}>
                    ₹{Number(item.effectivePrice || 0).toFixed(2)}   x{item.quantity}
                  </Text>
                </View>

                {/* Row Total */}
                <Text style={styles.itemTotal}>
                  ₹{Number(item.effectivePrice * item.quantity || 0).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          {/* Price Breakdown matching Screen 5 */}
          <View style={styles.breakdownBox}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Subtotal</Text>
              <Text style={styles.breakdownValue}>₹{Number(grossAmount || 0).toFixed(2)}</Text>
            </View>

            {displayDiscount > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.discountLabel}>Discount</Text>
                <Text style={styles.discountValue}>−₹{Number(displayDiscount || 0).toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.breakdownRowTotal}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₹{Number(displayTotal || 0).toFixed(2)}</Text>
            </View>
          </View>

          {/* Payment Method Section matching Screen 5 */}
          <Text style={styles.sectionTitle}>Payment Method</Text>

          {/* Single Enclosed Card for Payment Options matching Screen 5 */}
          <View style={styles.paymentCard}>
            {PAYMENT_METHODS.map((method, index) => {
              const isSelected = selectedMethod === method.id;
              const isLast = index === PAYMENT_METHODS.length - 1;

              return (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.methodRow,
                    isSelected && styles.methodRowSelected,
                    !isLast && styles.methodRowDivider,
                  ]}
                  onPress={() => setSelectedMethod(method.id)}
                  activeOpacity={0.8}
                >
                  {/* Radio Indicator */}
                  <View
                    style={[
                      styles.radioOuter,
                      isSelected && styles.radioOuterSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioInner} />}
                  </View>

                  {/* Payment Method Icon Badge on Left */}
                  <View style={styles.methodIconBadge}>
                    {method.id === "UPI" ? (
                      <View style={styles.upiBadge}>
                        <Text style={styles.upiBadgeText}>UPI</Text>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 18 }}>{method.icon}</Text>
                    )}
                  </View>

                  {/* Label */}
                  <Text
                    style={[
                      styles.methodLabel,
                      isSelected && styles.methodLabelSelected,
                    ]}
                  >
                    {method.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Pay Now Button with White Padlock matching Screen 5 */}
          <TouchableOpacity
            style={styles.payNowBtn}
            onPress={handleProceed}
            activeOpacity={0.88}
          >
            <View style={styles.payBtnContent}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.payNowText}>
                Pay Now ₹{Number(displayTotal || 0).toFixed(2)}
              </Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Supermarket Search Modal */}
      <SupermarketSearchModal
        visible={searchModalVisible}
        mode={(purchaseMode || "offline") as any}
        title="Search Supermarket by Registered Name"
        subtitle="Select the store where items are being purchased"
        onSelect={handleSelectStoreFromModal}
        onUnavailableSelected={(store) => {
          setSearchModalVisible(false);
          setUnavailableModal({
            visible: true,
            mode: purchaseMode === "online" ? "Online" : "Offline",
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
          setUnavailableModal({ visible: false, mode: "Offline", storeName: "" })
        }
        onSelectAnother={() => {
          setUnavailableModal({ visible: false, mode: "Offline", storeName: "" });
          setSearchModalVisible(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2E0854",
  },
  purpleHeader: {
    backgroundColor: "#2E0854",
    paddingBottom: 24,
  },
  headerSafe: {
    backgroundColor: "#2E0854",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBackArrow: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "300",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  scissorIcon: {
    color: "#FFFFFF",
    fontSize: 18,
  },
  whiteSheet: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -16,
    overflow: "hidden",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 40,
  },
  storeSection: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  changeLinkText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#4338CA",
  },
  storeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#BBF7D0",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  storeCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
  },
  storeNameText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  storeCodeText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  storeStatusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  storeStatusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#15803D",
  },
  selectStorePrompt: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectStoreTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  selectStoreSub: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
  selectStoreArrow: {
    fontSize: 24,
    color: "#94A3B8",
    fontWeight: "300",
  },
  itemsList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  itemThumbBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  itemThumb: {
    width: 40,
    height: 40,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E1B4B",
    marginBottom: 4,
  },
  itemQtyPrice: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  breakdownBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  breakdownLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  breakdownValue: {
    fontSize: 13,
    color: "#1E1B4B",
    fontWeight: "700",
  },
  discountLabel: {
    fontSize: 13,
    color: "#059669",
    fontWeight: "600",
  },
  discountValue: {
    fontSize: 13,
    color: "#059669",
    fontWeight: "700",
  },
  breakdownRowTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E1B4B",
  },
  paymentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginTop: 8,
    marginBottom: 26,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  methodRowSelected: {
    backgroundColor: "#FAFAFA",
  },
  methodRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  radioOuterSelected: {
    borderColor: "#3B0764",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3B0764",
  },
  methodIconBadge: {
    marginRight: 12,
  },
  upiBadge: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  upiBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  methodLabelSelected: {
    color: "#1E1B4B",
    fontWeight: "700",
  },
  payNowBtn: {
    backgroundColor: "#F6BC45",
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F6BC45",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  payBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lockIcon: {
    fontSize: 16,
  },
  payNowText: {
    color: "#2E0854",
    fontSize: 16,
    fontWeight: "900",
  },
});
