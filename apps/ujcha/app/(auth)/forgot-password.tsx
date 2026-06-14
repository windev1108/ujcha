import { useState } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { postSendOtp, postResetPassword } from '@/services/auth/api'

type Step = 'phone' | 'reset'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSendOtp() {
    if (!phone.trim()) { setError(t('error_phone_required')); return }
    setLoading(true); setError('')
    try {
      await postSendOtp(phone.trim())
      setStep('reset')
    } catch (e: any) {
      setError(e?.response?.data?.message ?? t('generic_error'))
    } finally { setLoading(false) }
  }

  async function handleReset() {
    if (!otp.trim()) { setError(t('enter_otp_label')); return }
    if (newPassword.length < 6) { setError(t('error_password_min')); return }
    setLoading(true); setError('')
    try {
      await postResetPassword({ phone: phone.trim(), code: otp.trim(), newPassword })
      setDone(true)
    } catch (e: any) {
      const msg = e?.response?.data?.message
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? t('generic_error')))
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingTop: insets.top + 48 }} className="px-6">
          <TouchableOpacity onPress={() => router.back()} className="mb-8">
            <Text className="text-primary text-sm">← {t('back')}</Text>
          </TouchableOpacity>

          <Text className="text-[22px] font-bold text-ink mb-1">{t('forgot_password_title')}</Text>

          {done ? (
            <>
              <Text className="text-muted text-sm mb-8">{t('reset_success_desc')}</Text>
              <Button onPress={() => router.replace('/(auth)/login')} size="lg" className="w-full">
                {t('login')}
              </Button>
            </>
          ) : (
            <>
              <Text className="text-muted text-sm mb-8">
                {step === 'phone' ? t('forgot_password_desc') : `${t('otp_sent_to')} ${phone}`}
              </Text>
              {error ? (
                <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                  <Text className="text-danger text-sm">{error}</Text>
                </View>
              ) : null}
              {step === 'phone' ? (
                <>
                  <Input label={t('phone_number')} placeholder={t('phone_placeholder')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                  <Button onPress={handleSendOtp} loading={loading} size="lg" className="w-full">{t('send_otp')}</Button>
                </>
              ) : (
                <>
                  <Input label={t('otp_label')} placeholder="6 chữ số" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
                  <Input label={t('new_password')} placeholder={t('min_6_chars')} value={newPassword} onChangeText={setNewPassword} secureTextEntry />
                  <Button onPress={handleReset} loading={loading} size="lg" className="w-full mb-4">{t('reset_password')}</Button>
                  <TouchableOpacity onPress={() => setStep('phone')} className="self-center">
                    <Text className="text-sm text-primary">← {t('change_phone')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
