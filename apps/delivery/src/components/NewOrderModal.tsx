import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Bike, Coffee, MapPin, Phone, Wallet } from '@/components/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { shipperApi } from '@/services/api.service';
import { locationService } from '@/services/location.service';
import { haversineMeters } from '@/utils/distance';
import type { NewDeliveryOrderPayload } from '@/services/socket.service';

const COUNTDOWN_SEC = 60;
const THUMB = 58;
const PRIMARY = '#1a3c34';
const MINT = '#99d6b3';

const { width: SCREEN_W } = Dimensions.get('window');

function buildMapHTML(lat: number, lng: number) {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;}</style>
</head><body><div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${lat},${lng}],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
var icon=L.divIcon({html:'<div style="background:#c45c5c;border-radius:50%;width:18px;height:18px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>',iconSize:[18,18],iconAnchor:[9,9],className:''});
L.marker([${lat},${lng}],{icon}).addTo(map).bindPopup('Địa chỉ giao').openPopup();
</script></body></html>`;
}

function fmt(n: number) { return Number(n).toLocaleString('vi-VN') + 'đ'; }

function fmtDist(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function callPhone(phone: string) {
  const cleaned = phone.replace(/\s/g, '');
  if (!cleaned) return;
  Linking.openURL(`tel:${cleaned}`).catch(() =>
    Alert.alert('Lỗi', 'Không thể thực hiện cuộc gọi.'),
  );
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  card: 'Thẻ',
};

function buildItemMeta(item: NewDeliveryOrderPayload['items'][number]): string {
  const parts: string[] = [];
  const opts = Object.entries(item.optionsJson ?? {});
  if (opts.length) parts.push(opts.map(([k, v]) => `${k}: ${v}`).join(' · '));
  const extras = (item.extrasJson ?? []).map((e) => e.name).filter(Boolean);
  if (extras.length) parts.push(extras.join(', '));
  if (item.note) parts.push(`Ghi chú: ${item.note}`);
  return parts.join(' | ');
}

// ── Swipe-to-accept ──────────────────────────────────────────────────────────

function SwipeAccept({ onAccept, disabled }: { onAccept: () => void; disabled: boolean }) {
  const [trackW, setTrackW] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const accepted = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderMove: (_, { dx }) => {
        const max = trackW - THUMB - 8;
        translateX.setValue(Math.max(0, Math.min(dx, max)));
      },
      onPanResponderRelease: (_, { dx }) => {
        const max = trackW - THUMB - 8;
        if (!accepted.current && dx >= max * 0.8) {
          accepted.current = true;
          Animated.timing(translateX, { toValue: max, duration: 120, useNativeDriver: true }).start(() => onAccept());
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  const bgOpacity = translateX.interpolate({
    inputRange: [0, Math.max(trackW - THUMB - 8, 1)],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={s.swipeTrack} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
      <Animated.View style={[StyleSheet.absoluteFill, s.swipeFill, { opacity: bgOpacity, borderRadius: 100 }]} />
      <Text style={s.swipeHint}>Trượt để nhận đơn →</Text>
      <Animated.View style={[s.swipeThumb, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <Bike size={26} color="#99d6b3" />
      </Animated.View>
    </View>
  );
}

// ── Countdown badge ──────────────────────────────────────────────────────────

function CountdownBadge({ seconds }: { seconds: number }) {
  const urgent = seconds <= 15;
  return (
    <View style={[s.countBadge, urgent && s.countBadgeUrgent]}>
      <Text style={[s.countNum, urgent && s.countNumUrgent]}>{seconds}</Text>
      <Text style={[s.countSub, urgent && s.countSubUrgent]}>giây</Text>
    </View>
  );
}

// ── Main Modal ───────────────────────────────────────────────────────────────

export function NewOrderModal({
  order,
  onDismiss,
  onAccepted,
}: {
  order: NewDeliveryOrderPayload;
  onDismiss: () => void;
  onAccepted?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [seconds, setSeconds] = useState(COUNTDOWN_SEC);
  const [accepting, setAccepting] = useState(false);
  const [distM, setDistM] = useState<number | null>(null);
  const soundRef = useRef<any>(null);
  const slideAnim = useRef(new Animated.Value(600)).current;

  // Fetch current location to compute delivery distance
  useEffect(() => {
    if (order.lat == null || order.lng == null) return;
    void locationService.getCurrentLocation().then((loc) => {
      if (!loc) return;
      setDistM(haversineMeters(loc.coords.latitude, loc.coords.longitude, order.lat!, order.lng!));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();

    void (async () => {
      try {
        const ExpoAv = await import('expo-av');
        await ExpoAv.Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await ExpoAv.Audio.Sound.createAsync(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('../../assets/audio/new-order.mp3'),
          { shouldPlay: true, isLooping: true, volume: 1 },
        );
        soundRef.current = sound;
      } catch { /* expo-av not available */ }
    })();

    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(timer); handleDismiss(); return 0; }
        return s - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      void soundRef.current?.stopAsync();
      void soundRef.current?.unloadAsync();
    };
  }, []);

  async function handleDismiss() {
    await soundRef.current?.stopAsync();
    await soundRef.current?.unloadAsync();
    onDismiss();
  }

  async function handleAccept() {
    setAccepting(true);
    try {
      await shipperApi.acceptOrder(order.orderId);
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
      onAccepted?.();
      onDismiss();
    } catch (e: any) {
      setAccepting(false);
      const code = e?.response?.data?.code;
      if (code === 'ORDER_ALREADY_TAKEN') {
        Alert.alert('Không kịp rồi', 'Shipper khác vừa nhận đơn này.');
        void handleDismiss();
      } else {
        Alert.alert('Lỗi', 'Không thể nhận đơn. Thử lại sau.');
      }
    }
  }

  const hasMap = order.lat != null && order.lng != null;
  const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <View style={[s.overlay, { paddingTop: insets.top }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} />

        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={s.sheetHeader}>
            <View style={s.headerLeft}>
              <View style={s.newBadge}>
                <Text style={s.newBadgeText}>ĐƠN MỚI</Text>
              </View>
              <Text style={s.headerTitle}>Giao hàng mới!</Text>
              <Text style={s.headerSub}>
                <Text style={s.paymentCodeText}>#{order.paymentCode}</Text>
                {'  '}·{'  '}{totalItems} món
                {distM != null ? `  ·  ${fmtDist(distM)}` : ''}
              </Text>
            </View>
            <CountdownBadge seconds={seconds} />
          </View>

          <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
            {/* Map */}
            {hasMap && (
              <View style={s.mapWrap}>
                <WebView
                  source={{ html: buildMapHTML(order.lat!, order.lng!) }}
                  style={s.map}
                  originWhitelist={['*']}
                  javaScriptEnabled
                  scrollEnabled={false}
                />
              </View>
            )}

            {/* Info bar: distance + ship fee + total */}
            <View style={s.infoBar}>
              <View style={s.infoBarItem}>
                <MapPin size={14} color={PRIMARY} />
                <View style={s.infoBarText}>
                  <Text style={s.infoBarLabel}>KHOẢNG CÁCH</Text>
                  <Text style={s.infoBarValue}>
                    {distM != null ? fmtDist(distM) : '—'}
                  </Text>
                </View>
              </View>
              <View style={s.infoBarSep} />
              <View style={s.infoBarItem}>
                <Wallet size={14} color={PRIMARY} />
                <View style={s.infoBarText}>
                  <Text style={s.infoBarLabel}>PHÍ SHIP</Text>
                  <Text style={s.infoBarValue}>{fmt(order.shippingFee)}</Text>
                </View>
              </View>
              <View style={s.infoBarSep} />
              <View style={s.infoBarItem}>
                <View style={s.infoBarText}>
                  <Text style={s.infoBarLabel}>TỔNG ĐƠN</Text>
                  <Text style={s.infoBarValue}>{fmt(order.totalAmount)}</Text>
                </View>
              </View>
            </View>

            {/* Address */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>ĐỊA CHỈ GIAO</Text>
              <Text style={s.addressText}>{order.address || '—'}</Text>
              {order.addressNote ? (
                <View style={s.noteRow}>
                  <Text style={s.noteText}>Ghi chú: {order.addressNote}</Text>
                </View>
              ) : null}
            </View>

            <View style={s.divider} />

            {/* Customer */}
            <View style={s.row2}>
              <View style={s.cell}>
                <Text style={s.cellLabel}>Khách hàng</Text>
                <Text style={s.cellValue}>{order.customerName}</Text>
              </View>
              <View style={s.cell}>
                <Text style={s.cellLabel}>SĐT</Text>
                {order.customerPhone ? (
                  <Pressable
                    style={s.phoneBtn}
                    onPress={() => callPhone(order.customerPhone)}
                    hitSlop={8}
                  >
                    <Phone size={13} color={PRIMARY} />
                    <Text style={s.phoneTxt}>{order.customerPhone}</Text>
                  </Pressable>
                ) : (
                  <Text style={s.cellValue}>—</Text>
                )}
              </View>
            </View>

            <View style={s.row2}>
              <View style={s.cell}>
                <Text style={s.cellLabel}>Thanh toán</Text>
                <Text style={s.cellValue}>{PAYMENT_LABELS[order.paymentType] ?? order.paymentType}</Text>
              </View>
            </View>

            <View style={s.divider} />

            {/* Items */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>SẢN PHẨM ({order.items.length} loại)</Text>
              <View style={s.itemsList}>
                {order.items.map((item, i) => {
                  const meta = buildItemMeta(item);
                  return (
                    <View key={i} style={s.itemRow}>
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={s.itemImg} />
                      ) : (
                        <View style={[s.itemImg, s.itemImgPlaceholder]}>
                          <Coffee size={20} color="#0f766e" />
                        </View>
                      )}
                      <View style={s.itemInfo}>
                        <View style={s.itemNameRow}>
                          <View style={s.itemQty}>
                            <Text style={s.itemQtyText}>×{item.quantity}</Text>
                          </View>
                          <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                        </View>
                        {meta ? <Text style={s.itemMeta} numberOfLines={2}>{meta}</Text> : null}
                      </View>
                      <Text style={s.itemPrice}>{fmt(item.price * item.quantity)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <SwipeAccept onAccept={handleAccept} disabled={accepting} />
            <Pressable style={s.declineBtn} onPress={handleDismiss} disabled={accepting}>
              <Text style={s.declineTxt}>Bỏ qua ({seconds}s)</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '94%', overflow: 'hidden' },

  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 16,
  },
  headerLeft: { flex: 1, gap: 2 },
  newBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 4,
  },
  newBadgeText: { fontSize: 10, fontWeight: '800', color: MINT, letterSpacing: 1.5 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  paymentCodeText: { fontWeight: '800', color: MINT },

  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center',
    minWidth: 56, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  countBadgeUrgent: { backgroundColor: 'rgba(248,113,113,0.25)', borderColor: '#f87171' },
  countNum: { fontSize: 20, fontWeight: '800', color: '#fff' },
  countNumUrgent: { color: '#f87171' },
  countSub: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 },
  countSubUrgent: { color: '#f87171' },

  body: { flexShrink: 1 },
  bodyContent: { paddingBottom: 8 },
  mapWrap: { height: 160 },
  map: { flex: 1 },

  // Info bar (distance / ship fee / total)
  infoBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f0fdf4', paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(26,26,26,0.06)',
  },
  infoBarItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoBarSep: { width: 1, height: 28, backgroundColor: 'rgba(26,60,52,0.15)', marginHorizontal: 4 },
  infoBarText: { gap: 1 },
  infoBarLabel: { fontSize: 9, fontWeight: '700', color: '#5a8f7a', textTransform: 'uppercase', letterSpacing: 0.8 },
  infoBarValue: { fontSize: 14, fontWeight: '800', color: PRIMARY },

  section: { paddingHorizontal: 20, paddingVertical: 14, gap: 6 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#717171', textTransform: 'uppercase', letterSpacing: 1.5 },
  addressText: { fontSize: 15, fontWeight: '500', color: '#1a1a1a', lineHeight: 22 },
  noteRow: { backgroundColor: '#fffbeb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderLeftWidth: 3, borderLeftColor: '#c9a227' },
  noteText: { fontSize: 13, color: '#92400e' },

  divider: { height: 1, backgroundColor: 'rgba(26,26,26,0.06)', marginHorizontal: 20 },

  row2: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, gap: 20 },
  cell: { flex: 1, gap: 3 },
  cellLabel: { fontSize: 10, fontWeight: '600', color: '#717171', textTransform: 'uppercase', letterSpacing: 0.8 },
  cellValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },

  phoneBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(26,60,52,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  phoneTxt: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  itemsList: { gap: 8, marginTop: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#f7f7f7', borderRadius: 12, padding: 10 },
  itemImg: { width: 52, height: 52, borderRadius: 10, resizeMode: 'cover' },
  itemImgPlaceholder: { backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1, gap: 3 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemQty: { backgroundColor: '#e8f5e9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  itemQtyText: { fontSize: 11, fontWeight: '700', color: '#0f766e' },
  itemName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  itemMeta: { fontSize: 11, color: '#717171', lineHeight: 16 },
  itemPrice: { fontSize: 13, fontWeight: '700', color: PRIMARY, minWidth: 60, textAlign: 'right' },

  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(26,26,26,0.06)', backgroundColor: '#fff' },

  swipeTrack: {
    height: 58, borderRadius: 100, backgroundColor: '#f0fdf4',
    borderWidth: 1.5, borderColor: MINT, justifyContent: 'center',
    alignItems: 'center', overflow: 'hidden', paddingHorizontal: 4,
  },
  swipeFill: { backgroundColor: PRIMARY },
  swipeHint: { fontSize: 14, fontWeight: '600', color: '#0f766e' },
  swipeThumb: {
    position: 'absolute', left: 4, width: THUMB, height: THUMB, borderRadius: 100,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },

  declineBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  declineTxt: { fontSize: 14, color: '#717171', fontWeight: '500' },
});
