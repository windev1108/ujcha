import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
import {
  Package, MapPin, CheckCircle2, Radio, User, FileText,
  Clock, CreditCard, Coffee, ChevronLeft,
} from '@/components/icons';
import { useTracking } from '@/hooks/use-tracking';
import { useOrders } from '@/hooks/use-orders';
import { useOrdersStore } from '@/store/orders.store';
import { socketService } from '@/services/socket.service';
import { shipperApi } from '@/services/api.service';
import type { Order } from '@/store/orders.store';

// ── constants ─────────────────────────────────────────────────────────────────
const MAP_MAX = 260;
const MAP_MIN = 90;
const SCROLL_THRESHOLD = 80;
const PRIMARY = '#1a3c34';

// ── helpers ───────────────────────────────────────────────────────────────────
function buildLeafletHTML(lat: number, lng: number, destLat?: number | null, destLng?: number | null) {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{margin:0;padding:0;height:100%;width:100%;}
.me{background:#1a3c34;border-radius:50%;width:16px;height:16px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);}
.dest{background:#c45c5c;border-radius:50%;width:13px;height:13px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);}
</style></head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false}).setView([${lat},${lng}],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(map);
L.control.zoom({position:'bottomright'}).addTo(map);
var meIcon=L.divIcon({html:'<div class="me"></div>',iconSize:[16,16],iconAnchor:[8,8],className:''});
var destIcon=L.divIcon({html:'<div class="dest"></div>',iconSize:[13,13],iconAnchor:[6.5,6.5],className:''});
var marker=L.marker([${lat},${lng}],{icon:meIcon}).addTo(map);
${destLat && destLng ? `L.marker([${destLat},${destLng}],{icon:destIcon}).addTo(map).bindPopup('Địa chỉ giao hàng').openPopup();` : ''}
window.updateLocation=function(lat,lng){marker.setLatLng([lat,lng]);map.setView([lat,lng],map.getZoom(),{animate:true,duration:0.6});};
</script></body></html>`;
}

function buildItemMeta(item: Order['items'][number]): string {
  const parts: string[] = [];
  const opts = Object.entries(item.optionsJson ?? {});
  if (opts.length) parts.push(opts.map(([k, v]) => `${k}: ${v}`).join(' · '));
  const extras = (item.extrasJson ?? []).map((e) => e.name).filter(Boolean);
  if (extras.length) parts.push(extras.join(', '));
  if (item.note) parts.push(`Ghi chú: ${item.note}`);
  return parts.join(' | ');
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  confirmed:  { label: 'Đã xác nhận',   color: '#1d4ed8', bg: '#eff6ff' },
  preparing:  { label: 'Đang pha chế',  color: '#7e22ce', bg: '#faf5ff' },
  ready:      { label: 'Sẵn sàng lấy',  color: '#0f766e', bg: '#f0fdfa' },
  picked_up:  { label: 'Đã lấy hàng',   color: '#c2410c', bg: '#fff7ed' },
  arrived:    { label: 'Đã đến nơi',    color: '#0369a1', bg: '#f0f9ff' },
  delivering: { label: 'Đang giao',     color: '#0369a1', bg: '#f0f9ff' },
  completed:  { label: 'Giao xong',     color: '#15803d', bg: '#f0fdf4' },
};

// ── main screen ───────────────────────────────────────────────────────────────
export default function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { markPickedUp, markArrived, completeDelivery } = useOrders();
  const { isTracking, start, stop, lastLocation } = useTracking(id);
  const webviewRef = useRef<WebView>(null);

  const order = useOrdersStore((s) => s.orders.find((o) => o.id === id) ?? null);

  // Refresh order status on focus to catch any missed socket events
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void shipperApi.getOrder(id)
        .then(({ data }) => {
          const d = data as Order;
          useOrdersStore.getState().setOrders(
            useOrdersStore.getState().orders.map((o) => (o.id === id ? { ...o, ...d } : o)),
          );
        })
        .catch(() => {});
    }, [id]),
  );

  // Real-time socket updates for this specific order
  useEffect(() => {
    if (!id) return;
    const handler = (data: { orderId: string; status: string }) => {
      if (data.orderId === id) {
        useOrdersStore.getState().updateOrderStatus(data.orderId, data.status);
      }
    };
    socketService.on<{ orderId: string; status: string }>('order:status', handler);
    return () => socketService.off('order:status', handler as (...args: unknown[]) => void);
  }, [id]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const mapHeight = scrollY.interpolate({
    inputRange: [0, SCROLL_THRESHOLD],
    outputRange: [MAP_MAX, MAP_MIN],
    extrapolate: 'clamp',
  });
  const mapOverlayOpacity = scrollY.interpolate({
    inputRange: [0, SCROLL_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    if (!lastLocation || !webviewRef.current) return;
    webviewRef.current.injectJavaScript(
      `window.updateLocation(${lastLocation.lat},${lastLocation.lng});true;`,
    );
  }, [lastLocation]);

  async function handlePickup() {
    try {
      await markPickedUp(id);
      const ok = await start();
      if (!ok) Alert.alert('GPS', 'Không thể bật GPS. Vui lòng kiểm tra quyền vị trí trong cài đặt.');
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật trạng thái.');
    }
  }

  async function handleArrived() {
    try { await markArrived(id); }
    catch { Alert.alert('Lỗi', 'Không thể cập nhật trạng thái.'); }
  }

  async function handleComplete() {
    Alert.alert('Xác nhận hoàn thành', 'Bạn đã giao hàng thành công?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Hoàn thành',
        style: 'default',
        onPress: async () => {
          try {
            await completeDelivery(id);
            await stop();
            router.back();
          } catch {
            Alert.alert('Lỗi', 'Không thể cập nhật trạng thái.');
          }
        },
      },
    ]);
  }

  async function handleRestartGps() {
    const ok = await start();
    if (!ok) Alert.alert('GPS', 'Không thể bật GPS. Vui lòng kiểm tra quyền vị trí trong cài đặt.');
  }

  if (!order) {
    return (
      <SafeAreaView style={s.loadWrap}>
        <ActivityIndicator color={PRIMARY} size="large" />
      </SafeAreaView>
    );
  }

  const mapLat = lastLocation?.lat ?? order.address?.lat ?? 10.7769;
  const mapLng = lastLocation?.lng ?? order.address?.lng ?? 106.7009;
  const name = order.user?.name ?? order.guestDeliveryName ?? 'Khách';
  const phone = order.user?.phone ?? order.guestDeliveryPhone ?? '—';
  const displayId = order.paymentCode ? `#${order.paymentCode}` : `#${order.id.slice(-6).toUpperCase()}`;
  const st = STATUS_LABEL[order.status] ?? { label: order.status, color: '#717171', bg: '#f5f5f5' };

  const canPickup = order.status === 'ready';
  const canArrived = order.status === 'picked_up';
  const canComplete = order.status === 'arrived' || order.status === 'delivering';
  const isActiveDelivery = ['picked_up', 'arrived', 'delivering'].includes(order.status);
  const isWaiting = ['confirmed', 'preparing'].includes(order.status);

  const isCashPending = order.paymentType === 'cash' && order.paymentStatus !== 'paid';
  const isPaid = order.paymentStatus === 'paid';

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Top bar */}
      <View style={s.topBar}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color="#fff" />
        </Pressable>

        <View style={s.topCenter}>
          <Text style={s.topId}>{displayId}</Text>
          <View style={[s.statusPill, { backgroundColor: st.bg }]}>
            <Text style={[s.statusPillText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        <View style={s.gpsBadge}>
          <View style={[s.gpsDot, { backgroundColor: isTracking ? '#22c55e' : 'rgba(255,255,255,0.3)' }]} />
          <Text style={[s.gpsText, { color: isTracking ? '#22c55e' : 'rgba(255,255,255,0.4)' }]}>GPS</Text>
        </View>
      </View>

      {/* Animated map */}
      <Animated.View style={[s.mapWrap, { height: mapHeight }]}>
        <WebView
          ref={webviewRef}
          source={{ html: buildLeafletHTML(mapLat, mapLng, order.address?.lat, order.address?.lng) }}
          style={s.map}
          originWhitelist={['*']}
          javaScriptEnabled
          scrollEnabled={false}
        />
        <Animated.View style={[s.mapHint, { opacity: mapOverlayOpacity }]}>
          <View style={s.mapHintPill}>
            <Text style={s.mapHintText}>↑ Kéo lên để xem bản đồ đầy đủ</Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Scrollable content */}
      <Animated.ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
      >
        {/* ── Action buttons ── */}
        <View style={s.actionsCard}>
          {isActiveDelivery && !isTracking && (
            <Pressable style={[s.actionBtn, s.btnOutline]} onPress={handleRestartGps}>
              <Radio size={18} color={PRIMARY} />
              <Text style={[s.btnText, { color: PRIMARY }]}>Bật lại GPS</Text>
            </Pressable>
          )}

          {isWaiting && (
            <View style={s.waitCard}>
              <Clock size={22} color="#7e22ce" />
              <View style={s.waitTextWrap}>
                <Text style={s.waitTitle}>Đang chờ cửa hàng chuẩn bị</Text>
                <Text style={s.waitSub}>Bạn sẽ được thông báo khi hàng sẵn sàng</Text>
              </View>
            </View>
          )}

          {canPickup && (
            <Pressable style={[s.actionBtn, s.btnPrimary]} onPress={handlePickup}>
              <Package size={18} color="#fff" />
              <Text style={s.btnText}>Đã lấy hàng</Text>
            </Pressable>
          )}

          {canArrived && (
            <Pressable style={[s.actionBtn, s.btnOrange]} onPress={handleArrived}>
              <MapPin size={18} color="#fff" />
              <Text style={s.btnText}>Đã đến điểm giao</Text>
            </Pressable>
          )}

          {canComplete && (
            <Pressable style={[s.actionBtn, s.btnGreen]} onPress={handleComplete}>
              <CheckCircle2 size={18} color="#fff" />
              <Text style={s.btnText}>Giao xong</Text>
            </Pressable>
          )}
        </View>

        {/* ── Payment info — critical for cash collection ── */}
        <View style={[s.payCard, isCashPending && s.payCardCash, isPaid && s.payCardPaid]}>
          <View style={s.payRow}>
            <View style={s.payLeft}>
              <Text style={s.cardLabel}>THANH TOÁN</Text>
              <Text style={s.payType}>
                {order.paymentType === 'cash' ? '💵 Tiền mặt' : '🏦 Chuyển khoản'}
              </Text>
            </View>
            <View style={s.payRight}>
              <View style={[
                s.payStatusBadge,
                isPaid ? s.payBadgePaid : isCashPending ? s.payBadgeCash : s.payBadgePending,
              ]}>
                <Text style={[
                  s.payStatusText,
                  { color: isPaid ? '#15803d' : isCashPending ? '#c2410c' : '#717171' },
                ]}>
                  {isPaid ? '✓ Đã thanh toán' : isCashPending ? '💰 Thu tiền mặt' : '⏳ Chờ xác nhận'}
                </Text>
              </View>
              <Text style={[s.payAmount, isCashPending && { color: '#c2410c' }]}>
                {Number(order.finalAmount).toLocaleString('vi-VN')}đ
              </Text>
            </View>
          </View>
          {isCashPending && (
            <View style={s.payWarning}>
              <Text style={s.payWarningText}>⚠️ Nhớ thu tiền mặt khi giao hàng</Text>
            </View>
          )}
        </View>

        {/* ── Address ── */}
        <View style={s.infoCard}>
          <Text style={s.cardLabel}>ĐỊA CHỈ GIAO</Text>
          <Text style={s.addressText}>{order.address?.fullAddress ?? '—'}</Text>
          {order.address?.note ? (
            <View style={s.noteRow}>
              <FileText size={13} color="#92400e" style={{ marginRight: 4 }} />
              <Text style={s.noteText}>{order.address.note}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Customer ── */}
        <View style={s.infoCard}>
          <Text style={s.cardLabel}>KHÁCH HÀNG</Text>
          <View style={s.customerRow}>
            <View style={s.customerAvatar}>
              <User size={20} color="#717171" />
            </View>
            <View style={s.customerInfo}>
              <Text style={s.customerName}>{name}</Text>
              <Text style={s.customerPhone}>{phone}</Text>
            </View>
            <View style={s.amountBadge}>
              <Text style={s.amountLabel}>Phí ship</Text>
              <Text style={s.amountValue}>{Number(order.shippingFee).toLocaleString('vi-VN')}đ</Text>
            </View>
          </View>
        </View>

        {/* ── GPS coords ── */}
        {lastLocation && (
          <View style={s.gpsCard}>
            <View style={s.gpsPulse} />
            <Text style={s.gpsCoordsText}>
              {lastLocation.lat.toFixed(5)}, {lastLocation.lng.toFixed(5)}
            </Text>
          </View>
        )}

        {/* ── Items ── */}
        {order.items.length > 0 && (
          <View style={s.infoCard}>
            <Text style={s.cardLabel}>SẢN PHẨM · {order.items.length} MÓN</Text>
            <View style={s.itemsList}>
              {order.items.map((item) => {
                const meta = buildItemMeta(item);
                const imgUrl = item.product?.imageUrls?.[0];
                return (
                  <View key={item.id} style={s.itemRow}>
                    {imgUrl ? (
                      <Image source={imgUrl} style={s.itemImg} contentFit="cover" />
                    ) : (
                      <View style={[s.itemImg, s.itemPlaceholder]}>
                        <Coffee size={22} color="#0f766e" />
                      </View>
                    )}
                    <View style={s.itemBody}>
                      <View style={s.itemHeader}>
                        <View style={s.itemQtyBadge}>
                          <Text style={s.itemQtyText}>×{item.quantity}</Text>
                        </View>
                        <Text style={s.itemName} numberOfLines={1}>{item.product.name}</Text>
                      </View>
                      {meta ? <Text style={s.itemMeta} numberOfLines={2}>{meta}</Text> : null}
                    </View>
                    <Text style={s.itemPrice}>
                      {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Tổng đơn</Text>
              <Text style={s.totalValue}>{Number(order.finalAmount).toLocaleString('vi-VN')}đ</Text>
            </View>
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f0f0' },
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7f7f7' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: PRIMARY, gap: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: {},
  topCenter: { flex: 1, alignItems: 'center', gap: 4 },
  topId: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 1.2 },
  statusPill: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 40, justifyContent: 'flex-end' },
  gpsDot: { width: 7, height: 7, borderRadius: 4 },
  gpsText: { fontSize: 11, fontWeight: '700' },

  mapWrap: { position: 'relative', overflow: 'hidden' },
  map: { flex: 1 },
  mapHint: { position: 'absolute', bottom: 8, left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' },
  mapHintPill: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  mapHintText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  scroll: { flex: 1 },
  scrollContent: { padding: 12, gap: 10, paddingBottom: 40 },

  actionsCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 12, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: 'rgba(26,26,26,0.05)',
  },
  actionBtn: { height: 50, borderRadius: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnPrimary: { backgroundColor: PRIMARY },
  btnOrange: { backgroundColor: '#c2410c' },
  btnGreen: { backgroundColor: '#15803d' },
  btnOutline: { borderWidth: 1.5, borderColor: PRIMARY, backgroundColor: '#fff' },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  waitCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#faf5ff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#e9d5ff',
  },
  waitEmoji: { fontSize: 24 },
  waitTextWrap: { flex: 1, gap: 2 },
  waitTitle: { fontSize: 14, fontWeight: '600', color: '#7e22ce' },
  waitSub: { fontSize: 12, color: '#a855f7' },

  // Payment card
  payCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 14, gap: 8,
    borderWidth: 1.5, borderColor: 'rgba(26,26,26,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  payCardCash: { borderColor: '#fed7aa', backgroundColor: '#fff7ed' },
  payCardPaid: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
  payRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  payLeft: { gap: 4 },
  payRight: { alignItems: 'flex-end', gap: 6 },
  payType: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  payStatusBadge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  payBadgePaid: { backgroundColor: '#dcfce7' },
  payBadgeCash: { backgroundColor: '#fed7aa' },
  payBadgePending: { backgroundColor: '#f3f4f6' },
  payStatusText: { fontSize: 12, fontWeight: '700' },
  payAmount: { fontSize: 18, fontWeight: '800', color: PRIMARY },
  payWarning: {
    backgroundColor: '#fef3c7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderLeftWidth: 3, borderLeftColor: '#f59e0b',
  },
  payWarningText: { fontSize: 13, fontWeight: '600', color: '#92400e' },

  infoCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    borderWidth: 1, borderColor: 'rgba(26,26,26,0.05)',
  },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#b0b0b0', letterSpacing: 1.5, textTransform: 'uppercase' },
  addressText: { fontSize: 14, fontWeight: '500', color: '#1a1a1a', lineHeight: 20 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fffbeb', borderRadius: 10, padding: 10, borderLeftWidth: 3, borderLeftColor: '#c9a227' },
  noteText: { flex: 1, fontSize: 13, color: '#92400e' },

  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  customerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  customerInfo: { flex: 1, gap: 2 },
  customerName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  customerPhone: { fontSize: 13, color: '#717171' },
  amountBadge: { alignItems: 'flex-end', gap: 2 },
  amountLabel: { fontSize: 10, color: '#b0b0b0', fontWeight: '600', textTransform: 'uppercase' },
  amountValue: { fontSize: 15, fontWeight: '700', color: PRIMARY },

  gpsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f0fdf4', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  gpsPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  gpsCoordsText: { fontSize: 12, color: '#166534', fontWeight: '500' },

  itemsList: { gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemImg: { width: 56, height: 56, borderRadius: 12 },
  itemPlaceholder: { backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center' },
  itemBody: { flex: 1, gap: 4, paddingTop: 2 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemQtyBadge: { backgroundColor: '#e8f5e9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  itemQtyText: { fontSize: 11, fontWeight: '700', color: '#0f766e' },
  itemName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  itemMeta: { fontSize: 11, color: '#717171', lineHeight: 16 },
  itemPrice: { fontSize: 13, fontWeight: '700', color: PRIMARY, paddingTop: 2, minWidth: 64, textAlign: 'right' },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(26,26,26,0.06)',
  },
  totalLabel: { fontSize: 13, fontWeight: '600', color: '#717171' },
  totalValue: { fontSize: 17, fontWeight: '800', color: PRIMARY },
});
