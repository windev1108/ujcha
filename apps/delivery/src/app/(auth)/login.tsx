import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/use-auth';

export default function LoginScreen() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<'phone' | 'password' | null>(null);

  const isValid = phone.trim().length > 0 && password.length > 0;

  async function handleLogin() {
    if (!isValid) return;
    setLoading(true);
    try {
      await login(phone.trim(), password);
    } catch {
      Alert.alert(
        'Đăng nhập thất bại',
        'Số điện thoại hoặc mật khẩu không đúng, hoặc tài khoản chưa được đăng ký làm shipper.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={s.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.header}>
          <View style={s.logoOuter}>
            <View style={s.logoInner}>
              <Text style={s.logoText}>U</Text>
            </View>
          </View>
          <Text style={s.brand}>UjCha</Text>
          <Text style={s.brandSub}>DELIVERY</Text>
          <View style={s.tagRow}>
            <View style={s.tagDot} />
            <Text style={s.tagText}>Dành cho nhân viên giao hàng</Text>
          </View>
        </View>

        <View style={s.card}>
          <View style={s.fieldWrap}>
            <Text style={s.label}>Số điện thoại</Text>
            <TextInput
              style={[s.input, focused === 'phone' && s.inputActive]}
              placeholder="0901234567"
              placeholderTextColor="#b8b8b8"
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              value={phone}
              onChangeText={setPhone}
              onFocus={() => setFocused('phone')}
              onBlur={() => setFocused(null)}
            />
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.label}>Mật khẩu</Text>
            <TextInput
              style={[s.input, focused === 'password' && s.inputActive]}
              placeholder="••••••••"
              placeholderTextColor="#b8b8b8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              s.btn,
              (!isValid || loading) && s.btnMuted,
              pressed && isValid && s.btnPressed,
            ]}
            onPress={handleLogin}
            disabled={!isValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.btnText}>Đăng nhập</Text>
            )}
          </Pressable>
        </View>

        <Text style={s.footer}>© 2025 UjCha · v1.0</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const PRIMARY = '#1a3c34';
const MINT = '#99d6b3';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: PRIMARY },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },

  header: { alignItems: 'center', marginBottom: 32 },
  logoOuter: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  logoInner: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 32, fontWeight: '800', color: PRIMARY, letterSpacing: -1 },
  brand: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  brandSub: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 3.5,
    marginTop: 2,
  },
  tagRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 6 },
  tagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MINT },
  tagText: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
  },
  fieldWrap: { gap: 6 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#717171',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(26,26,26,0.12)',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
  },
  inputActive: {
    borderColor: PRIMARY,
    borderWidth: 2,
    backgroundColor: '#fff',
  },
  btn: {
    height: 52,
    borderRadius: 100,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnMuted: { opacity: 0.38 },
  btnPressed: { opacity: 0.88 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },

  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 24,
  },
});
