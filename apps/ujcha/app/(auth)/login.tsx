import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import * as SecureStore from 'expo-secure-store'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { postLogin } from '@/services/auth/api'
import { getOrCreateDeviceId } from '@/lib/device-id'
import { useAuthStore } from '@/store/auth-store'

const SAVED_CREDS_KEY = 'ujcha_saved_credentials'

export default function LoginScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const setSession = useAuthStore((s) => s.setSession)

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ phone?: string; password?: string; general?: string }>({})

  useEffect(() => {
    SecureStore.getItemAsync(SAVED_CREDS_KEY).then((raw) => {
      if (!raw) return
      try {
        const { phone: savedPhone, password: savedPassword } = JSON.parse(raw)
        setPhone(savedPhone ?? '')
        setPassword(savedPassword ?? '')
        setRememberMe(true)
      } catch {
        // corrupted entry — ignore
      }
    })
  }, [])

  async function handleLogin() {
    const e: typeof errors = {}
    if (!phone.trim()) e.phone = t('error_phone_required')
    if (!password) e.password = t('error_password_required')
    if (Object.keys(e).length) { setErrors(e); return }

    setLoading(true)
    setErrors({})
    try {
      const deviceId = await getOrCreateDeviceId()
      const result = await postLogin({ phone: phone.trim(), password, deviceId })
      setSession(result.user, result.accessToken, result.refreshToken)

      if (rememberMe) {
        await SecureStore.setItemAsync(SAVED_CREDS_KEY, JSON.stringify({ phone: phone.trim(), password }))
      } else {
        await SecureStore.deleteItemAsync(SAVED_CREDS_KEY)
      }

      router.replace('/(tabs)')
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? t('generic_error')
      setErrors({ general: Array.isArray(msg) ? msg.join(', ') : msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        className="flex-1"
      >
        <View style={{ paddingTop: insets.top + 48 }} className="px-6">
          <Text className="text-3xl font-bold text-primary tracking-wide mb-1">Ujcha</Text>
          <Text className="text-[22px] font-bold text-ink mb-1">{t('login')}</Text>
          <Text className="text-muted text-sm mb-8">{t('login_welcome')}</Text>

          {errors.general && (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <Text className="text-danger text-sm">{errors.general}</Text>
            </View>
          )}

          <Input
            label={t('phone_number')}
            placeholder={t('phone_placeholder')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            error={errors.phone}
            autoComplete="tel"
          />

          <Input
            label={t('password')}
            placeholder={t('password_placeholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
          />

          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity
              onPress={() => setRememberMe((v) => !v)}
              activeOpacity={0.7}
              className="flex-row items-center gap-2"
            >
              <View
                className={`w-5 h-5 rounded border-2 items-center justify-center ${
                  rememberMe ? 'bg-primary border-primary' : 'bg-white border-hairline-strong'
                }`}
              >
                {rememberMe && (
                  <Text className="text-white text-xs font-bold leading-none">✓</Text>
                )}
              </View>
              <Text className="text-sm text-ink">{t('remember_me')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
              <Text className="text-sm text-primary font-medium">{t('forgot_password')}</Text>
            </TouchableOpacity>
          </View>

          <Button onPress={handleLogin} loading={loading} size="lg" className="w-full mb-4">
            {t('login')}
          </Button>

          <View className="flex-row justify-center">
            <Text className="text-muted text-sm">{t('no_account')} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text className="text-sm text-primary font-semibold">{t('register_now')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
