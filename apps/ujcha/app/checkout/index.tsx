import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createOrder, fetchAddresses, previewVoucher } from '@/services/order/api'
import { QK } from '@/constants/query-keys'
import { useCartStore } from '@/store/cart-store'
import { formatVnd } from '@/lib/format'
import { computeOptionSurcharge } from '@/lib/product-options'
import type { OrderType, PaymentType, CreateOrderPayload } from '@/types'

export default function CheckoutScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const { items, clearCart } = useCartStore()

  const [orderType, setOrderType] = useState<OrderType>('delivery')
  const [paymentType, setPaymentType] = useState<PaymentType>('cash')
  const [addressId, setAddressId] = useState<string | null>(null)
  const [deliveryName, setDeliveryName] = useState('')
  const [deliveryPhone, setDeliveryPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherDiscount, setVoucherDiscount] = useState(0)
  const [voucherLoading, setVoucherLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { data: addresses = [] } = useQuery({
    queryKey: QK.addresses,
    queryFn: fetchAddresses,
  })

  const orderTypes: { key: OrderType; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'delivery', label: t('type_delivery'), icon: 'bicycle-outline' },
    { key: 'pickup', label: t('type_pickup'), icon: 'bag-outline' },
  ]

  const subtotal = items.reduce((sum, item) => {
    const base = item.product.finalPrice
    const opts = computeOptionSurcharge(item.product.optionGroups ?? [], item.selectedOptions)
    const tops = item.toppings.reduce((s, t) => s + (t.topping?.price ?? 0), 0)
    return sum + (base + opts + tops) * item.quantity
  }, 0)

  const total = subtotal - voucherDiscount

  async function handleApplyVoucher() {
    if (!voucherCode.trim()) return
    setVoucherLoading(true)
    try {
      const result = await previewVoucher({ voucherCode: voucherCode.trim(), subtotal, type: orderType })
      setVoucherDiscount(result.discountAmount)
    } catch (e: any) {
      Alert.alert(t('generic_error'), e?.response?.data?.message ?? t('invalid_promo_code'))
      setVoucherDiscount(0)
    } finally {
      setVoucherLoading(false)
    }
  }

  async function handleSubmit() {
    if (items.length === 0) { Alert.alert(t('error_cart_empty')); return }

    if (orderType === 'delivery' && !addressId && !deliveryAddress.trim()) {
      Alert.alert(t('error_enter_delivery_address'))
      return
    }

    setSubmitting(true)
    try {
      const orderItems = items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        selectedOptions: it.selectedOptions,
        toppingIds: it.toppings.map((t) => t.toppingId),
      }))

      const payload: CreateOrderPayload = {
        type: orderType,
        paymentType,
        items: orderItems,
        ...(voucherCode.trim() && voucherDiscount > 0 ? { voucherCode: voucherCode.trim(), discountAmount: voucherDiscount } : {}),
        ...(addressId ? { addressId } : orderType === 'delivery' ? {
          inlineAddress: {
            fullAddress: deliveryAddress,
            name: deliveryName,
            phone: deliveryPhone,
          },
        } : {}),
      }

      const order = await createOrder(payload)
      clearCart()
      router.replace(`/orders/${order.paymentCode}`)
    } catch (e: any) {
      Alert.alert(t('order_failed'), e?.response?.data?.message ?? t('error_try_again'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-soft"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title={t('order_eyebrow')} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Order type */}
        <View className="bg-white rounded-2xl border border-black/5 p-4 mb-4">
          <Text className="text-[13px] font-semibold uppercase tracking-widest text-muted mb-3">{t('delivery_type')}</Text>
          <View className="flex-row gap-3">
            {orderTypes.map((tp) => (
              <TouchableOpacity
                key={tp.key}
                onPress={() => setOrderType(tp.key)}
                className={`flex-1 flex-row items-center justify-center gap-2 h-11 rounded-xl border ${orderType === tp.key ? 'bg-primary border-primary' : 'bg-surface-card border-transparent'}`}
              >
                <Ionicons name={tp.icon} size={16} color={orderType === tp.key ? '#fff' : '#1a1a1a'} />
                <Text className={`text-sm font-semibold ${orderType === tp.key ? 'text-white' : 'text-ink'}`}>
                  {tp.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Delivery address */}
        {orderType === 'delivery' && (
          <View className="bg-white rounded-2xl border border-black/5 p-4 mb-4">
            <Text className="text-[13px] font-semibold uppercase tracking-widest text-muted mb-3">{t('delivery_address_title')}</Text>

            {addresses.length > 0 && (
              <View className="mb-3">
                {addresses.map((addr) => (
                  <TouchableOpacity
                    key={addr.id}
                    onPress={() => setAddressId(addr.id === addressId ? null : addr.id)}
                    className={`flex-row items-start p-3 rounded-xl border mb-2 ${addr.id === addressId ? 'border-primary bg-primary/5' : 'border-black/5'}`}
                  >
                    <Ionicons
                      name={addr.id === addressId ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={addr.id === addressId ? '#1a3c34' : '#717171'}
                      style={{ marginRight: 8, marginTop: 1 }}
                    />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-ink">{addr.name} · {addr.phone}</Text>
                      <Text className="text-xs text-muted mt-0.5">{addr.fullAddress}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <Text className="text-xs text-muted text-center my-1">— {t('or')} {t('add_new_address_option')} —</Text>
              </View>
            )}

            {!addressId && (
              <>
                <Input label={t('recipient_name_label')} placeholder="Nguyễn Văn A" value={deliveryName} onChangeText={setDeliveryName} />
                <Input label={t('phone_number')} placeholder={t('phone_placeholder')} value={deliveryPhone} onChangeText={setDeliveryPhone} keyboardType="phone-pad" />
                <Input label={t('full_address')} placeholder={t('address_placeholder')} value={deliveryAddress} onChangeText={setDeliveryAddress} multiline />
              </>
            )}
          </View>
        )}

        {/* Payment */}
        <View className="bg-white rounded-2xl border border-black/5 p-4 mb-4">
          <Text className="text-[13px] font-semibold uppercase tracking-widest text-muted mb-3">{t('payment_method')}</Text>
          <View className="flex-row gap-3">
            {[
              { key: 'cash' as PaymentType, label: t('cash'), icon: 'cash-outline' as const },
              { key: 'bank_transfer' as PaymentType, label: t('bank_transfer'), icon: 'phone-portrait-outline' as const },
            ].map((p) => (
              <TouchableOpacity
                key={p.key}
                onPress={() => setPaymentType(p.key)}
                className={`flex-1 flex-row items-center justify-center gap-2 h-11 rounded-xl border ${paymentType === p.key ? 'bg-primary border-primary' : 'bg-surface-card border-transparent'}`}
              >
                <Ionicons name={p.icon} size={16} color={paymentType === p.key ? '#fff' : '#1a1a1a'} />
                <Text className={`text-sm font-semibold ${paymentType === p.key ? 'text-white' : 'text-ink'}`}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Voucher */}
        <View className="bg-white rounded-2xl border border-black/5 p-4 mb-4">
          <Text className="text-[13px] font-semibold uppercase tracking-widest text-muted mb-3">{t('discount_code')}</Text>
          <View className="flex-row gap-2">
            <Input
              placeholder={t('enter_promocode')}
              value={voucherCode}
              onChangeText={setVoucherCode}
              className="flex-1 mb-0"
              autoCapitalize="characters"
            />
            <TouchableOpacity
              onPress={handleApplyVoucher}
              disabled={voucherLoading || !voucherCode.trim()}
              className="h-11 px-4 bg-primary rounded-xl items-center justify-center self-end mb-4 disabled:opacity-50"
            >
              {voucherLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white font-semibold text-sm">{t('apply')}</Text>}
            </TouchableOpacity>
          </View>
          {voucherDiscount > 0 && (
            <Text className="text-sm text-primary font-medium">✓ {t('discount')} {formatVnd(voucherDiscount)}</Text>
          )}
        </View>

        {/* Order items summary */}
        <View className="bg-white rounded-2xl border border-black/5 p-4 mb-4">
          <Text className="text-[13px] font-semibold uppercase tracking-widest text-muted mb-3">
            {t('order_summary')} ({items.length})
          </Text>
          {items.map((item) => {
            const opts = computeOptionSurcharge(item.product.optionGroups ?? [], item.selectedOptions)
            const tops = item.toppings.reduce((s, t) => s + (t.topping?.price ?? 0), 0)
            const price = (item.product.finalPrice + opts + tops) * item.quantity
            return (
              <View key={item.id} className="flex-row justify-between mb-2">
                <Text className="text-sm text-ink flex-1 mr-2" numberOfLines={1}>
                  {item.quantity}x {item.product.name}
                </Text>
                <Text className="text-sm font-medium text-ink">{formatVnd(price)}</Text>
              </View>
            )
          })}

          <View className="border-t border-black/5 mt-3 pt-3">
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-muted">{t('temporarily_calculated')}</Text>
              <Text className="text-sm text-ink">{formatVnd(subtotal)}</Text>
            </View>
            {voucherDiscount > 0 && (
              <View className="flex-row justify-between mb-1">
                <Text className="text-sm text-muted">{t('discount_code')}</Text>
                <Text className="text-sm text-primary">-{formatVnd(voucherDiscount)}</Text>
              </View>
            )}
            <View className="flex-row justify-between mt-2">
              <Text className="text-[15px] font-bold text-ink">{t('total')}</Text>
              <Text className="text-[15px] font-bold text-primary">{formatVnd(total)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Submit bar */}
      <View
        style={{ paddingBottom: insets.bottom + 12 }}
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-black/5 px-4 pt-3"
      >
        <Button onPress={handleSubmit} loading={submitting} size="lg" className="w-full">
          {`${t('place_order')} · ${formatVnd(total)}`}
        </Button>
      </View>
    </KeyboardAvoidingView>
  )
}
