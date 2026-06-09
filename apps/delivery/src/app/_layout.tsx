import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/store/auth.store';

SplashScreen.preventAutoHideAsync();
import { socketService } from '@/services/socket.service';
import { locationService } from '@/services/location.service';
import { useNewOrder, enqueueAvailableOrders } from '@/hooks/use-new-order';
import { useOrders } from '@/hooks/use-orders';
import { useOrdersStore } from '@/store/orders.store';
import { NewOrderModal } from '@/components/NewOrderModal';
import { shipperApi } from '@/services/api.service';
import type { NewDeliveryOrderPayload } from '@/services/socket.service';

function NewOrderOverlay() {
  const { incomingOrder, dismiss } = useNewOrder();
  const { fetchOrders } = useOrders();
  const { accessToken } = useAuthStore();
  const fetchedRef = useRef(false);

  // On login, fetch any already-confirmed unassigned delivery orders and queue
  // them so the shipper sees the modal even for orders confirmed before login.
  useEffect(() => {
    if (!accessToken || fetchedRef.current) return;
    fetchedRef.current = true;
    void shipperApi.getAvailableOrders()
      .then(({ data }) => enqueueAvailableOrders(data as NewDeliveryOrderPayload[]))
      .catch(() => {});
  }, [accessToken]);

  if (!incomingOrder) return null;
  return (
    <NewOrderModal
      order={incomingOrder}
      onDismiss={dismiss}
      onAccepted={fetchOrders}
    />
  );
}

export default function RootLayout() {
  const { hydrated, accessToken, shipper, hydrate } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    SplashScreen.hideAsync();


    const inAuth = segments[0] === '(auth)';
    const isAuthed = !!accessToken && !!shipper;

    if (isAuthed) {
      socketService.connect();
      // Always enable GPS when logged in so customers can always track the shipper
      void locationService.enableGps().catch(() => {});
    } else {
      socketService.disconnect();
    }

    if (!isAuthed && !inAuth) {
      router.replace('/(auth)/login');
    } else if (isAuthed && inAuth) {
      router.replace('/(shipper)/');
    }
  }, [hydrated, accessToken, shipper]);

  // Real-time order status updates pushed from server to this shipper's socket room
  useEffect(() => {
    if (!accessToken) return;
    const handler = (data: { orderId: string; status: string }) => {
      useOrdersStore.getState().updateOrderStatus(data.orderId, data.status);
    };
    socketService.on<{ orderId: string; status: string }>('order:status', handler);
    // Pass specific handler so we only remove this listener, not others (e.g., delivery/[id].tsx)
    return () => socketService.off('order:status', handler as (...args: unknown[]) => void);
  }, [accessToken]);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(shipper)" />
      </Stack>
      <NewOrderOverlay />
    </View>
  );
}
