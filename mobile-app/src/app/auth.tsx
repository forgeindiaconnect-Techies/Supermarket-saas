import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCart, SupermarketInfo } from "../context/CartContext";
import { API_URL, safeFetch } from "../constants/api";
import ModeUnavailableModal from "../components/ModeUnavailableModal";
import SupermarketSearchModal from "../components/SupermarketSearchModal";

export default function CustomerAuthScreen() {
  const router = useRouter();
  const {
    setCustomerUser,
    setSelectedSupermarket,
    setPurchaseMode,
    selectedSupermarket,
  } = useCart();

  const [activeTab, setActiveTab] = useState<"register" | "login">("register");

  // Form Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Store Selection State
  const [chosenStore, setChosenStore] = useState<SupermarketInfo | null>(
    selectedSupermarket || null
  );
  const [searchModalVisible, setSearchModalVisible] = useState(false);

  // Unavailable Modal State
  const [unavailableModal, setUnavailableModal] = useState<{
    visible: boolean;
    mode: string;
    storeName?: string;
  }>({
    visible: false,
    mode: "Online",
    storeName: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handlePhoneChange = (text: string) => {
    let cleaned = text.replace(/\D/g, "");
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
      cleaned = cleaned.slice(2);
    }
    cleaned = cleaned.slice(0, 10);
    setPhone(cleaned);
  };

  const handleSelectStoreFromModal = (store: SupermarketInfo) => {
    const isOnlineSupported =
      store.onlineDeliveryAvailable === true ||
      store.selfPickupAvailable === true ||
      store.onlineAvailable === true;

    if (!isOnlineSupported) {
      setSearchModalVisible(false);
      setUnavailableModal({
        visible: true,
        mode: "Online",
        storeName: store.name,
      });
      return;
    }

    setChosenStore(store);
    setSelectedSupermarket(store);
    setSearchModalVisible(false);
    setErrorMsg("");
  };

  const handleUnavailableStoreSelected = (store: SupermarketInfo) => {
    setSearchModalVisible(false);
    setUnavailableModal({
      visible: true,
      mode: "Online",
      storeName: store.name,
    });
  };

  const handleSubmit = async () => {
    setErrorMsg("");

    // Common phone validation
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length !== 10 || !["6", "7", "8", "9"].includes(cleanPhone[0])) {
      setErrorMsg("Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.");
      return;
    }

    // 1. REGISTRATION FLOW
    if (activeTab === "register") {
      if (!name.trim() || name.trim().length < 2) {
        setErrorMsg("Please enter your full name.");
        return;
      }

      const emailTrim = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailTrim || !emailRegex.test(emailTrim)) {
        setErrorMsg("Please enter a valid email address (e.g., name@example.com).");
        return;
      }

      if (!chosenStore) {
        setErrorMsg("Please search and select your preferred supermarket location.");
        setSearchModalVisible(true);
        return;
      }

      // Strict validation of Online availability
      const isOnlineSupported =
        chosenStore.onlineDeliveryAvailable === true ||
        chosenStore.selfPickupAvailable === true ||
        chosenStore.onlineAvailable === true;

      if (!isOnlineSupported) {
        setUnavailableModal({
          visible: true,
          mode: "Online",
          storeName: chosenStore.name,
        });
        return;
      }

      setLoading(true);
      try {
        if (!API_URL) throw new Error("API URL missing in configuration.");

        const res = await safeFetch(`${API_URL}/auth/customer/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            phone: cleanPhone,
            email: email.trim().toLowerCase(),
            password,
            address: address.trim(),
            supermarketId: chosenStore._id,
            supermarketCode: chosenStore.code,
            registrationType: "ONLINE",
          }),
        }, 8000);

        const data = await res.json();

        if (!res.ok || !data.success) {
          if (data.message && data.message.includes("does not currently support Online Purchase")) {
            setUnavailableModal({
              visible: true,
              mode: "Online",
              storeName: chosenStore.name,
            });
            return;
          }
          throw new Error(data.message || "Registration failed.");
        }

        // Connect customer permanently to selected supermarket
        setPurchaseMode("online");
        setSelectedSupermarket(data.supermarket || chosenStore);
        setCustomerUser({
          _id: data.customer?._id,
          name: data.customer?.name || name.trim(),
          phone: cleanPhone,
          email: data.customer?.email || email.trim().toLowerCase(),
          address: address.trim(),
          supermarketId: chosenStore._id,
          supermarketCode: chosenStore.code,
          supermarketName: chosenStore.name,
          registeredLocation: `${chosenStore.city}, ${chosenStore.state || ""}`.trim(),
          token: data.token,
        });

        // Redirect to Online Catalog
        router.replace("/catalog");
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to complete registration.");
      } finally {
        setLoading(false);
      }
    } else {
      // 2. SIGN IN FLOW
      setLoading(true);
      try {
        if (!API_URL) throw new Error("API URL missing in configuration.");

        const res = await safeFetch(`${API_URL}/auth/customer/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: cleanPhone,
            password,
          }),
        }, 8000);

        const data = await res.json();

        if (!res.ok || !data.success) {
          if (data.message && data.message.includes("does not currently support Online Purchase")) {
            setUnavailableModal({
              visible: true,
              mode: "Online",
              storeName: data.supermarket?.name || "Your Supermarket",
            });
            return;
          }
          throw new Error(data.message || "Login failed.");
        }

        const storeInfo: SupermarketInfo = data.supermarket || {
          _id: data.customer?.supermarketId,
          name: data.customer?.supermarketName || "Connected Store",
          code: data.customer?.supermarketCode || "",
          onlineAvailable: true,
        };

        setPurchaseMode("online");
        setSelectedSupermarket(storeInfo);
        setCustomerUser({
          _id: data.customer?._id,
          name: data.customer?.name || "Shopper",
          phone: cleanPhone,
          email: data.customer?.email || "",
          address: data.customer?.address || "",
          supermarketId: storeInfo._id,
          supermarketCode: storeInfo.code,
          supermarketName: storeInfo.name,
          registeredLocation: data.customer?.registeredLocation || "",
          token: data.token,
        });

        router.replace("/catalog");
      } catch (err: any) {
        setErrorMsg(err.message || "Login failed. Check your number.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <StatusBar style="light" />

        {/* Royal Electric Blue Top Header */}
        <View style={styles.blueHeader}>
          <SafeAreaView edges={["top"]} style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => router.replace("/")}
                activeOpacity={0.7}
              >
                <View style={styles.backBtnPill}>
                  <Text style={styles.backArrowText}>←</Text>
                  <Text style={styles.backLabelText}>Home</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerTitle}>Customer Portal</Text>
                <Text style={styles.headerSub}>
                  {activeTab === "register" ? "Create Account & Start Shopping" : "Sign In to Your Supermarket"}
                </Text>
              </View>

              <View style={{ width: 60 }} />
            </View>
          </SafeAreaView>
        </View>

        {/* White Sheet Container */}
        <View style={styles.whiteSheet}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Segmented Tab Bar: Register vs Sign In */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === "register" && styles.tabBtnActive]}
                onPress={() => {
                  setActiveTab("register");
                  setErrorMsg("");
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    activeTab === "register" && styles.tabBtnTextActive,
                  ]}
                >
                  Create Account
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === "login" && styles.tabBtnActive]}
                onPress={() => {
                  setActiveTab("login");
                  setErrorMsg("");
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    activeTab === "login" && styles.tabBtnTextActive,
                  ]}
                >
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>

            {/* Error Banner */}
            {errorMsg ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerIcon}>⚠️</Text>
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* 1. Customer Personal Details: Name, Mobile, Email */}
            {activeTab === "register" && (
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  Customer Name <Text style={styles.star}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            )}

            {/* Mobile Number (Mandatory for both Register & Login) */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>
                Mobile Number <Text style={styles.star}>*</Text>
              </Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCodeBox}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.phoneInput]}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={handlePhoneChange}
                />
              </View>
            </View>

            {/* Email Address (Mandatory for Online Registration) */}
            {activeTab === "register" && (
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  Email Address <Text style={styles.star}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. yourname@gmail.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            )}

            {/* 2. Selected Supermarket Display (Search bar completely removed per exact specification) */}
            {chosenStore && (
              <View style={styles.sectionWrap}>
                <Text style={styles.inputLabel}>Selected Supermarket</Text>
                <View style={styles.selectedStoreCard}>
                  <View style={styles.selectedStoreTop}>
                    <View style={styles.selectedStoreIcon}>
                      <Text style={{ fontSize: 20 }}>🏪</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectedStoreName}>{chosenStore.name}</Text>
                      <Text style={styles.selectedStoreLocation}>
                        📍 {chosenStore.city || "Bangalore"}, {chosenStore.state || "Karnataka"}
                      </Text>
                      <View style={styles.storeVerifiedBadge}>
                        <Text style={styles.storeVerifiedText}>
                          ✓ Online Purchase Enabled ({chosenStore.code})
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Delivery Address (for Online Orders) */}
            {activeTab === "register" && (
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Delivery Address (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.addressInput]}
                  placeholder="Apartment, Street, Area for doorstep delivery"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={2}
                  value={address}
                  onChangeText={setAddress}
                />
              </View>
            )}

            {/* Password / PIN */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>
                {activeTab === "register" ? "Create Password / PIN" : "Account Password / PIN"} <Text style={styles.star}>*</Text>
              </Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder={activeTab === "register" ? "Set a secure password" : "Enter your password"}
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={styles.toggleVisibilityBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.toggleVisibilityText}>
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Information Note */}
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxIcon}>🔒</Text>
              <Text style={styles.infoBoxText}>
                {activeTab === "register"
                  ? "Your account will be permanently connected to your selected supermarket. You will browse and purchase exclusively from their live stock."
                  : "Sign in to access your registered supermarket products, saved cart items, and order history."}
              </Text>
            </View>

            {/* Primary Action Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.btnContentRow}>
                  <Text style={styles.submitButtonText}>
                    {activeTab === "register" ? "Continue to Online Store" : "Sign In & Browse"}
                  </Text>
                  <Text style={styles.btnRightArrow}>→</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchTabLink}
              onPress={() => {
                setActiveTab(activeTab === "register" ? "login" : "register");
                setErrorMsg("");
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.switchTabText}>
                {activeTab === "register"
                  ? "Already have an account? Sign In"
                  : "Don't have an account? Create One"}
              </Text>
            </TouchableOpacity>

            {/* Dedicated Delivery Fleet Login Link */}
            <TouchableOpacity
              style={styles.deliveryFleetCardLink}
              onPress={() => router.push("/delivery-login")}
              activeOpacity={0.7}
            >
              <Text style={styles.deliveryFleetLinkText}>
                🚚 Delivery Personnel? <Text style={styles.deliveryFleetLinkBold}>Access Delivery Dashboard →</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Supermarket Location Search Modal */}
        <SupermarketSearchModal
          visible={searchModalVisible}
          mode="online"
          title="Search Supermarket Location"
          subtitle="Displaying registered supermarkets enabled by Super Admin"
          onSelect={handleSelectStoreFromModal}
          onUnavailableSelected={handleUnavailableStoreSelected}
          onClose={() => setSearchModalVisible(false)}
        />

        {/* Clear Unavailable Modal Warning required by user */}
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#4C1D95", // Unified Royal Purple Theme matching Reference Design
  },
  blueHeader: {
    backgroundColor: "#4C1D95",
    paddingBottom: 22,
  },
  headerSafe: {
    backgroundColor: "#4C1D95",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  headerBtn: {
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  backArrowText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginRight: 4,
  },
  backLabelText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  headerTitleWrap: {
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  headerSub: {
    color: "#BAE6FD",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  whiteSheet: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -8,
    overflow: "hidden",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },
  tabBtnTextActive: {
    color: "#7C3AED",
    fontWeight: "800",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerIcon: {
    fontSize: 16,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "600",
  },
  sectionWrap: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  star: {
    color: "#EF4444",
  },
  searchLocationTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  searchLocationIcon: {
    fontSize: 20,
  },
  searchLocationTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  searchLocationSub: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
  searchLocationArrow: {
    fontSize: 24,
    color: "#94A3B8",
    fontWeight: "300",
  },
  selectedStoreCard: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#86EFAC",
    borderRadius: 16,
    padding: 14,
  },
  selectedStoreTop: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  selectedStoreIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedStoreName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  selectedStoreLocation: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
  },
  storeVerifiedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  storeVerifiedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803D",
  },
  changeStoreBtn: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  changeStoreText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7C3AED",
    textDecorationLine: "underline",
  },
  formGroup: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    color: "#0F172A",
    fontWeight: "600",
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  toggleVisibilityBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  toggleVisibilityText: {
    fontSize: 16,
    color: "#64748B",
  },
  phoneInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  countryCodeBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#334155",
  },
  phoneInput: {
    flex: 1,
  },
  addressInput: {
    height: 64,
    textAlignVertical: "top",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 14,
    padding: 12,
    marginBottom: 22,
    gap: 8,
  },
  infoBoxIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#5B21B6",
  },
  submitButton: {
    backgroundColor: "#7C3AED",
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 14,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  btnContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  btnRightArrow: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  switchTabLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  switchTabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  deliveryFleetCardLink: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    backgroundColor: "#FAF5FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  deliveryFleetLinkText: {
    fontSize: 13,
    color: "#5B21B6",
    fontWeight: "600",
  },
  deliveryFleetLinkBold: {
    color: "#7C3AED",
    fontWeight: "800",
  },
});
