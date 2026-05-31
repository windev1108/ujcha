import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import {
  Wifi, WifiOff, Navigation, MapPin, Bell, BellOff,
  Info, Settings, RefreshCw, Check,
} from '@/components/icons';
import { socketService } from '@/services/socket.service';
import { locationService } from '@/services/location.service';
import { useTrackingStore } from '@/store/tracking.store';

const PRIMARY = '#1a3c34';
const MINT = '#99d6b3';
const DANGER = '#c45c5c';
const MUTED = '#717171';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const NOTIF_PREF_KEY = 'ujcha_notif_enabled';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const isTracking = useTrackingStore((s) => s.isTracking);

  const [socketOnline, setSocketOnline] = useState(false);
  const [gpsPermission, setGpsPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [gpsActive, setGpsActive] = useState(false);
  const [togglingGps, setTogglingGps] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setSocketOnline(socketService.isConnected);
      void locationService.getPermissionStatus().then((perm) => {
        setGpsPermission(perm);
        setGpsActive(locationService.isGpsActive());
      });
      void AsyncStorage.getItem(NOTIF_PREF_KEY).then((v) => {
        if (v !== null) setNotifEnabled(v === 'true');
      });
    }, []),
  );

  async function handleNotifToggle(val: boolean) {
    setNotifEnabled(val);
    await AsyncStorage.setItem(NOTIF_PREF_KEY, String(val));
  }

  async function handleGpsToggle(val: boolean) {
    setTogglingGps(true);
    try {
      if (val) {
        const ok = await locationService.enableGps();
        if (!ok) {
          Alert.alert(
            'Không thể bật GPS',
            'Vui lòng cấp quyền vị trí trong Cài đặt hệ thống → Quyền ứng dụng.',
            [{ text: 'OK' }],
          );
        }
        const perm = await locationService.getPermissionStatus();
        setGpsPermission(perm);
        setGpsActive(locationService.isGpsActive());
      } else {
        await locationService.disableGps();
        setGpsActive(false);
      }
    } finally {
      setTogglingGps(false);
    }
  }

  function handleRefresh() {
    setSocketOnline(socketService.isConnected);
    void locationService.getPermissionStatus().then((perm) => {
      setGpsPermission(perm);
      setGpsActive(locationService.isGpsActive());
    });
  }

  const gpsGranted = gpsPermission === 'granted';

  function gpsStatusText() {
    if (!gpsGranted) return 'Chưa cấp quyền vị trí';
    if (isTracking) return 'Đang theo dõi đơn hàng';
    if (gpsActive) return 'Định vị đang bật';
    return 'Định vị đang tắt';
  }

  function gpsStatusColor() {
    if (!gpsGranted) return DANGER;
    if (gpsActive || isTracking) return '#15803d';
    return MUTED;
  }

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Text style={s.eyebrow}>ỨNG DỤNG</Text>
        <Text style={s.headerTitle}>Cài đặt</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Connection status ── */}
        <View style={s.statusCard}>
          <View style={s.statusTitleRow}>
            <Text style={s.sectionLabel}>TRẠNG THÁI KẾT NỐI</Text>
            <Pressable style={s.refreshBtn} onPress={handleRefresh}>
              <RefreshCw size={15} color={MUTED} />
            </Pressable>
          </View>
          <View style={s.statusRow}>
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
            <View style={[s.statusItem, (gpsGranted && isTracking) && s.statusItemActive]}>
              <Navigation size={18} color={gpsGranted && isTracking ? PRIMARY : MUTED} />
              <Text style={[s.statusItemLabel, { color: gpsGranted && isTracking ? PRIMARY : MUTED }]}>
                {!gpsGranted ? 'GPS tắt' : isTracking ? 'GPS đang dùng' : 'GPS sẵn sàng'}
              </Text>
              <View style={[
                s.statusDot,
                { backgroundColor: !gpsGranted ? DANGER : isTracking ? '#22c55e' : '#d1d5db' },
              ]} />
            </View>
          </View>
        </View>

        {/* ── GPS / Location ── */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>VỊ TRÍ & GPS</Text>

          {/* Main GPS toggle */}
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <View style={[
                s.iconWrap,
                { backgroundColor: (gpsActive || isTracking) ? 'rgba(26,60,52,0.10)' : !gpsGranted ? '#fff5f5' : '#f3f4f6' },
              ]}>
                <Navigation size={18} color={(gpsActive || isTracking) ? PRIMARY : !gpsGranted ? DANGER : MUTED} />
              </View>
              <View style={s.settingText}>
                <Text style={s.settingTitle}>Bật định vị</Text>
                <Text style={[s.settingDesc, { color: gpsStatusColor() }]}>
                  {gpsStatusText()}
                </Text>
                {(gpsActive || isTracking) && (
                  <Text style={[s.settingDesc, { color: '#b0b0b0', marginTop: 1 }]}>
                    Tự động bật khi đăng nhập
                  </Text>
                )}
              </View>
            </View>
            <Switch
              value={gpsActive || isTracking}
              onValueChange={handleGpsToggle}
              disabled={togglingGps || isTracking}
              trackColor={{ false: '#e5e7eb', true: MINT }}
              thumbColor={(gpsActive || isTracking) ? PRIMARY : '#fff'}
            />
          </View>

          {/* Permission status row */}
          <View style={s.divider} />
          <View style={s.infoRow}>
            <View style={[s.iconWrap, { backgroundColor: gpsGranted ? '#f0fdf4' : '#fff5f5' }]}>
              <MapPin size={16} color={gpsGranted ? '#15803d' : DANGER} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.infoLabel}>Quyền truy cập</Text>
              <Text style={[s.infoValue, { color: gpsGranted ? '#15803d' : DANGER }]}>
                {gpsGranted ? 'Đã cấp quyền vị trí' : 'Chưa cấp quyền — bật để yêu cầu'}
              </Text>
            </View>
            {gpsGranted && (
              <View style={s.grantedBadge}>
                <Check size={14} color="#15803d" />
              </View>
            )}
          </View>

          <View style={s.divider} />
          <View style={s.infoRow}>
            <View style={s.iconWrap}>
              <Settings size={16} color={MUTED} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.infoLabel}>Chế độ GPS</Text>
              <Text style={s.infoValue}>
                {locationService.isForegroundTracking()
                  ? 'Foreground — Expo Go'
                  : 'Background — Production'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Notifications ── */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>THÔNG BÁO</Text>
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <View style={[s.iconWrap, { backgroundColor: notifEnabled ? 'rgba(26,60,52,0.08)' : '#f3f4f6' }]}>
                {notifEnabled
                  ? <Bell size={18} color={PRIMARY} />
                  : <BellOff size={18} color={MUTED} />
                }
              </View>
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
        </View>

        {/* ── App info ── */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>THÔNG TIN ỨNG DỤNG</Text>

          <View style={s.infoRow}>
            <View style={s.iconWrap}>
              <Info size={16} color={MUTED} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.infoLabel}>Phiên bản</Text>
              <Text style={s.infoValue}>UjCha Delivery v{APP_VERSION}</Text>
            </View>
          </View>

          <View style={s.divider} />

          <View style={s.infoRow}>
            <View style={s.iconWrap}>
              <Settings size={16} color={MUTED} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.infoLabel}>GPS mode</Text>
              <Text style={s.infoValue}>
                {locationService.isForegroundTracking() ? 'Foreground (Expo Go)' : 'Background'}
              </Text>
            </View>
          </View>
        </View>

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

  statusCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(26,26,26,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    gap: 12,
  },
  statusTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refreshBtn: { padding: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusItem: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  statusItemActive: { backgroundColor: 'rgba(26,60,52,0.06)' },
  statusItemLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusSep: { width: 1, height: 40, backgroundColor: 'rgba(26,26,26,0.07)' },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(26,26,26,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  divider: { height: 1, backgroundColor: 'rgba(26,26,26,0.05)', marginVertical: 10 },

  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  settingLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(26,60,52,0.08)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  settingText: { flex: 1, gap: 2 },
  settingTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  settingDesc: { fontSize: 12, color: MUTED },
  grantedBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoLabel: { fontSize: 10, fontWeight: '600', color: '#b0b0b0', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 13, fontWeight: '500', color: '#1a1a1a' },
});
