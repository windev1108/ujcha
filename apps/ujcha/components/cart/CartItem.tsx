import { View, Text, TouchableOpacity, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { formatVnd } from '@/lib/format'
import { computeOptionSurcharge } from '@/lib/product-options'
import type { ApiCartItem } from '@/types'

interface CartItemProps {
  item: ApiCartItem
  onIncrease: () => void
  onDecrease: () => void
  onRemove: () => void
}

export function CartItem({ item, onIncrease, onDecrease, onRemove }: CartItemProps) {
  const basePrice = item.product.finalPrice
  const optionSurcharge = computeOptionSurcharge(
    item.product.optionGroups ?? [],
    item.selectedOptions,
  )
  const toppingTotal = item.toppings.reduce((s, t) => s + (t.topping?.price ?? 0), 0)
  const unitPrice = basePrice + optionSurcharge + toppingTotal
  const lineTotal = unitPrice * item.quantity
  const image = item.product.imageUrls?.[0]

  return (
    <View className="flex-row bg-white rounded-2xl border border-black/5 p-3 mb-3">
      <View className="w-16 h-16 rounded-xl bg-surface-card overflow-hidden mr-3">
        {image ? (
          <Image source={{ uri: image }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="cafe-outline" size={20} color="#717171" />
          </View>
        )}
      </View>

      <View className="flex-1">
        <Text className="text-sm font-semibold text-ink leading-tight" numberOfLines={1}>
          {item.product.name}
        </Text>
        {Object.entries(item.selectedOptions).map(([k, v]) => (
          <Text key={k} className="text-xs text-muted mt-0.5">{k}: {v}</Text>
        ))}
        {item.toppings.map((t) => (
          <Text key={t.toppingId} className="text-xs text-muted">+ {t.topping?.name}</Text>
        ))}

        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-[15px] font-bold text-primary">{formatVnd(lineTotal)}</Text>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={onDecrease}
              className="w-7 h-7 rounded-full border border-black/10 items-center justify-center"
            >
              <Ionicons name={item.quantity === 1 ? 'trash-outline' : 'remove'} size={14} color="#1a1a1a" />
            </TouchableOpacity>
            <Text className="text-sm font-bold text-ink w-5 text-center">{item.quantity}</Text>
            <TouchableOpacity
              onPress={onIncrease}
              className="w-7 h-7 rounded-full bg-primary items-center justify-center"
            >
              <Ionicons name="add" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  )
}
