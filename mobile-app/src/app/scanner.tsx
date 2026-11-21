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
  ScrollView,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Theme } from "../constants/colors";
import { API_URL, safeFetch } from "../constants/api";
import { useCart, SupermarketInfo } from "../context/CartContext";
import SupermarketSearchModal from "../components/SupermarketSearchModal";

const { width, height } = Dimensions.get("window");
const SCAN_BOX_SIZE = width * 0.65;

export type ScannedSessionItem = {
  id: string; // product._id
  product: any;
  quantity: number;
  addedToCart: boolean;
  scannedAt: number;
};

export default function ScanProductScreen() {
  const router = useRouter();
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  const {
    selectedSupermarket,
    setSelectedSupermarket,
    purchaseMode,
    addToCart,
    cart,
    totalCount,
    totalAmount,
    clearCart,
    updateQuantity,
  } = useCart();

  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [storeModalVisible, setStoreModalVisible] = useState(false);

  // Switch supermarket handler (warns customer that cart and current session will be cleared)
  const handleSwitchStore = () => {
    Alert.alert(
      "Switch Supermarket?",
      "Switching supermarkets will clear your current scanned products and shopping cart. Do you want to select a different store?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch Store",
          style: "destructive",
          onPress: () => {
            setStoreModalVisible(true);
          },
        },
      ]
    );
  };

  const handleSelectStoreFromModal = (store: SupermarketInfo) => {
    setSelectedSupermarket(store);
    setStoreModalVisible(false);
    setScannedSessionItems([]);
    clearCart();
    setToastMsg(`✓ Active Supermarket: ${store.name}`);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Session list of all scanned products (never disappears when scanning multiple items)
  const [scannedSessionItems, setScannedSessionItems] = useState<ScannedSessionItem[]>([]);

  const laserAnim = useRef(new Animated.Value(0)).current;
  const lastScanTimestamp = useRef<number>(0);
  const lastBarcode = useRef<string>("");

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

  // Handle Fresh Session Initialization
  useEffect(() => {
    if (fresh === "true") {
      setScannedSessionItems([]);
      clearCart();
      setSelectedSupermarket(null);
    }
  }, [fresh]);

  // Sync addedToCart status with the live cart
  useEffect(() => {
    setScannedSessionItems((prev) =>
      prev.map((item) => {
        const inCart = cart.some((c) => c._id === item.id);
        const cartItem = cart.find((c) => c._id === item.id);
        return {
          ...item,
          addedToCart: inCart,
          quantity: cartItem ? cartItem.quantity : item.quantity,
        };
      })
    );
  }, [cart]);

  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      setLoading(false);
      setErrorMsg("");
    }, [])
  );

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCAN_BOX_SIZE * 0.7],
  });

  // Handle Barcode Scanned Event
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (!data || loading || scanned) return;

    const now = Date.now();
    const cleanCode = data.trim();

    // Prevent duplicate rapid-fire scanning of the exact same barcode within 1.8 seconds
    if (cleanCode === lastBarcode.current && now - lastScanTimestamp.current < 1800) {
      return;
    }

    lastScanTimestamp.current = now;
    lastBarcode.current = cleanCode;

    setScanned(true);
    setLoading(true);
    setErrorMsg("");

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

      const res = await safeFetch(endpoint, { headers }, 12000);
      const json = await res.json();

      if (res.ok && json.success && json.product) {
        const prod = json.product;

        // If supermarket is not yet identified, automatically identify it from the scanned product
        let currentStore = selectedSupermarket;
        if (!currentStore || !currentStore._id) {
          if (prod.supermarket && typeof prod.supermarket === "object") {
            const sm = prod.supermarket;
            currentStore = {
              _id: sm._id,
              name: sm.name,
              code: sm.code,
              address: sm.address,
              city: sm.city,
              state: sm.state,
              pincode: sm.pincode,
              logoUrl: sm.logoUrl,
            };
            setSelectedSupermarket(currentStore);
            setToastMsg(`✓ Identified: ${sm.name}`);
          } else if (prod.supermarket) {
            try {
              const smRes = await safeFetch(`${API_URL}/supermarkets/${prod.supermarket}`, {}, 5000);
              const smData = await smRes.json();
              if (smData.success && smData.supermarket) {
                const sm = smData.supermarket;
                currentStore = {
                  _id: sm._id,
                  name: sm.name,
                  code: sm.code,
                  address: sm.address,
                  city: sm.city,
                  state: sm.state,
                  pincode: sm.pincode,
                  logoUrl: sm.logoUrl,
                };
                setSelectedSupermarket(currentStore);
                setToastMsg(`✓ Identified: ${sm.name}`);
              }
            } catch (_) {}
          }
        } else {
          // Strict multi-tenant verification: Never allow products from another supermarket
          const prodStoreId = typeof prod.supermarket === "object" ? prod.supermarket._id : prod.supermarket;
          if (prodStoreId && String(prodStoreId) !== String(currentStore._id)) {
            setErrorMsg(`Product "${prod.name}" does not belong to ${currentStore.name}.`);
            setTimeout(() => setErrorMsg(""), 3500);
            return;
          }
        }

        // Check if this product is already in the session scanned list
        setScannedSessionItems((prev) => {
          const existingIdx = prev.findIndex(
            (it) => it.id === prod._id || (it.product?.barcode && it.product.barcode === prod.barcode)
          );

          if (existingIdx !== -1) {
            // Product was scanned previously in this session
            const existing = prev[existingIdx];
            const updated = [...prev];
            const newQty = existing.quantity + 1;
            const stockLimit = Number(prod.stock || 999);
            const clampedQty = Math.min(newQty, stockLimit);

            updated[existingIdx] = {
              ...existing,
              quantity: clampedQty,
              scannedAt: Date.now(),
            };

            // If already in cart, update cart quantity too
            if (existing.addedToCart) {
              addToCart(prod, 1);
            }

            // Move to top of the list so it is highlighted
            const [item] = updated.splice(existingIdx, 1);
            return [item, ...updated];
          }

          // Brand new scanned product: Add to session list (DO NOT auto-add to cart)
          const newItem: ScannedSessionItem = {
            id: prod._id,
            product: prod,
            quantity: 1,
            addedToCart: false,
            scannedAt: Date.now(),
          };

          return [newItem, ...prev];
        });

        // Flash immediate confirmation toast
        const storeNameDisplay = currentStore?.name ? ` from ${currentStore.name}` : "";
        setToastMsg(`✓ Scanned: ${prod.name}${storeNameDisplay}`);
        setTimeout(() => setToastMsg(""), 2800);
      } else {
        const storePrefix = selectedSupermarket?.name ? `in ${selectedSupermarket.name}: ` : "";
        setErrorMsg(json.message || `Product Not Found ${storePrefix}Barcode "${cleanCode}"`);
        setTimeout(() => setErrorMsg(""), 3500);
      }
    } catch (err: any) {
      const isTimeout = err.name === "AbortError";
      setErrorMsg(
        isTimeout
          ? "Request timed out. Please point camera to try again."
          : err.message || "Failed to connect to scanner API"
      );
      setTimeout(() => setErrorMsg(""), 3500);
    } finally {
      setLoading(false);
      // Re-enable scanning after 1.5 seconds cooldown
      setTimeout(() => {
        setScanned(false);
      }, 1500);
    }
  };

  // Explicitly Add Scanned Product to Cart (User Confirmation Required)
  const handleAddToCart = (sessionItem: ScannedSessionItem) => {
    const success = addToCart(sessionItem.product, sessionItem.quantity);
    if (success) {
      setScannedSessionItems((prev) =>
        prev.map((it) => (it.id === sessionItem.id ? { ...it, addedToCart: true } : it))
      );
      setToastMsg(`🛒 Added "${sessionItem.product.name}" to cart!`);
      setTimeout(() => setToastMsg(""), 3000);
    }
  };

  // Adjust item quantity in session (and cart if already added)
  const handleQuantityChange = (sessionItem: ScannedSessionItem, delta: number) => {
    const currentQ = sessionItem.quantity;
    const stockLimit = Number(sessionItem.product.stock || 999);
    const newQ = currentQ + delta;

    if (newQ <= 0) {
      // Remove from session
      handleRemoveItem(sessionItem);
      return;
    }

    if (newQ > stockLimit) {
      Alert.alert("Stock Limit Reached", `Only ${stockLimit} units available in store.`);
      return;
    }

    setScannedSessionItems((prev) =>
      prev.map((it) => (it.id === sessionItem.id ? { ...it, quantity: newQ } : it))
    );

    // If item is already added to cart, sync quantity with cart
    if (sessionItem.addedToCart) {
      updateQuantity(sessionItem.id, delta);
    }
  };

  // Remove item from current scanning session
  const handleRemoveItem = (sessionItem: ScannedSessionItem) => {
    setScannedSessionItems((prev) => prev.filter((it) => it.id !== sessionItem.id));
    if (sessionItem.addedToCart) {
      updateQuantity(sessionItem.id, -sessionItem.quantity);
    }
  };

  // Reset entire scanning session & clear cart
  const handleStartFreshSession = () => {
    Alert.alert(
      "Start Fresh Shopping Session?",
      "This will clear all scanned items and your current shopping cart. Do you want to start a new offline shopping session?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start Fresh",
          style: "destructive",
          onPress: () => {
            setScannedSessionItems([]);
            clearCart();
            setToastMsg("Started fresh offline shopping session.");
            setTimeout(() => setToastMsg(""), 2500);
          },
        },
      ]
    );
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

      {/* Top Header Bar */}
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.headerBackIcon}>‹</Text>
          </TouchableOpacity>

          <View style={{ alignItems: "center" }}>
            <Text style={styles.headerTitle}>Scan Products</Text>
            <View style={styles.offlineHeaderBadge}>
              <Text style={styles.offlineHeaderBadgeText}>
                {selectedSupermarket?.name ? `${selectedSupermarket.name} • OFFLINE` : "OFFLINE SCANNER"}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              style={styles.headerCircleBtn}
              onPress={() => setTorch((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={[styles.headerIconText, torch && { color: "#F59E0B" }]}>⚡</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerCircleBtn}
              onPress={handleStartFreshSession}
              activeOpacity={0.7}
            >
              <Text style={styles.headerIconText}>🔄</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Prominent Supermarket Identity Banner */}
        {selectedSupermarket ? (
          <View style={styles.storeBannerWrap}>
            <View style={styles.storeBannerLeft}>
              <View style={styles.storeLogoBox}>
                <Text style={{ fontSize: 20 }}>🏬</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.storeBannerName} numberOfLines={1}>
                    {selectedSupermarket.name}
                  </Text>
                  <View style={styles.storeCodePill}>
                    <Text style={styles.storeCodePillText}>{selectedSupermarket.code || "STORE"}</Text>
                  </View>
                </View>
                <Text style={styles.storeBannerLocation} numberOfLines={1}>
                  📍 {selectedSupermarket.city || selectedSupermarket.address || "Active In-Store Session"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.switchStoreBtn}
              onPress={handleSwitchStore}
              activeOpacity={0.7}
            >
              <Text style={styles.switchStoreBtnText}>Switch Store</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </SafeAreaView>

      {/* Live Camera Viewfinder (Top Half) */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        />

        {/* Viewfinder Target Frame */}
        <View style={styles.scanTargetBox}>
          {/* Corner Brackets */}
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
              <ActivityIndicator size="small" color="#FBBF24" />
              <Text style={styles.loadingText}>
                Fetching from {selectedSupermarket?.name || "supermarket"}...
              </Text>
            </View>
          )}
        </View>

        {/* Floating Toast Notification */}
        {toastMsg ? (
          <View style={styles.toastPill}>
            <Text style={styles.toastText}>{toastMsg}</Text>
          </View>
        ) : null}

        {/* Error Notification Pill */}
        {errorMsg ? (
          <View style={styles.errorPill}>
            <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          </View>
        ) : null}

        <View style={styles.scanInstructionWrap}>
          <Text style={styles.scanInstructionText}>
            Align barcode inside frame • Scanned items remain in session
          </Text>
        </View>
      </View>

      {/* Scanned Products Session List (Bottom Section) */}
      <View style={styles.sessionListContainer}>
        {/* Session Section Header */}
        <View style={styles.sessionListHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.sessionHeaderTitle}>Scanned Products</Text>
            <View style={styles.sessionCountBadge}>
              <Text style={styles.sessionCountBadgeText}>{scannedSessionItems.length}</Text>
            </View>
          </View>

          {scannedSessionItems.length > 0 && (
            <TouchableOpacity onPress={handleStartFreshSession} activeOpacity={0.7}>
              <Text style={styles.clearSessionText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Scanned Products Cards List */}
        {scannedSessionItems.length === 0 ? (
          <View style={styles.emptySessionState}>
            <Text style={{ fontSize: 34, marginBottom: 6 }}>📦</Text>
            <Text style={styles.emptySessionTitle}>No products scanned yet</Text>
            <Text style={styles.emptySessionSub}>
              Scan any product barcode above. All scanned products will be displayed here immediately and remain visible.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scannedScroll}
            contentContainerStyle={styles.scannedScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {scannedSessionItems.map((item, index) => {
              const prod = item.product;
              const rawPrice = Number(prod.price || 0);
              const rawCostPrice = Number(prod.costPrice || 0);
              const explicitDiscount = Number(prod.discount || 0);

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

              const inStock = Number(prod.stock || 0) > 0;
              const stockCount = Number(prod.stock || 0);
              const itemSubtotal = finalPrice * item.quantity;

              return (
                <View key={`${item.id}-${index}`} style={styles.productCard}>
                  {/* Top Row: Thumbnail + Info + Delete */}
                  <View style={styles.cardMainRow}>
                    {/* Thumbnail Image */}
                    <View style={styles.thumbWrapper}>
                      <Image
                        source={
                          prod.imageUrl
                            ? { uri: prod.imageUrl }
                            : require("@/assets/images/react-logo.png")
                        }
                        style={styles.thumbImg}
                        resizeMode="contain"
                      />
                    </View>

                    {/* Details Column */}
                    <View style={styles.detailsCol}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Text style={styles.productName} numberOfLines={2}>
                          {prod.name}
                        </Text>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleRemoveItem(item)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.deleteBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.productMeta} numberOfLines={1}>
                        {prod.brand || "Supermarket"} • {prod.category || "General"}
                      </Text>

                      {/* Barcode and Supermarket Verification Badges */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginVertical: 3 }}>
                        <View style={styles.barcodeBadge}>
                          <Text style={styles.barcodeBadgeText}>#{prod.barcode || "BARCODE"}</Text>
                        </View>
                        <View style={styles.storeVerifiedBadge}>
                          <Text style={styles.storeVerifiedText}>✓ {selectedSupermarket?.name || "Verified Store"}</Text>
                        </View>
                      </View>

                      {/* Stock availability indicator */}
                      <View style={styles.stockPillRow}>
                        <View
                          style={[
                            styles.stockDot,
                            { backgroundColor: inStock ? "#16A34A" : "#DC2626" },
                          ]}
                        />
                        <Text
                          style={[
                            styles.stockText,
                            { color: inStock ? "#16A34A" : "#DC2626" },
                          ]}
                        >
                          {inStock ? `In Stock (${stockCount} units)` : "Out of Stock"}
                        </Text>
                      </View>

                      {/* Price & MRP Row */}
                      <View style={styles.priceRow}>
                        <Text style={styles.finalPriceText}>₹{finalPrice.toFixed(2)}</Text>
                        {discountAmount > 0 && originalMrp > finalPrice && (
                          <>
                            <Text style={styles.mrpText}>₹{originalMrp.toFixed(2)}</Text>
                            <View style={styles.discountBadge}>
                              <Text style={styles.discountBadgeText}>
                                ₹{discountAmount.toFixed(0)} OFF
                              </Text>
                            </View>
                          </>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Bottom Action Row: Stepper + Add To Cart Button */}
                  <View style={styles.cardBottomRow}>
                    {/* Quantity Stepper */}
                    <View style={styles.stepperBox}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleQuantityChange(item, -1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperQtyText}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={[
                          styles.stepperBtn,
                          item.quantity >= stockCount && { opacity: 0.4 },
                        ]}
                        onPress={() => handleQuantityChange(item, 1)}
                        disabled={item.quantity >= stockCount}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Subtotal */}
                    <View style={{ flex: 1, paddingHorizontal: 10 }}>
                      <Text style={styles.itemSubtotalLabel}>Subtotal</Text>
                      <Text style={styles.itemSubtotalVal}>₹{itemSubtotal.toFixed(2)}</Text>
                    </View>

                    {/* Explicit Add to Cart Button */}
                    {item.addedToCart ? (
                      <View style={styles.addedBadge}>
                        <Text style={styles.addedBadgeCheck}>✓</Text>
                        <Text style={styles.addedBadgeText}>In Cart</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.addToCartBtn,
                          !inStock && { backgroundColor: "#94A3B8" },
                        ]}
                        onPress={() => handleAddToCart(item)}
                        disabled={!inStock}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.addToCartBtnIcon}>🛒</Text>
                        <Text style={styles.addToCartBtnText}>Add to Cart</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* View Cart Sticky Bottom Bar */}
        {cart.length > 0 && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.viewCartBtn}
              onPress={() => router.push("/cart")}
              activeOpacity={0.88}
            >
              <View style={styles.cartCountPill}>
                <Text style={styles.cartCountText}>{totalCount}</Text>
              </View>
              <Text style={styles.viewCartBtnText}>
                View Cart • ₹{Number(totalAmount || 0).toFixed(2)}
              </Text>
              <Text style={styles.viewCartArrow}>➔</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Supermarket Selection Modal */}
      <SupermarketSearchModal
        visible={storeModalVisible}
        mode="offline"
        title="Select Your Supermarket"
        subtitle="Choose the supermarket where you are currently shopping to enable in-store barcode scanning."
        onSelect={handleSelectStoreFromModal}
        onClose={() => setStoreModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1E1B4B", // Royal purple dark canvas
  },
  headerSafe: {
    backgroundColor: "#2E0854",
  },
  storeBannerWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  storeBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  storeLogoBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  storeBannerName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  storeCodePill: {
    backgroundColor: "#059669",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  storeCodePillText: {
    color: "#FFFFFF",
    fontSize: 8.5,
    fontWeight: "900",
  },
  storeBannerLocation: {
    color: "#C4B5FD",
    fontSize: 11,
    marginTop: 2,
  },
  switchStoreBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  switchStoreBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },

  /* Store Identification Lock Screen */
  storeLockedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 10,
  },
  storeLockedCard: {
    backgroundColor: "#1E293B",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#334155",
    width: "100%",
    maxWidth: 360,
  },
  storeLockedIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(124, 58, 237, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#7C3AED",
  },
  storeLockedTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  storeLockedSubtitle: {
    color: "#94A3B8",
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  identifyStoreBtn: {
    backgroundColor: "#059669",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    shadowColor: "#059669",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  identifyStoreBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  /* Barcode & Store Badges on Scanned Cards */
  barcodeBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  barcodeBadgeText: {
    color: "#475569",
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  storeVerifiedBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  storeVerifiedText: {
    color: "#059669",
    fontSize: 9.5,
    fontWeight: "800",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBackIcon: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "600",
    marginTop: -3,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  offlineHeaderBadge: {
    backgroundColor: "#059669",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  offlineHeaderBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  headerIconText: {
    fontSize: 17,
    color: "#FFFFFF",
  },

  /* Camera Viewfinder (Top Section) */
  cameraContainer: {
    height: height * 0.32,
    position: "relative",
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  scanTargetBox: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE * 0.65,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  corner: {
    position: "absolute",
    width: 22,
    height: 22,
    borderColor: "#FFFFFF",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 6,
  },
  laserLine: {
    position: "absolute",
    top: 6,
    left: 10,
    right: 10,
    height: 2.5,
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
  },
  loadingBox: {
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  toastPill: {
    position: "absolute",
    top: 10,
    backgroundColor: "#059669",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  errorPill: {
    position: "absolute",
    top: 10,
    backgroundColor: "#DC2626",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  errorText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  scanInstructionWrap: {
    position: "absolute",
    bottom: 8,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scanInstructionText: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "600",
  },

  /* Scanned Products Session List (Bottom Section) */
  sessionListContainer: {
    flex: 1,
    backgroundColor: "#F4EFFE", // Soft lavender canvas
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  sessionListHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  sessionHeaderTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1E1B4B",
  },
  sessionCountBadge: {
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  sessionCountBadgeText: {
    color: "#6D28D9",
    fontSize: 12,
    fontWeight: "900",
  },
  clearSessionText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "700",
  },
  emptySessionState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptySessionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E1B4B",
    marginBottom: 6,
  },
  emptySessionSub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  scannedScroll: {
    flex: 1,
  },
  scannedScrollContent: {
    padding: 14,
    paddingBottom: 85,
    gap: 12,
  },

  /* Scanned Product Card */
  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    shadowColor: "#3B0764",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  cardMainRow: {
    flexDirection: "row",
    gap: 12,
  },
  thumbWrapper: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
  },
  detailsCol: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
    lineHeight: 18,
  },
  deleteBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deleteBtnText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "700",
  },
  productMeta: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 2,
  },
  stockPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockText: {
    fontSize: 11,
    fontWeight: "700",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  finalPriceText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1E3A8A",
  },
  mrpText: {
    fontSize: 12,
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  discountBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803D",
  },

  /* Card Bottom Action Row */
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  stepperBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    overflow: "hidden",
  },
  stepperBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stepperBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
  },
  stepperQtyText: {
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    minWidth: 24,
    textAlign: "center",
  },
  itemSubtotalLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
  },
  itemSubtotalVal: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0F172A",
  },
  addToCartBtn: {
    backgroundColor: "#059669",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addToCartBtnIcon: {
    fontSize: 13,
  },
  addToCartBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  addedBadge: {
    backgroundColor: "#DCFCE7",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  addedBadgeCheck: {
    color: "#15803D",
    fontSize: 12,
    fontWeight: "900",
  },
  addedBadgeText: {
    color: "#15803D",
    fontSize: 12,
    fontWeight: "800",
  },

  /* Bottom View Cart Sticky Bar */
  bottomBar: {
    position: "absolute",
    bottom: 12,
    left: 16,
    right: 16,
  },
  viewCartBtn: {
    backgroundColor: "#2E0854", // Deep signature purple
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 24,
    shadowColor: "#2E0854",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  cartCountPill: {
    backgroundColor: "#F59E0B", // Gold amber badge
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  cartCountText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  viewCartBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  viewCartArrow: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  /* Permissions */
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
    color: "#0F172A",
    marginBottom: 8,
  },
  permissionSub: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  grantBtn: {
    backgroundColor: Theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  grantBtnText: {
    color: Theme.white,
    fontWeight: "700",
    fontSize: 15,
  },
  backLink: {
    color: Theme.primary,
    fontWeight: "600",
    fontSize: 14,
  },
});
