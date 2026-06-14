import { View, Text } from 'react-native'
import { ORDER_STATUS_COLORS } from '@/constants/colors'
import type { OrderStatus } from '@/types'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = ORDER_STATUS_COLORS[status] ?? ORDER_STATUS_COLORS.pending
  return (
    <View
      style={{ backgroundColor: config.bg }}
      className="self-start rounded-full px-3 py-1"
    >
      <Text style={{ color: config.text }} className="text-xs font-semibold">
        {config.label}
      </Text>
    </View>
  )
}

export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <View className="absolute -top-1 -right-1 bg-danger rounded-full min-w-[16px] h-4 items-center justify-center px-1">
      <Text className="text-[10px] font-bold text-white">{count > 99 ? '99+' : count}</Text>
    </View>
  )
}
