import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { OrderStatusBadge } from '@/components/ui/Badge'
import { fetchOrderDetail } from '@/services/order/api'
import { QK } from '@/constants/query-keys'
import { useOrderStatusSocket } from '@/hooks/useOrderStatusSocket'
import { useOrderPaymentSocket } from '@/hooks/useOrderPaymentSocket'
import { formatVnd, formatDate } from '@/lib/format'
import { ORDER_STATUS_COLORS } from '@/constants/colors'
import type { OrderStatus } from '@/types'

const TERMINAL_STATUSES: OrderStatus[] = ['completed', 'cancelled']

const STATUS_STEPS: OrderStatus[] = [
  'pending', 'confirmed', 'preparing', 'ready', 'delivering', 'completed',
]

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: order, isLoading } = useQuery({
    queryKey: QK.order(orderId),
    queryFn: () => fetchOrderDetail(orderId),
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 5000
      return TERMINAL_STATUSES.includes(data.status) ? false : 8000
    },
  })

  const isTerminal = order ? TERMINAL_STATUSES.includes(order.status) : false

  useOrderStatusSocket({
    enabled: !isTerminal,
    onStatusChange: ({ orderId: oid, status }) => {
      if (oid === order?.id) {
        queryClient.invalidateQueries({ queryKey: QK.order(orderId) })
      }
    },
  })

  const { isPaid } = useOrderPaymentSocket({
    orderId: order?.id ?? null,
    enabled: order?.paymentStatus === 'pending' && order?.paymentType === 'bank_transfer',
    onPaid: () => queryClient.invalidateQueries({ queryKey: QK.order(orderId) }),
  })

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#1a3c34" />
      </View>
    )
  }

  if (!order) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-muted">{t('order_not_found')}</Text>
      </View>
    )
  }

  const stepIndex = STATUS_STEPS.indexOf(order.status)

  return (
    <View className="flex-1 bg-surface-soft">
      <ScreenHeader title={`${t('order_code')} #${order.paymentCode}`} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status card */}
        <View className="bg-white rounded-2xl border border-black/5 p-4 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <OrderStatusBadge status={order.status} />
            <Text className="text-xs text-muted">{formatDate(order.createdAt)}</Text>
          </View>

          {/* Progress bar */}
          {order.type !== 'pickup' || order.status !== 'cancelled' ? (
            <View>
              <View className="flex-row items-center">
                {STATUS_STEPS.map((s, i) => {
                  const done = i <= stepIndex
                  const isLast = i === STATUS_STEPS.length - 1
                  return (
                    <View key={s} className="flex-row items-center flex-1">
                      <View
                        className={`w-6 h-6 rounded-full items-center justify-center ${done ? 'bg-primary' : 'bg-surface-card'}`}
                      >
                        {done ? (
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        ) : (
                          <View className="w-2 h-2 rounded-full bg-surface-tertiary" />
                        )}
                      </View>
                      {!isLast && (
                        <View className={`flex-1 h-0.5 ${i < stepIndex ? 'bg-primary' : 'bg-surface-card'}`} />
                      )}
                    </View>
                  )
                })}
              </View>
              <View className="flex-row mt-1">
                {STATUS_STEPS.map((s) => (
                  <Text key={s} className="flex-1 text-[9px] text-center text-muted" numberOfLines={1}>
                    {ORDER_STATUS_COLORS[s]?.label ?? s}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {/* Delivery info */}
        {order.address && (
          <View className="bg-white rounded-2xl border border-black/5 p-4 mb-4">
            <View className="flex-row items-center gap-2 mb-2">
              <Ionicons name="location-outline" size={16} color="#1a3c34" />
              <Text className="text-[13px] font-semibold text-muted uppercase tracking-widest">{t('delivery_address_title')}</Text>
            </View>
            <Text className="text-[15px] font-medium text-ink">{order.guestDeliveryName ?? order.address.name}</Text>
            <Text className="text-sm text-muted mt-0.5">{order.address.fullAddress}</Text>
          </View>
        )}

        {/* Items */}
        <View className="bg-white rounded-2xl border border-black/5 p-4 mb-4">
          <Text className="text-[13px] font-semibold text-muted uppercase tracking-widest mb-3">
            {t('items_count', { count: order.items.length })}
          </Text>
          {order.items.map((item) => (
            <View key={item.id} className="flex-row justify-between mb-3">
              <View className="flex-1 mr-3">
                <Text className="text-sm font-medium text-ink" numberOfLines={1}>
                  {item.quantity}x {item.productName}
                </Text>
                {Object.entries(item.selectedOptions).map(([k, v]) => (
                  <Text key={k} className="text-xs text-muted">{k}: {v}</Text>
                ))}
                {item.toppings?.map((t) => (
                  <Text key={t.id} className="text-xs text-muted">+ {t.name}</Text>
                ))}
              </View>
              <Text className="text-sm font-medium text-ink">{formatVnd(item.totalPrice)}</Text>
            </View>
          ))}
        </View>

        {/* Payment summary */}
        <View className="bg-white rounded-2xl border border-black/5 p-4 mb-4">
          <Text className="text-[13px] font-semibold text-muted uppercase tracking-widest mb-3">
            {t('payment')}
          </Text>
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-muted">{t('temporarily_calculated')}</Text>
            <Text className="text-sm text-ink">{formatVnd(order.totalAmount)}</Text>
          </View>
          {order.discountAmount > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-muted">{t('discount')}</Text>
              <Text className="text-sm text-primary">-{formatVnd(order.discountAmount)}</Text>
            </View>
          )}
          {order.pointDiscountAmount > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-muted">{t('points_label')}</Text>
              <Text className="text-sm text-primary">-{formatVnd(order.pointDiscountAmount)}</Text>
            </View>
          )}
          {order.shippingFee > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-muted">{t('shipping_fee')}</Text>
              <Text className="text-sm text-ink">{formatVnd(order.shippingFee)}</Text>
            </View>
          )}
          <View className="border-t border-black/5 mt-2 pt-2 flex-row justify-between">
            <Text className="text-[15px] font-bold text-ink">{t('total')}</Text>
            <Text className="text-[15px] font-bold text-primary">{formatVnd(order.finalAmount)}</Text>
          </View>
          <View className="flex-row justify-between mt-2">
            <Text className="text-sm text-muted">{t('payment_method')}</Text>
            <Text className="text-sm font-medium text-ink">
              {order.paymentType === 'cash' ? t('cash') : t('bank_transfer')}
              {order.paymentStatus === 'paid' ? ' ✓' : ''}
            </Text>
          </View>
        </View>

        {/* Earned points */}
        {order.earnedPoints > 0 && (
          <View className="bg-primary/5 rounded-2xl border border-primary/20 p-4 mb-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="star" size={16} color="#1a3c34" />
              <Text className="text-sm font-semibold text-primary">
                {t('earned_points_from_order')}: +{order.earnedPoints} pts
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
