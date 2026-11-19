import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { CartProvider } from "../context/CartContext";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <CartProvider>
      <AnimatedSplashOverlay />
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
