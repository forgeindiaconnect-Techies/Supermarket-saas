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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCart } from "../context/CartContext";
import { API_URL, safeFetch } from "../constants/api";

export default function DeliveryLoginScreen() {
  const router = useRouter();
  const { setDeliveryUser } = useCart();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleDeliveryLogin = async () => {
    setErrorMsg("");

    if (!username.trim()) {
      setErrorMsg("Please enter your Delivery Username or Registered Email.");
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" />

      {/* Decorative Aura */}
      <View style={styles.topAura} />

      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.replace("/")}
              activeOpacity={0.7}
            >
              <Text style={styles.backBtnText}>← Customer App</Text>
            </TouchableOpacity>
          </View>

          {/* Portal Brand Box */}
          <View style={styles.brandBox}>
            <View style={styles.iconCircle}>
              <Text style={styles.deliveryIcon}>🚚</Text>
            </View>
            <Text style={styles.portalTitle}>Delivery Fleet Portal</Text>
            <Text style={styles.portalSubtitle}>
              Dedicated Multi-Tenant Delivery Operations
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <View style={styles.noticeBox}>
              <Text style={styles.noticeTitle}>🔐 Authorized Access Only</Text>
              <Text style={styles.noticeText}>
                Use the dedicated credentials created by Super Admin for your assigned supermarket fleet.
              </Text>
            </View>

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Delivery Username or Email</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. driver_sm8912 or name@store.com"
              placeholderTextColor="#94A3B8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••••••"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleDeliveryLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.loginBtnText}>Login to Delivery Dashboard →</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerInfo}>
              <Text style={styles.footerInfoText}>
                Note: Each supermarket delivery fleet has an isolated dashboard with its own branding, tasks, and orders.
              </Text>
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
    backgroundColor: "#0F172A", // Deep navy blue
  },
  topAura: {
    position: "absolute",
    top: -120,
    left: -60,
    right: -60,
    height: 340,
    borderRadius: 200,
    backgroundColor: "#0284C7",
    opacity: 0.25,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  backBtnText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "600",
  },
  brandBox: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(2, 132, 199, 0.2)",
    borderWidth: 2,
    borderColor: "#38BDF8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  deliveryIcon: {
    fontSize: 32,
  },
  portalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  portalSubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 4,
    textAlign: "center",
  },
  formCard: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  noticeBox: {
    backgroundColor: "rgba(2, 132, 199, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#38BDF8",
    marginBottom: 2,
  },
  noticeText: {
    fontSize: 11,
    color: "#BAE6FD",
    lineHeight: 16,
  },
  errorBox: {
    backgroundColor: "#7F1D1D",
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "600",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E2E8F0",
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontSize: 14,
  },
  loginBtn: {
    backgroundColor: "#0284C7",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 22,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  footerInfo: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingTop: 12,
  },
  footerInfoText: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 16,
  },
});

