import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SupermarketInfo } from "../context/CartContext";
import { API_URL, safeFetch } from "../constants/api";

const { width, height } = Dimensions.get("window");

interface SupermarketSearchModalProps {
  visible: boolean;
  mode: "online" | "offline";
  title?: string;
  subtitle?: string;
  onSelect: (supermarket: SupermarketInfo) => void;
  onClose: () => void;
  onUnavailableSelected?: (supermarket: SupermarketInfo) => void;
}

export default function SupermarketSearchModal({
  visible,
  mode,
  title,
  subtitle,
  onSelect,
  onClose,
  onUnavailableSelected,
}: SupermarketSearchModalProps) {
  const [stores, setStores] = useState<SupermarketInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const modalTitle =
    title || "Select Supermarket";

  const fetchStores = async () => {
    try {
      setLoading(true);
      setError("");

      if (!API_URL) throw new Error("API URL missing");

      const endpoint = `${API_URL}/supermarkets?_t=${Date.now()}`;
      const res = await safeFetch(endpoint, {}, 6000);
      const data = await res.json();

      if (data.success && Array.isArray(data.supermarkets)) {
        setStores(data.supermarkets);
      } else {
        setStores([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load supermarkets");
      setStores([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchStores();
    }
  }, [visible]);

  const handleStorePress = (store: SupermarketInfo) => {
    const isSupported =
      mode === "online"
        ? (store.onlineDeliveryAvailable === true || store.selfPickupAvailable === true || store.onlineAvailable === true)
        : (store.selfPickupAvailable === true || store.offlineAvailable === true);

    if (!isSupported) {
      if (onUnavailableSelected) {
        onUnavailableSelected(store);
      }
      return;
    }

    onSelect(store);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>{modalTitle}</Text>
            <Text style={styles.headerSub}>
              {subtitle || "Available Registered Supermarkets"}
            </Text>
          </View>

          <View style={{ width: 36 }} />
        </View>

        {/* Store List (Search bar removed per exact specification) */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#3B0764" />
            <Text style={styles.loadingText}>Fetching registered supermarkets...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => fetchStores()}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : stores.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyIcon}>🏪</Text>
            <Text style={styles.emptyTitle}>No Supermarkets Found</Text>
            <Text style={styles.emptySub}>
              No supermarkets currently registered by the Super Admin.
            </Text>
          </View>
        ) : (
          <FlatList
            data={stores}
            keyExtractor={(item) => item._id || item.code}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isModeEnabled =
                mode === "online"
                  ? (item.onlineDeliveryAvailable === true || item.selfPickupAvailable === true || item.onlineAvailable === true)
                  : (item.selfPickupAvailable === true || item.offlineAvailable === true);

              return (
                <TouchableOpacity
                  style={[
                    styles.storeCard,
                    !isModeEnabled && styles.storeCardDisabled,
                  ]}
                  onPress={() => handleStorePress(item)}
                  activeOpacity={0.8}
                >
                  <View style={styles.storeCardLeft}>
                    <View
                      style={[
                        styles.storeIconWrap,
                        isModeEnabled
                          ? styles.storeIconActive
                          : styles.storeIconMuted,
                      ]}
                    >
                      <Text style={{ fontSize: 22 }}>🏪</Text>
                    </View>

                    <View style={styles.storeInfo}>
                      <View style={styles.storeTitleRow}>
                        <Text style={styles.storeName}>{item.name}</Text>
                        <View style={styles.codeBadge}>
                          <Text style={styles.codeBadgeText}>{item.code}</Text>
                        </View>
                      </View>

                      {/* Location details */}
                      <Text style={styles.storeLocation}>
                        📍 {item.city || "Bangalore"}{item.state ? `, ${item.state}` : ""}
                        {item.address ? ` • ${item.address}` : ""}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.storeArrowWrap}>
                    {isModeEnabled ? (
                      <Text style={styles.activeArrow}>›</Text>
                    ) : (
                      <View style={styles.lockedBadge}>
                        <Text style={styles.lockedBadgeText}>Locked</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#2E0854", // Deep rich purple from app design
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "300",
  },
  headerTextWrap: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  headerSub: {
    fontSize: 11,
    color: "#CBB2FE",
    marginTop: 2,
    textAlign: "center",
  },
  searchBarWrap: {
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
  },
  clearBtn: {
    padding: 4,
  },
  clearBtnText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "800",
  },
  listContent: {
    padding: 14,
    gap: 12,
  },
  storeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  storeCardDisabled: {
    opacity: 0.72,
    backgroundColor: "#FAFAFA",
    borderColor: "#F1F5F9",
  },
  storeCardLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: 12,
  },
  storeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  storeIconActive: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  storeIconMuted: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  storeInfo: {
    flex: 1,
  },
  storeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 4,
  },
  storeName: {
    fontSize: 15.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  codeBadge: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  codeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#4338CA",
    fontFamily: "monospace",
  },
  storeLocation: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 8,
    lineHeight: 16,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  modePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  pillGreen: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
  },
  pillGreenText: {
    color: "#15803D",
  },
  pillRed: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  pillRedText: {
    color: "#991B1B",
  },
  modePillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  storeArrowWrap: {
    paddingLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  activeArrow: {
    fontSize: 28,
    color: "#3B0764",
    fontWeight: "300",
  },
  lockedBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lockedBadgeText: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "800",
  },
  centerBox: {
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
  errorIcon: {
    fontSize: 34,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 14,
  },
  retryBtn: {
    backgroundColor: "#3B0764",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 10,
    opacity: 0.7,
  },
  emptyTitle: {
    fontSize: 17,
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
  },
});
