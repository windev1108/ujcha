import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Share, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import {
  fetchReferralMyStats,
  fetchReferralPublicConfig,
  claimMilestone,
  fetchLeaderboard,
} from '@/services/referral/api'
import { QK } from '@/constants/query-keys'
import { useAuth } from '@/hooks/useAuth'

export default function ReferralScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: QK.referralStats,
    queryFn: fetchReferralMyStats,
  })

  const { data: config } = useQuery({
    queryKey: ['referral', 'config'],
    queryFn: fetchReferralPublicConfig,
  })

  const { data: leaderboard = [] } = useQuery({
    queryKey: QK.referralLeaderboard,
    queryFn: fetchLeaderboard,
  })

  const claimMutation = useMutation({
    mutationFn: claimMilestone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.referralStats })
      Alert.alert(t('success'), t('claimed_reward'))
    },
  })

  const referralLink = user?.referralCode
    ? `https://ujcha.vn/?ref=${user.referralCode}`
    : null

  async function handleShare() {
    if (!referralLink) return
    try {
      await Share.share({
        message: t('referral_share_message', { link: referralLink }),
        url: referralLink,
      })
    } catch {}
  }

  return (
    <View className="flex-1 bg-surface-soft">
      <ScreenHeader title={t('referral_friends_title')} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Referral link card */}
        <View className="bg-primary rounded-2xl p-5 mb-4">
          <Text className="text-white/70 text-xs uppercase tracking-widest mb-1">{t('your_referral_code')}</Text>
          <Text className="text-white text-2xl font-bold tracking-widest mb-3">
            {user?.referralCode ?? '—'}
          </Text>
          <TouchableOpacity
            onPress={handleShare}
            className="bg-white/20 rounded-xl h-11 flex-row items-center justify-center gap-2"
          >
            <Ionicons name="share-outline" size={18} color="#fff" />
            <Text className="text-white font-semibold text-sm">{t('share_referral_link')}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        {statsLoading ? (
          <ActivityIndicator color="#1a3c34" className="my-8" />
        ) : stats && (
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-white rounded-2xl border border-black/5 p-4 items-center">
              <Text className="text-2xl font-bold text-primary">{stats.totalInvited}</Text>
              <Text className="text-xs text-muted mt-1 text-center">{t('stat_invited')}</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl border border-black/5 p-4 items-center">
              <Text className="text-2xl font-bold text-primary">{stats.totalEarned}</Text>
              <Text className="text-xs text-muted mt-1 text-center">{t('stat_points')}</Text>
            </View>
          </View>
        )}

        {/* Milestones */}
        {config?.milestones && config.milestones.length > 0 && (
          <View className="bg-white rounded-2xl border border-black/5 p-4 mb-4">
            <Text className="text-[13px] font-semibold uppercase tracking-widest text-muted mb-3">
              {t('affiliate_milestones')}
            </Text>
            {config.milestones.map((m) => {
              const claimed = stats?.claimedMilestones?.includes(m.id)
              const reached = (stats?.totalInvited ?? 0) >= m.requiredInvites
              const canClaim = reached && !claimed

              return (
                <View key={m.id} className="flex-row items-center justify-between py-3 border-b border-black/5 last:border-0">
                  <View className="flex-row items-center gap-3">
                    <View className={`w-8 h-8 rounded-full items-center justify-center ${claimed ? 'bg-primary' : reached ? 'bg-primary/10' : 'bg-surface-card'}`}>
                      <Ionicons
                        name={claimed ? 'checkmark' : 'people-outline'}
                        size={16}
                        color={claimed ? '#fff' : reached ? '#1a3c34' : '#717171'}
                      />
                    </View>
                    <View>
                      <Text className="text-sm font-semibold text-ink">{m.label}</Text>
                      <Text className="text-xs text-muted">
                        {t('invite_n_friends', { count: m.requiredInvites })} · +{m.rewardPoints} {t('points_unit')}
                      </Text>
                    </View>
                  </View>
                  {canClaim ? (
                    <TouchableOpacity
                      onPress={() => claimMutation.mutate(m.id)}
                      className="bg-primary rounded-lg px-3 py-1.5"
                    >
                      <Text className="text-white text-xs font-semibold">{t('claim_reward')}</Text>
                    </TouchableOpacity>
                  ) : claimed ? (
                    <Text className="text-xs text-primary font-semibold">{t('inv_rewarded')}</Text>
                  ) : (
                    <Text className="text-xs text-muted">{stats?.totalInvited ?? 0}/{m.requiredInvites}</Text>
                  )}
                </View>
              )
            })}
          </View>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <View className="bg-white rounded-2xl border border-black/5 p-4">
            <Text className="text-[13px] font-semibold uppercase tracking-widest text-muted mb-3">
              {t('leaderboard')}
            </Text>
            {leaderboard.slice(0, 10).map((entry, i) => (
              <View key={i} className="flex-row items-center py-2.5 border-b border-black/5 last:border-0">
                <Text className="w-6 text-sm font-bold text-muted">{i + 1}</Text>
                <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-3">
                  <Text className="text-sm font-bold text-primary">
                    {entry.name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text className="flex-1 text-sm font-medium text-ink">{entry.name}</Text>
                <Text className="text-sm font-bold text-primary">
                  {entry.count} {t('referral_friends_unit')}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
