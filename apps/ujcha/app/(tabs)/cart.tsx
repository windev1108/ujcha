import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { CartItem } from '@/components/cart/CartItem'
import { Button } from '@/components/ui/Button'
import { useCartStore } from '@/store/cart-store'
import { formatVnd } from '@/lib/format'
import { computeOptionSurcharge } from '@/lib/product-options'
import { useAuth } from '@/hooks/useAuth'

export default function CartScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const { isLoggedIn } = useAuth()
  const { items, updateItem, removeItem, clearCart } = useCartStore()

  const subtotal = items.reduce((sum, item) => {
    const base = item.product.finalPrice
    const opts = computeOptionSurcharge(item.product.optionGroups ?? [], item.selectedOptions)
    const tops = item.toppings.reduce((s, t) => s + (t.topping?.price ?? 0), 0)
    return sum + (base + opts + tops) * item.quantity
  }, 0)

  if (items.length === 0) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-8">
        <Ionicons name="bag-outline" size={64} color="#717171" />
        <Text className="text-xl font-bold text-ink mt-4 mb-2">{t('cart_empty')}</Text>
        <Text className="text-muted text-center mb-8">{t('cart_empty_desc')}</Text>
        <Button onPress={() => router.push('/(tabs)/menu')} size="lg">
          {t('view_menu')}
        </Button>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-surface-soft">
      {/* Header */}
      <View style={{ paddingTop: insets.top + 12 }} className="bg-white px-4 pb-3 border-b border-black/5">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-ink">{t('your_cart')} ({items.length})</Text>
          <TouchableOpacity onPress={clearCart}>
            <Text className="text-sm text-danger">{t('delete')} {t('all')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item) => (
          <CartItem
            key={item.id}
            item={item}
            onIncrease={() => updateItem(item.id, item.quantity + 1)}
            onDecrease={() => updateItem(item.id, item.quantity - 1)}
            onRemove={() => removeItem(item.id)}
          />
        ))}
      </ScrollView>

      {/* Bottom summary */}
      <View
        style={{ paddingBottom: insets.bottom + 16 }}
        className="bg-white px-4 pt-4 border-t border-black/5"
      >
        <View className="flex-row justify-between mb-3">
          <Text className="text-muted text-sm">{t('temporarily_calculated')}</Text>
          <Text className="font-bold text-ink text-[15px]">{formatVnd(subtotal)}</Text>
        </View>
        <Button
          onPress={() => {
            if (!isLoggedIn) {
              router.push('/(auth)/login')
              return
            }
            router.push('/checkout')
          }}
          size="lg"
          className="w-full"
        >
          {`${t('place_order')} · ${formatVnd(subtotal)}`}
        </Button>
      </View>
    </View>
  )
}
