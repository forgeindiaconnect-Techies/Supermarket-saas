import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal as RNModal,
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

  // Scanned Product Details State for Instant Interactive Display
  const [scannedProduct, setScannedProduct] = useState<any | null>(null);
  const [scanQuantity, setScanQuantity] = useState(1);
  const [addedSuccess, setAddedSuccess] = useState(false);

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
      setScannedProduct(null);
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

      // 15s timeout to handle free-tier cloud backend cold starts gracefully
      const res = await safeFetch(endpoint, { headers }, 15000);
      const json = await res.json();

      if (res.ok && json.success && json.product) {
        const prod = json.product;
        // If store was not set, adopt scanned product's store
        if (!selectedSupermarket && prod.supermarket && typeof prod.supermarket === "object") {
          setSelectedSupermarket(prod.supermarket);
        }

        // In offline self-checkout mode, automatically add 1 unit to cart
        if (purchaseMode === "offline") {
          addToCart(prod, 1);
        }

        // Immediately display the scanned product with Image, Name, Price & Stock
        setScannedProduct(prod);
        setScanQuantity(1);
        setAddedSuccess(purchaseMode === "offline");
        setScanned(true);
      } else {
        setErrorMsg(json.message || "Product not found in this supermarket inventory.");
        setTimeout(() => {
          setScanned(false);
          setErrorMsg("");
        }, 3000);
      }
    } catch (err: any) {
      const isTimeout = err.name === "AbortError";
      setErrorMsg(
        isTimeout
          ? "Server request timed out. Please tap scan to try again."
          : err.message || "Failed to connect to scanner API"
      );
      setTimeout(() => {
        setScanned(false);
        setErrorMsg("");
      }, 3000);
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

      {/* Viewfinder Overlay */}
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

          <View style={{ alignItems: "center" }}>
            <Text style={styles.headerTitle}>Scan Product</Text>
            {purchaseMode === "offline" && (
              <View style={styles.offlineHeaderBadge}>
                <Text style={styles.offlineHeaderBadgeText}>OFFLINE SCANNER ACTIVE</Text>
              </View>
            )}
          </View>

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
            {/* White Rounded Corner Brackets */}
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
                <Text style={styles.loadingText}>Fetching product details...</Text>
              </View>
            )}
          </View>

          {errorMsg ? (
            <View style={styles.errorPill}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
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
              Align barcode within the frame to view product
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {/* ========================================================================= */}
      {/* INTERACTIVE SCANNED PRODUCT DETAILS BOTTOM SHEET (IMMEDIATE DISPLAY)     */}
      {/* ========================================================================= */}
      <RNModal
        visible={!!scannedProduct}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setScannedProduct(null);
          setScanned(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {/* Top Drag Handle */}
            <View style={styles.modalDragHandle} />

            {/* Header with Title and Close Button */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={styles.modalCheckCircle}>
                  <Text style={{ color: "#16A34A", fontSize: 13, fontWeight: "900" }}>✓</Text>
                </View>
                <Text style={styles.modalSheetTitle}>
                  {purchaseMode === "offline" ? "Scanned Product Added" : "Product Scanned"}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.modalCloseCircle}
                onPress={() => {
                  setScannedProduct(null);
                  setScanned(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Scanned Product Card with Real Image, Name, Brand, Price & Stock */}
            {scannedProduct && (() => {
              const rawPrice = Number(scannedProduct.price || 0);
              const rawCostPrice = Number(scannedProduct.costPrice || 0);
              const explicitDiscount = Number(scannedProduct.discount || 0);

              let originalMrp = rawPrice;
              let finalPrice = rawPrice;
              let discountAmount = explicitDiscount;

              if (rawCostPrice > 0 && rawCostPrice !== rawPrice) {
                originalMrp = Math.max(rawPrice, rawCostPrice);
                finalPrice = Math.min(rawPrice, rawCostPrice);
                discountAmount = Math.max(explicitDiscount, originalMrp - finalPrice);
              } else if (explicitDiscount > 0) {
                originalMrp = rawPrice;
                finalPrice = Math.max(0, rawPrice - explicitDiscount);
                discountAmount = explicitDiscount;
              }

              const hasDiscount = discountAmount > 0 && originalMrp > finalPrice;
              const discountPercent =
                hasDiscount && originalMrp > 0
                  ? Math.round((discountAmount / originalMrp) * 100)
                  : 0;

              const inStock = (scannedProduct.stock || 0) > 0;
              const stockCount = Number(scannedProduct.stock || 0);
              const totalItemPrice = finalPrice * scanQuantity;

              return (
                <View style={styles.scannedProductBody}>
                  {/* Image + Info Row */}
                  <View style={styles.modalProductRow}>
                    <View style={styles.modalImgCard}>
                      <Image
                        source={
                          scannedProduct.imageUrl
                            ? { uri: scannedProduct.imageUrl }
                            : require("@/assets/images/react-logo.png")
                        }
                        style={styles.modalProductImg}
                        resizeMode="contain"
                      />
                    </View>

                    <View style={styles.modalProductInfoCol}>
                      <Text style={styles.modalProductName} numberOfLines={2}>
                        {scannedProduct.name}
                      </Text>

                      <Text style={styles.modalProductMeta} numberOfLines={1}>
                        {scannedProduct.brand || "Supermarket"} • {scannedProduct.category || "General"}
                      </Text>

                      {/* Stock Availability Badge */}
                      <View
                        style={[
                          styles.modalStockPill,
                          inStock ? styles.modalStockIn : styles.modalStockOut,
                        ]}
                      >
                        <Text
                          style={[
                            styles.modalStockText,
                            inStock ? styles.modalStockInText : styles.modalStockOutText,
                          ]}
                        >
                          {inStock ? `● In Stock (${stockCount} available)` : "● Out of Stock"}
                        </Text>
                      </View>

                      {/* Price Section */}
                      <View style={styles.modalPriceContainer}>
                        <Text style={styles.modalFinalPrice}>₹{finalPrice.toFixed(2)}</Text>
                        {hasDiscount && (
                          <>
                            <Text style={styles.modalMrpPrice}>₹{originalMrp.toFixed(2)}</Text>
                            <View style={styles.modalDiscountBadge}>
                              <Text style={styles.modalDiscountText}>
                                ₹{discountAmount.toFixed(0)} OFF ({discountPercent}%)
                              </Text>
                            </View>
                          </>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Quantity Stepper & Subtotal Row */}
                  <View style={styles.modalStepperRow}>
                    <View>
                      <Text style={styles.modalStepperLabel}>Cart Quantity</Text>
                      <Text style={styles.modalItemSubtotal}>
                        Subtotal: <Text style={{ color: "#1E3A8A", fontWeight: "900" }}>₹{totalItemPrice.toFixed(2)}</Text>
                      </Text>
                    </View>

                    <View style={styles.modalStepperControls}>
                      <TouchableOpacity
                        style={styles.modalStepperBtn}
                        onPress={() => {
                          const newQ = Math.max(1, scanQuantity - 1);
                          setScanQuantity(newQ);
                          if (purchaseMode === "offline") {
                            addToCart(scannedProduct, -1);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.modalStepperBtnText}>−</Text>
                      </TouchableOpacity>

                      <Text style={styles.modalStepperQtyVal}>{scanQuantity}</Text>

                      <TouchableOpacity
                        style={[
                          styles.modalStepperBtn,
                          scanQuantity >= stockCount && { opacity: 0.5 },
                        ]}
                        onPress={() => {
                          if (scanQuantity < stockCount) {
                            const newQ = scanQuantity + 1;
                            setScanQuantity(newQ);
                            if (purchaseMode === "offline") {
                              addToCart(scannedProduct, 1);
                            }
                          }
                        }}
                        disabled={scanQuantity >= stockCount}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.modalStepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Main Action Buttons */}
                  <View style={styles.modalActionButtonsCol}>
                    {/* Primary Button: Scan Next Item */}
                    <TouchableOpacity
                      style={styles.modalScanNextBtn}
                      onPress={() => {
                        setScannedProduct(null);
                        setScanned(false);
                      }}
                      activeOpacity={0.88}
                    >
                      <Text style={styles.modalScanNextBtnText}>
                        📸 Scan Next Product
                      </Text>
                    </TouchableOpacity>

                    {/* Secondary Actions: Full Details & Go to Cart */}
                    <View style={styles.modalSecondaryActionsRow}>
                      <TouchableOpacity
                        style={styles.modalFullDetailsBtn}
                        onPress={() => {
                          const p = scannedProduct;
                          setScannedProduct(null);
                          router.push({
                            pathname: "/product-details",
                            params: {
                              productId: p._id,
                              barcode: p.barcode || "",
                            },
                          });
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.modalFullDetailsBtnText}>
                          🔍 View Full Details
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.modalGoToCartBtn}
                        onPress={() => {
                          setScannedProduct(null);
                          router.push("/cart");
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.modalGoToCartBtnText}>
                          🛒 View Cart ({totalCount}) →
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      </RNModal>
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
  offlineHeaderBadge: {
    backgroundColor: "#16A34A",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
  },
  offlineHeaderBadgeText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.5,
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
    backgroundColor: "rgba(0, 0, 0, 0.78)",
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
    backgroundColor: "rgba(220, 38, 38, 0.95)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
    maxWidth: "85%",
  },
  errorText: {
    color: Theme.white,
    fontSize: 12.5,
    fontWeight: "700",
    textAlign: "center",
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

  // Modal / Bottom Sheet Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  modalDragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSheetTitle: {
    fontSize: 15.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalCloseCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "800",
  },
  scannedProductBody: {
    gap: 14,
  },
  modalProductRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalImgCard: {
    width: 86,
    height: 86,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalProductImg: {
    width: "100%",
    height: "100%",
  },
  modalProductInfoCol: {
    flex: 1,
    marginLeft: 12,
  },
  modalProductName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 20,
  },
  modalProductMeta: {
    fontSize: 11.5,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
  },
  modalStockPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
  },
  modalStockIn: {
    backgroundColor: "#DCFCE7",
  },
  modalStockOut: {
    backgroundColor: "#FEE2E2",
  },
  modalStockText: {
    fontSize: 11,
    fontWeight: "800",
  },
  modalStockInText: {
    color: "#15803D",
  },
  modalStockOutText: {
    color: "#B91C1C",
  },
  modalPriceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  modalFinalPrice: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1E3A8A",
  },
  modalMrpPrice: {
    fontSize: 12.5,
    color: "#94A3B8",
    textDecorationLine: "line-through",
    fontWeight: "600",
  },
  modalDiscountBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modalDiscountText: {
    color: "#2563EB",
    fontSize: 10,
    fontWeight: "800",
  },
  modalStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalStepperLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  modalItemSubtotal: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginTop: 2,
  },
  modalStepperControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  modalStepperBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  modalStepperBtnText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalStepperQtyVal: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
    paddingHorizontal: 10,
  },
  modalActionButtonsCol: {
    gap: 8,
    marginTop: 4,
  },
  modalScanNextBtn: {
    backgroundColor: "#16A34A",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },
  modalScanNextBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  modalSecondaryActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  modalFullDetailsBtn: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  modalFullDetailsBtnText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
  },
  modalGoToCartBtn: {
    flex: 1,
    backgroundColor: "#1E3A8A",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalGoToCartBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
