import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { ProductCard } from '@/components/product/ProductCard'
import { fetchProducts } from '@/services/product/api'
import { fetchCategories } from '@/services/product/api'
import { QK } from '@/constants/query-keys'
import { useCartStore } from '@/store/cart-store'
import { useNotificationStore } from '@/store/notification-store'
import { CountBadge } from '@/components/ui/Badge'

export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const addItem = useCartStore((s) => s.addItem)
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  const { data: categories = [] } = useQuery({
    queryKey: QK.categories,
    queryFn: fetchCategories,
  })

  const { data: products = [], isLoading } = useQuery({
    queryKey: QK.products(),
    queryFn: () => fetchProducts(),
  })

  const featured = products.filter((p) => !p.isSoldOut).slice(0, 12)

  const quickActions = [
    { icon: 'bicycle-outline' as const, label: t('type_delivery'), desc: t('delivery_desc') },
    { icon: 'bag-outline' as const, label: t('type_pickup'), desc: t('pickup_desc') },
    { icon: 'restaurant-outline' as const, label: t('type_table'), desc: t('staff_brings_to_table') },
  ]

  return (
    <>
    <StatusBar style="light" />
    <ScrollView
      className="flex-1 bg-surface-soft"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View
        style={{ paddingTop: insets.top + 12 }}
        className="bg-primary px-5 pb-6"
      >
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-white/70 text-sm">{t('hero_eyebrow')}</Text>
            <Text className="text-white text-2xl font-bold tracking-wider">Ujcha</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            className="relative"
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            <CountBadge count={unreadCount} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/menu')}
          className="mt-4 h-11 bg-white/20 rounded-2xl flex-row items-center px-4 gap-2"
        >
          <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.8)" />
          <Text className="text-white/70 text-sm">{t('search_product')}…</Text>
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <View className="flex-row px-5 gap-3 mt-4">
        {quickActions.map((q) => (
          <TouchableOpacity
            key={q.label}
            onPress={() => router.push('/checkout')}
            className="flex-1 bg-white rounded-2xl p-3 items-center border border-black/5"
          >
            <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mb-1">
              <Ionicons name={q.icon} size={20} color="#1a3c34" />
            </View>
            <Text className="text-xs font-bold text-ink">{q.label}</Text>
            <Text className="text-[10px] text-muted" numberOfLines={1}>{q.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Categories */}
      {categories.length > 0 && (
        <View className="mt-5">
          <View className="flex-row items-center justify-between px-5 mb-3">
            <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted">{t('category')}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5">
            <View className="flex-row gap-3">
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => router.push({ pathname: '/(tabs)/menu', params: { categoryId: cat.id } })}
                  className="items-center"
                >
                  <View className="w-14 h-14 rounded-2xl bg-primary/10 overflow-hidden mb-1">
                    {cat.thumbnail ? (
                      <Image source={{ uri: cat.thumbnail }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                      <View className="flex-1 items-center justify-center">
                        <Ionicons name="cafe-outline" size={22} color="#1a3c34" />
                      </View>
                    )}
                  </View>
                  <Text className="text-[11px] font-medium text-ink text-center" numberOfLines={1}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Featured products */}
      <View className="mt-5 px-5">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted">{t('bestseller')}</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/menu')}>
            <Text className="text-xs text-primary font-medium">{t('see_all')} →</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#1a3c34" className="py-8" />
        ) : (
          <View className="flex-row flex-wrap gap-4">
            {featured.map((p) => (
              <View key={p.id} className="w-[47%]">
                <ProductCard product={p} onAddPress={() => router.push(`/menu/${p.slug}`)} />
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
    </>
  )
}
