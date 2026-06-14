import '../global.css'
import '@/i18n'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useNotificationSocket } from '@/hooks/useNotificationSocket'
import { useAuth } from '@/hooks/useAuth'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
})

function SocketProvider() {
  const { accessToken } = useAuth()
  useNotificationSocket(accessToken)
  return null
}

function RootLayout() {
  const { isHydrated } = useAuth()

  useEffect(() => {
    if (isHydrated) SplashScreen.hideAsync()
  }, [isHydrated])

  if (!isHydrated) return null

  return (
    <>
      <SocketProvider />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="menu/[slug]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="checkout/index" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="orders/[orderId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="notifications/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile/addresses" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile/vouchers" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="rewards" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="referral" options={{ animation: 'slide_from_right' }} />
      </Stack>
      <StatusBar style="dark" />
    </>
  )
}

export default function AppLayout() {
  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <RootLayout />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
