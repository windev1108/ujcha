import { Tabs } from 'expo-router'
import { View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { CountBadge } from '@/components/ui/Badge'
import { useCartItemCount } from '@/store/cart-store'
import { useNotificationStore } from '@/store/notification-store'
import { COLORS } from '@/constants/colors'

function CartTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const count = useCartItemCount()
  return (
    <View>
      <Ionicons name={focused ? 'bag' : 'bag-outline'} size={24} color={color} />
      <CountBadge count={count} />
    </View>
  )
}

function NotifTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const count = useNotificationStore((s) => s.unreadCount)
  return (
    <View>
      <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={24} color={color} />
      <CountBadge count={count} />
    </View>
  )
}

export default function TabLayout() {
  const { t } = useTranslation()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: 'rgba(0,0,0,0.06)',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: t('menu'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cafe' : 'cafe-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('cart'),
          tabBarIcon: CartTabIcon,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('orders'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('account'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
