import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Bike, MapPin, Package, Inbox, CheckCircle, XCircle, ChevronRight, Phone } from '@/components/icons';
import { DateFilter, isInRange } from '@/components/date-filter';
import type { DateRange } from '@/components/date-filter';
import { useOrders } from '@/hooks/use-orders';
import { locationService } from '@/services/location.service';
import { shipperApi } from '@/services/api.service';
import { haversineMeters } from '@/utils/distance';
import { socketService } from '@/services/socket.service';
import type { NewDeliveryOrderPayload } from '@/services/socket.service';
import type { Order } from '@/store/orders.store';

// ── Types ─────────────────────────────────────────────────────────────────────

type HistoryOrder = {
  id: string;
  status: string;
  finalAmount: number;
  shippingFee: number;
  createdAt: string;
  updatedAt: string;
  address: { fullAddress: string } | null;
};

type Tab = 'available' | 'active' | 'history';

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIMARY = '#1a3c34';
const ACTIVE_STATUSES = ['confirmed', 'preparing', 'ready', 'picked_up', 'arrived', 'delivering'];

const STATUS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  confirmed: { label: 'Đã xác nhận', color: '#1d4ed8', bg: '#eff6ff', dot: '#3b82f6' },
  preparing: { label: 'Đang pha chế', color: '#7e22ce', bg: '#faf5ff', dot: '#a855f7' },
  ready: { label: 'Sẵn sàng giao', color: '#0f766e', bg: '#f0fdfa', dot: '#14b8a6' },
  picked_up: { label: 'Đã lấy hàng', color: '#c2410c', bg: '#fff7ed', dot: '#f97316' },
  arrived: { label: 'Đến điểm giao', color: '#0369a1', bg: '#f0f9ff', dot: '#0ea5e9' },
  delivering: { label: 'Đang giao', color: '#0369a1', bg: '#f0f9ff', dot: '#0ea5e9' },
};

const STATUS_PRIORITY: Record<string, number> = {
  arrived: 0, picked_up: 1, ready: 2, preparing: 3, confirmed: 4, delivering: 5,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortId(id: string) { return id.slice(-6).toUpperCase(); }

function timeLabel(iso: string) {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDist(m: number) {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

function fmt(n: number) { return Number(n).toLocaleString('vi-VN') + 'đ'; }

// ── Sub-components ────────────────────────────────────────────────────────────

function OrderCard({ order, onPress, distM }: { order: Order; onPress: () => void; distM?: number }) {
  const st = STATUS[order.status] ?? { label: order.status, color: '#717171', bg: '#f5f5f5', dot: '#717171' };
  const name = order.user?.name ?? order.guestDeliveryName ?? 'Khách';
  const phone = order.user?.phone ?? order.guestDeliveryPhone ?? '';
  const isActionable = ['ready', 'picked_up', 'delivering', 'arrived'].includes(order.status);

  return (
    <Pressable
      style={({ pressed }) => [s.card, isActionable && s.cardActionable, pressed && s.cardPressed]}
      onPress={onPress}
    >
      <View style={s.cardRow1}>
        <View style={s.idRow}>
          <View style={[s.dot, { backgroundColor: st.dot }]} />
          <Text style={s.orderId}>
            {order.paymentCode ? `#${order.paymentCode}` : `#${shortId(order.id)}`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {distM !== undefined && (
            <View style={s.distPill}>
              <MapPin size={10} color="#0f766e" />
              <Text style={s.distText}>{fmtDist(distM)}</Text>
            </View>
          )}
          <Text style={s.timeLabel}>{timeLabel(order.createdAt)}</Text>
        </View>
      </View>

      <View style={[s.badge, { backgroundColor: st.bg }]}>
        <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
      </View>

      <Text style={s.address} numberOfLines={2}>
        {order.address?.fullAddress ?? 'Chưa có địa chỉ'}
      </Text>

      <View style={s.cardRow2}>
        <View style={s.customerCol}>
          <Text style={s.customerName} numberOfLines={1}>{name}</Text>
          {phone ? (
            <Pressable
              style={s.phoneChip}
              onPress={(e) => { e.stopPropagation?.(); Linking.openURL(`tel:${phone.replace(/\s/g, '')}`); }}
              hitSlop={6}
            >
              <Phone size={11} color="#0369a1" />
              <Text style={s.customerPhone}>{phone}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={s.amountCol}>
          <Text style={s.amount}>{Number(order.finalAmount).toLocaleString('vi-VN')}đ</Text>
          <View style={s.itemsPill}>
            <Text style={s.itemsText}>{order.items.length} món</Text>
          </View>
        </View>
      </View>

      {isActionable && (
        <View style={s.actionStrip}>
          <View style={s.actionStripInner}>
            {order.status === 'ready' && <Package size={13} color="#0f766e" />}
            {(order.status === 'picked_up' || order.status === 'delivering') && <Bike size={13} color="#0f766e" />}
            {order.status === 'arrived' && <MapPin size={13} color="#0f766e" />}
            <Text style={s.actionStripText}>
              {order.status === 'ready' ? 'Đến lấy hàng' :
                order.status === 'delivering' ? 'Đang giao hàng' :
                order.status === 'picked_up' ? 'Đang trên đường' :
                  'Đã đến điểm giao'}
            </Text>
            <ChevronRight size={13} color="#0f766e" />
          </View>
        </View>
      )}
    </Pressable>
  );
}

function AvailableOrderCard({
  order, onAccept, accepting, distM,
}: {
  order: NewDeliveryOrderPayload;
  onAccept: (id: string) => void;
  accepting: boolean;
  distM?: number;
}) {
  return (
    <View style={s.availCard}>
      <View style={s.availHeader}>
        <View style={s.availBadge}>
          <Text style={s.availBadgeText}>CHƯA CÓ SHIPPER</Text>
        </View>
        <Text style={s.availCode}>#{order.paymentCode}</Text>
      </View>

      <View style={s.availMeta}>
        {distM !== undefined && (
          <View style={s.availDistPill}>
            <MapPin size={10} color="#c2410c" />
            <Text style={s.availDistText}>{fmtDist(distM)}</Text>
          </View>
        )}
        <Text style={s.availFee}>+{fmt(order.shippingFee)} ship</Text>
      </View>

      <Text style={s.availAddress} numberOfLines={2}>{order.address || '—'}</Text>

      <View style={s.availRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.availCustomer}>{order.customerName}</Text>
          <Text style={s.availItems}>{order.items.reduce((sum, i) => sum + i.quantity, 0)} món · {fmt(order.totalAmount)}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [s.acceptBtn, accepting && s.acceptBtnDisabled, pressed && { opacity: 0.85 }]}
          onPress={() => onAccept(order.orderId)}
          disabled={accepting}
        >
          {accepting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.acceptBtnText}>Nhận đơn</Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

function HistoryCard({ item, onPress }: { item: HistoryOrder; onPress: () => void }) {
  const done = item.status === 'completed';
  return (
    <Pressable
      style={({ pressed }) => [s.histCard, !done && s.histCardCancelled, pressed && { opacity: 0.82 }]}
      onPress={onPress}
    >
      <View style={s.histRow}>
        <View style={[s.histIconWrap, { backgroundColor: done ? '#f0fdf4' : '#fff5f5' }]}>
          {done ? <CheckCircle size={18} color="#15803d" /> : <XCircle size={18} color="#c45c5c" />}
        </View>
        <View style={s.histInfo}>
          <Text style={s.histAddress} numberOfLines={1}>
            {item.address?.fullAddress ?? '—'}
          </Text>
          <Text style={s.histDate}>{dateLabel(item.updatedAt)}</Text>
        </View>
        <View style={s.histRight}>
          <Text style={[s.histFee, !done && { color: '#b0b0b0' }]}>
            {done ? `+${fmt(Number(item.shippingFee))}` : '—'}
          </Text>
          <View style={[s.histBadge, done ? s.histBadgeDone : s.histBadgeCancelled]}>
            <Text style={[s.histBadgeText, { color: done ? '#15803d' : '#c45c5c' }]}>
              {done ? 'Đã giao' : 'Đã huỷ'}
            </Text>
          </View>
        </View>
        <ChevronRight size={14} color="#d0d0d0" />
      </View>
    </Pressable>
  );
}

function EmptyState({ label, sub }: { label: string; sub?: string }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIconBox}><Inbox size={32} color="#b0b0b0" /></View>
      <Text style={s.emptyTitle}>{label}</Text>
      {sub && <Text style={s.emptyDesc}>{sub}</Text>}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orders, loading, fetchOrders } = useOrders();

  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [myLat, setMyLat] = useState<number | null>(null);
  const [myLng, setMyLng] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryOrder[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<NewDeliveryOrderPayload[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const activeOrders = orders.filter(
    (o) => ACTIVE_STATUSES.includes(o.status) && isInRange(o.createdAt, dateRange),
  );
  const filteredHistory = history.filter((h) => isInRange(h.updatedAt, dateRange));

  // ── Data fetchers ──────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const { data } = await shipperApi.getOrderHistory();
      setHistory(data as HistoryOrder[]);
    } catch { /* ignore */ } finally { setHistLoading(false); }
  }, []);

  const fetchAvailable = useCallback(async () => {
    try {
      const { data } = await shipperApi.getAvailableOrders();
      setAvailableOrders(data as NewDeliveryOrderPayload[]);
    } catch { /* ignore */ }
  }, []);

  // ── Socket listeners for available orders ─────────────────────────────────

  useEffect(() => {
    // New order arrives → add to list immediately so dismissing modal still shows it
    const newOrderHandler = (data: NewDeliveryOrderPayload) => {
      setAvailableOrders((prev) => {
        if (prev.some((o) => o.orderId === data.orderId)) return prev;
        return [data, ...prev];
      });
    };

    const takenHandler = ({ orderId }: { orderId: string }) =>
      setAvailableOrders((prev) => prev.filter((o) => o.orderId !== orderId));

    const statusHandler = (data: { orderId: string; status: string }) => {
      if (['delivering', 'completed', 'cancelled'].includes(data.status)) {
        setAvailableOrders((prev) => prev.filter((o) => o.orderId !== data.orderId));
      }
    };

    socketService.on<NewDeliveryOrderPayload>('order:new-delivery', newOrderHandler);
    socketService.on<{ orderId: string }>('order:delivery-taken', takenHandler);
    socketService.on<{ orderId: string; status: string }>('order:status', statusHandler);
    return () => {
      socketService.off('order:new-delivery', newOrderHandler as (...args: unknown[]) => void);
      socketService.off('order:delivery-taken', takenHandler as (...args: unknown[]) => void);
      socketService.off('order:status', statusHandler as (...args: unknown[]) => void);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Accept available order ─────────────────────────────────────────────────

  const handleAcceptOrder = useCallback(async (orderId: string) => {
    setAcceptingId(orderId);
    try {
      await shipperApi.acceptOrder(orderId);
      setAvailableOrders((prev) => prev.filter((o) => o.orderId !== orderId));
      void fetchOrders();
      setActiveTab('active');
    } catch (e: any) {
      const code = e?.response?.data?.code;
      if (code === 'ORDER_ALREADY_TAKEN') {
        Alert.alert('Không kịp', 'Shipper khác vừa nhận đơn này.');
        setAvailableOrders((prev) => prev.filter((o) => o.orderId !== orderId));
      } else {
        Alert.alert('Lỗi', 'Không thể nhận đơn. Thử lại sau.');
      }
    } finally { setAcceptingId(null); }
  }, [fetchOrders]);

  // ── On focus refresh ───────────────────────────────────────────────────────

  useEffect(() => {
    void locationService.getCurrentLocation().then((loc) => {
      if (loc) { setMyLat(loc.coords.latitude); setMyLng(loc.coords.longitude); }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchOrders();
      void fetchHistory();
      void fetchAvailable();
    }, [fetchOrders, fetchHistory, fetchAvailable]),
  );

  // ── Derived data ──────────────────────────────────────────────────────────

  const ordersWithDist = activeOrders
    .map((o) => {
      const distM =
        myLat != null && myLng != null && o.address?.lat != null && o.address?.lng != null
          ? haversineMeters(myLat, myLng, o.address.lat, o.address.lng)
          : undefined;
      return { order: o, distM };
    })
    .sort((a, b) => {
      const pa = STATUS_PRIORITY[a.order.status] ?? 9;
      const pb = STATUS_PRIORITY[b.order.status] ?? 9;
      if (pa !== pb) return pa - pb;
      if (a.distM !== undefined && b.distM !== undefined) return a.distM - b.distM;
      return 0;
    });

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'available', label: 'Free pick',  count: availableOrders.length },
    { key: 'active',    label: 'Đang xử lý', count: activeOrders.length },
    { key: 'history',   label: 'Đã giao',    count: filteredHistory.filter((h) => h.status === 'completed').length },
  ];

  const isRefreshing = loading || histLoading;

  function handleRefresh() {
    void fetchOrders();
    void fetchHistory();
    void fetchAvailable();
  }

  // ── Render tab content ────────────────────────────────────────────────────

  function renderAvailable() {
    if (!availableOrders.length) {
      return <EmptyState label="Không có đơn chờ nhận" sub="Đơn mới sẽ hiện tại đây" />;
    }
    return availableOrders.map((o) => {
      const distM =
        myLat != null && myLng != null && o.lat != null && o.lng != null
          ? haversineMeters(myLat, myLng, o.lat, o.lng)
          : undefined;
      return (
        <AvailableOrderCard
          key={o.orderId}
          order={o}
          onAccept={handleAcceptOrder}
          accepting={acceptingId === o.orderId}
          distM={distM}
        />
      );
    });
  }

  function renderActive() {
    if (loading && !activeOrders.length) {
      return (
        <View style={s.center}>
          <ActivityIndicator color={PRIMARY} size="large" />
          <Text style={s.loadingTxt}>Đang tải đơn hàng…</Text>
        </View>
      );
    }
    if (!ordersWithDist.length) {
      return <EmptyState label="Không có đơn đang xử lý" sub="Kéo xuống để làm mới" />;
    }
    return ordersWithDist.map((item) => (
      <OrderCard
        key={item.order.id}
        order={item.order}
        distM={item.distM}
        onPress={() => router.push(`/(shipper)/delivery/${item.order.id}`)}
      />
    ));
  }

  function renderHistory() {
    if (histLoading && !history.length) {
      return (
        <View style={s.center}>
          <ActivityIndicator color={PRIMARY} size="large" />
          <Text style={s.loadingTxt}>Đang tải lịch sử…</Text>
        </View>
      );
    }
    if (!filteredHistory.length) {
      return <EmptyState label={history.length ? 'Không có đơn trong khoảng này' : 'Chưa có lịch sử giao hàng'} />;
    }
    return filteredHistory.map((item) => (
      <HistoryCard
        key={item.id}
        item={item}
        onPress={() => router.push(`/(shipper)/history/${item.id}`)}
      />
    ));
  }

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Text style={s.eyebrow}>SHIPPER PORTAL</Text>
        <Text style={s.headerTitle}>Đơn hàng</Text>
      </View>

      {/* ── Tab bar ── */}
      <View style={s.tabBar}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[s.tab, active && s.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.label}</Text>
              {tab.count > 0 && (
                <View style={[s.tabBadge, active && s.tabBadgeActive]}>
                  <Text style={[s.tabBadgeText, active && s.tabBadgeTextActive]}>
                    {tab.count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* ── Date filter — hidden on available tab ── */}
      {activeTab !== 'available' && (
        <DateFilter value={dateRange} onChange={setDateRange} />
      )}

      {/* ── Tab content ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={PRIMARY}
            colors={[PRIMARY]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'available' && renderAvailable()}
        {activeTab === 'active' && renderActive()}
        {activeTab === 'history' && renderHistory()}
      </ScrollView>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f7' },

  header: { backgroundColor: PRIMARY, paddingHorizontal: 20, paddingBottom: 16, gap: 2 },
  eyebrow: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },

  // Tab bar
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(26,26,26,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    gap: 8,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  tabActive: { backgroundColor: PRIMARY },
  tabLabel: { fontSize: 12, fontWeight: '700', color: '#717171' },
  tabLabelActive: { color: '#fff' },
  tabBadge: { backgroundColor: 'rgba(26,26,26,0.12)', borderRadius: 100, minWidth: 18, paddingHorizontal: 5, paddingVertical: 1, alignItems: 'center' },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeText: { fontSize: 10, fontWeight: '800', color: '#717171' },
  tabBadgeTextActive: { color: '#fff' },

  // Scroll content
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  center: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  loadingTxt: { fontSize: 14, color: '#717171' },

  empty: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  emptyIconBox: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  emptyDesc: { fontSize: 13, color: '#717171' },

  // Order card
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.06)', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardActionable: { borderColor: '#99d6b3', borderWidth: 1.5, shadowColor: PRIMARY, shadowOpacity: 0.08 },
  cardPressed: { opacity: 0.93 },
  cardRow1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  orderId: { fontSize: 12, fontWeight: '700', color: '#717171', letterSpacing: 0.6 },
  timeLabel: { fontSize: 12, color: '#b0b0b0' },
  distPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#f0fdf4', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100 },
  distText: { fontSize: 11, fontWeight: '600', color: '#0f766e' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  address: { fontSize: 14, color: '#1a1a1a', lineHeight: 20, fontWeight: '500' },
  cardRow2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  customerCol: { flex: 1, gap: 2 },
  customerName: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  phoneChip: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' },
  customerPhone: { fontSize: 12, color: '#0369a1', fontWeight: '500' },
  amountCol: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 16, fontWeight: '700', color: PRIMARY },
  itemsPill: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  itemsText: { fontSize: 11, fontWeight: '600', color: '#0f766e' },
  actionStrip: {
    backgroundColor: '#f0fdf4', marginHorizontal: -16, marginBottom: -16,
    paddingVertical: 10, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, alignItems: 'center',
  },
  actionStripInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionStripText: { fontSize: 12, fontWeight: '700', color: '#0f766e', letterSpacing: 0.2 },

  // Available order card
  availCard: {
    backgroundColor: '#fff7ed', borderRadius: 18, padding: 14, gap: 8,
    borderWidth: 1.5, borderColor: '#fed7aa',
    shadowColor: '#ea580c', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  availHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  availBadge: { backgroundColor: '#fed7aa', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  availBadgeText: { fontSize: 9, fontWeight: '800', color: '#c2410c', letterSpacing: 0.8 },
  availCode: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  availMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  availDistPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(194,65,12,0.1)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100 },
  availDistText: { fontSize: 11, fontWeight: '600', color: '#c2410c' },
  availFee: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  availAddress: { fontSize: 14, fontWeight: '500', color: '#1a1a1a', lineHeight: 20 },
  availRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  availCustomer: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  availItems: { fontSize: 11, color: '#717171', marginTop: 2 },
  acceptBtn: {
    backgroundColor: PRIMARY, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 10,
    minWidth: 90, alignItems: 'center', justifyContent: 'center',
  },
  acceptBtnDisabled: { opacity: 0.5 },
  acceptBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // History card
  histCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: 'rgba(26,26,26,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  histCardCancelled: { opacity: 0.6 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  histIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  histInfo: { flex: 1, gap: 3 },
  histAddress: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  histDate: { fontSize: 11, color: '#b0b0b0' },
  histRight: { alignItems: 'flex-end', gap: 4 },
  histFee: { fontSize: 15, fontWeight: '700', color: PRIMARY },
  histBadge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  histBadgeDone: { backgroundColor: '#f0fdf4' },
  histBadgeCancelled: { backgroundColor: '#fff5f5' },
  histBadgeText: { fontSize: 10, fontWeight: '700' },
});
