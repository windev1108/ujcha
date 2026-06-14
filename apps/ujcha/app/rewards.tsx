import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { fetchPointRewardCatalog, redeemPointReward } from '@/services/order/api'
import { fetchProfile } from '@/services/profile/api'
import { QK } from '@/constants/query-keys'
import { formatVnd } from '@/lib/format'
import type { PointRewardCatalog } from '@/types'

export default function RewardsScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: profile } = useQuery({ queryKey: QK.profile, queryFn: fetchProfile })
  const { data: catalog = [], isLoading } = useQuery({
    queryKey: QK.pointRewards,
    queryFn: fetchPointRewardCatalog,
  })

  const redeemMutation = useMutation({
    mutationFn: redeemPointReward,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QK.profile })
      Alert.alert(t('redeem_success'), `${t('voucher_code_label')}: ${data.code}`)
    },
    onError: (e: any) => {
      Alert.alert(t('generic_error'), e?.response?.data?.message ?? t('redeem_failed'))
    },
  })

  function handleRedeem(item: PointRewardCatalog) {
    if ((profile?.pointBalance ?? 0) < item.pointCost) {
      Alert.alert(
        t('insufficient_points'),
        t('need_n_points', { need: item.pointCost, have: profile?.pointBalance ?? 0 }),
      )
      return
    }
    Alert.alert(
      t('confirm_redeem'),
      t('redeem_confirm_desc', { cost: item.pointCost, name: item.name }),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('redeem_now'), onPress: () => redeemMutation.mutate(item.id) },
      ],
    )
  }

  return (
    <View className="flex-1 bg-surface-soft">
      <ScreenHeader title={t('redeem_points')} />

      {/* Points balance */}
      <View className="bg-primary mx-4 mt-4 rounded-2xl p-4">
        <Text className="text-white/70 text-xs uppercase tracking-widest">{t('points_balance_label')}</Text>
        <Text className="text-white text-3xl font-bold mt-1">
          {(profile?.pointBalance ?? 0).toLocaleString()} pts
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#1a3c34" className="mt-16" />
      ) : catalog.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="gift-outline" size={48} color="#717171" />
          <Text className="text-muted mt-3">{t('no_rewards')}</Text>
        </View>
      ) : (
        <FlatList
          data={catalog.filter((c) => c.isActive)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => {
            const canRedeem = (profile?.pointBalance ?? 0) >= item.pointCost
            return (
              <View className="bg-white rounded-2xl border border-black/5 p-4 mb-3">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 mr-3">
                    <Text className="text-[15px] font-bold text-ink">{item.name}</Text>
                    <Text className="text-sm text-muted mt-1">
                      {t('voucher_discount_desc')} {item.voucherType === 'percent'
                        ? `${item.voucherValue}%`
                        : formatVnd(item.voucherValue)}
                    </Text>
                    {item.description && (
                      <Text className="text-xs text-muted mt-1">{item.description}</Text>
                    )}
                  </View>
                  <View className="items-end">
                    <Text className="text-lg font-bold text-primary">{item.pointCost}</Text>
                    <Text className="text-xs text-muted">{t('points_label')}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleRedeem(item)}
                  disabled={!canRedeem || redeemMutation.isPending}
                  className={`mt-3 h-10 rounded-xl items-center justify-center ${canRedeem ? 'bg-primary' : 'bg-surface-card'}`}
                >
                  <Text className={`text-sm font-semibold ${canRedeem ? 'text-white' : 'text-muted'}`}>
                    {canRedeem ? t('redeem_now') : t('insufficient_points')}
                  </Text>
                </TouchableOpacity>
              </View>
            )
          }}
        />
      )}
    </View>
  )
}
