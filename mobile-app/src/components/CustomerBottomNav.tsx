import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useCart } from "../context/CartContext";
import { Theme } from "../constants/colors";

export type TabName =
  | "home"
  | "scan"
  | "cart"
  | "orders"
  | "tracking"
  | "profile";

export default function CustomerBottomNav({ activeTab }: { activeTab: TabName }) {
  const router = useRouter();
  const { totalCount, customerUser } = useCart();

  // For authenticated customers, Home opens the online supermarket store/catalog.
  // For guests, Home opens the initial public home screen.
  const homeRoute = customerUser && customerUser.token ? "/catalog" : "/";

  // Exact 6 customer navigation tabs in mandatory order:
  // 1. Store -> 2. Scan -> 3. Cart -> 4. Orders -> 5. Track Order -> 6. Profile
  const tabs: {
    id: TabName;
    label: string;
    icon: string;
    route: any;
  }[] = [
    { id: "home", label: customerUser ? "Store" : "Home", icon: "⌂", route: homeRoute },
    { id: "scan", label: "Scan", icon: "⚲", route: "/scanner" },
    { id: "cart", label: "Cart", icon: "🛒", route: "/cart" },
    { id: "orders", label: "Orders", icon: "📋", route: "/orders" },
    { id: "tracking", label: "Track Order", icon: "🚚", route: "/order-tracking" },
    { id: "profile", label: "Profile", icon: "👤", route: "/profile" },
  ];

  return (
    <View style={styles.navBar}>
      {tabs.map((tab, idx) => {
        const isActive = activeTab === tab.id;
        const isCart = tab.id === "cart";

        return (
          <TouchableOpacity
            key={`${tab.id}-${idx}`}
            style={styles.tabItem}
            onPress={() => {
              if (activeTab !== tab.id) {
                router.replace(tab.route as any);
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.iconWrapper}>
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                {tab.icon}
              </Text>
              {isCart && totalCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{totalCount}</Text>
                </View>
              )}
            </View>

            <Text
              style={[styles.tabLabel, isActive && styles.tabLabelActive]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>

            {isActive && <View style={styles.activeDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: "row",
    height: 66,
    backgroundColor: Theme.white,
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: 4,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 4,
  },
  iconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  tabIcon: {
    fontSize: 22,
    color: "#94A3B8",
  },
  tabIconActive: {
    color: "#7C3AED", // Royal purple accent
    fontWeight: "bold",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 2,
  },
  tabLabelActive: {
    color: "#7C3AED",
    fontWeight: "800",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#7C3AED",
    marginTop: 2,
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: "#EF4444",
    borderRadius: 9,
    minWidth: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: Theme.white,
    fontSize: 10,
    fontWeight: "bold",
  },
});
