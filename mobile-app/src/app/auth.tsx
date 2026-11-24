import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCart, SupermarketInfo } from "../context/CartContext";
import { API_URL, safeFetch } from "../constants/api";

export default function CustomerAuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; mobile?: string }>();

  const {
    setCustomerUser,
    setSelectedSupermarket,
    setPurchaseMode,
    selectedSupermarket,
  } = useCart();

  // Active Tab: "register" or "login"
  const [activeTab, setActiveTab] = useState<"register" | "login">(
    params.tab === "login" ? "login" : "register"
  );

  useEffect(() => {
    if (params.tab === "login") {
      setActiveTab("login");
    } else if (params.tab === "register") {
      setActiveTab("register");
    }
  }, [params.tab]);

  // Form Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(params.mobile ? String(params.mobile) : "");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Dynamic Supermarkets for Customer Account Association
  const [supermarkets, setSupermarkets] = useState<SupermarketInfo[]>([]);
  const [selectedSupermarketId, setSelectedSupermarketId] = useState<string>(
    selectedSupermarket?._id ? String(selectedSupermarket._id) : ""
  );
  const [isSupermarketDropdownOpen, setIsSupermarketDropdownOpen] = useState(false);
  const [loadingSupermarkets, setLoadingSupermarkets] = useState(false);
  const [supermarketFetchError, setSupermarketFetchError] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Fetch active registered supermarkets dynamically from backend
  const fetchActiveSupermarkets = async () => {
    try {
      setLoadingSupermarkets(true);
      setSupermarketFetchError("");
      if (!API_URL) return;

      let res = await safeFetch(`${API_URL}/supermarkets`, {}, 12000).catch(() => null);
      if (!res || !res.ok) {
        res = await safeFetch(`${API_URL}/auth/supermarkets`, {}, 12000).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success && Array.isArray(data.supermarkets)) {
          setSupermarkets(data.supermarkets);
          if (data.supermarkets.length === 1 && !selectedSupermarketId) {
            setSelectedSupermarketId(data.supermarkets[0]._id);
          } else if (selectedSupermarket?._id) {
            const match = data.supermarkets.find((s: SupermarketInfo) => s._id === selectedSupermarket._id);
            if (match) {
              setSelectedSupermarketId(match._id);
            }
          }
          return;
        }
      }
      setSupermarketFetchError("Unable to load supermarkets. Tap to retry.");
    } catch (err: any) {
      setSupermarketFetchError("Failed to fetch supermarkets. Tap to retry.");
    } finally {
      setLoadingSupermarkets(false);
    }
  };

  useEffect(() => {
    fetchActiveSupermarkets();
  }, []);

  const chosenStore = supermarkets.find((s) => s._id === selectedSupermarketId);

  const handlePhoneChange = (text: string) => {
    let cleaned = text.replace(/\D/g, "");
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
      cleaned = cleaned.slice(2);
    }
    cleaned = cleaned.slice(0, 10);
    setPhone(cleaned);
  };

  const handleSubmit = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    const cleanPhone = phone.replace(/\D/g, "");

    // 1. REGISTRATION FLOW
    if (activeTab === "register") {
      // Supermarket validation: Mandatory
      if (!selectedSupermarketId) {
        setErrorMsg("Please select a supermarket. Supermarket selection is mandatory to create an account.");
        return;
      }

      // Name validation: compulsory
      if (!name.trim() || name.trim().length < 2) {
        setErrorMsg("Please enter your full name (minimum 2 characters).");
        return;
      }

      // Mobile validation: compulsory 10-digit starting with 6, 7, 8, 9
      if (!cleanPhone || cleanPhone.length !== 10 || !["6", "7", "8", "9"].includes(cleanPhone[0])) {
        setErrorMsg("Mobile number must contain exactly 10 digits and start with 6, 7, 8, or 9.");
        return;
      }

      // Email validation: compulsory and valid format
      const emailTrim = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailTrim || !emailRegex.test(emailTrim)) {
        setErrorMsg("Please enter a valid email address (e.g., yourname@example.com).");
        return;
      }

      // Delivery Address: compulsory
      if (!address.trim() || address.trim().length < 5) {
        setErrorMsg("Please enter your complete delivery address (apartment, street, area).");
        return;
      }

      // Password: compulsory, minimum 4 characters
      if (!password || password.trim().length < 4) {
        setErrorMsg("Please create a password or PIN of at least 4 characters.");
        return;
      }

      setLoading(true);
      try {
        if (!API_URL) throw new Error("API URL not configured in environment.");

        const targetStore = supermarkets.find((s) => s._id === selectedSupermarketId);

        const res = await safeFetch(
          `${API_URL}/auth/customer/register`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              phone: cleanPhone,
              email: emailTrim,
              address: address.trim(),
              password: password.trim(),
              supermarketId: selectedSupermarketId,
              supermarketCode: targetStore?.code || "",
              registrationType: "ONLINE",
            }),
          },
          40000
        );

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
          throw new Error(data?.message || "Registration failed. Please check your details.");
        }

        // Registration successful: associate selected supermarket in context
        if (targetStore) {
          setSelectedSupermarket(targetStore);
        }

        // Display success message and switch to Sign-In page
        setSuccessMsg(`Registration Successful with ${targetStore?.name || "selected supermarket"}! Please sign in to continue.`);
        setPassword("");
        setActiveTab("login");
      } catch (err: any) {
        const raw = (err?.message || "") + " " + (err?.cause?.message || "") + " " + String(err || "");
        if (
          raw.toLowerCase().includes("cancel") ||
          raw.toLowerCase().includes("abort") ||
          raw.toLowerCase().includes("timeout") ||
          raw.toLowerCase().includes("fetch failed") ||
          raw.toLowerCase().includes("network request failed")
        ) {
          setErrorMsg("Connection timed out while reaching server. The server is waking up. Please tap Create Account again.");
        } else {
          setErrorMsg(err.message || "Failed to create account. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    } else {
      // 2. SIGN IN FLOW
      if (!cleanPhone || cleanPhone.length !== 10) {
        setErrorMsg("Please enter your registered 10-digit mobile number.");
        return;
      }

      if (!password || !password.trim()) {
        setErrorMsg("Please enter your registered password or PIN.");
        return;
      }

      setLoading(true);
      try {
        if (!API_URL) throw new Error("API URL not configured in environment.");

        const res = await safeFetch(
          `${API_URL}/auth/customer/login`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: cleanPhone,
              password: password.trim(),
            }),
          },
          40000
        );

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
          throw new Error(
            data?.message ||
              "Your account is not registered. Please create an account first and then sign in."
          );
        }

        const storeInfo: SupermarketInfo | null = data.supermarket || null;

        // Maintain authenticated session & purchase mode
        setPurchaseMode("online");
        if (storeInfo) {
          setSelectedSupermarket(storeInfo);
        }

        setCustomerUser({
          _id: data.customer?._id,
          name: data.customer?.name || "Shopper",
          phone: cleanPhone,
          email: data.customer?.email || "",
          address: data.customer?.address || "",
          supermarketId: storeInfo?._id || data.customer?.supermarketId,
          supermarketCode: storeInfo?.code || data.customer?.supermarketCode,
          supermarketName: storeInfo?.name || data.customer?.supermarketName,
          registeredLocation: data.customer?.registeredLocation || "",
          token: data.token,
        });

        // Open Online shopping dashboard
        router.replace("/catalog");
      } catch (err: any) {
        const raw = (err?.message || "") + " " + (err?.cause?.message || "") + " " + String(err || "");
        if (
          raw.toLowerCase().includes("cancel") ||
          raw.toLowerCase().includes("abort") ||
          raw.toLowerCase().includes("timeout") ||
          raw.toLowerCase().includes("fetch failed") ||
          raw.toLowerCase().includes("network request failed")
        ) {
          setErrorMsg("Connection timed out while reaching server. The server is waking up. Please tap Sign In again.");
        } else {
          setErrorMsg(
            err.message ||
              "Your account is not registered. Please create an account first and then sign in."
          );
        }
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

        {/* Royal Purple Top Header */}
        <View style={styles.purpleHeader}>
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
                <Text style={styles.headerTitle}>
                  {activeTab === "register" ? "Customer Registration" : "Customer Sign In"}
                </Text>
                <Text style={styles.headerSub}>
                  {activeTab === "register"
                    ? "Create Account for Online Shopping"
                    : "Access Your Online Shopping Account"}
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
            keyboardShouldPersistTaps="handled"
          >
            {/* Page Header Banner */}
            {activeTab === "register" ? (
              <View style={styles.pageHeaderBanner}>
                <View style={styles.pageHeaderBadge}>
                  <Text style={styles.pageHeaderBadgeText}>ONLINE SHOPPER REGISTRATION</Text>
                </View>
                <Text style={styles.pageHeaderTitle}>Create Account</Text>
                <Text style={styles.pageHeaderSubtitle}>
                  Registration is compulsory for all online customers. Please select your supermarket and enter your details below.
                </Text>
              </View>
            ) : (
              <View style={styles.pageHeaderBanner}>
                <View style={[styles.pageHeaderBadge, { backgroundColor: "#EDE9FE" }]}>
                  <Text style={[styles.pageHeaderBadgeText, { color: "#6D28D9" }]}>CUSTOMER SIGN IN</Text>
                </View>
                <Text style={styles.pageHeaderTitle}>Customer Sign In</Text>
                <Text style={styles.pageHeaderSubtitle}>
                  Enter your registered mobile number and password / PIN to access your account.
                </Text>
              </View>
            )}

            {/* Success Message Banner */}
            {successMsg ? (
              <View style={styles.successBanner}>
                <Text style={styles.successBannerIcon}>✓</Text>
                <Text style={styles.successBannerText}>{successMsg}</Text>
              </View>
            ) : null}

            {/* Error Message Banner */}
            {errorMsg ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerIcon}>⚠️</Text>
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Customer Registration Fields */}
            {activeTab === "register" && (
              <>
                {/* Mandatory Select Supermarket Dropdown */}
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>
                    Select Supermarket <Text style={styles.star}>*</Text>
                  </Text>

                  {/* Dropdown Box Trigger */}
                  <TouchableOpacity
                    style={[
                      styles.dropdownTrigger,
                      isSupermarketDropdownOpen && styles.dropdownTriggerActive,
                      !selectedSupermarketId && errorMsg.includes("supermarket") && styles.inputErrorBorder,
                    ]}
                    onPress={() => setIsSupermarketDropdownOpen(!isSupermarketDropdownOpen)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dropdownLeftCol}>
                      <View style={styles.dropdownStoreIconBox}>
                        <Text style={styles.dropdownStoreIcon}>🏬</Text>
                      </View>
                      {selectedSupermarketId && chosenStore ? (
                        <View style={styles.dropdownSelectedTextWrap}>
                          <Text style={styles.dropdownSelectedName} numberOfLines={1}>
                            {chosenStore.name}
                          </Text>
                          <Text style={styles.dropdownSelectedMeta} numberOfLines={1}>
                            {[chosenStore.code, chosenStore.city || chosenStore.address].filter(Boolean).join(" • ")}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.dropdownPlaceholderText}>
                          {loadingSupermarkets ? "Loading active supermarkets..." : "Select your supermarket..."}
                        </Text>
                      )}
                    </View>

                    <View style={styles.dropdownRightCol}>
                      {loadingSupermarkets ? (
                        <ActivityIndicator size="small" color="#7C3AED" />
                      ) : (
                        <Text style={styles.dropdownChevron}>
                          {isSupermarketDropdownOpen ? "▲" : "▼"}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Dropdown Options List */}
                  {isSupermarketDropdownOpen && (
                    <View style={styles.dropdownOptionsContainer}>
                      {loadingSupermarkets ? (
                        <View style={styles.dropdownLoadingBox}>
                          <ActivityIndicator size="small" color="#7C3AED" />
                          <Text style={styles.dropdownLoadingText}>Fetching verified supermarkets...</Text>
                        </View>
                      ) : supermarketFetchError && supermarkets.length === 0 ? (
                        <TouchableOpacity
                          style={styles.dropdownRetryBox}
                          onPress={fetchActiveSupermarkets}
                        >
                          <Text style={styles.dropdownRetryText}>⚠️ {supermarketFetchError}</Text>
                          <Text style={styles.dropdownRetryBtn}>Tap to Retry</Text>
                        </TouchableOpacity>
                      ) : supermarkets.length === 0 ? (
                        <View style={styles.dropdownEmptyBox}>
                          <Text style={styles.dropdownEmptyText}>No active supermarkets available.</Text>
                        </View>
                      ) : (
                        supermarkets.map((store) => {
                          const isSelected = store._id === selectedSupermarketId;
                          return (
                            <TouchableOpacity
                              key={store._id}
                              style={[
                                styles.dropdownOptionItem,
                                isSelected && styles.dropdownOptionItemSelected,
                              ]}
                              onPress={() => {
                                setSelectedSupermarketId(store._id);
                                setIsSupermarketDropdownOpen(false);
                                if (errorMsg.includes("supermarket")) setErrorMsg("");
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={styles.optionContentLeft}>
                                <View style={[styles.storeIconBox, isSelected && styles.storeIconBoxSelected]}>
                                  <Text style={[styles.storeIconLetter, isSelected && styles.storeIconLetterSelected]}>
                                    {(store.name || "S").charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                                <View style={styles.optionDetailsCol}>
                                  <Text style={[styles.optionStoreName, isSelected && styles.optionStoreNameSelected]}>
                                    {store.name}
                                  </Text>
                                  <View style={styles.optionMetaRow}>
                                    {store.code ? (
                                      <View style={styles.optionCodeBadge}>
                                        <Text style={styles.optionCodeBadgeText}>{store.code}</Text>
                                      </View>
                                    ) : null}
                                    {store.city || store.address ? (
                                      <Text style={styles.optionLocationText} numberOfLines={1}>
                                        📍 {[store.city, store.state].filter(Boolean).join(", ")}
                                      </Text>
                                    ) : null}
                                  </View>
                                </View>
                              </View>

                              <View style={styles.optionCheckCol}>
                                {isSelected ? (
                                  <View style={styles.checkCircleSelected}>
                                    <Text style={styles.checkIconText}>✓</Text>
                                  </View>
                                ) : (
                                  <View style={styles.checkCircleUnselected} />
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  )}

                  <Text style={styles.fieldHint}>
                    Compulsory: Your online shopping and orders will be associated with this supermarket
                  </Text>
                </View>

                {/* 1. Customer Name */}
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

                {/* 2. Mobile Number */}
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
                      placeholder="10-digit mobile number (starts with 6-9)"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      maxLength={10}
                      value={phone}
                      onChangeText={handlePhoneChange}
                    />
                  </View>
                  <Text style={styles.fieldHint}>Must be 10 digits starting with 6, 7, 8, or 9</Text>
                </View>

                {/* 3. Email Address */}
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>
                    Email Address <Text style={styles.star}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. name@example.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                  />
                  <Text style={styles.fieldHint}>Saved in lowercase for order confirmation</Text>
                </View>

                {/* 4. Delivery Address */}
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>
                    Delivery Address <Text style={styles.star}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, styles.addressInput]}
                    placeholder="Flat/House No., Street, Area, Landmark"
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={3}
                    value={address}
                    onChangeText={setAddress}
                  />
                  <Text style={styles.fieldHint}>Compulsory for doorstep delivery of your orders</Text>
                </View>

                {/* 5. Create Password / PIN */}
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>
                    Create Password / PIN <Text style={styles.star}>*</Text>
                  </Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      placeholder="Set a secure password or PIN (min 4 chars)"
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
                        {showPassword ? "👁️ Hide" : "👁️ Show"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {/* Customer Sign In Fields */}
            {activeTab === "login" && (
              <>
                {/* Registered Mobile Number */}
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>
                    Registered Mobile Number <Text style={styles.star}>*</Text>
                  </Text>
                  <View style={styles.phoneInputRow}>
                    <View style={styles.countryCodeBox}>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      style={[styles.input, styles.phoneInput]}
                      placeholder="10-digit registered mobile number"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      maxLength={10}
                      value={phone}
                      onChangeText={handlePhoneChange}
                    />
                  </View>
                </View>

                {/* Registered Password / PIN */}
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>
                    Registered Password / PIN <Text style={styles.star}>*</Text>
                  </Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      placeholder="Enter your registered password or PIN"
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
                        {showPassword ? "👁️ Hide" : "👁️ Show"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {/* Information Notice */}
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxIcon}>🛡️</Text>
              <Text style={styles.infoBoxText}>
                {activeTab === "register"
                  ? "Registration is mandatory for all new online customers. Your account credentials will be securely encrypted."
                  : "Only registered online customer accounts can sign in. Unregistered shoppers must create an account first."}
              </Text>
            </View>

            {/* Action Submit Button */}
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
                    {activeTab === "register" ? "Create Account" : "Sign In"}
                  </Text>
                  <Text style={styles.btnRightArrow}>→</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Switch Tab Link for Register */}
            {activeTab === "register" && (
              <TouchableOpacity
                style={styles.switchTabLink}
                onPress={() => {
                  setActiveTab("login");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.switchTabText}>
                  Already have an account? <Text style={{ color: "#7C3AED", fontWeight: "800" }}>Sign In here →</Text>
                </Text>
              </TouchableOpacity>
            )}

            {/* Switch Tab Link for Sign In */}
            {activeTab === "login" && (
              <TouchableOpacity
                style={styles.switchTabLink}
                onPress={() => {
                  setActiveTab("register");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.switchTabText}>
                  Don't have an account? <Text style={{ color: "#7C3AED", fontWeight: "800" }}>Create an account / Register here →</Text>
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1B4B", // Royal purple dark canvas
  },
  purpleHeader: {
    backgroundColor: "#2E0854",
    paddingBottom: 16,
  },
  headerSafe: {
    backgroundColor: "transparent",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerBtn: {
    padding: 4,
  },
  backBtnPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  backArrowText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  backLabelText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  headerTitleWrap: {
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  headerSub: {
    color: "#DDD6FE",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },
  whiteSheet: {
    flex: 1,
    backgroundColor: "#F9F8FD",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  tabToggleRow: {
    flexDirection: "row",
    backgroundColor: "#EDE9FE",
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  tabToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  tabToggleBtnActive: {
    backgroundColor: "#7C3AED",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tabToggleText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#6D28D9",
  },
  tabToggleTextActive: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  pageHeaderBanner: {
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  pageHeaderBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  pageHeaderBadgeText: {
    color: "#15803D",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  pageHeaderTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  pageHeaderSubtitle: {
    fontSize: 12.5,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 18,
    fontWeight: "500",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  successBannerIcon: {
    fontSize: 16,
    color: "#059669",
    fontWeight: "900",
  },
  successBannerText: {
    color: "#065F46",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerIcon: {
    fontSize: 15,
  },
  errorBannerText: {
    color: "#DC2626",
    fontSize: 12.5,
    fontWeight: "700",
    flex: 1,
  },
  formGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E1B4B",
    marginBottom: 6,
  },
  star: {
    color: "#EF4444",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: "#0F172A",
  },
  phoneInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  countryCodeBox: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  countryCodeText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
  },
  phoneInput: {
    flex: 1,
  },
  fieldHint: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 3,
    marginLeft: 2,
  },
  addressInput: {
    minHeight: 65,
    textAlignVertical: "top",
  },
  passwordInputContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 80,
  },
  toggleVisibilityBtn: {
    position: "absolute",
    right: 12,
    top: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  toggleVisibilityText: {
    color: "#7C3AED",
    fontSize: 12,
    fontWeight: "800",
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#F3E8FF",
    borderRadius: 12,
    padding: 12,
    marginVertical: 12,
    alignItems: "flex-start",
    gap: 8,
  },
  infoBoxIcon: {
    fontSize: 16,
  },
  infoBoxText: {
    color: "#5B21B6",
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: "#2E0854",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2E0854",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  btnContentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  btnRightArrow: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  switchTabLink: {
    marginTop: 18,
    alignItems: "center",
    paddingVertical: 6,
  },
  switchTabText: {
    color: "#6D28D9",
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  // Supermarket Dropdown Styles
  dropdownTrigger: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownTriggerActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#FDFCFF",
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  inputErrorBorder: {
    borderColor: "#EF4444",
  },
  dropdownLeftCol: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  dropdownStoreIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownStoreIcon: {
    fontSize: 16,
  },
  dropdownSelectedTextWrap: {
    flex: 1,
  },
  dropdownSelectedName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  dropdownSelectedMeta: {
    fontSize: 11,
    color: "#6D28D9",
    fontWeight: "600",
    marginTop: 1,
  },
  dropdownPlaceholderText: {
    fontSize: 13.5,
    color: "#94A3B8",
    fontWeight: "500",
  },
  dropdownRightCol: {
    marginLeft: 8,
    paddingRight: 4,
  },
  dropdownChevron: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "800",
  },
  dropdownOptionsContainer: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#DDD6FE",
    borderTopWidth: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    overflow: "hidden",
    shadowColor: "#2E0854",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownOptionItemSelected: {
    backgroundColor: "#F5F3FF",
  },
  optionContentLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  storeIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  storeIconBoxSelected: {
    backgroundColor: "#7C3AED",
  },
  storeIconLetter: {
    fontSize: 14,
    fontWeight: "900",
    color: "#6D28D9",
  },
  storeIconLetterSelected: {
    color: "#FFFFFF",
  },
  optionDetailsCol: {
    flex: 1,
  },
  optionStoreName: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#1E293B",
  },
  optionStoreNameSelected: {
    color: "#6D28D9",
  },
  optionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  optionCodeBadge: {
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  optionCodeBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#6D28D9",
  },
  optionLocationText: {
    fontSize: 11,
    color: "#64748B",
    flex: 1,
  },
  optionCheckCol: {
    marginLeft: 8,
  },
  checkCircleSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  checkIconText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  checkCircleUnselected: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },
  dropdownLoadingBox: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dropdownLoadingText: {
    fontSize: 12.5,
    color: "#6D28D9",
    fontWeight: "600",
  },
  dropdownRetryBox: {
    padding: 14,
    alignItems: "center",
  },
  dropdownRetryText: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600",
  },
  dropdownRetryBtn: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "800",
    marginTop: 4,
    textDecorationLine: "underline",
  },
  dropdownEmptyBox: {
    padding: 14,
    alignItems: "center",
  },
  dropdownEmptyText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
});
