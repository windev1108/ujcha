import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { ProductCard } from '@/components/product/ProductCard'
import { fetchProducts, fetchCategories } from '@/services/product/api'
import { QK } from '@/constants/query-keys'

export default function MenuScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const { data: categories = [] } = useQuery({
    queryKey: QK.categories,
    queryFn: fetchCategories,
  })

  const { data: products = [], isLoading } = useQuery({
    queryKey: QK.products(selectedCategoryId ? { categoryId: selectedCategoryId } : undefined),
    queryFn: () => fetchProducts(selectedCategoryId ? { categoryId: selectedCategoryId } : undefined),
  })

  const filtered = search.trim()
    ? products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      )
    : products

  return (
    <View className="flex-1 bg-surface-soft">
      {/* Search header */}
      <View style={{ paddingTop: insets.top + 12 }} className="bg-white px-4 pb-3 border-b border-black/5">
        <Text className="text-xl font-bold text-ink mb-3">{t('menu')}</Text>
        <View className="flex-row items-center bg-surface-card rounded-xl px-3 h-10 gap-2">
          <Ionicons name="search-outline" size={16} color="#717171" />
          <TextInput
            className="flex-1 text-[14px] text-ink"
            placeholder={`${t('search_product')}...`}
            placeholderTextColor="#717171"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#717171" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category chips */}
      <View className="bg-white border-b border-black/5">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
        >
          <TouchableOpacity
            onPress={() => setSelectedCategoryId(null)}
            className={`rounded-full px-4 py-2 ${!selectedCategoryId ? 'bg-primary' : 'bg-surface-card'}`}
          >
            <Text className={`text-xs font-semibold ${!selectedCategoryId ? 'text-white' : 'text-ink'}`}>
              {t('all')}
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setSelectedCategoryId(cat.id === selectedCategoryId ? null : cat.id)}
              className={`rounded-full px-4 py-2 ${cat.id === selectedCategoryId ? 'bg-primary' : 'bg-surface-card'}`}
            >
              <Text className={`text-xs font-semibold ${cat.id === selectedCategoryId ? 'text-white' : 'text-ink'}`}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Product grid */}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator color="#1a3c34" className="mt-16" />
        ) : filtered.length === 0 ? (
          <View className="items-center mt-16">
            <Ionicons name="search-outline" size={48} color="#717171" />
            <Text className="text-muted mt-3">{t('no_products_found')}</Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-4">
            {filtered.map((p) => (
              <View key={p.id} className="w-[47%]">
                <ProductCard product={p} onAddPress={() => router.push(`/menu/${p.slug}`)} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
