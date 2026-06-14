import { useState } from 'react'
import { View, Text, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { OrderCard } from '@/components/order/OrderCard'
import { fetchMyOrders } from '@/services/order/api'
import { QK } from '@/constants/query-keys'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'

export default function OrdersScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const { isLoggedIn, accessToken } = useAuth()
  const [page] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: QK.orders(page),
    queryFn: () => fetchMyOrders(page),
    enabled: isLoggedIn,
  })

  if (!isLoggedIn) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-8">
        <Ionicons name="receipt-outline" size={64} color="#717171" />
        <Text className="text-xl font-bold text-ink mt-4 mb-2">{t('order_history')}</Text>
        <Text className="text-muted text-center mb-8">{t('order_history_sub')}</Text>
        <Button onPress={() => router.push('/(auth)/login')} size="lg">{t('login')}</Button>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-surface-soft">
      <View style={{ paddingTop: insets.top + 12 }} className="bg-white px-4 pb-3 border-b border-black/5">
        <Text className="text-xl font-bold text-ink">{t('orders_eyebrow')}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#1a3c34" className="mt-16" />
      ) : !data?.data?.length ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="receipt-outline" size={64} color="#717171" />
          <Text className="text-xl font-bold text-ink mt-4 mb-2">{t('no_orders')}</Text>
          <Button onPress={() => router.push('/(tabs)/menu')} className="mt-4">{t('place_order')}</Button>
        </View>
      ) : (
        <FlatList
          data={data.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <OrderCard order={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}
