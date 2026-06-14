import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { fetchProfile } from '@/services/profile/api'
import { QK } from '@/constants/query-keys'
import { useAuthStore } from '@/store/auth-store'
import { useAuth } from '@/hooks/useAuth'
import { useLocale } from '@/hooks/useLocale'
import { Button } from '@/components/ui/Button'

export default function ProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const { locale, changeLocale } = useLocale()
  const { isLoggedIn, user } = useAuth()
  const clearSession = useAuthStore((s) => s.clearSession)

  const { data: profile } = useQuery({
    queryKey: QK.profile,
    queryFn: fetchProfile,
    enabled: isLoggedIn,
  })

  const menuItems = [
    { icon: 'location-outline' as const, label: t('shipping_addresses'), route: '/profile/addresses' as const },
    { icon: 'pricetag-outline' as const, label: t('my_vouchers'), route: '/profile/vouchers' as const },
    { icon: 'gift-outline' as const, label: t('redeem_points'), route: '/rewards' as const },
    { icon: 'people-outline' as const, label: t('referral_friends_title'), route: '/referral' as const },
    { icon: 'notifications-outline' as const, label: t('notifications'), route: '/notifications' as const },
  ]

  function handleLogout() {
    Alert.alert(t('logout'), `${t('logout')}?`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logout'), style: 'destructive', onPress: clearSession },
    ])
  }

  function handleLanguageToggle() {
    const next = locale === 'vi' ? 'en' : 'vi'
    changeLocale(next)
  }

  if (!isLoggedIn) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-8">
        <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-4">
          <Ionicons name="person-outline" size={36} color="#1a3c34" />
        </View>
        <Text className="text-xl font-bold text-ink mb-2">{t('my_account')}</Text>
        <Text className="text-muted text-center mb-8">{t('personal_eyebrow')}</Text>
        <Button onPress={() => router.push('/(auth)/login')} size="lg" className="w-full mb-3">
          {t('login')}
        </Button>
        <Button onPress={() => router.push('/(auth)/register')} variant="secondary" size="lg" className="w-full">
          {t('create_account')}
        </Button>
      </View>
    )
  }

  return (
    <>
    <StatusBar style="light" />
    <ScrollView
      className="flex-1 bg-surface-soft"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      {/* Header card */}
      <View style={{ paddingTop: insets.top + 16 }} className="bg-primary px-5 pb-8">
        <View className="flex-row items-center gap-4">
          <View className="w-16 h-16 rounded-full bg-white/20 overflow-hidden">
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Text className="text-2xl font-bold text-white">
                  {user?.name?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-white text-lg font-bold">{user?.name}</Text>
            <Text className="text-white/70 text-sm">{user?.phone ?? user?.email}</Text>
          </View>
        </View>

        {/* Points card */}
        {profile && (
          <View className="mt-4 bg-white/15 rounded-2xl px-4 py-3 flex-row items-center justify-between">
            <View>
              <Text className="text-white/70 text-xs">{t('points_balance_label')}</Text>
              <Text className="text-white text-xl font-bold">{profile.pointBalance.toLocaleString()} pts</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/rewards')}
              className="bg-white/20 rounded-full px-3 py-1.5"
            >
              <Text className="text-white text-xs font-semibold">{t('redeem_now')} →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Menu items */}
      <View className="mx-4 -mt-4 bg-white rounded-2xl border border-black/5 overflow-hidden">
        {menuItems.map((item, i) => (
          <TouchableOpacity
            key={item.route}
            onPress={() => router.push(item.route)}
            className={`flex-row items-center px-4 py-4 ${i < menuItems.length - 1 ? 'border-b border-black/5' : ''}`}
          >
            <View className="w-8 h-8 rounded-xl bg-primary/10 items-center justify-center mr-3">
              <Ionicons name={item.icon} size={16} color="#1a3c34" />
            </View>
            <Text className="flex-1 text-[15px] font-medium text-ink">{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color="#717171" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Language switcher */}
      <View className="mx-4 mt-4">
        <TouchableOpacity
          onPress={handleLanguageToggle}
          className="flex-row items-center px-4 py-4 bg-white rounded-2xl border border-black/5"
        >
          <View className="w-8 h-8 rounded-xl bg-primary/10 items-center justify-center mr-3">
            <Ionicons name="language-outline" size={16} color="#1a3c34" />
          </View>
          <Text className="flex-1 text-[15px] font-medium text-ink">
            {locale === 'vi' ? 'Tiếng Việt' : 'English'}
          </Text>
          <Text className="text-sm text-muted">{locale === 'vi' ? 'EN →' : 'VI →'}</Text>
        </TouchableOpacity>
      </View>

      <View className="mx-4 mt-4">
        <TouchableOpacity
          onPress={handleLogout}
          className="flex-row items-center px-4 py-4 bg-white rounded-2xl border border-black/5"
        >
          <View className="w-8 h-8 rounded-xl bg-red-50 items-center justify-center mr-3">
            <Ionicons name="log-out-outline" size={16} color="#c45c5c" />
          </View>
          <Text className="flex-1 text-[15px] font-medium text-danger">{t('logout')}</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-center text-[11px] text-muted mt-6">Ujcha v1.0.0</Text>
    </ScrollView>
    </>
  )
}
