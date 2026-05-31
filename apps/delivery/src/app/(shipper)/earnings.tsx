import { useCallback, useState } from 'react';
import { Inbox } from '@/components/icons';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { shipperApi } from '@/services/api.service';
import { DateFilter, isInRange } from '@/components/date-filter';
import type { DateRange } from '@/components/date-filter';

type HistoryOrder = {
  id: string;
  status: string;
  shippingFee: number;
  createdAt: string;
  updatedAt: string;
};

function fmt(n: number) { return Number(n).toLocaleString('vi-VN') + 'đ'; }

function monthLabel(iso: string) {
  const d = new Date(iso);
  return `T${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await shipperApi.getOrderHistory();
      setHistory(data as HistoryOrder[]);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void fetchHistory();
  }, [fetchHistory]));

  // Apply date filter (by completedAt / updatedAt)
  const filtered = history.filter((o) => isInRange(o.updatedAt, dateRange));
  const completed = filtered.filter((o) => o.status === 'completed');
  const cancelled = filtered.filter((o) => o.status === 'cancelled');
  const totalEarnings = completed.reduce((s, o) => s + Number(o.shippingFee), 0);

  // Group completed earnings by month within filtered range
  const byMonth: Record<string, number> = {};
  for (const o of completed) {
    const m = monthLabel(o.updatedAt);
    byMonth[m] = (byMonth[m] ?? 0) + Number(o.shippingFee);
  }
  const monthEntries = Object.entries(byMonth).slice(0, 12);

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Text style={s.eyebrow}>THU NHẬP</Text>
        <Text style={s.headerTitle}>Thu nhập của tôi</Text>
      </View>

      <DateFilter value={dateRange} onChange={setDateRange} />

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchHistory} tintColor="#1a3c34" colors={['#1a3c34']} />
        }
      >
        {/* Total earnings card */}
        <View style={s.earningsCard}>
          <Text style={s.cardLabel}>
            {dateRange ? 'THU NHẬP TRONG KỲ' : 'TỔNG THU NHẬP'}
          </Text>
          {loading ? (
            <ActivityIndicator color="#99d6b3" size="large" style={{ marginVertical: 12 }} />
          ) : (
            <Text style={s.earningsAmount}>{fmt(totalEarnings)}</Text>
          )}
          <Text style={s.earningsSub}>
            {dateRange ? 'Phí ship trong khoảng đã chọn' : 'Tổng phí ship nhận được'}
          </Text>

          <View style={s.statRow}>
            <View style={s.statItem}>
              <Text style={s.statNum}>{completed.length}</Text>
              <Text style={s.statLabel}>Đã giao</Text>
            </View>
            <View style={s.statSep} />
            <View style={s.statItem}>
              <Text style={[s.statNum, { color: '#f87171' }]}>{cancelled.length}</Text>
              <Text style={s.statLabel}>Đã huỷ</Text>
            </View>
            <View style={s.statSep} />
            <View style={s.statItem}>
              <Text style={s.statNum}>{filtered.length}</Text>
              <Text style={s.statLabel}>Tổng đơn</Text>
            </View>
          </View>
        </View>

        {/* Monthly/period breakdown */}
        {monthEntries.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>
              {dateRange ? 'THEO THÁNG (ĐÃ LỌC)' : 'THEO THÁNG'}
            </Text>
            <View style={s.monthCard}>
              {monthEntries.map(([month, amount], i) => (
                <View key={month}>
                  <View style={s.monthRow}>
                    <Text style={s.monthName}>{month}</Text>
                    <Text style={s.monthAmount}>{fmt(amount)}</Text>
                  </View>
                  {i < monthEntries.length - 1 && <View style={s.divider} />}
                </View>
              ))}
            </View>
          </View>
        )}

        {!loading && filtered.length === 0 && (
          <View style={s.emptyBox}>
            <View style={s.emptyIconBox}><Inbox size={40} color="#b0b0b0" /></View>
            <Text style={s.emptyTitle}>
              {history.length > 0 ? 'Không có dữ liệu trong khoảng này' : 'Chưa có dữ liệu'}
            </Text>
            <Text style={s.emptyDesc}>
              {history.length > 0 ? 'Thử chọn khoảng thời gian khác' : 'Hoàn thành đơn đầu tiên để xem thu nhập'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f7' },

  header: { backgroundColor: '#1a3c34', paddingHorizontal: 20, paddingBottom: 16, gap: 2 },
  eyebrow: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },

  content: { padding: 16, gap: 16, paddingBottom: 40 },

  earningsCard: {
    backgroundColor: '#1a3c34', borderRadius: 24, padding: 20, gap: 4,
    shadowColor: '#1a3c34', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  cardLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, textTransform: 'uppercase' },
  earningsAmount: { fontSize: 36, fontWeight: '800', color: '#99d6b3', letterSpacing: -0.5, marginTop: 4 },
  earningsSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 12 },

  statRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 12, marginTop: 4 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  statSep: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)', alignSelf: 'stretch', marginVertical: 2 },

  section: { gap: 10 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#b0b0b0', letterSpacing: 1.5, textTransform: 'uppercase', paddingHorizontal: 4 },
  monthCard: {
    backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(26,26,26,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  monthName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  monthAmount: { fontSize: 15, fontWeight: '700', color: '#1a3c34' },
  divider: { height: 1, backgroundColor: 'rgba(26,26,26,0.05)', marginHorizontal: 16 },

  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  emptyDesc: { fontSize: 13, color: '#b0b0b0', textAlign: 'center' },
});
