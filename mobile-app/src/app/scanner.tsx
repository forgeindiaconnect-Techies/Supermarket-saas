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
  const { fresh, mode } = useLocalSearchParams<{ fresh?: string; mode?: string }>();
  const {
    selectedSupermarket,
    setSelectedSupermarket,
    purchaseMode,
    setPurchaseMode,
    startFreshOfflineSession,
    addToCart,
    cart,
    totalCount,
    totalAmount,
    clearCart,
    updateQuantity,
    customerUser,
    customerInfo,
  } = useCart();

  // In offline in-store mode, enforce offline purchase mode
  useEffect(() => {
    setPurchaseMode("offline");
  }, []);

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
      startFreshOfflineSession();
    }
  }, [fresh, startFreshOfflineSession]);

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

      let prod: any = null;
      let rawSm: any = null;

      try {
        const res = await safeFetch(endpoint, { headers }, 15000);
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && json?.product) {
          prod = json.product;
          rawSm = prod.supermarket || json.supermarket;
        }
      } catch (_) {}

      // Fallback 1: If product not yet resolved (e.g. deployed backend required supermarket ID before initial scan),
      // search active products across the catalog using the clean barcode
      if (!prod) {
        try {
          const fallbackRes = await safeFetch(
            `${API_URL}/products?search=${encodeURIComponent(cleanCode)}`,
            {},
            15000
          );
          if (fallbackRes.ok) {
            const fallbackJson = await fallbackRes.json().catch(() => null);
            if (fallbackJson?.success && Array.isArray(fallbackJson.products) && fallbackJson.products.length > 0) {
              const matched =
                fallbackJson.products.find((p: any) => {
                  const b = String(p.barcode || "").trim();
                  return (
                    b === cleanCode ||
                    b === cleanCode.replace(/^0+/, "") ||
                    cleanCode.endsWith(b) ||
                    b.endsWith(cleanCode)
                  );
                }) || fallbackJson.products[0];

              if (matched) {
                prod = matched;
                rawSm = matched.supermarket;
              }
            }
          }
        } catch (_) {}
      }

      // Fallback 2: Direct lookup by ID if code is a 24-hex MongoDB ObjectId
      if (!prod && cleanCode.match(/^[0-9a-fA-F]{24}$/)) {
        try {
          const idRes = await safeFetch(`${API_URL}/products/${cleanCode}`, {}, 10000);
          if (idRes.ok) {
            const idJson = await idRes.json().catch(() => null);
            if (idJson?.success && idJson?.product) {
              prod = idJson.product;
              rawSm = prod.supermarket;
            }
          }
        } catch (_) {}
      }

      if (prod) {
        // Automatically identify supermarket from the scanned product
        let currentStore = selectedSupermarket;
        const sm = rawSm || prod.supermarket;

        if (!currentStore || !currentStore._id) {
          if (sm && typeof sm === "object" && sm.name) {
            currentStore = {
              _id: String(sm._id || ""),
              name: sm.name,
              code: sm.code || prod.supermarketCode || "",
              address: sm.address,
              city: sm.city,
              state: sm.state,
              pincode: sm.pincode,
              logoUrl: sm.logoUrl,
            };
            setSelectedSupermarket(currentStore);
            setToastMsg(`✓ Identified: ${sm.name}`);
          } else if (sm) {
            // Attempt to resolve store details by ID, or fallback to product-level attributes
            try {
              const smRes = await safeFetch(`${API_URL}/supermarkets/${sm}`, {}, 6000);
              const smData = await smRes.json().catch(() => null);
              if (smData?.success && smData?.supermarket) {
                const s = smData.supermarket;
                currentStore = {
                  _id: String(s._id),
                  name: s.name,
                  code: s.code,
                  address: s.address,
                  city: s.city,
                  state: s.state,
                  pincode: s.pincode,
                  logoUrl: s.logoUrl,
                };
                setSelectedSupermarket(currentStore);
                setToastMsg(`✓ Identified: ${s.name}`);
              } else if (prod.supermarketName) {
                currentStore = {
                  _id: String(sm),
                  name: prod.supermarketName,
                  code: prod.supermarketCode || "",
                };
                setSelectedSupermarket(currentStore);
                setToastMsg(`✓ Identified: ${prod.supermarketName}`);
              }
            } catch (_) {
              if (prod.supermarketName) {
                currentStore = {
                  _id: String(sm),
                  name: prod.supermarketName,
                  code: prod.supermarketCode || "",
                };
                setSelectedSupermarket(currentStore);
                setToastMsg(`✓ Identified: ${prod.supermarketName}`);
              }
            }
          } else if (prod.supermarketName) {
            currentStore = {
              _id: String(prod._id || "identified_store"),
              name: prod.supermarketName,
              code: prod.supermarketCode || "",
            };
            setSelectedSupermarket(currentStore);
            setToastMsg(`✓ Identified: ${prod.supermarketName}`);
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

        // AUTOMATIC SCAN & ADD TO CART (Physical Supermarket In-Store Self-Checkout)
        addToCart(prod, 1);

        // Update session scanned products list
        setScannedSessionItems((prev) => {
          const existingIdx = prev.findIndex(
            (it) => it.id === prod._id || (it.product?.barcode && it.product.barcode === prod.barcode)
          );

          if (existingIdx !== -1) {
            // Product was scanned previously in this session: increment quantity
            const existing = prev[existingIdx];
            const updated = [...prev];
            const newQty = existing.quantity + 1;
            const stockLimit = Number(prod.stock || 999);
            const clampedQty = Math.min(newQty, stockLimit);

            updated[existingIdx] = {
              ...existing,
              quantity: clampedQty,
              addedToCart: true,
              scannedAt: Date.now(),
            };

            // Move to top of the list so it is highlighted
            const [item] = updated.splice(existingIdx, 1);
            return [item, ...updated];
          }

          // Brand new scanned product: Added directly to cart
          const newItem: ScannedSessionItem = {
            id: prod._id,
            product: prod,
            quantity: 1,
            addedToCart: true,
            scannedAt: Date.now(),
          };

          return [newItem, ...prev];
        });

        // Flash immediate confirmation toast
        const storeNameDisplay = currentStore?.name ? ` • ${currentStore.name}` : "";
        setToastMsg(`✓ Added to Cart: ${prod.name}${storeNameDisplay}`);
        setTimeout(() => setToastMsg(""), 2800);
      } else {
        const storePrefix = selectedSupermarket?.name ? `in ${selectedSupermarket.name}: ` : "";
        setErrorMsg(`Product Not Found ${storePrefix}(Barcode: "${cleanCode}")`);
        setTimeout(() => setErrorMsg(""), 3500);
      }
    } catch (err: any) {
      const raw = (err?.message || "") + " " + (err?.cause?.message || "") + " " + String(err || "");
      const isTimeout =
        err.name === "AbortError" ||
        raw.toLowerCase().includes("cancel") ||
        raw.toLowerCase().includes("abort") ||
        raw.toLowerCase().includes("timeout") ||
        raw.toLowerCase().includes("fetch failed");
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

  // Explicitly Add Scanned Product to Cart (Fallback if item was removed from cart)
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

  // Adjust item quantity in session and cart
  const handleQuantityChange = (sessionItem: ScannedSessionItem, delta: number) => {
    const currentQ = sessionItem.quantity;
    const stockLimit = Number(sessionItem.product.stock || 999);
    const newQ = currentQ + delta;

    if (newQ <= 0) {
      // Remove from session and cart
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

    // Sync quantity with cart
    updateQuantity(sessionItem.id, delta);
  };

  // Remove item from current scanning session and cart
  const handleRemoveItem = (sessionItem: ScannedSessionItem) => {
    setScannedSessionItems((prev) => prev.filter((it) => it.id !== sessionItem.id));
    updateQuantity(sessionItem.id, -sessionItem.quantity);
    setToastMsg(`Removed "${sessionItem.product.name}" from cart`);
    setTimeout(() => setToastMsg(""), 2200);
  };

  // Step 4: Proceed to In-Store Payment
  // Strict requirement: When customer clicks PAY NOW, do not directly open payment.
  // First display mandatory Offline Customer Details form to collect current walk-in customer's details.
  const handleProceedToPayment = () => {
    if (cart.length === 0) {
      Alert.alert("Empty Cart", "Please scan product barcodes to add items before proceeding.");
      return;
    }

    router.push({
      pathname: "/customer-details",
      params: { method: "UPI" },
    });
  };

  // Reset entire scanning session, clear cart & ensure completely fresh privacy state
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
            startFreshOfflineSession();
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
                {selectedSupermarket?.name
                  ? `${selectedSupermarket.name} • OFFLINE SCANNER`
                  : "OFFLINE SCANNER"}
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
                {scannedSessionItems.length > 0 && selectedSupermarket?.name
                  ? `Scanning in ${selectedSupermarket.name}...`
                  : "Looking up product..."}
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
        {/* Supermarket Name displayed strictly ABOVE the scanned product details once scanned */}
        {selectedSupermarket?.name && scannedSessionItems.length > 0 && (
          <View style={styles.scannedStoreBanner}>
            <View style={styles.scannedStoreIconCircle}>
              <Text style={{ fontSize: 18 }}>🏬</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.scannedStoreSubLabel}>SUPERMARKET</Text>
              <Text style={styles.scannedStoreName} numberOfLines={1}>
                {selectedSupermarket.name}
              </Text>
              {(selectedSupermarket.city || selectedSupermarket.address) && (
                <Text style={styles.scannedStoreLoc} numberOfLines={1}>
                  📍 {selectedSupermarket.city || selectedSupermarket.address}
                </Text>
              )}
            </View>
            {selectedSupermarket.code && (
              <View style={styles.scannedStoreCodePill}>
                <Text style={styles.scannedStoreCodeText}>{selectedSupermarket.code}</Text>
              </View>
            )}
          </View>
        )}

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
              Point camera at any product barcode above. The supermarket and product details will appear here once scanned.
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
                      {/* Step 2: Supermarket Name clearly displayed above product details */}
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                        <Text style={{ fontSize: 10, fontWeight: "800", color: "#6D28D9", textTransform: "uppercase", letterSpacing: 0.5 }}>
                          🏬 Supermarket:{" "}
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: "800", color: "#4338CA", flex: 1 }} numberOfLines={1}>
                          {selectedSupermarket?.name || prod.supermarketName || "Family Foods Supermarket"}
                        </Text>
                      </View>

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

                      {/* Barcode and Unit Badges */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginVertical: 3 }}>
                        <View style={styles.barcodeBadge}>
                          <Text style={styles.barcodeBadgeText}>Barcode: #{prod.barcode || "BARCODE"}</Text>
                        </View>
                        {prod.unit ? (
                          <View style={[styles.barcodeBadge, { backgroundColor: "#F1F5F9", borderColor: "#CBD5E1" }]}>
                            <Text style={[styles.barcodeBadgeText, { color: "#475569" }]}>Unit: {prod.unit}</Text>
                          </View>
                        ) : null}
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
                          {inStock ? `Stock: ${stockCount} available` : "Out of Stock"}
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

        {/* Direct In-Store Checkout / Payment Sticky Bar */}
        {cart.length > 0 && (
          <View style={styles.bottomBar}>
            <View style={styles.checkoutBarContainer}>
              <View style={styles.checkoutBarInfo}>
                <View style={styles.cartCountBadge}>
                  <Text style={styles.cartCountBadgeText}>
                    🛒 {totalCount} {totalCount === 1 ? "Item" : "Items"} Scanned
                  </Text>
                </View>
                <Text style={styles.checkoutBarTotalLabel}>Total Amount</Text>
                <Text style={styles.checkoutBarTotalValue}>
                  ₹{Number(totalAmount || 0).toFixed(2)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.payNowBtn}
                onPress={handleProceedToPayment}
                activeOpacity={0.88}
              >
                <Text style={styles.payNowBtnText}>
                  Proceed to Payment (₹{Number(totalAmount || 0).toFixed(2)})
                </Text>
                <Text style={styles.payNowBtnArrow}>➔</Text>
              </TouchableOpacity>
            </View>
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
  scannedStoreBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: "#EDE9FE",
    shadowColor: "#6D28D9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  scannedStoreIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  scannedStoreSubLabel: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#6D28D9",
    letterSpacing: 0.6,
  },
  scannedStoreName: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1E1B4B",
    marginTop: 1,
  },
  scannedStoreLoc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  scannedStoreCodePill: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scannedStoreCodeText: {
    color: "#059669",
    fontSize: 10,
    fontWeight: "900",
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
    paddingBottom: 130,
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

  /* Bottom Direct In-Store Checkout Sticky Bar */
  bottomBar: {
    position: "absolute",
    bottom: 12,
    left: 14,
    right: 14,
    backgroundColor: "#2E0854", // Deep signature purple
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#2E0854",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: "#581C87",
  },
  checkoutBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  checkoutBarInfo: {
    flex: 1,
    marginRight: 10,
  },
  cartCountBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 2,
  },
  cartCountBadgeText: {
    color: "#FDE047",
    fontSize: 11,
    fontWeight: "800",
  },
  checkoutBarTotalLabel: {
    color: "#D8B4FE",
    fontSize: 9.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  checkoutBarTotalValue: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
  },
  payNowBtn: {
    backgroundColor: "#16A34A", // Emerald green for high-contrast checkout action
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  payNowBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "900",
  },
  payNowBtnArrow: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  viewCartLink: {
    alignItems: "center",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.12)",
  },
  viewCartLinkText: {
    color: "#C4B5FD",
    fontSize: 11.5,
    fontWeight: "700",
  },
  viewCartBtn: {
    backgroundColor: "#2E0854",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 24,
  },
  cartCountPill: {
    backgroundColor: "#F59E0B",
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
