import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Animated,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Theme } from "../constants/colors";
import { API_URL, safeFetch } from "../constants/api";
import { useCart } from "../context/CartContext";

const { width } = Dimensions.get("window");
const SCAN_BOX_SIZE = width * 0.76;

export default function ScanProductScreen() {
  const router = useRouter();
  const {
    selectedSupermarket,
    setSelectedSupermarket,
    purchaseMode,
    addToCart,
    cart,
    totalCount,
    totalAmount,
  } = useCart();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastAddedInfo, setLastAddedInfo] = useState<{
    name: string;
    price: number;
    quantity: number;
  } | null>(null);

  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(laserAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [laserAnim]);

  // Automatically reset scan state whenever user returns to scanner screen
  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      setLoading(false);
      setErrorMsg("");
    }, [])
  );

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCAN_BOX_SIZE * 0.65],
  });

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading || !data) return;

    setScanned(true);
    setLoading(true);
    setErrorMsg("");

    const cleanCode = data.trim();

    try {
      if (!API_URL) {
        throw new Error("API URL not configured in .env");
      }

      let endpoint = "";
      if (cleanCode.startsWith("SUPERMARKET_PRODUCT:")) {
        const id = cleanCode.replace("SUPERMARKET_PRODUCT:", "").trim();
        endpoint = `${API_URL}/products/qr/${encodeURIComponent(id)}`;
      } else {
        endpoint = `${API_URL}/products/barcode/${encodeURIComponent(cleanCode)}`;
      }

      const headers: Record<string, string> = {};
      if (selectedSupermarket?._id) {
        headers["x-supermarket-id"] = selectedSupermarket._id;
        headers["x-supermarket-code"] = selectedSupermarket.code || "";
      }

      const res = await safeFetch(endpoint, { headers }, 5000);
      const json = await res.json();

      if (res.ok && json.success && json.product) {
        const prod = json.product;
        // If store was not set, adopt scanned product's store
        if (!selectedSupermarket && prod.supermarket && typeof prod.supermarket === "object") {
          setSelectedSupermarket(prod.supermarket);
        }

        if (purchaseMode === "offline") {
          // OFFLINE: Automatically add scanned product to cart & allow scanning one by one
          addToCart(prod, 1);
          const effectivePrice = Number(prod.effectivePrice ?? (prod.price - (prod.discount || 0)));
          setLastAddedInfo({
            name: prod.name,
            price: effectivePrice,
            quantity: 1,
          });

          // Reset scan lock after 1.5s so customer can scan products one by one
          setTimeout(() => {
            setScanned(false);
          }, 1500);

          setTimeout(() => {
            setLastAddedInfo(null);
          }, 4000);
        } else {
          // ONLINE: Open Product Details
          router.push({
            pathname: "/product-details",
            params: {
              productId: prod._id,
              barcode: prod.barcode || cleanCode,
            },
          });
        }
      } else {
        if (purchaseMode === "offline") {
          setErrorMsg("Product not found in this supermarket inventory");
          setTimeout(() => {
            setScanned(false);
            setErrorMsg("");
          }, 2500);
        } else {
          // Product not registered: open Product Details with barcode to show "Product Not Found" screen
          router.push({
            pathname: "/product-details",
            params: {
              barcode: cleanCode,
            },
          });
        }
      }
    } catch (err: any) {
      const isTimeout = err.name === "AbortError";
      setErrorMsg(
        isTimeout
          ? "Connection timed out. Retrying..."
          : err.message || "Failed to connect to scanner API"
      );
      setTimeout(() => {
        setScanned(false);
        setErrorMsg("");
      }, 2500);
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Theme.primary} />
        <Text style={styles.permissionSub}>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSub}>
          Camera is needed to scan product barcodes in the supermarket.
        </Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
          <Text style={styles.grantBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace("/")}>
          <Text style={styles.backLink}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Live Camera View */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Viewfinder Overlay matching Screen 2 */}
      <SafeAreaView style={styles.overlay}>
        {/* Top Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Scan Product</Text>

          <TouchableOpacity
            style={styles.torchBtn}
            onPress={() => setTorch((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Text style={[styles.torchIcon, torch && styles.torchActive]}>⚡</Text>
          </TouchableOpacity>
        </View>

        {/* Center Scanner Window */}
        <View style={styles.centerSection}>
          <View style={styles.scanBox}>
            {/* White Rounded Corner Brackets matching Screen 2 */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Glowing Red Laser Line */}
            <Animated.View
              style={[
                styles.laserLine,
                { transform: [{ translateY: laserTranslateY }] },
              ]}
            />

            {loading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={Theme.gold} />
                <Text style={styles.loadingText}>Fetching product...</Text>
              </View>
            )}
          </View>

          {lastAddedInfo ? (
            <View style={styles.successPill}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successText}>
                Added "{lastAddedInfo.name}" • ₹{lastAddedInfo.price.toFixed(2)} to cart
              </Text>
            </View>
          ) : null}

          {errorMsg ? (
            <View style={styles.errorPill}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}
        </View>

        {/* Bottom Bar: View Cart Button & Instruction Pill */}
        <View style={styles.bottomSection}>
          {cart.length > 0 && (
            <TouchableOpacity
              style={styles.viewCartBtn}
              onPress={() => router.push("/cart")}
              activeOpacity={0.88}
            >
              <View style={styles.viewCartBtnInner}>
                <View style={styles.viewCartBadge}>
                  <Text style={styles.viewCartBadgeText}>{totalCount}</Text>
                </View>
                <Text style={styles.viewCartBtnText}>
                  View Cart • ₹{Number(totalAmount || 0).toFixed(2)}
                </Text>
                <Text style={styles.viewCartArrow}>→</Text>
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.instructionPill}>
            <View style={styles.scanIconBox}>
              <Text style={styles.scanIconSymbol}>⚲</Text>
            </View>
            <Text style={styles.instructionText}>
              Align barcode within the frame
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Theme.white,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: Theme.primary,
    marginBottom: 8,
  },
  permissionSub: {
    fontSize: 13,
    color: Theme.gray,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  grantBtn: {
    backgroundColor: Theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  grantBtnText: {
    color: Theme.white,
    fontWeight: "800",
    fontSize: 14,
  },
  backLink: {
    color: Theme.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    color: Theme.white,
    fontSize: 30,
    fontWeight: "300",
  },
  headerTitle: {
    color: Theme.white,
    fontSize: 17,
    fontWeight: "800",
  },
  torchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  torchIcon: {
    color: Theme.white,
    fontSize: 22,
  },
  torchActive: {
    color: Theme.gold,
  },
  centerSection: {
    alignItems: "center",
    justifyContent: "center",
  },
  scanBox: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE * 0.68,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: Theme.white,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 14,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 14,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 14,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 14,
  },
  laserLine: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 3,
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingBox: {
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  loadingText: {
    color: Theme.white,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  errorPill: {
    backgroundColor: "rgba(239, 68, 68, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  errorText: {
    color: Theme.white,
    fontSize: 12,
    fontWeight: "700",
  },
  successPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 163, 74, 0.95)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    marginTop: 16,
    gap: 8,
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  successIcon: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  successText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  bottomSection: {
    alignItems: "center",
    paddingBottom: 24,
    width: "100%",
  },
  viewCartBtn: {
    backgroundColor: "#16A34A",
    borderRadius: 26,
    paddingVertical: 13,
    paddingHorizontal: 22,
    marginBottom: 12,
    width: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  viewCartBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewCartBadge: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  viewCartBadgeText: {
    color: "#16A34A",
    fontSize: 12,
    fontWeight: "900",
  },
  viewCartBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  viewCartArrow: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  instructionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 10, 35, 0.78)",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  scanIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Theme.white,
    alignItems: "center",
    justifyContent: "center",
  },
  scanIconSymbol: {
    color: Theme.white,
    fontSize: 16,
  },
  instructionText: {
    color: Theme.white,
    fontSize: 13,
    fontWeight: "700",
  },
});
