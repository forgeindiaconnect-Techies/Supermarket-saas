import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";

const { width } = Dimensions.get("window");

interface ModeUnavailableModalProps {
  visible: boolean;
  mode: "Online" | "Offline" | string;
  supermarketName?: string;
  onClose: () => void;
  onSelectAnother?: () => void;
}

export default function ModeUnavailableModal({
  visible,
  mode = "Online",
  supermarketName,
  onClose,
  onSelectAnother,
}: ModeUnavailableModalProps) {
  const displayMode = mode.toLowerCase() === "online" ? "Online" : "Offline";

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Top Warning Icon Halo */}
          <View style={styles.iconHalo}>
            <Text style={styles.iconText}>⚠️</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{displayMode} Purchase Unavailable</Text>

          {/* Supermarket Name if provided */}
          {supermarketName ? (
            <View style={styles.storeBadge}>
              <Text style={styles.storeBadgeText}>🏪 {supermarketName}</Text>
            </View>
          ) : null}

          {/* Required Exact Message */}
          <Text style={styles.message}>
            This supermarket does not currently support {displayMode} Purchase. Please choose an available option.
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            {onSelectAnother ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onSelectAnother}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>Choose Other Store</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: width * 0.88,
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  iconHalo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEF2F2",
    borderWidth: 2,
    borderColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 8,
  },
  storeBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  storeBadgeText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#475569",
  },
  message: {
    fontSize: 14.5,
    lineHeight: 22,
    color: "#475569",
    textAlign: "center",
    marginBottom: 24,
  },
  buttonRow: {
    width: "100%",
    flexDirection: "column",
    gap: 10,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#3B0764", // App theme purple
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "700",
  },
});
