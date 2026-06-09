import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { User, Phone, LogOut, Settings, ChevronRight } from '@/components/icons';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth.store';
import { socketService } from '@/services/socket.service';

const PRIMARY = '#1a3c34';
const MINT = '#99d6b3';
const DANGER = '#c45c5c';
const MUTED = '#717171';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();
  const shipper = useAuthStore((s) => s.shipper);
  const updateShipper = useAuthStore((s) => s.updateShipper);

  const [logoutLoading, setLogoutLoading] = useState(false);

  const socketOnline = socketService.isConnected;
  const initial = shipper?.name?.[0]?.toUpperCase() ?? '?';

  async function handleLogout() {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          setLogoutLoading(true);
          await logout();
          setLogoutLoading(false);
        },
      },
    ]);
  }

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Text style={s.eyebrow}>TÀI KHOẢN</Text>
        <Text style={s.headerTitle}>Hồ sơ</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Avatar card */}
        <View style={[s.card, s.avatarCard]}>
          <View style={s.avatarRing}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
          </View>
          <View style={s.onlinePill}>
            <View style={[s.onlineDot, { backgroundColor: socketOnline ? '#22c55e' : '#d1d5db' }]} />
            <Text style={[s.onlineLabel, { color: socketOnline ? '#15803d' : MUTED }]}>
              {socketOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
            </Text>
          </View>
          <Text style={s.shipperName}>{shipper?.name ?? '—'}</Text>
          <Text style={s.shipperEmail}>{shipper?.phone ?? '—'}</Text>
        </View>

        {/* Personal info card */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>THÔNG TIN CÁ NHÂN</Text>

          <View style={s.infoRow}>
            <View style={s.infoIconWrap}><User size={16} color={PRIMARY} /></View>
            <View style={s.infoBody}>
              <Text style={s.infoLabel}>Họ tên</Text>
              <Text style={s.infoValue}>{shipper?.name ?? '—'}</Text>
            </View>
          </View>

          <View style={s.divider} />

          <View style={s.divider} />

          <View style={s.infoRow}>
            <View style={s.infoIconWrap}><Phone size={16} color={PRIMARY} /></View>
            <View style={s.infoBody}>
              <Text style={s.infoLabel}>Số điện thoại</Text>
              <Text style={[s.infoValue, !shipper?.phone && { color: '#b0b0b0' }]}>
                {shipper?.phone ?? 'Chưa cập nhật'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick link to settings */}
        <View style={s.card}>
          <Pressable
            style={({ pressed }) => [s.quickRow, pressed && { opacity: 0.7 }]}
            onPress={() => router.navigate('/(shipper)/settings')}
          >
            <View style={s.quickLeft}>
              <View style={s.infoIconWrap}>
                <Settings size={16} color={PRIMARY} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={s.quickTitle}>Cài đặt ứng dụng</Text>
                <Text style={s.quickDesc}>GPS, thông báo, phiên bản</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#b0b0b0" />
          </Pressable>
        </View>

        {/* Logout */}
        <Pressable
          style={({ pressed }) => [s.logoutBtn, logoutLoading && s.btnDisabled, pressed && { opacity: 0.8 }]}
          onPress={handleLogout}
          disabled={logoutLoading}
        >
          {logoutLoading ? (
            <ActivityIndicator color={DANGER} />
          ) : (
            <>
              <LogOut size={18} color={DANGER} />
              <Text style={s.logoutText}>Đăng xuất</Text>
            </>
          )}
        </Pressable>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f7' },
  header: { backgroundColor: PRIMARY, paddingHorizontal: 20, paddingBottom: 16, gap: 2 },
  eyebrow: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },

  content: { padding: 16, gap: 12, paddingBottom: 48 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#b0b0b0', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(26,26,26,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  avatarCard: { alignItems: 'center', paddingTop: 24, paddingBottom: 20, gap: 8 },
  avatarRing: { padding: 3, borderRadius: 52, borderWidth: 2, borderColor: MINT },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f7f7f7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineLabel: { fontSize: 12, fontWeight: '600' },
  shipperName: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginTop: 4 },
  shipperEmail: { fontSize: 13, color: MUTED },

  divider: { height: 1, backgroundColor: 'rgba(26,26,26,0.05)', marginVertical: 10 },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(26,60,52,0.08)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  infoBody: { flex: 1, gap: 2 },
  infoLabel: { fontSize: 10, fontWeight: '600', color: '#b0b0b0', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },

  quickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  quickTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  quickDesc: { fontSize: 12, color: MUTED },

  logoutBtn: { height: 52, borderRadius: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: DANGER, backgroundColor: '#fff' },
  btnDisabled: { opacity: 0.45 },
  logoutText: { fontSize: 15, fontWeight: '600', color: DANGER },
});
