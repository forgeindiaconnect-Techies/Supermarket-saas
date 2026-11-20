import React, { useState } from "react";
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
  Image,
  Dimensions,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCart } from "../context/CartContext";
import { API_URL, safeFetch } from "../constants/api";

const { width, height } = Dimensions.get("window");

export default function DeliveryLoginScreen() {
  const router = useRouter();
  const { setDeliveryUser } = useCart();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleDeliveryLogin = async () => {
    setErrorMsg("");

    if (!username.trim()) {
      setErrorMsg("Please enter your Driver Username or Email.");
      return;
    }
    if (!password) {
      setErrorMsg("Please enter your account password.");
      return;
    }

    setLoading(true);
    try {
      if (!API_URL) throw new Error("API URL missing in configuration.");

      const res = await safeFetch(
        `${API_URL}/auth/delivery-login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        },
        8000
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Delivery authentication failed.");
      }

      // Populate delivery user in context
      const deliveryPayload = {
        _id: data.user._id,
        name: data.user.name,
        username: data.user.username,
        email: data.user.email,
        phone: data.user.phone,
        role: data.user.role,
        supermarketId: data.supermarket?._id || data.user.supermarketId,
        supermarketCode: data.supermarket?.code || data.user.supermarketCode,
        supermarketName: data.supermarket?.name || data.user.supermarketName,
        logoUrl: data.supermarket?.logoUrl,
        deliveryBannerUrl: data.supermarket?.deliveryBannerUrl,
        token: data.token,
      };

      setDeliveryUser(deliveryPayload);

      // Successfully authenticated -> Direct to isolated Delivery Dashboard
      router.replace("/delivery-dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log in to Delivery Dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const handleSupportCall = () => {
    Linking.openURL("tel:+919876543210").catch(() => {});
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" />

      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* 1. Full-Bleed Top Hero Banner: High-res 3D Fleet Visual */}
          <View style={styles.heroBannerWrap}>
            <Image
              source={require("../../assets/images/delivery-fleet-bg.jpg")}
              style={styles.heroBannerImage}
              resizeMode="cover"
            />
            {/* Interactive touch area for ← Customer App button */}
            <TouchableOpacity
              style={styles.backButtonTouch}
              onPress={() => router.replace("/")}
              activeOpacity={0.8}
            >
              <View style={styles.backButtonPill}>
                <Text style={styles.backArrowText}>←</Text>
                <Text style={styles.backLabelText}>Customer App</Text>
              </View>
            </TouchableOpacity>

            {/* Delivery Fleet Portal Branding Header */}
            <View style={styles.fleetBrandHeader}>
              <View style={styles.fleetLogoBadge}>
                <Text style={{ fontSize: 20 }}>🚚</Text>
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.fleetBrandTitle}>
                  Delivery <Text style={styles.fleetBrandTitleCyan}>Fleet Portal</Text>
                </Text>
                <Text style={styles.fleetBrandSubtitle}>
                  Delivering Excellence, Together
                </Text>
              </View>
            </View>
          </View>

          {/* 2. The Center White Driver Login Card */}
          <View style={styles.cardContainer}>
            <View style={styles.loginCard}>
              {/* Crisp 3D Shield Badge with Lock Icon */}
              <View style={styles.shieldBadgeContainer}>
                <View style={styles.shieldBadgeCircle}>
                  <Text style={styles.shieldBadgeIcon}>🛡️</Text>
                  <View style={styles.lockBadgeMini}>
                    <Text style={styles.lockBadgeMiniIcon}>🔒</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.driverLoginTitle}>Driver Login</Text>
              <Text style={styles.driverLoginSubtitle}>Access your delivery dashboard</Text>

              {/* Error Message banner */}
              {errorMsg ? (
                <View style={styles.errorBannerBox}>
                  <Text style={styles.errorBannerText}>⚠️ {errorMsg}</Text>
                </View>
              ) : null}

              {/* Input 1: Driver Username or Email */}
              <View style={styles.inputBox}>
                <View style={styles.inputLeftIconSquare}>
                  <Text style={styles.inputGlyphIcon}>👤</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="Driver Username or Email"
                  placeholderTextColor="#94A3B8"
                  value={username}
                  onChangeText={(val) => {
                    setUsername(val);
                    if (errorMsg) setErrorMsg("");
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Input 2: Password */}
              <View style={[styles.inputBox, { marginTop: 12 }]}>
                <View style={styles.inputLeftIconSquare}>
                  <Text style={styles.inputGlyphIcon}>🔒</Text>
                </View>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="Password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (errorMsg) setErrorMsg("");
                  }}
                  secureTextEntry={!showPassword}
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

              {/* Action Button: Login to Delivery Dashboard */}
              <TouchableOpacity
                style={[styles.loginSubmitBtn, loading && styles.loginSubmitBtnDisabled]}
                onPress={handleDeliveryLogin}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.btnContentRow}>
                    <Text style={styles.btnLeftGlyph}>➔</Text>
                    <Text style={styles.loginSubmitBtnText}>Login to Delivery Dashboard</Text>
                    <Text style={styles.btnRightArrow}>→</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Security Divider */}
              <View style={styles.securityDividerRow}>
                <View style={styles.securityDividerLine} />
                <View style={styles.securityShieldCircle}>
                  <Text style={styles.securityShieldIcon}>🛡️</Text>
                </View>
                <View style={styles.securityDividerLine} />
              </View>

              <Text style={styles.securityNoticeText}>
                Secure Access for Authorized Delivery Personnel Only
              </Text>
            </View>

            {/* 3. Floating Support Footer Card */}
            <View style={styles.supportFooterCard}>
              <TouchableOpacity
                style={styles.supportLeftHalf}
                onPress={handleSupportCall}
                activeOpacity={0.7}
              >
                <View style={styles.headsetIconBox}>
                  <Text style={styles.headsetGlyph}>🎧</Text>
                </View>
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.needHelpHeading}>Need Help?</Text>
                  <Text style={styles.contactSupportLink}>Contact Support</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.supportVerticalLine} />

              <TouchableOpacity
                style={styles.supportRightHalf}
                onPress={handleSupportCall}
                activeOpacity={0.7}
              >
                <Text style={styles.phoneGlyph}>📞</Text>
                <Text style={styles.supportPhoneNumber}>+91 98765 43210</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2563EB", // Vibrant royal blue matching the bottom wave of delivery banner
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  // Top Hero Banner: Exactly matches Reference Image
  heroBannerWrap: {
    width: width,
    height: Math.min(Math.round(height * 0.42), 340),
    position: "relative",
    overflow: "hidden",
  },
  heroBannerImage: {
    width: "100%",
    height: "100%",
  },
  backButtonTouch: {
    position: "absolute",
    top: Platform.OS === "ios" ? 48 : 36,
    left: 18,
    zIndex: 10,
  },
  backButtonPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 24, 70, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  backArrowText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginRight: 6,
  },
  backLabelText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  fleetBrandHeader: {
    position: "absolute",
    top: Platform.OS === "ios" ? 92 : 80,
    left: 18,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  fleetLogoBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 50, 150, 0.6)",
    borderWidth: 2,
    borderColor: "#38BDF8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  fleetBrandTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  fleetBrandTitleCyan: {
    color: "#38BDF8",
  },
  fleetBrandSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#BAE6FD",
    marginTop: 2,
  },
  // Center Card Container
  cardContainer: {
    paddingHorizontal: 20,
    marginTop: -28, // Nests naturally into the curved blue wave of the hero banner
    zIndex: 5,
  },
  loginCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderWidth: 1.5,
    borderColor: "#DBEAFE",
    shadowColor: "#002B7F",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  shieldBadgeContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    marginTop: -4,
  },
  shieldBadgeCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#EFF6FF",
    borderWidth: 2,
    borderColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0066FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    position: "relative",
  },
  shieldBadgeIcon: {
    fontSize: 28,
  },
  lockBadgeMini: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#1D4ED8",
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  lockBadgeMiniIcon: {
    fontSize: 10,
    color: "#FFFFFF",
  },
  driverLoginTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  driverLoginSubtitle: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
    textAlign: "center",
    marginTop: 3,
    marginBottom: 16,
  },
  errorBannerBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  errorBannerText: {
    color: "#DC2626",
    fontSize: 12.5,
    fontWeight: "600",
    textAlign: "center",
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    height: 52,
  },
  inputLeftIconSquare: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#0A2540",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  inputGlyphIcon: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    height: "100%",
  },
  toggleVisibilityBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  toggleVisibilityText: {
    fontSize: 16,
    color: "#64748B",
  },
  // Submit Button
  loginSubmitBtn: {
    backgroundColor: "#0066FF",
    borderRadius: 18,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    shadowColor: "#0066FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  loginSubmitBtnDisabled: {
    opacity: 0.65,
  },
  btnContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnLeftGlyph: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    marginRight: 8,
  },
  loginSubmitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  btnRightArrow: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginLeft: 8,
  },
  // Security Divider
  securityDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 8,
  },
  securityDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  securityShieldCircle: {
    marginHorizontal: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  securityShieldIcon: {
    fontSize: 12,
  },
  securityNoticeText: {
    fontSize: 11.5,
    color: "#64748B",
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.1,
  },
  // Floating Support Footer Card
  supportFooterCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0F7FF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    marginTop: 14,
    shadowColor: "#0038A8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  supportLeftHalf: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headsetIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  headsetGlyph: {
    fontSize: 15,
  },
  needHelpHeading: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
  },
  contactSupportLink: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0066FF",
  },
  supportVerticalLine: {
    width: 1,
    height: 26,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 10,
  },
  supportRightHalf: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  phoneGlyph: {
    fontSize: 14,
  },
  supportPhoneNumber: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.2,
  },
});
