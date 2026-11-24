import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCart } from "../context/CartContext";
import { Theme } from "../constants/colors";
import { API_URL, safeFetch } from "../constants/api";

// 5 Official Supermarket Pickup Time Slots
export type PickupSlot = {
  id: string;
  label: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
};

export const OFFICIAL_PICKUP_SLOTS: PickupSlot[] = [
  { id: "slot-1", label: "10:00 AM – 12:00 PM", startHour: 10, startMin: 0, endHour: 12, endMin: 0 },
  { id: "slot-2", label: "12:00 PM – 2:00 PM", startHour: 12, startMin: 0, endHour: 14, endMin: 0 },
  { id: "slot-3", label: "2:00 PM – 4:00 PM", startHour: 14, startMin: 0, endHour: 16, endMin: 0 },
  { id: "slot-4", label: "4:00 PM – 6:00 PM", startHour: 16, startMin: 0, endHour: 18, endMin: 0 },
  { id: "slot-5", label: "6:00 PM – 8:00 PM", startHour: 18, startMin: 0, endHour: 20, endMin: 0 },
];

export const getPickupSlotStatus = (slot: PickupSlot, dateChoice: string) => {
  const isToday = dateChoice === "Today";
  if (!isToday) {
    return { available: true, reason: "Available", isOngoing: false, isEnded: false };
  }

  const now = new Date();
  const currentTotalMins = now.getHours() * 60 + now.getMinutes();
  const startTotalMins = slot.startHour * 60 + slot.startMin;
  const endTotalMins = slot.endHour * 60 + slot.endMin;

  // 1. Slot has already ended: past end time
  if (currentTotalMins >= endTotalMins) {
    return { available: false, reason: "Slot Ended", isOngoing: false, isEnded: true };
  }

  // 2. Ongoing slot: currently between start and end
  if (currentTotalMins >= startTotalMins && currentTotalMins < endTotalMins) {
    const remainingMins = endTotalMins - currentTotalMins;
    if (remainingMins < 15) {
      return { available: false, reason: "Closing Soon", isOngoing: true, isEnded: false };
    }
    return { available: true, reason: "Ongoing (Available)", isOngoing: true, isEnded: false };
  }

  // 3. Future slot: start time is ahead of current time
  return { available: true, reason: "Available", isOngoing: false, isEnded: false };
};

export default function CheckoutScreen() {
  const router = useRouter();
  const {
    cart,
    totalCount,
    grossAmount,
    totalSavings,
    totalAmount,
    customerInfo,
    customerUser,
    isAuthLoading,
    updateCustomerDetails,
    selectedSupermarket,
    setSelectedSupermarket,
    purchaseMode,
    fulfillmentType,
    setFulfillmentType,
  } = useCart();

  // Resolved Customer details
  const initialName = (customerUser?.name || customerInfo?.name || "").trim();
  const initialPhone = (customerUser?.phone || customerInfo?.phone || "").replace(/\D/g, "").slice(-10);
  const initialAddress = (customerUser?.address || customerInfo?.address || "").trim();

  // Mandatory Authentication Guard for Online Checkout
  // Waits for session to finish restoring before evaluating
  useEffect(() => {
    if (isAuthLoading) return;
    if (purchaseMode === "online" && (!customerUser || !customerUser.token)) {
      router.replace({ pathname: "/auth", params: { tab: "register" } });
    }
  }, [isAuthLoading, purchaseMode, customerUser]);

  // Live real-time sync of supermarket channel settings from database
  useEffect(() => {
    const smId = selectedSupermarket?._id || customerUser?.supermarketId;
    if (!smId || !API_URL) return;

    safeFetch(`${API_URL}/supermarkets/${smId}/availability`, {}, 4000)
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data.supermarket) {
          const s = data.supermarket;
          setSelectedSupermarket({
            ...selectedSupermarket,
            _id: String(s._id || smId),
            name: s.name || selectedSupermarket?.name || "Supermarket",
            code: s.code || selectedSupermarket?.code || "",
            onlineDeliveryAvailable: s.onlineDeliveryAvailable === true,
            selfPickupAvailable: s.selfPickupAvailable === true,
            onlineAvailable: s.onlineAvailable === true,
            offlineAvailable: s.offlineAvailable === true,
            city: s.city || selectedSupermarket?.city,
            address: s.address || selectedSupermarket?.address,
          });
        }
      })
      .catch((_) => {});
  }, [selectedSupermarket?._id, customerUser?.supermarketId]);

  const [selectedMethod, setSelectedMethod] = useState<"UPI" | "Card">("UPI");

  // Edit details modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(initialName);
  const [editPhone, setEditPhone] = useState(initialPhone);
  const [editAddress, setEditAddress] = useState(initialAddress);
  const [savingDetails, setSavingDetails] = useState(false);

  // Self Pickup Date & Time Slot selection
  const [pickupDate, setPickupDate] = useState("Today");
  const [pickupTimeSlot, setPickupTimeSlot] = useState<string>(() => {
    const firstAvail = OFFICIAL_PICKUP_SLOTS.find((s) => getPickupSlotStatus(s, "Today").available);
    return firstAvail ? firstAvail.label : "";
  });

  // Keep pickup slot synchronized with selected date and current time
  useEffect(() => {
    const isCurrentValid = OFFICIAL_PICKUP_SLOTS.some(
      (s) =>
        (s.label === pickupTimeSlot || s.label.replace("–", "-") === pickupTimeSlot.replace("–", "-")) &&
        getPickupSlotStatus(s, pickupDate).available
    );
    if (!isCurrentValid) {
      const nextAvail = OFFICIAL_PICKUP_SLOTS.find((s) => getPickupSlotStatus(s, pickupDate).available);
      setPickupTimeSlot(nextAvail ? nextAvail.label : "");
    }
  }, [pickupDate]);

  // Check store availability saved by Super Admin
  const isDeliverySupported =
    selectedSupermarket?.onlineDeliveryAvailable === true;
  const isPickupSupported =
    selectedSupermarket?.selfPickupAvailable === true;
  const isOnlineOrderAvailable = isDeliverySupported || isPickupSupported;

  // Selected fulfillment method
  const effectiveFulfillment =
    fulfillmentType === "SELF_PICKUP" ? "SELF_PICKUP" : "DELIVERY";

  const handleSaveDetails = async () => {
    const cleanP = editPhone.replace(/\D/g, "").slice(-10);
    if (!editName.trim()) {
      Alert.alert("Missing Name", "Please enter your full name.");
      return;
    }
    if (cleanP.length !== 10) {
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit mobile number.");
      return;
    }

    setSavingDetails(true);
    try {
      await updateCustomerDetails({
        name: editName.trim(),
        phone: cleanP,
        address: editAddress.trim(),
      });
      setIsEditModalOpen(false);
    } catch (_) {
      Alert.alert("Notice", "Updated locally for this order.");
      setIsEditModalOpen(false);
    } finally {
      setSavingDetails(false);
    }
  };

  const handleProceedToPayment = () => {
    if (cart.length === 0) {
      Alert.alert("Empty Cart", "Your cart is empty. Please add items before checking out.");
      return;
    }

    if (!isOnlineOrderAvailable) {
      Alert.alert(
        "Online Orders Disabled",
        "This supermarket is currently not accepting online orders (neither Delivery nor Self Pickup is enabled by Super Admin). Please select another supermarket."
      );
      return;
    }

    const finalName = (customerUser?.name || customerInfo?.name || editName).trim();
    const rawP = (customerUser?.phone || customerInfo?.phone || editPhone).replace(/\D/g, "");
    const finalPhone = rawP.slice(-10);
    const finalAddress = (customerUser?.address || customerInfo?.address || editAddress).trim();
    const finalEmail = (customerUser?.email || "").trim().toLowerCase();

    if (!finalName || finalPhone.length !== 10) {
      Alert.alert("Customer Details Required", "Please review and confirm your name and mobile number.", [
        { text: "Update Details", onPress: () => setIsEditModalOpen(true) },
      ]);
      return;
    }

    if (effectiveFulfillment === "DELIVERY" && !finalAddress) {
      Alert.alert("Delivery Address Needed", "Please enter your delivery address for doorstep delivery.", [
        { text: "Add Address", onPress: () => setIsEditModalOpen(true) },
      ]);
      return;
    }

    if (effectiveFulfillment === "SELF_PICKUP") {
      if (!pickupTimeSlot) {
        Alert.alert(
          "Pickup Slot Required",
          "All pickup slots for today have ended. Please select Tomorrow or another date above to book your collection slot."
        );
        return;
      }

      const chosenSlot = OFFICIAL_PICKUP_SLOTS.find(
        (s) => s.label === pickupTimeSlot || s.label.replace("–", "-") === pickupTimeSlot.replace("–", "-")
      );
      if (chosenSlot) {
        const slotStatus = getPickupSlotStatus(chosenSlot, pickupDate);
        if (!slotStatus.available) {
          Alert.alert(
            "Slot Unavailable",
            `The selected slot "${pickupTimeSlot}" is ${slotStatus.reason.toLowerCase()}. Please select an available upcoming time slot.`
          );
          return;
        }
      }
    }

    router.push({
      pathname: "/payment",
      params: {
        method: selectedMethod,
        customerName: finalName,
        customerPhone: finalPhone,
        customerEmail: finalEmail,
        customerAddress: finalAddress,
        customerId: customerUser?._id,
        fulfillmentType: effectiveFulfillment,
        pickupDate: effectiveFulfillment === "SELF_PICKUP" ? pickupDate : "",
        pickupTimeSlot: effectiveFulfillment === "SELF_PICKUP" ? pickupTimeSlot : "",
      },
    });
  };

  const displayName = customerUser?.name || customerInfo?.name || "Shopper";
  const rawP = (customerUser?.phone || customerInfo?.phone || "").replace(/\D/g, "");
  const displayPhone = rawP.length === 10 ? `+91 ${rawP.slice(0, 5)} ${rawP.slice(5)}` : (rawP ? `+91 ${rawP}` : "Not provided");
  const displayAddress = customerUser?.address || customerInfo?.address || "No address provided";

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Order Checkout</Text>
            <Text style={styles.headerSubtitle}>Review details & fulfillment</Text>
          </View>
          <View style={styles.headerPlaceholder} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Connected Supermarket Banner Card */}
        {selectedSupermarket ? (
          <View style={styles.storeCard}>
            <View style={styles.storeIconBox}>
              <Text style={styles.storeIconText}>🏪</Text>
            </View>
            <View style={styles.storeInfo}>
              <Text style={styles.storeName}>{selectedSupermarket.name}</Text>
              <Text style={styles.storeLocation}>
                📍 {selectedSupermarket.city || "Bangalore"}{" "}
                {selectedSupermarket.code ? `• ${selectedSupermarket.code}` : ""}
              </Text>
            </View>
            <View style={styles.verifiedStoreBadge}>
              <Text style={styles.verifiedStoreBadgeText}>Verified Store</Text>
            </View>
          </View>
        ) : null}

        {/* Fulfillment Method Selection - Both Collect from Store and Home Delivery always available */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Fulfillment Method</Text>
          <Text style={styles.sectionSubtitle}>
            Please select your preferred fulfillment option:
          </Text>

          <View style={styles.fulfillmentRow}>
            {/* Option 1 – Collect from Store */}
            <TouchableOpacity
              style={[
                styles.fulfillmentOption,
                effectiveFulfillment === "SELF_PICKUP" && styles.fulfillmentOptionActive,
              ]}
              onPress={() => setFulfillmentType("SELF_PICKUP")}
              activeOpacity={0.8}
            >
              <View style={styles.fulfillmentIconCircle}>
                <Text style={styles.fulfillmentEmoji}>🏬</Text>
              </View>
              <Text
                style={[
                  styles.fulfillmentLabel,
                  effectiveFulfillment === "SELF_PICKUP" && styles.fulfillmentLabelActive,
                ]}
              >
                Option 1 – Collect from Store
              </Text>
              <Text style={styles.fulfillmentHint}>Collect personally from store</Text>
              {effectiveFulfillment === "SELF_PICKUP" && (
                <View style={styles.activeCheckmark}>
                  <Text style={styles.activeCheckmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Option 2 – Home Delivery (Delivery Button) */}
            <TouchableOpacity
              style={[
                styles.fulfillmentOption,
                effectiveFulfillment === "DELIVERY" && styles.fulfillmentOptionActive,
              ]}
              onPress={() => setFulfillmentType("DELIVERY")}
              activeOpacity={0.8}
            >
              <View style={styles.fulfillmentIconCircle}>
                <Text style={styles.fulfillmentEmoji}>🚚</Text>
              </View>
              <Text
                style={[
                  styles.fulfillmentLabel,
                  effectiveFulfillment === "DELIVERY" && styles.fulfillmentLabelActive,
                ]}
              >
                Option 2 – Home Delivery
              </Text>
              <Text style={styles.fulfillmentHint}>Receive at delivery address</Text>
              {effectiveFulfillment === "DELIVERY" && (
                <View style={styles.activeCheckmark}>
                  <Text style={styles.activeCheckmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Self Pickup: Date & Time Slot Picker */}
        {effectiveFulfillment === "SELF_PICKUP" && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>📅 Pickup Date & Time Slot</Text>
                <Text style={styles.sectionSubtitle}>Choose when you will collect your order</Text>
              </View>
            </View>

            {/* Date Selector */}
            <Text style={styles.slotGroupLabel}>Collection Date</Text>
            <View style={styles.slotGrid}>
              {[
                { label: "Today", sub: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" }) },
                { label: "Tomorrow", sub: new Date(Date.now() + 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) },
                { label: "Day After", sub: new Date(Date.now() + 172800000).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) },
              ].map((d) => (
                <TouchableOpacity
                  key={d.label}
                  style={[styles.dateChip, pickupDate === d.label && styles.dateChipActive]}
                  onPress={() => setPickupDate(d.label)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dateChipLabel, pickupDate === d.label && styles.dateChipLabelActive]}>
                    {d.label}
                  </Text>
                  <Text style={[styles.dateChipSub, pickupDate === d.label && styles.dateChipSubActive]}>
                    {d.sub}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Time Slot Selector with Real-Time Validation */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, marginBottom: 6 }}>
              <Text style={styles.slotGroupLabel}>Pickup Time Slot (2-Hour Window)</Text>
              <Text style={styles.slotLiveBadge}>● Live Validation</Text>
            </View>

            {pickupDate === "Today" && OFFICIAL_PICKUP_SLOTS.every((s) => !getPickupSlotStatus(s, "Today").available) ? (
              <View style={styles.noSlotsBanner}>
                <Text style={styles.noSlotsBannerText}>
                  ⚠️ All pickup slots for Today have ended. Please select "Tomorrow" above to book your collection slot.
                </Text>
              </View>
            ) : (
              <View style={styles.slotsRow}>
                {OFFICIAL_PICKUP_SLOTS.map((slot) => {
                  const status = getPickupSlotStatus(slot, pickupDate);
                  const isSelected =
                    pickupTimeSlot === slot.label ||
                    pickupTimeSlot.replace("–", "-") === slot.label.replace("–", "-");
                  const isDisabled = !status.available;

                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[
                        styles.slotChip,
                        isSelected && styles.slotChipActive,
                        isDisabled && styles.slotChipDisabled,
                      ]}
                      onPress={() => {
                        if (isDisabled) {
                          Alert.alert(
                            "Slot Unavailable",
                            `This pickup time slot is ${status.reason.toLowerCase()} and cannot be booked.`
                          );
                          return;
                        }
                        setPickupTimeSlot(slot.label);
                      }}
                      disabled={isDisabled}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                        <Text
                          style={[
                            styles.slotChipText,
                            isSelected && styles.slotChipTextActive,
                            isDisabled && styles.slotChipTextDisabled,
                          ]}
                        >
                          ⏰ {slot.label}
                        </Text>
                        <Text
                          style={[
                            styles.slotStatusTag,
                            isSelected && styles.slotStatusTagActive,
                            isDisabled && styles.slotStatusTagDisabled,
                          ]}
                        >
                          {status.reason}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Customer Details Summary (Collected once, never asked repeatedly) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Customer & Delivery Details</Text>
              <Text style={styles.sectionSubtitle}>
                Retrieved securely from your account
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => {
                setEditName(initialName);
                setEditPhone(initialPhone);
                setEditAddress(initialAddress);
                setIsEditModalOpen(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.editBtnText}>Edit ✏️</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Recipient</Text>
              <Text style={styles.detailValue}>{displayName}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Mobile</Text>
              <Text style={styles.detailValue}>{displayPhone}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={[styles.detailValue, { flex: 1, textAlign: "right" }]} numberOfLines={2}>
                {displayAddress}
              </Text>
            </View>
          </View>

          {effectiveFulfillment === "DELIVERY" && !displayAddress && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ Please tap Edit to provide your delivery street address.
              </Text>
            </View>
          )}
        </View>

        {/* Order Items Summary */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Items ({totalCount})</Text>
            <TouchableOpacity onPress={() => router.push("/cart")} activeOpacity={0.7}>
              <Text style={styles.viewCartLink}>View Cart →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.itemsList}>
            {cart.slice(0, 4).map((it) => (
              <View key={it._id} style={styles.itemRow}>
                <View style={styles.itemNameCol}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {it.name}
                  </Text>
                  <Text style={styles.itemMeta}>Qty: {it.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>
                  ₹{(it.effectivePrice * it.quantity).toFixed(2)}
                </Text>
              </View>
            ))}
            {cart.length > 4 && (
              <Text style={styles.moreItemsText}>
                + {cart.length - 4} more items in cart
              </Text>
            )}
          </View>
        </View>

        {/* Payment Method Selector */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <Text style={styles.sectionSubtitle}>
            Select your preferred secure payment option
          </Text>

          <View style={styles.paymentMethodsRow}>
            <TouchableOpacity
              style={[
                styles.methodOption,
                selectedMethod === "UPI" && styles.methodOptionActive,
              ]}
              onPress={() => setSelectedMethod("UPI")}
              activeOpacity={0.8}
            >
              <Text style={styles.methodEmoji}>⚡</Text>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>UPI / QR Pay</Text>
                <Text style={styles.methodSub}>GPay, PhonePe, Paytm</Text>
              </View>
              {selectedMethod === "UPI" && (
                <View style={styles.radioDot}>
                  <View style={styles.radioDotInner} />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.methodOption,
                selectedMethod === "Card" && styles.methodOptionActive,
              ]}
              onPress={() => setSelectedMethod("Card")}
              activeOpacity={0.8}
            >
              <Text style={styles.methodEmoji}>💳</Text>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>Credit / Debit Card</Text>
                <Text style={styles.methodSub}>Visa, MasterCard, RuPay</Text>
              </View>
              {selectedMethod === "Card" && (
                <View style={styles.radioDot}>
                  <View style={styles.radioDotInner} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Bill Summary */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Bill Breakdown</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total</Text>
            <Text style={styles.billVal}>₹{grossAmount.toFixed(2)}</Text>
          </View>

          {totalSavings > 0 && (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: "#16A34A" }]}>
                Promotional Discount
              </Text>
              <Text style={[styles.billVal, { color: "#16A34A" }]}>
                - ₹{totalSavings.toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Fulfillment Fee</Text>
            <Text style={[styles.billVal, { color: "#16A34A" }]}>FREE</Text>
          </View>

          <View style={styles.billDivider} />

          <View style={styles.billRow}>
            <Text style={styles.billTotalLabel}>Grand Total</Text>
            <Text style={styles.billTotalVal}>₹{totalAmount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Space for bottom checkout button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarTotal}>
          <Text style={styles.bottomBarTotalLabel}>Total Payable</Text>
          <Text style={styles.bottomBarTotalVal}>₹{totalAmount.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.payBtn, !isOnlineOrderAvailable && { backgroundColor: "#94A3B8" }]}
          onPress={handleProceedToPayment}
          disabled={!isOnlineOrderAvailable}
          activeOpacity={0.85}
        >
          <Text style={styles.payBtnText}>
            {isOnlineOrderAvailable ? "Proceed to Pay →" : "Online Orders Disabled"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Edit Details Modal */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Customer Details</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="e.g. Rahul Sharma"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Mobile Number (10 Digits)</Text>
            <TextInput
              style={styles.input}
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
              maxLength={10}
              placeholder="e.g. 9876543210"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Delivery Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editAddress}
              onChangeText={setEditAddress}
              multiline
              numberOfLines={3}
              placeholder="Door No, Street Name, Area, City"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsEditModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveDetails}
                disabled={savingDetails}
              >
                <Text style={styles.saveBtnText}>
                  {savingDetails ? "Saving..." : "Save Details"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  headerSafe: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 20,
    color: "#0F172A",
    fontWeight: "700",
  },
  headerTitles: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  headerPlaceholder: {
    width: 38,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  storeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  storeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  storeIconText: {
    fontSize: 22,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  storeLocation: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  verifiedStoreBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedStoreBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#166534",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  editBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284C7",
  },
  fulfillmentRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  fulfillmentOption: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#FAFAFA",
    position: "relative",
  },
  fulfillmentOptionActive: {
    borderColor: "#059669",
    backgroundColor: "#F0FDF4",
  },
  fulfillmentIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  fulfillmentEmoji: {
    fontSize: 18,
  },
  fulfillmentLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  fulfillmentLabelActive: {
    color: "#065F46",
  },
  fulfillmentHint: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  activeCheckmark: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  activeCheckmarkText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  disabledOrderBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 14,
  },
  disabledOrderIcon: {
    fontSize: 24,
  },
  disabledOrderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#991B1B",
  },
  disabledOrderDesc: {
    fontSize: 12,
    color: "#B91C1C",
    marginTop: 2,
    lineHeight: 16,
  },
  slotGroupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  slotGrid: {
    flexDirection: "row",
    gap: 10,
  },
  dateChip: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  dateChipActive: {
    borderColor: "#059669",
    backgroundColor: "#ECFDF5",
  },
  dateChipLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  dateChipLabelActive: {
    color: "#065F46",
  },
  dateChipSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  dateChipSubActive: {
    color: "#047857",
    fontWeight: "600",
  },
  slotsRow: {
    flexDirection: "column",
    gap: 8,
  },
  slotChip: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#F8FAFC",
    width: "100%",
  },
  slotChipActive: {
    borderColor: "#059669",
    backgroundColor: "#ECFDF5",
  },
  slotChipDisabled: {
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
    opacity: 0.65,
  },
  slotChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  slotChipTextActive: {
    color: "#065F46",
    fontWeight: "800",
  },
  slotChipTextDisabled: {
    color: "#94A3B8",
    fontWeight: "500",
  },
  slotStatusTag: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#059669",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  slotStatusTagActive: {
    backgroundColor: "#059669",
    color: "#FFFFFF",
  },
  slotStatusTagDisabled: {
    backgroundColor: "#E2E8F0",
    color: "#64748B",
  },
  slotLiveBadge: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#059669",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  noSlotsBanner: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1.5,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  noSlotsBannerText: {
    fontSize: 12.5,
    color: "#92400E",
    fontWeight: "700",
    lineHeight: 18,
  },
  detailsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
  },
  detailDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  warningBox: {
    marginTop: 10,
    padding: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
  },
  warningText: {
    fontSize: 12,
    color: "#92400E",
    fontWeight: "600",
  },
  viewCartLink: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284C7",
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  itemNameCol: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 13,
    color: "#1E293B",
    fontWeight: "600",
  },
  itemMeta: {
    fontSize: 11,
    color: "#64748B",
  },
  itemPrice: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "700",
  },
  moreItemsText: {
    fontSize: 12,
    color: "#64748B",
    fontStyle: "italic",
    marginTop: 4,
  },
  paymentMethodsRow: {
    gap: 10,
    marginTop: 12,
  },
  methodOption: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#FFFFFF",
    gap: 12,
  },
  methodOptionActive: {
    borderColor: "#3B0764",
    backgroundColor: "#FAF5FF",
  },
  methodEmoji: {
    fontSize: 22,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  methodSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#3B0764",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3B0764",
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  billLabel: {
    fontSize: 13,
    color: "#64748B",
  },
  billVal: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
  },
  billDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 8,
  },
  billTotalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  billTotalVal: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  bottomBarTotal: {
    flex: 1,
  },
  bottomBarTotalLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  bottomBarTotalVal: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  payBtn: {
    backgroundColor: "#059669",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  payBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  modalCloseText: {
    fontSize: 18,
    color: "#64748B",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
  },
  textArea: {
    height: 70,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  cancelBtnText: {
    color: "#64748B",
    fontWeight: "600",
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#059669",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});

