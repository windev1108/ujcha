import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { OrderStatusBadge } from '@/components/ui/Badge'
import { formatVnd, formatDate } from '@/lib/format'
import type { UserOrder } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  delivery: 'Giao hàng',
  pickup: 'Mang đi',
  table: 'Tại bàn',
}

export function OrderCard({ order }: { order: UserOrder }) {
  const router = useRouter()
  return (
    <TouchableOpacity
      onPress={() => router.push(`/orders/${order.paymentCode}`)}
      activeOpacity={0.85}
      className="bg-white rounded-2xl border border-black/5 p-4 mb-3"
    >
      <View className="flex-row items-start justify-between mb-2">
        <View>
          <Text className="text-[15px] font-bold text-ink">#{order.paymentCode}</Text>
          <Text className="text-xs text-muted mt-0.5">{formatDate(order.createdAt)}</Text>
        </View>
        <OrderStatusBadge status={order.status} />
      </View>

      <View className="flex-row items-center gap-1 mb-2">
        <Ionicons
          name={order.type === 'delivery' ? 'bicycle-outline' : order.type === 'pickup' ? 'bag-outline' : 'restaurant-outline'}
          size={13}
          color="#717171"
        />
        <Text className="text-xs text-muted">{TYPE_LABELS[order.type]}</Text>
        <Text className="text-xs text-muted mx-1">·</Text>
        <Text className="text-xs text-muted">{order.items.length} sản phẩm</Text>
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-muted">
          {order.items.map((it) => it.productName).slice(0, 2).join(', ')}
          {order.items.length > 2 ? ` +${order.items.length - 2}` : ''}
        </Text>
        <Text className="text-[15px] font-bold text-primary">{formatVnd(order.finalAmount)}</Text>
      </View>
    </TouchableOpacity>
  )
}
