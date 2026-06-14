import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { fetchMyVouchers } from '@/services/voucher/api'
import { QK } from '@/constants/query-keys'
import { formatVnd, formatDate } from '@/lib/format'
import type { UserVoucher } from '@/types'

export default function VouchersScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: QK.vouchers,
    queryFn: fetchMyVouchers,
  })

  function handleCopy(code: string) {
    Alert.alert(t('voucher_code_label'), `${code}\n\n${t('copy_voucher_hint')}`)
  }

  function renderItem({ item }: { item: UserVoucher }) {
    const isUsed = !!item.usedAt
    const isExpired = item.expiresAt ? new Date(item.expiresAt) < new Date() : false
    const inactive = isUsed || isExpired

    return (
      <View className={`bg-white rounded-2xl border mb-3 overflow-hidden ${inactive ? 'border-black/5 opacity-60' : 'border-primary/20'}`}>
        <View className={`h-1.5 ${inactive ? 'bg-surface-tertiary' : 'bg-primary'}`} />
        <View className="p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-ink">{item.name}</Text>
              <Text className="text-sm text-muted mt-1">
                {t('discount')} {item.discountType === 'percent'
                  ? `${item.discountValue}%`
                  : formatVnd(item.discountValue)}
                {item.maxDiscountAmount ? ` (${t('max_discount', { amount: formatVnd(item.maxDiscountAmount) })})` : ''}
              </Text>
              {item.minOrderAmount > 0 && (
                <Text className="text-xs text-muted mt-0.5">{t('min_order_label', { amount: formatVnd(item.minOrderAmount) })}</Text>
              )}
            </View>
            <View className={`self-start rounded-full px-2 py-1 ${inactive ? 'bg-surface-card' : 'bg-primary/10'}`}>
              <Text className={`text-[10px] font-bold ${inactive ? 'text-muted' : 'text-primary'}`}>
                {isUsed ? t('voucher_used') : isExpired ? t('expired') : t('voucher_active')}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-dashed border-black/10">
            <Text className="text-base font-bold text-primary tracking-widest">{item.code}</Text>
            {!inactive && (
              <TouchableOpacity
                onPress={() => handleCopy(item.code)}
                className="flex-row items-center gap-1 bg-primary/10 rounded-lg px-3 py-1.5"
              >
                <Ionicons name="copy-outline" size={14} color="#1a3c34" />
                <Text className="text-xs font-semibold text-primary">{t('copy')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {item.expiresAt && (
            <Text className="text-[11px] text-muted mt-2">
              {t('expired')}: {formatDate(item.expiresAt)}
            </Text>
          )}
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-surface-soft">
      <ScreenHeader title={t('my_vouchers')} />

      {isLoading ? (
        <ActivityIndicator color="#1a3c34" className="mt-16" />
      ) : vouchers.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="pricetag-outline" size={48} color="#717171" />
          <Text className="text-muted mt-3">{t('no_vouchers')}</Text>
        </View>
      ) : (
        <FlatList
          data={vouchers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        />
      )}
    </View>
  )
}
