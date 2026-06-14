import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { postSendOtp, postRegister } from '@/services/auth/api'
import { getOrCreateDeviceId } from '@/lib/device-id'
import { useAuthStore } from '@/store/auth-store'

type Step = 'phone' | 'verify'

export default function RegisterScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const setSession = useAuthStore((s) => s.setSession)

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSendOtp() {
    if (!phone.trim()) { setError(t('error_phone_required')); return }
    setLoading(true)
    setError('')
    try {
      await postSendOtp(phone.trim())
      setStep('verify')
    } catch (e: any) {
      setError(e?.response?.data?.message ?? t('generic_error'))
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    if (!otp.trim()) { setError(t('enter_otp_label')); return }
    if (!name.trim()) { setError(t('error_name_required')); return }
    if (password.length < 6) { setError(t('error_password_min')); return }
    setLoading(true)
    setError('')
    try {
      const deviceId = await getOrCreateDeviceId()
      const result = await postRegister({ phone: phone.trim(), name: name.trim(), password, code: otp.trim(), deviceId })
      setSession(result.user, result.accessToken, result.refreshToken)
      router.replace('/(tabs)')
    } catch (e: any) {
      const msg = e?.response?.data?.message
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? t('generic_error')))
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
      >
        <View style={{ paddingTop: insets.top + 48 }} className="px-6">
          <Text className="text-3xl font-bold text-primary tracking-wide mb-1">Ujcha</Text>
          <Text className="text-[22px] font-bold text-ink mb-1">
            {step === 'phone' ? t('create_account') : t('step_verify')}
          </Text>
          <Text className="text-muted text-sm mb-8">
            {step === 'phone' ? t('register_welcome') : `${t('otp_sent_to')} ${phone}`}
          </Text>

          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <Text className="text-danger text-sm">{error}</Text>
            </View>
          ) : null}

          {step === 'phone' ? (
            <>
              <Input
                label={t('phone_number')}
                placeholder={t('phone_placeholder')}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              <Button onPress={handleSendOtp} loading={loading} size="lg" className="w-full mb-4">
                {t('send_otp')}
              </Button>
            </>
          ) : (
            <>
              <Input
                label={t('otp_label')}
                placeholder="6 chữ số"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
              <Input
                label={t('full_name')}
                placeholder="Nguyễn Văn A"
                value={name}
                onChangeText={setName}
                autoComplete="name"
              />
              <Input
                label={t('password')}
                placeholder={t('min_6_chars')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Button onPress={handleRegister} loading={loading} size="lg" className="w-full mb-4">
                {t('confirm_and_complete_register')}
              </Button>
              <TouchableOpacity onPress={() => setStep('phone')} className="self-center">
                <Text className="text-sm text-primary">← {t('change_phone')}</Text>
              </TouchableOpacity>
            </>
          )}

          <View className="flex-row justify-center mt-6">
            <Text className="text-muted text-sm">{t('have_account')} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text className="text-sm text-primary font-semibold">{t('login')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
