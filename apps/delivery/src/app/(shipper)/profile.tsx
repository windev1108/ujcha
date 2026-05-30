import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import {
  User, Phone, Mail, LogOut, MapPin, Wifi, WifiOff, Settings,
  Bell, BellOff, Info, ChevronRight, Check, Pencil, X, RefreshCw, Navigation,
} from '@/components/icons';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth.store';
import { useTrackingStore } from '@/store/tracking.store';
import { socketService } from '@/services/socket.service';
import { locationService } from '@/services/location.service';
import { shipperApi } from '@/services/api.service';

const PRIMARY = '#1a3c34';
const MINT = '#99d6b3';
const DANGER = '#c45c5c';
const MUTED = '#717171';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const NOTIF_PREF_KEY = 'ujcha_notif_enabled';

export default function ProfileScreen() {
  const { logout } = useAuth();
  const shipper = useAuthStore((s) => s.shipper);
  const updateShipper = useAuthStore((s) => s.updateShipper);
  const isTracking = useTrackingStore((s) => s.isTracking);

  const [logoutLoading, setLogoutLoading] = useState(false);
  const [socketOnline, setSocketOnline] = useState(false);
  const [gpsPermission, setGpsPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [notifEnabled, setNotifEnabled] = useState(true);

  // Phone edit state
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(shipper?.phone ?? '');
  const [savingPhone, setSavingPhone] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setSocketOnline(socketService.isConnected);
      void locationService.getPermissionStatus().then(setGpsPermission);
      void AsyncStorage.getItem(NOTIF_PREF_KEY).then((v) => {
        if (v !== null) setNotifEnabled(v === 'true');
      });
    }, []),
  );

  async function handleNotifToggle(val: boolean) {
    setNotifEnabled(val);
    await AsyncStorage.setItem(NOTIF_PREF_KEY, String(val));
  }

  async function handleRequestGps() {
    const status = await locationService.requestPermissions();
    setGpsPermission(status ? 'granted' : 'denied');
  }

  async function handleSavePhone() {
    if (!phoneInput.trim()) return;
    setSavingPhone(true);
    try {
      const { data } = await shipperApi.updatePhone(phoneInput.trim());
      updateShipper({ phone: data.phone });
      setEditingPhone(false);
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật số điện thoại. Thử lại sau.');
    } finally {
      setSavingPhone(false);
    }
  }

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

  const gpsGranted = gpsPermission === 'granted';

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <Text style={s.eyebrow}>TÀI KHOẢN</Text>
        <Text style={s.headerTitle}>Hồ sơ & Cài đặt</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Connection status ── */}
        <View style={s.statusCard}>
          <Text style={s.sectionLabel}>TRẠNG THÁI KẾT NỐI</Text>
          <View style={s.statusRow}>
            {/* Socket */}
            <View style={[s.statusItem, socketOnline && s.statusItemActive]}>
              {socketOnline
                ? <Wifi size={18} color={PRIMARY} />
                : <WifiOff size={18} color={MUTED} />
              }
              <Text style={[s.statusItemLabel, { color: socketOnline ? PRIMARY : MUTED }]}>
                {socketOnline ? 'Kết nối' : 'Ngoại tuyến'}
              </Text>
              <View style={[s.statusDot, { backgroundColor: socketOnline ? '#22c55e' : '#d1d5db' }]} />
            </View>

            <View style={s.statusSep} />

            {/* GPS */}
            <View style={[s.statusItem, (gpsGranted && isTracking) && s.statusItemActive]}>
              <Navigation size={18} color={gpsGranted && isTracking ? PRIMARY : MUTED} />
              <Text style={[s.statusItemLabel, { color: gpsGranted && isTracking ? PRIMARY : MUTED }]}>
                {!gpsGranted ? 'GPS từ chối' : isTracking ? 'GPS bật' : 'GPS sẵn sàng'}
              </Text>
              <View style={[
                s.statusDot,
                { backgroundColor: !gpsGranted ? DANGER : isTracking ? '#22c55e' : '#d1d5db' },
              ]} />
            </View>

            <View style={s.statusSep} />

            {/* Refresh */}
            <Pressable
              style={s.refreshBtn}
              onPress={() => {
                setSocketOnline(socketService.isConnected);
                void locationService.getPermissionStatus().then(setGpsPermission);
              }}
            >
              <RefreshCw size={16} color={MUTED} />
            </Pressable>
          </View>
        </View>

        {/* ── Profile card ── */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>HỒ SƠ</Text>

          {/* Avatar */}
          <View style={s.avatarRow}>
            <View style={s.avatarRing}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{shipper?.name?.[0]?.toUpperCase() ?? '?'}</Text>
              </View>
            </View>
            <View style={s.onlinePill}>
              <View style={[s.onlineDot, { backgroundColor: socketOnline ? '#22c55e' : '#d1d5db' }]} />
              <Text style={[s.onlineLabel, { color: socketOnline ? '#15803d' : MUTED }]}>
                {socketOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
              </Text>
            </View>
          </View>

          {/* Name */}
          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <User size={16} color={PRIMARY} />
            </View>
            <View style={s.infoBody}>
              <Text style={s.infoLabel}>Họ tên</Text>
              <Text style={s.infoValue}>{shipper?.name ?? '—'}</Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Email */}
          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <Mail size={16} color={PRIMARY} />
            </View>
            <View style={s.infoBody}>
              <Text style={s.infoLabel}>Email</Text>
              <Text style={s.infoValue}>{shipper?.email ?? '—'}</Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Phone — editable */}
          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <Phone size={16} color={PRIMARY} />
            </View>
            <View style={s.infoBody}>
              <Text style={s.infoLabel}>Số điện thoại</Text>
              {editingPhone ? (
                <View style={s.phoneEditRow}>
                  <TextInput
                    style={s.phoneInput}
                    value={phoneInput}
                    onChangeText={setPhoneInput}
                    keyboardType="phone-pad"
                    placeholder="Nhập số điện thoại"
                    placeholderTextColor="#b0b0b0"
                    autoFocus
                  />
                  <Pressable
                    style={[s.iconBtn, s.iconBtnPrimary]}
                    onPress={handleSavePhone}
                    disabled={savingPhone}
                  >
                    {savingPhone
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Check size={14} color="#fff" />
                    }
                  </Pressable>
                  <Pressable
                    style={s.iconBtn}
                    onPress={() => { setEditingPhone(false); setPhoneInput(shipper?.phone ?? ''); }}
                  >
                    <X size={14} color={MUTED} />
                  </Pressable>
                </View>
              ) : (
                <View style={s.phoneDisplayRow}>
                  <Text style={[s.infoValue, !shipper?.phone && { color: '#b0b0b0' }]}>
                    {shipper?.phone ?? 'Chưa cập nhật'}
                  </Text>
                  <Pressable
                    style={s.editPhoneBtn}
                    onPress={() => { setEditingPhone(true); setPhoneInput(shipper?.phone ?? ''); }}
                  >
                    <Pencil size={13} color={PRIMARY} />
                    <Text style={s.editPhoneTxt}>Sửa</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Settings ── */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>CÀI ĐẶT</Text>

          {/* Notifications */}
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              {notifEnabled
                ? <Bell size={18} color={PRIMARY} />
                : <BellOff size={18} color={MUTED} />
              }
              <View style={s.settingText}>
                <Text style={s.settingTitle}>Thông báo đơn hàng</Text>
                <Text style={s.settingDesc}>Nhận thông báo khi có đơn mới</Text>
              </View>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={handleNotifToggle}
              trackColor={{ false: '#e5e7eb', true: MINT }}
              thumbColor={notifEnabled ? PRIMARY : '#fff'}
            />
          </View>

          <View style={s.divider} />

          {/* GPS permission */}
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <MapPin size={18} color={gpsGranted ? PRIMARY : DANGER} />
              <View style={s.settingText}>
                <Text style={s.settingTitle}>Quyền truy cập GPS</Text>
                <Text style={[s.settingDesc, { color: gpsGranted ? '#15803d' : DANGER }]}>
                  {gpsGranted ? 'Đã cấp quyền vị trí' : 'Chưa cấp quyền — nhấn để cấp'}
                </Text>
              </View>
            </View>
            {gpsGranted ? (
              <View style={s.grantedBadge}>
                <Check size={13} color="#15803d" />
              </View>
            ) : (
              <Pressable style={s.requestBtn} onPress={handleRequestGps}>
                <Text style={s.requestBtnTxt}>Cấp quyền</Text>
                <ChevronRight size={14} color={PRIMARY} />
              </Pressable>
            )}
          </View>
        </View>

        {/* ── App info ── */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>THÔNG TIN ỨNG DỤNG</Text>
          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <Info size={16} color={MUTED} />
            </View>
            <View style={s.infoBody}>
              <Text style={s.infoLabel}>Phiên bản</Text>
              <Text style={s.infoValue}>UjCha Delivery v{APP_VERSION}</Text>
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <Settings size={16} color={MUTED} />
            </View>
            <View style={s.infoBody}>
              <Text style={s.infoLabel}>GPS mode</Text>
              <Text style={s.infoValue}>
                {locationService.isForegroundTracking() ? 'Foreground (Expo Go)' : 'Background'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Logout ── */}
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f7' },
  header: {
    backgroundColor: PRIMARY, paddingHorizontal: 20,
    paddingTop: 4, paddingBottom: 20, gap: 3,
  },
  eyebrow: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },

  content: { padding: 16, gap: 12, paddingBottom: 48 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#b0b0b0', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },

  // Status card
  statusCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16, marginTop: -14,
    borderWidth: 1, borderColor: 'rgba(26,26,26,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusItem: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 8, borderRadius: 12 },
  statusItemActive: { backgroundColor: 'rgba(26,60,52,0.06)' },
  statusItemLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusSep: { width: 1, height: 36, backgroundColor: 'rgba(26,26,26,0.07)' },
  refreshBtn: { width: 44, alignItems: 'center', justifyContent: 'center' },

  // Generic card
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(26,26,26,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  divider: { height: 1, backgroundColor: 'rgba(26,26,26,0.05)', marginVertical: 10 },

  // Avatar
  avatarRow: { alignItems: 'center', marginBottom: 16, gap: 8 },
  avatarRing: { padding: 3, borderRadius: 48, borderWidth: 2, borderColor: MINT },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30, fontWeight: '700', color: '#fff' },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f7f7f7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineLabel: { fontSize: 12, fontWeight: '600' },

  // Info rows
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(26,60,52,0.08)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  infoBody: { flex: 1, gap: 2 },
  infoLabel: { fontSize: 10, fontWeight: '600', color: '#b0b0b0', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },

  // Phone edit
  phoneDisplayRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  phoneEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phoneInput: {
    flex: 1, height: 36, borderRadius: 10, borderWidth: 1.5, borderColor: PRIMARY,
    paddingHorizontal: 10, fontSize: 14, color: '#1a1a1a', backgroundColor: '#f0fdf4',
  },
  editPhoneBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, backgroundColor: 'rgba(26,60,52,0.08)' },
  editPhoneTxt: { fontSize: 12, fontWeight: '600', color: PRIMARY },
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  iconBtnPrimary: { backgroundColor: PRIMARY },

  // Settings
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  settingLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingText: { flex: 1, gap: 2 },
  settingTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  settingDesc: { fontSize: 12, color: MUTED },

  // GPS request
  grantedBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },
  requestBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  requestBtnTxt: { fontSize: 13, fontWeight: '600', color: PRIMARY },

  // Logout
  logoutBtn: { height: 52, borderRadius: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: DANGER, backgroundColor: '#fff' },
  btnDisabled: { opacity: 0.45 },
  logoutText: { fontSize: 15, fontWeight: '600', color: DANGER },
});
