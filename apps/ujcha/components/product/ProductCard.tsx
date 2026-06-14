import { View, Text, TouchableOpacity, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { formatVnd } from '@/lib/format'
import type { ApiProduct } from '@/types'

interface ProductCardProps {
  product: ApiProduct
  onAddPress?: () => void
}

export function ProductCard({ product, onAddPress }: ProductCardProps) {
  const router = useRouter()
  const image = product.imageUrls?.[0]

  return (
    <TouchableOpacity
      onPress={() => router.push(`/menu/${product.slug}`)}
      activeOpacity={0.85}
      className="bg-white rounded-2xl border border-black/5 overflow-hidden"
    >
      <View className="aspect-[4/3] bg-surface-card">
        {image ? (
          <Image source={{ uri: image }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="cafe-outline" size={32} color="#717171" />
          </View>
        )}
        {product.discountPercent > 0 && (
          <View className="absolute top-2 left-2 bg-danger rounded-full px-2 py-0.5">
            <Text className="text-[10px] font-bold text-white">-{product.discountPercent}%</Text>
          </View>
        )}
        {product.isSoldOut && (
          <View className="absolute inset-0 bg-black/30 items-center justify-center">
            <Text className="text-white font-bold text-xs">Hết hàng</Text>
          </View>
        )}
      </View>

      <View className="p-3">
        <Text className="text-sm font-semibold text-ink leading-tight" numberOfLines={2}>
          {product.name}
        </Text>
        <View className="flex-row items-center justify-between mt-2">
          <View>
            <Text className="text-[15px] font-bold text-primary">
              {formatVnd(product.finalPrice)}
            </Text>
            {product.discountPercent > 0 && (
              <Text className="text-xs text-muted line-through">
                {formatVnd(product.price)}
              </Text>
            )}
          </View>
          {!product.isSoldOut && onAddPress && (
            <TouchableOpacity
              onPress={onAddPress}
              className="w-8 h-8 rounded-full bg-primary items-center justify-center"
              hitSlop={8}
            >
              <Ionicons name="add" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}
