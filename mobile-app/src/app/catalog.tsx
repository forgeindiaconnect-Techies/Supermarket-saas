import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCart, SupermarketInfo } from "../context/CartContext";
import { API_URL, safeFetch } from "../constants/api";
import CustomerBottomNav from "../components/CustomerBottomNav";

const { width } = Dimensions.get("window");

const CATEGORIES = [
  "All",
  "Fruits & Vegetables",
  "Beverages",
  "Snacks",
  "Dairy",
  "Groceries",
  "Household",
];

export default function OnlineCatalogScreen() {
  const router = useRouter();
  const {
    selectedSupermarket,
    setSelectedSupermarket,
    setPurchaseMode,
    cart,
    addToCart,
    updateQuantity,
    totalCount,
    totalAmount,
    customerUser,
    isAuthLoading,
  } = useCart();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Guard: Mandatory Registration & Authentication for Online Shopping
  // Waits for session to finish loading before evaluating guard
  useEffect(() => {
    if (isAuthLoading) return;
    if (!customerUser || !customerUser.token) {
      router.replace({ pathname: "/auth", params: { tab: "register" } });
    }
  }, [isAuthLoading, customerUser]);

  // Permanently bind to the customer's registered supermarket
  useEffect(() => {
    setPurchaseMode("online");
    if (!selectedSupermarket && customerUser?.supermarketId) {
      setSelectedSupermarket({
        _id: String(customerUser.supermarketId),
        name: customerUser.supermarketName || "Supermarket",
        code: customerUser.supermarketCode || "",
        onlineAvailable: true,
        offlineAvailable: true,
      });
    }
  }, [selectedSupermarket, customerUser]);

  const fetchStoreProducts = useCallback(async () => {
    const targetStoreId = customerUser?.supermarketId || selectedSupermarket?._id;
    const targetStoreCode = customerUser?.supermarketCode || selectedSupermarket?.code;
    if (!targetStoreId) return;

    try {
      setLoading(true);
      if (!API_URL) throw new Error("API URL not configured");

      const params = new URLSearchParams();
      params.append("supermarketId", String(targetStoreId));
      if (targetStoreCode) {
        params.append("supermarketCode", String(targetStoreCode));
      }
      if (selectedCategory !== "All") {
        params.append("category", selectedCategory);
      }
      params.append("_t", Date.now().toString());

      const reqHeaders: Record<string, string> = {
        "x-supermarket-id": String(targetStoreId),
        "x-supermarket-code": String(targetStoreCode || ""),
      };
      if (customerUser?.token) {
        reqHeaders["Authorization"] = `Bearer ${customerUser.token}`;
      }

      const res = await safeFetch(`${API_URL}/products?${params.toString()}`, {
        headers: reqHeaders,
      }, 15000);

      const contentType = res.headers?.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.success && Array.isArray(data.products)) {
          setProducts(data.products);
        } else {
          setProducts([]);
        }
      } else {
        setProducts([]);
      }
    } catch (_) {
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSupermarket, customerUser, selectedCategory]);

  useEffect(() => {
    fetchStoreProducts();
  }, [fetchStoreProducts]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStoreProducts();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Deep Purple Top Banner Header */}
      <View style={styles.purpleHeader}>
        <SafeAreaView edges={["top"]} style={styles.headerSafe}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => router.replace("/")}
              activeOpacity={0.7}
            >
              <Text style={styles.headerBackArrow}>‹</Text>
            </TouchableOpacity>

            <View style={styles.headerStoreBlock}>
              <View style={styles.storePickerPill}>
                <Text style={styles.storePickerIcon}>🏪</Text>
                <Text style={styles.storePickerName} numberOfLines={1}>
                  {customerUser?.supermarketName || selectedSupermarket?.name || "SuperMart Store"}
                </Text>
              </View>
              <Text style={styles.storeLocationSub}>
                {selectedSupermarket?.city ? `📍 ${selectedSupermarket.city}` : "Registered Store"} • Online Store
              </Text>
            </View>

            <TouchableOpacity
              style={styles.cartHeaderBtn}
              onPress={() => router.push("/cart")}
              activeOpacity={0.7}
            >
              <Text style={styles.cartHeaderIcon}>🛒</Text>
              {totalCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{totalCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* Category Pills Slider */}
      <View style={styles.categoriesWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoriesContent}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item;
            return (
              <TouchableOpacity
                style={[
                  styles.categoryPill,
                  isSelected && styles.categoryPillActive,
                ]}
                onPress={() => setSelectedCategory(item)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isSelected && styles.categoryTextActive,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Products Matrix / Grid */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B0764" />
          <Text style={styles.loadingText}>
            Loading {selectedSupermarket?.name || "store"} products...
          </Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No Products Found</Text>
          <Text style={styles.emptySub}>
            There are currently no catalog products listed under {customerUser?.supermarketName || selectedSupermarket?.name || "this supermarket"}.
          </Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
            <Text style={styles.refreshBtnText}>Refresh Catalog</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item._id || item.barcode}
          numColumns={2}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          columnWrapperStyle={styles.rowWrapper}
          contentContainerStyle={styles.productsList}
          renderItem={({ item }) => {
            const cartEntry = cart.find((c) => c._id === item._id);
            const inCartQty = cartEntry ? cartEntry.quantity : 0;

            const price = Number(item.price || 0);
            const costPrice = Number(item.costPrice || 0);
            const isOutOfStock = item.stock <= 0;

            let mrp = price;
            let effective = price;
            if (costPrice > 0 && costPrice !== price) {
              mrp = Math.max(price, costPrice);
              effective = Math.min(price, costPrice);
            }

            return (
              <View style={styles.productCard}>
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/product-details",
                      params: { productId: item._id, barcode: item.barcode },
                    })
                  }
                  activeOpacity={0.85}
                  style={styles.cardImageTouch}
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.placeholderImg}>
                      <Text style={{ fontSize: 32 }}>🛍️</Text>
                    </View>
                  )}

                  {item.discount > 0 && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>OFFER</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.cardDetails}>
                  <Text style={styles.brandName} numberOfLines={1}>
                    {item.brand || "General"}
                  </Text>
                  <Text style={styles.productTitle} numberOfLines={2}>
                    {item.name}
                  </Text>

                  <View style={styles.priceRow}>
                    <Text style={styles.effectivePrice}>₹{effective}</Text>
                    {mrp > effective && (
                      <Text style={styles.mrpCrossed}>₹{mrp}</Text>
                    )}
                  </View>

                  <View style={styles.stockStatusRow}>
                    <Text
                      style={[
                        styles.stockStatusText,
                        isOutOfStock
                          ? styles.outOfStock
                          : item.stock < 10
                          ? styles.lowStock
                          : styles.inStock,
                      ]}
                    >
                      {isOutOfStock ? "Out of Stock" : `${item.stock} left in store`}
                    </Text>
                  </View>

                  {/* Add to Cart / Quantity Stepper */}
                  {isOutOfStock ? (
                    <View style={styles.disabledAddBtn}>
                      <Text style={styles.disabledAddText}>Unavailable</Text>
                    </View>
                  ) : inCartQty > 0 ? (
                    <View style={styles.stepperWrap}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => updateQuantity(item._id, -1)}
                      >
                        <Text style={styles.stepBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperQty}>{inCartQty}</Text>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => addToCart(item, 1)}
                      >
                        <Text style={styles.stepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.addCartBtn}
                      onPress={() => addToCart(item, 1)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.addCartText}>+ Add to Cart</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Floating Bottom Cart Bar if items exist */}
      {totalCount > 0 && (
        <View style={styles.floatingCartBar}>
          <View style={styles.floatingCartLeft}>
            <Text style={styles.floatingCartCount}>{totalCount} {totalCount === 1 ? "Item" : "Items"}</Text>
            <Text style={styles.floatingCartTotal}>Total: ₹{totalAmount.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={styles.floatingCartBtn}
            onPress={() => router.push("/cart")}
            activeOpacity={0.88}
          >
            <Text style={styles.floatingCartBtnText}>View Cart →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Nav */}
      <CustomerBottomNav activeTab="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  purpleHeader: {
    backgroundColor: "#2E0854",
    paddingBottom: 12,
  },
  headerSafe: {
    backgroundColor: "#2E0854",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBackArrow: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "300",
  },
  headerStoreBlock: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  storePickerPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
    maxWidth: "85%",
  },
  storePickerIcon: {
    fontSize: 14,
  },
  storePickerName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  storeLocationSub: {
    color: "#CBB2FE",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  cartHeaderBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cartHeaderIcon: {
    fontSize: 20,
  },
  cartBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#EF4444",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  categoriesWrap: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
  },
  categoryPillActive: {
    backgroundColor: "#3B0764",
  },
  categoryText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#64748B",
  },
  categoryTextActive: {
    color: "#FFFFFF",
  },
  productsList: {
    padding: 12,
    paddingBottom: 90,
  },
  rowWrapper: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  productCard: {
    width: (width - 34) / 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardImageTouch: {
    width: "100%",
    height: 125,
    backgroundColor: "#F8FAFC",
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  placeholderImg: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  discountBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#DC2626",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
  cardDetails: {
    padding: 10,
  },
  brandName: {
    fontSize: 10.5,
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  productTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
    minHeight: 34,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  effectivePrice: {
    fontSize: 14.5,
    fontWeight: "900",
    color: "#059669",
  },
  mrpCrossed: {
    fontSize: 12,
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  stockStatusRow: {
    marginTop: 4,
    marginBottom: 8,
  },
  stockStatusText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  inStock: {
    color: "#15803D",
  },
  lowStock: {
    color: "#D97706",
  },
  outOfStock: {
    color: "#DC2626",
  },
  addCartBtn: {
    backgroundColor: "#F6BC45",
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addCartText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#2E0854",
  },
  disabledAddBtn: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  disabledAddText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#94A3B8",
  },
  stepperWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2E0854",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  stepperQty: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  floatingCartBar: {
    position: "absolute",
    bottom: 60,
    left: 16,
    right: 16,
    backgroundColor: "#2E0854",
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingCartLeft: {
    flex: 1,
  },
  floatingCartCount: {
    color: "#FDE68A",
    fontSize: 12,
    fontWeight: "700",
  },
  floatingCartTotal: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  floatingCartBtn: {
    backgroundColor: "#F6BC45",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  floatingCartBtnText: {
    color: "#2E0854",
    fontSize: 13,
    fontWeight: "900",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
    marginBottom: 16,
  },
  refreshBtn: {
    backgroundColor: "#3B0764",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
  },
  refreshBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },
});
