import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Theme } from "../constants/colors";
import CustomerBottomNav from "../components/CustomerBottomNav";
import { useCart } from "../context/CartContext";
import { API_URL, safeFetch, formatPhoneNumber } from "../constants/api";

export default function ProfileScreen() {
  const router = useRouter();
  const {
    customerUser,
    selectedSupermarket,
    logoutCustomer,
    updateCustomerDetails,
  } = useCart();

  // Edit Profile Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(customerUser?.name || "");
  const [editEmail, setEditEmail] = useState(customerUser?.email || "");
  const [editAddress, setEditAddress] = useState(customerUser?.address || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState("");

  // Change Password/PIN Modal State
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState("");

  const handleOpenEditModal = () => {
    setEditName(customerUser?.name || "");
    setEditEmail(customerUser?.email || "");
    setEditAddress(customerUser?.address || "");
    setEditError("");
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || editName.trim().length < 2) {
      setEditError("Full name must be at least 2 characters.");
      return;
    }
    if (editEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editEmail.trim())) {
        setEditError("Please enter a valid email address.");
        return;
      }
    }
    if (!editAddress.trim()) {
      setEditError("Please enter a delivery address.");
      return;
    }

    setSavingProfile(true);
    setEditError("");
    try {
      await updateCustomerDetails({
        name: editName.trim(),
        email: editEmail.trim(),
        address: editAddress.trim(),
      });
      setEditModalVisible(false);
      Alert.alert("Profile Updated", "Your profile details have been saved successfully.");
    } catch (err: any) {
      setEditError(err?.message || "Failed to save profile. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenPinModal = () => {
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setPinError("");
    setPinSuccess("");
    setPinModalVisible(true);
  };

  const handleSavePin = async () => {
    setPinError("");
    setPinSuccess("");

    if (!newPin || newPin.trim().length < 4) {
      setPinError("New password or PIN must be at least 4 characters.");
      return;
    }
    if (newPin !== confirmPin) {
      setPinError("New PIN and Confirm PIN do not match.");
      return;
    }

    setSavingPin(true);
    try {
      if (!API_URL) throw new Error("API URL not configured");
      const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (customerUser?.token) reqHeaders["Authorization"] = `Bearer ${customerUser.token}`;

      const res = await safeFetch(`${API_URL}/auth/customer/profile`, {
        method: "PUT",
        headers: reqHeaders,
        body: JSON.stringify({
          customerId: customerUser?._id,
          phone: customerUser?.phone,
          currentPassword: currentPin.trim(),
          newPassword: newPin.trim(),
        }),
      }, 10000);

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to update password/PIN");
      }

      setPinSuccess("Password/PIN updated successfully!");
      setTimeout(() => {
        setPinModalVisible(false);
      }, 1500);
    } catch (err: any) {
      setPinError(err?.message || "Failed to update PIN. Please check current PIN.");
    } finally {
      setSavingPin(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out of SuperMart? Your customer session will be securely cleared.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: () => {
            logoutCustomer();
            router.replace("/");
          },
        },
      ]
    );
  };

  const isAuthenticated = Boolean(customerUser && customerUser.token);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (isAuthenticated) {
              router.replace("/catalog");
            } else {
              router.replace("/");
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>My Profile</Text>

        {isAuthenticated ? (
          <TouchableOpacity
            style={styles.headerEditBtn}
            onPress={handleOpenEditModal}
            activeOpacity={0.7}
          >
            <Text style={styles.headerEditBtnText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {isAuthenticated ? (
          <>
            {/* 1. Customer Hero Profile Card with Pastel Accents */}
            <View style={styles.heroProfileCard}>
              <View style={styles.avatarRow}>
                <View style={styles.avatarWrapper}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>
                      {customerUser?.name ? customerUser.name.charAt(0).toUpperCase() : "👤"}
                    </Text>
                  </View>
                  <View style={styles.verifiedDot} />
                </View>

                <View style={styles.heroDetails}>
                  <Text style={styles.heroName} numberOfLines={1}>
                    {customerUser?.name || "Customer"}
                  </Text>
                  <Text style={styles.heroPhone}>
                    📞 {customerUser?.phone ? formatPhoneNumber(customerUser.phone) : ""}
                  </Text>
                  {customerUser?.email ? (
                    <Text style={styles.heroEmail} numberOfLines={1}>
                      ✉️ {customerUser.email}
                    </Text>
                  ) : null}
                  <View style={styles.memberBadge}>
                    <Text style={styles.memberBadgeText}>✓ VERIFIED CUSTOMER</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 2. Connected Supermarket Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <View style={styles.sectionIconTitle}>
                  <View style={styles.sectionIconCircle}>
                    <Text style={{ fontSize: 16 }}>🏪</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Connected Supermarket</Text>
                </View>
                <View style={styles.verifiedStoreBadge}>
                  <Text style={styles.verifiedStoreBadgeText}>✓ REGISTERED</Text>
                </View>
              </View>

              <View style={styles.storeDetailBox}>
                <Text style={styles.storeName}>
                  {selectedSupermarket?.name || customerUser?.supermarketName || "SuperMart Store"}
                </Text>
                <Text style={styles.storeMeta}>
                  Code: {selectedSupermarket?.code || customerUser?.supermarketCode || "SM-ONLINE"}
                  {selectedSupermarket?.city ? ` • ${selectedSupermarket.city}` : ""}
                </Text>
                <View style={styles.onlineBadge}>
                  <Text style={styles.onlineBadgeText}>🟢 Online Ordering Active</Text>
                </View>
              </View>
            </View>

            {/* 3. Delivery Address Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <View style={styles.sectionIconTitle}>
                  <View style={styles.sectionIconCircle}>
                    <Text style={{ fontSize: 16 }}>📍</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Delivery Address</Text>
                </View>
                <TouchableOpacity onPress={handleOpenEditModal} activeOpacity={0.7}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.addressBox}>
                <Text style={styles.addressText}>
                  {customerUser?.address || "No delivery address set. Tap Edit to add your address."}
                </Text>
              </View>
            </View>

            {/* 4. Account Settings & Options */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitleSmall}>ACCOUNT SETTINGS</Text>

              <TouchableOpacity
                style={styles.menuRow}
                onPress={handleOpenEditModal}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: "#EDE9FE" }]}>
                  <Text style={{ fontSize: 16 }}>✏️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuRowTitle}>Edit Profile Information</Text>
                  <Text style={styles.menuRowSub}>Update your name, email and address</Text>
                </View>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuRow}
                onPress={handleOpenPinModal}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: "#EDE9FE" }]}>
                  <Text style={{ fontSize: 16 }}>🔒</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuRowTitle}>Change Password / PIN</Text>
                  <Text style={styles.menuRowSub}>Update security PIN used to sign in</Text>
                </View>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => router.push("/orders")}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: "#E0E7FF" }]}>
                  <Text style={{ fontSize: 16 }}>📋</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuRowTitle}>My Orders & Receipts</Text>
                  <Text style={styles.menuRowSub}>View order history and digital bills</Text>
                </View>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => router.push("/order-tracking")}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: "#DCFCE7" }]}>
                  <Text style={{ fontSize: 16 }}>🚚</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuRowTitle}>Live Delivery Tracking</Text>
                  <Text style={styles.menuRowSub}>Track active home deliveries in real time</Text>
                </View>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>
            </View>

            {/* 5. Secure Logout Button */}
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.85}
            >
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* Guest State: Prompt to Sign In */
          <View style={styles.guestCard}>
            <View style={styles.guestAvatar}>
              <Text style={{ fontSize: 36 }}>👤</Text>
            </View>
            <Text style={styles.guestTitle}>Sign In to SuperMart</Text>
            <Text style={styles.guestSub}>
              Access your personal account, saved delivery addresses, order history, and active tracking.
            </Text>
            <TouchableOpacity
              style={styles.guestSignInBtn}
              onPress={() => router.push({ pathname: "/auth", params: { tab: "login" } })}
              activeOpacity={0.88}
            >
              <Text style={styles.guestSignInBtnText}>Customer Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.guestRegisterBtn}
              onPress={() => router.push({ pathname: "/auth", params: { tab: "register" } })}
              activeOpacity={0.75}
            >
              <Text style={styles.guestRegisterBtnText}>New Customer? Create Account</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Customer Bottom Navigation Bar */}
      <CustomerBottomNav activeTab="profile" />

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Customer Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {editError ? <Text style={styles.modalError}>{editError}</Text> : null}

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your full name"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.modalInput}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="yourname@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Delivery Address</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={editAddress}
              onChangeText={setEditAddress}
              placeholder="Door/Flat No, Apartment, Street, Area"
              multiline
              numberOfLines={3}
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
                disabled={savingProfile}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Password/PIN Modal */}
      <Modal
        visible={pinModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPinModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password / PIN</Text>
              <TouchableOpacity onPress={() => setPinModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {pinError ? <Text style={styles.modalError}>{pinError}</Text> : null}
            {pinSuccess ? <Text style={styles.modalSuccess}>{pinSuccess}</Text> : null}

            <Text style={styles.inputLabel}>Current Password / PIN</Text>
            <TextInput
              style={styles.modalInput}
              value={currentPin}
              onChangeText={setCurrentPin}
              placeholder="Enter current PIN"
              secureTextEntry
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>New Password / PIN</Text>
            <TextInput
              style={styles.modalInput}
              value={newPin}
              onChangeText={setNewPin}
              placeholder="Enter new PIN (min 4 characters)"
              secureTextEntry
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Confirm New Password / PIN</Text>
            <TextInput
              style={styles.modalInput}
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="Confirm new PIN"
              secureTextEntry
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPinModalVisible(false)}
                disabled={savingPin}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSavePin}
                disabled={savingPin}
              >
                {savingPin ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Update PIN</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: {
    fontSize: 26,
    color: "#1E293B",
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  headerEditBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#EDE9FE",
  },
  headerEditBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7C3AED",
  },
  scrollContent: {
    padding: 16,
  },

  /* 1. Hero Profile Card */
  heroProfileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#EDE9FE",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrapper: {
    position: "relative",
    marginRight: 16,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#7C3AED",
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: "900",
    color: "#7C3AED",
  },
  verifiedDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#10B981",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
  },
  heroDetails: {
    flex: 1,
  },
  heroName: {
    fontSize: 19,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 2,
  },
  heroPhone: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 2,
  },
  heroEmail: {
    fontSize: 12.5,
    color: "#64748B",
    marginBottom: 6,
  },
  memberBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  memberBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 0.5,
  },

  /* Section Cards */
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionIconTitle: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#1E293B",
  },
  sectionCardTitleSmall: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  verifiedStoreBadge: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedStoreBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#7C3AED",
    letterSpacing: 0.5,
  },
  editLink: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7C3AED",
  },
  storeDetailBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  storeName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  storeMeta: {
    fontSize: 12.5,
    color: "#64748B",
    marginBottom: 6,
  },
  onlineBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  onlineBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7C3AED",
  },
  addressBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  addressText: {
    fontSize: 13.5,
    color: "#334155",
    lineHeight: 20,
  },

  /* Menu Rows */
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#F8FAFC",
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuRowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  menuRowSub: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 1,
  },
  menuChevron: {
    fontSize: 20,
    color: "#CBD5E1",
    marginLeft: 8,
  },

  /* Logout Button */
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginTop: 4,
  },
  logoutIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#DC2626",
  },

  /* Guest View */
  guestCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EDE9FE",
    marginTop: 20,
  },
  guestAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 6,
  },
  guestSub: {
    fontSize: 13.5,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  guestSignInBtn: {
    backgroundColor: "#7C3AED",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  guestSignInBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  guestRegisterBtn: {
    paddingVertical: 10,
  },
  guestRegisterBtnText: {
    color: "#7C3AED",
    fontSize: 13.5,
    fontWeight: "700",
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0F172A",
  },
  modalCloseText: {
    fontSize: 18,
    color: "#94A3B8",
    padding: 4,
  },
  modalError: {
    backgroundColor: "#FEF2F2",
    color: "#DC2626",
    padding: 10,
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: "600",
    marginBottom: 10,
  },
  modalSuccess: {
    backgroundColor: "#ECFDF5",
    color: "#059669",
    padding: 10,
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: "600",
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 5,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
  },
  modalTextArea: {
    height: 70,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    marginTop: 18,
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#7C3AED",
    alignItems: "center",
  },
  modalSaveBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
