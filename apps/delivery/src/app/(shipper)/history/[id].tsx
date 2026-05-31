import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  ChevronLeft, MapPin, User, FileText, Coffee,
  CreditCard, CheckCircle, XCircle, Wallet, Phone, Clock,
} from '@/components/icons';
import { shipperApi } from '@/services/api.service';
import type { Order } from '@/store/orders.store';

const PRIMARY = '#1a3c34';
const DANGER = '#c45c5c';

function fmt(n: number) { return Number(n).toLocaleString('vi-VN') + 'đ'; }

function fmtDatetime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
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

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function load() {
    if (!id) return;
    setLoading(true);
    void shipperApi
      .getOrder(id)
      .then(({ data }) => { setOrder(data as Order); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useFocusEffect(useCallback(load, [id])); // eslint-disable-line react-hooks/exhaustive-deps

  const isDone = order?.status === 'completed';
  const isCash = order?.paymentType === 'cash';
  const isPaid = order?.paymentStatus === 'paid';
  const name = order?.user?.name ?? order?.guestDeliveryName ?? 'Khách';
  const phone = order?.user?.phone ?? order?.guestDeliveryPhone ?? '—';
  const displayId = order?.paymentCode
    ? `#${order.paymentCode}`
    : order ? `#${order.id.slice(-6).toUpperCase()}` : '—';

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* Top bar */}
      <View style={s.topBar}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={22} color="#fff" />
        </Pressable>
        <View style={s.topCenter}>
          <Text style={s.topEye}>CHI TIẾT ĐƠN HÀNG</Text>
          <Text style={s.topId}>{displayId}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.centerWrap}>
          <ActivityIndicator color={PRIMARY} size="large" />
          <Text style={s.centerTxt}>Đang tải…</Text>
        </View>
      ) : error || !order ? (
        <View style={s.centerWrap}>
          <Text style={s.errorTxt}>Không thể tải đơn hàng</Text>
          <Pressable style={s.retryBtn} onPress={load}>
            <Text style={s.retryTxt}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >

          {/* Status banner */}
          <View style={[s.statusBanner, isDone ? s.bannerDone : s.bannerCancelled]}>
            <View style={s.statusBannerIcon}>
              {isDone
                ? <CheckCircle size={28} color="#15803d" />
                : <XCircle size={28} color={DANGER} />
              }
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[s.statusBannerTitle, { color: isDone ? '#15803d' : DANGER }]}>
                {isDone ? 'Giao hàng thành công' : 'Đơn hàng đã huỷ'}
              </Text>
              <View style={s.tsRow}>
                <Clock size={12} color="#717171" />
                <Text style={s.tsLabel}>Đặt lúc</Text>
                <Text style={s.tsValue}>{fmtDatetime(order.createdAt)}</Text>
              </View>
              {isDone && order.completedAt && (
                <View style={s.tsRow}>
                  <CheckCircle size={12} color="#15803d" />
                  <Text style={[s.tsLabel, { color: '#15803d' }]}>Giao lúc</Text>
                  <Text style={[s.tsValue, { color: '#15803d', fontWeight: '700' }]}>
                    {fmtDatetime(order.completedAt)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Earnings summary — only for completed */}
          {isDone && (
            <View style={s.earningsCard}>
              <Text style={s.earningsEye}>THU NHẬP ĐƠN NÀY</Text>
              <View style={s.earningsRow}>
                <View style={s.earningsItem}>
                  <Text style={s.earningsNum}>{fmt(Number(order.shippingFee))}</Text>
                  <Text style={s.earningsSub}>Phí ship</Text>
                </View>
                <View style={s.earningsSep} />
                <View style={s.earningsItem}>
                  <Text style={[s.earningsNum, { color: 'rgba(255,255,255,0.65)' }]}>
                    {fmt(Number(order.finalAmount))}
                  </Text>
                  <Text style={s.earningsSub}>Tổng đơn</Text>
                </View>
              </View>
            </View>
          )}

          {/* Payment */}
          <View style={[s.card, isCash && !isPaid ? s.cardCash : isPaid ? s.cardPaid : {}]}>
            <Text style={s.cardLabel}>THANH TOÁN</Text>
            <View style={s.payRow}>
              <View style={s.payTypeRow}>
                <CreditCard size={16} color={PRIMARY} />
                <Text style={s.payTypeText}>{isCash ? 'Tiền mặt' : 'Chuyển khoản'}</Text>
              </View>
              <View style={[
                s.payBadge,
                isPaid ? s.payBadgePaid : isCash ? s.payBadgeCash : s.payBadgePending,
              ]}>
                <Text style={[s.payBadgeTxt, { color: isPaid ? '#15803d' : isCash ? '#c2410c' : '#717171' }]}>
                  {isPaid ? 'Đã thanh toán' : isCash ? 'Thu tiền mặt' : 'Chờ xác nhận'}
                </Text>
              </View>
            </View>
            <Text style={s.payAmount}>{fmt(Number(order.finalAmount))}</Text>
          </View>

          {/* Address */}
          <View style={s.card}>
            <Text style={s.cardLabel}>ĐỊA CHỈ GIAO</Text>
            <View style={s.addrRow}>
              <MapPin size={16} color={PRIMARY} />
              <Text style={s.addrText}>{order.address?.fullAddress ?? '—'}</Text>
            </View>
            {order.address?.note ? (
              <View style={s.noteBox}>
                <FileText size={13} color="#92400e" />
                <Text style={s.noteText}>{order.address.note}</Text>
              </View>
            ) : null}
          </View>

          {/* Customer */}
          <View style={s.card}>
            <Text style={s.cardLabel}>KHÁCH HÀNG</Text>
            <View style={s.customerRow}>
              <View style={s.customerAvatar}>
                <User size={20} color="#717171" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.customerName}>{name}</Text>
                {phone !== '—' ? (
                  <Pressable
                    style={s.phoneChip}
                    onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)}
                    hitSlop={6}
                  >
                    <Phone size={13} color="#0369a1" />
                    <Text style={s.customerPhone}>{phone}</Text>
                  </Pressable>
                ) : (
                  <Text style={s.customerPhone}>{phone}</Text>
                )}
              </View>
              <View style={s.shippingFeeBox}>
                <Text style={s.shippingFeeLabel}>Phí ship</Text>
                <View style={s.shippingFeePill}>
                  <Wallet size={12} color={PRIMARY} />
                  <Text style={s.shippingFeeAmt}>{fmt(Number(order.shippingFee))}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Items */}
          {order.items.length > 0 && (
            <View style={s.card}>
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
                          <Coffee size={20} color="#0f766e" />
                        </View>
                      )}
                      <View style={s.itemBody}>
                        <View style={s.itemHeader}>
                          <View style={s.qtyBadge}>
                            <Text style={s.qtyText}>×{item.quantity}</Text>
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
                <Text style={s.totalValue}>{fmt(Number(order.finalAmount))}</Text>
              </View>
            </View>
          )}

        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f7' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: PRIMARY, gap: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topCenter: { flex: 1, alignItems: 'center', gap: 2 },
  topEye: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, textTransform: 'uppercase' },
  topId: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerTxt: { fontSize: 14, color: '#717171' },
  errorTxt: { fontSize: 15, fontWeight: '600', color: '#717171' },
  retryBtn: { backgroundColor: PRIMARY, borderRadius: 100, paddingHorizontal: 20, paddingVertical: 10 },
  retryTxt: { fontSize: 14, fontWeight: '600', color: '#fff' },

  content: { padding: 12, gap: 10 },

  statusBanner: { borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  bannerDone: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  bannerCancelled: { backgroundColor: '#fff5f5', borderColor: '#fecaca' },
  statusBannerIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  statusBannerTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  tsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tsLabel: { fontSize: 11, color: '#717171', fontWeight: '500' },
  tsValue: { fontSize: 11, color: '#717171', flex: 1 },

  earningsCard: {
    backgroundColor: PRIMARY, borderRadius: 20, padding: 16,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4,
    gap: 4,
  },
  earningsEye: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, textTransform: 'uppercase' },
  earningsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  earningsItem: { flex: 1, alignItems: 'center', gap: 4 },
  earningsNum: { fontSize: 22, fontWeight: '800', color: '#99d6b3' },
  earningsSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  earningsSep: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.12)' },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 10,
    borderWidth: 1, borderColor: 'rgba(26,26,26,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardCash: { borderColor: '#fed7aa', backgroundColor: '#fff7ed' },
  cardPaid: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#b0b0b0', letterSpacing: 1.5, textTransform: 'uppercase' },

  payRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  payTypeText: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  payBadge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  payBadgePaid: { backgroundColor: '#dcfce7' },
  payBadgeCash: { backgroundColor: '#fed7aa' },
  payBadgePending: { backgroundColor: '#f3f4f6' },
  payBadgeTxt: { fontSize: 12, fontWeight: '700' },
  payAmount: { fontSize: 22, fontWeight: '800', color: PRIMARY },

  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  addrText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#1a1a1a', lineHeight: 20 },
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#fffbeb', borderRadius: 10, padding: 10, borderLeftWidth: 3, borderLeftColor: '#c9a227' },
  noteText: { flex: 1, fontSize: 13, color: '#92400e' },

  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  customerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  customerName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  phoneChip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  customerPhone: { fontSize: 13, color: '#0369a1', fontWeight: '500' },
  shippingFeeBox: { alignItems: 'flex-end', gap: 4 },
  shippingFeeLabel: { fontSize: 10, color: '#b0b0b0', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  shippingFeePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(26,60,52,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  shippingFeeAmt: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  itemsList: { gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemImg: { width: 52, height: 52, borderRadius: 12 },
  itemPlaceholder: { backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center' },
  itemBody: { flex: 1, gap: 4, paddingTop: 2 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBadge: { backgroundColor: '#e8f5e9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  qtyText: { fontSize: 11, fontWeight: '700', color: '#0f766e' },
  itemName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  itemMeta: { fontSize: 11, color: '#717171', lineHeight: 16 },
  itemPrice: { fontSize: 13, fontWeight: '700', color: PRIMARY, paddingTop: 2, minWidth: 60, textAlign: 'right' },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(26,26,26,0.06)' },
  totalLabel: { fontSize: 13, fontWeight: '600', color: '#717171' },
  totalValue: { fontSize: 17, fontWeight: '800', color: PRIMARY },
});
