import React, { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { CartProvider } from "../context/CartContext";

// Immediately dismiss any native splash screen so the app displays instantly
SplashScreen.hideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    // Unconditionally dismiss splash screen as soon as RootLayout mounts
    SplashScreen.hideAsync().catch(() => {});
    console.log("🚀 [SuperMart Mobile] RootLayout mounted & connected to Metro successfully!");
  }, []);

  return (
    <CartProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="catalog" />
        <Stack.Screen name="scanner" />
        <Stack.Screen name="product-details" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="customer-details" />
        <Stack.Screen name="payment" />
        <Stack.Screen name="payment-success" />
        <Stack.Screen name="order-tracking" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="receipt" />
        <Stack.Screen name="delivery-login" />
        <Stack.Screen name="delivery-dashboard" />
      </Stack>
    </CartProvider>
  );
}
