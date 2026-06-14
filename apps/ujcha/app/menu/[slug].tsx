import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { OptionPicker, ToppingPicker } from '@/components/product/ProductOptionPicker'
import { Button } from '@/components/ui/Button'
import { fetchProductBySlug } from '@/services/product/api'
import { QK } from '@/constants/query-keys'
import { useCartStore } from '@/store/cart-store'
import { formatVnd } from '@/lib/format'
import { computeOptionSurcharge, defaultOptions } from '@/lib/product-options'

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const addItem = useCartStore((s) => s.addItem)

  const { data: product, isLoading } = useQuery({
    queryKey: QK.product(slug),
    queryFn: () => fetchProductBySlug(slug),
  })

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [selectedToppingIds, setSelectedToppingIds] = useState<string[]>([])
  const [quantity, setQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)

  const opts = selectedOptions
  const surcharge = product ? computeOptionSurcharge(product.optionGroups, opts) : 0
  const toppingTotal = product
    ? product.toppings
        .filter((t) => selectedToppingIds.includes(t.id))
        .reduce((s, t) => s + t.price, 0)
    : 0
  const unitPrice = product ? product.finalPrice + surcharge + toppingTotal : 0
  const totalPrice = unitPrice * quantity

  function handleToggleTopping(id: string) {
    setSelectedToppingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function handleAddToCart() {
    if (!product) return

    for (const group of product.optionGroups) {
      if (group.selectionMin > 0 && !selectedOptions[group.name]) {
        Alert.alert(t('options'), `${t('select_at_least_1_product')}: ${group.name}`)
        return
      }
    }

    const toppingSnapshots = product.toppings
      .filter((t) => selectedToppingIds.includes(t.id))
      .map((t) => ({
        toppingId: t.id,
        topping: { id: t.id, name: t.name, price: t.price, nameTranslation: t.nameTranslation },
      }))

    addItem({
      productId: product.id,
      quantity,
      selectedOptions,
      toppingIds: selectedToppingIds,
      product: {
        id: product.id,
        name: product.name,
        nameTranslation: product.nameTranslation,
        slug: product.slug,
        price: product.price,
        imageUrls: product.imageUrls,
        discountPercent: product.discountPercent,
        finalPrice: product.finalPrice,
        optionGroups: product.optionGroups,
        toppings: product.toppings,
        category: product.category,
      },
      toppingSnapshots,
    })

    Alert.alert(t('added_to_cart'), product.name, [
      { text: t('continue'), style: 'cancel' },
      { text: t('your_cart'), onPress: () => router.push('/(tabs)/cart') },
    ])
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#1a3c34" />
      </View>
    )
  }

  if (!product) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <Text className="text-muted">{t('product_not_found')}</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-primary">← {t('back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Image */}
        <View className="relative bg-surface-card" style={{ aspectRatio: 4 / 3 }}>
          {product.imageUrls.length > 0 ? (
            <Image
              source={{ uri: product.imageUrls[imageIndex] }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Ionicons name="cafe-outline" size={64} color="#717171" />
            </View>
          )}

          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ top: insets.top + 8 }}
            className="absolute left-4 w-10 h-10 bg-white/90 rounded-full items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color="#1a1a1a" />
          </TouchableOpacity>

          {/* Discount badge */}
          {product.discountPercent > 0 && (
            <View className="absolute top-4 right-4 bg-danger rounded-full px-3 py-1">
              <Text className="text-white text-xs font-bold">-{product.discountPercent}%</Text>
            </View>
          )}

          {/* Image dots */}
          {product.imageUrls.length > 1 && (
            <View className="absolute bottom-3 w-full flex-row justify-center gap-1.5">
              {product.imageUrls.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => setImageIndex(i)}>
                  <View className={`w-1.5 h-1.5 rounded-full ${i === imageIndex ? 'bg-white' : 'bg-white/50'}`} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View className="px-4 pt-4">
          <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1">
            {product.category.name}
          </Text>
          <Text className="text-xl font-bold text-ink mb-2">{product.name}</Text>
          {product.description && (
            <Text className="text-sm text-muted mb-4 leading-5">{product.description}</Text>
          )}

          <View className="flex-row items-baseline gap-3 mb-5">
            <Text className="text-2xl font-bold text-primary">{formatVnd(product.finalPrice)}</Text>
            {product.discountPercent > 0 && (
              <Text className="text-base text-muted line-through">{formatVnd(product.price)}</Text>
            )}
          </View>

          {/* Options */}
          {product.optionGroups.length > 0 && (
            <OptionPicker
              optionGroups={product.optionGroups}
              selectedOptions={selectedOptions}
              onSelect={(group, val) => setSelectedOptions((prev) => ({ ...prev, [group]: val }))}
            />
          )}

          {/* Toppings */}
          <ToppingPicker
            toppings={product.toppings.filter((t) => t.isActive)}
            selectedIds={selectedToppingIds}
            onToggle={handleToggleTopping}
          />
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View
        style={{ paddingBottom: insets.bottom + 12 }}
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-black/5 px-4 pt-3"
      >
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center border border-black/10 rounded-full overflow-hidden">
            <TouchableOpacity
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-10 h-10 items-center justify-center"
            >
              <Ionicons name="remove" size={18} color="#1a1a1a" />
            </TouchableOpacity>
            <Text className="text-base font-bold text-ink px-2">{quantity}</Text>
            <TouchableOpacity
              onPress={() => setQuantity((q) => q + 1)}
              className="w-10 h-10 items-center justify-center bg-primary rounded-full"
            >
              <Ionicons name="add" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <Button onPress={handleAddToCart} size="lg" className="flex-1">
            {`${t('add_to_cart')} · ${formatVnd(totalPrice)}`}
          </Button>
        </View>
      </View>
    </View>
  )
}
