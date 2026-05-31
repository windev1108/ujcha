import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronUp, ChevronDown } from '@/components/icons';

const PRIMARY = '#1a3c34';
const MINT = '#99d6b3';

// ── Types & helpers ───────────────────────────────────────────────────────────

export type DatePreset = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface DateRange {
  preset: DatePreset;
  from: Date;
  to: Date;
}

const MAX_RANGE_MS = 365 * 24 * 60 * 60 * 1000;

function sod(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function eod(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}
function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function getPresetRange(preset: Exclude<DatePreset, 'custom'>): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { preset, from: sod(now), to: eod(now) };
    case 'week': {
      const dow = now.getDay();
      const mon = new Date(now);
      mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
      return { preset, from: sod(mon), to: eod(now) };
    }
    case 'month':
      return { preset, from: new Date(now.getFullYear(), now.getMonth(), 1), to: eod(now) };
    case 'year':
      return { preset, from: new Date(now.getFullYear(), 0, 1), to: eod(now) };
  }
}

export function isInRange(iso: string, range: DateRange | null): boolean {
  if (!range) return true;
  const d = new Date(iso);
  return d >= range.from && d <= range.to;
}

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'week',  label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
  { key: 'year',  label: 'Năm này' },
  { key: 'custom', label: 'Tùy chọn' },
];

// ── Spinner (day / month / year drum) ─────────────────────────────────────────

function Spinner({
  value, min, max, label, wide, onChange,
}: {
  value: number; min: number; max: number; label: string; wide?: boolean;
  onChange: (v: number) => void;
}) {
  const inc = () => onChange(value < max ? value + 1 : min);
  const dec = () => onChange(value > min ? value - 1 : max);
  const display = wide
    ? String(value)
    : String(value).padStart(2, '0');

  return (
    <View style={[sp.wrap, wide && { flex: 1.4 }]}>
      <Text style={sp.label}>{label}</Text>
      <Pressable style={sp.btn} onPress={inc} hitSlop={6}>
        <ChevronUp size={16} color={PRIMARY} />
      </Pressable>
      <View style={sp.valBox}>
        <Text style={sp.val}>{display}</Text>
      </View>
      <Pressable style={sp.btn} onPress={dec} hitSlop={6}>
        <ChevronDown size={16} color={PRIMARY} />
      </Pressable>
    </View>
  );
}

const sp = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 4 },
  label: {
    fontSize: 9, fontWeight: '700', color: '#b0b0b0',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2,
  },
  btn: {
    width: 38, height: 34, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, backgroundColor: 'rgba(26,60,52,0.06)',
  },
  valBox: {
    width: '90%', height: 44, borderRadius: 12,
    borderWidth: 1.5, borderColor: MINT,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f0fdf4',
  },
  val: { fontSize: 18, fontWeight: '800', color: PRIMARY },
});

// ── DateFilter ────────────────────────────────────────────────────────────────

interface Props {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
  style?: object;
}

export function DateFilter({ value, onChange, style }: Props) {
  const now = new Date();
  const [open, setOpen] = useState(false);

  const [fromDay,   setFromDay]   = useState(1);
  const [fromMonth, setFromMonth] = useState(now.getMonth() + 1);
  const [fromYear,  setFromYear]  = useState(now.getFullYear());
  const [toDay,     setToDay]     = useState(now.getDate());
  const [toMonth,   setToMonth]   = useState(now.getMonth() + 1);
  const [toYear,    setToYear]    = useState(now.getFullYear());

  function openPicker() {
    if (value?.preset === 'custom') {
      setFromDay(value.from.getDate());
      setFromMonth(value.from.getMonth() + 1);
      setFromYear(value.from.getFullYear());
      setToDay(value.to.getDate());
      setToMonth(value.to.getMonth() + 1);
      setToYear(value.to.getFullYear());
    } else {
      setFromDay(1);
      setFromMonth(now.getMonth() + 1);
      setFromYear(now.getFullYear());
      setToDay(now.getDate());
      setToMonth(now.getMonth() + 1);
      setToYear(now.getFullYear());
    }
    setOpen(true);
  }

  function apply() {
    const fd = Math.min(fromDay, daysInMonth(fromMonth, fromYear));
    const td = Math.min(toDay, daysInMonth(toMonth, toYear));
    const from = sod(new Date(fromYear, fromMonth - 1, fd));
    const to   = eod(new Date(toYear, toMonth - 1, td));

    if (to < from) {
      Alert.alert('Lỗi', '"Đến ngày" phải sau hoặc bằng "Từ ngày".');
      return;
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      Alert.alert('Giới hạn', 'Khoảng thời gian tối đa là 1 năm.');
      return;
    }
    onChange({ preset: 'custom', from, to });
    setOpen(false);
  }

  function select(preset: DatePreset) {
    if (preset === 'custom') { openPicker(); return; }
    onChange(getPresetRange(preset));
  }

  const active = value?.preset ?? null;

  return (
    <>
      <View style={[df.container, style]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={df.row}
        >
          {value && (
            <Pressable style={df.clearBtn} onPress={() => onChange(null)} hitSlop={8}>
              <Text style={df.clearTxt}>✕</Text>
            </Pressable>
          )}
          {PRESETS.map((p) => {
            const on = active === p.key;
            return (
              <Pressable
                key={p.key}
                style={[df.pill, on && df.pillOn]}
                onPress={() => select(p.key)}
              >
                <Text style={[df.pillTxt, on && df.pillTxtOn]}>{p.label}</Text>
                {p.key === 'custom' && value?.preset === 'custom' && (
                  <Text style={df.customRange}>
                    {'  '}{fmtDate(value.from)} – {fmtDate(value.to)}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Modal visible={open} transparent animationType="slide" statusBarTranslucent>
        <Pressable style={df.overlay} onPress={() => setOpen(false)} />
        <View style={df.sheet}>
          <View style={df.handle} />
          <Text style={df.sheetTitle}>Chọn khoảng thời gian</Text>
          <Text style={df.sheetSub}>Tối đa 1 năm</Text>

          {/* From date */}
          <View style={df.pickerSection}>
            <Text style={df.pickerLabel}>Từ ngày</Text>
            <View style={df.spinnerRow}>
              <Spinner value={fromDay}   min={1} max={daysInMonth(fromMonth, fromYear)} label="Ngày"  onChange={setFromDay} />
              <Spinner value={fromMonth} min={1} max={12}                                label="Tháng" onChange={setFromMonth} />
              <Spinner value={fromYear}  min={now.getFullYear() - 5} max={now.getFullYear()} label="Năm" wide onChange={setFromYear} />
            </View>
          </View>

          <View style={df.sectionDivider} />

          {/* To date */}
          <View style={df.pickerSection}>
            <Text style={df.pickerLabel}>Đến ngày</Text>
            <View style={df.spinnerRow}>
              <Spinner value={toDay}   min={1} max={daysInMonth(toMonth, toYear)} label="Ngày"  onChange={setToDay} />
              <Spinner value={toMonth} min={1} max={12}                            label="Tháng" onChange={setToMonth} />
              <Spinner value={toYear}  min={now.getFullYear() - 5} max={now.getFullYear()} label="Năm" wide onChange={setToYear} />
            </View>
          </View>

          <View style={df.actions}>
            <Pressable style={df.cancelBtn} onPress={() => setOpen(false)}>
              <Text style={df.cancelTxt}>Huỷ</Text>
            </Pressable>
            <Pressable style={df.applyBtn} onPress={apply}>
              <Text style={df.applyTxt}>Áp dụng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const df = StyleSheet.create({
  container: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(26,26,26,0.06)' },
  row: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, gap: 8, alignItems: 'center' },

  clearBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(26,26,26,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  clearTxt: { fontSize: 11, color: '#717171', fontWeight: '700' },

  pill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f3f4f6', borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  pillOn:    { backgroundColor: PRIMARY },
  pillTxt:   { fontSize: 12, fontWeight: '600', color: '#717171' },
  pillTxtOn: { color: '#fff' },
  customRange: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 36,
    gap: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  sheetSub: { fontSize: 12, color: '#b0b0b0', textAlign: 'center', marginTop: -12 },

  pickerSection: { gap: 10 },
  pickerLabel: { fontSize: 11, fontWeight: '700', color: '#717171', textTransform: 'uppercase', letterSpacing: 1 },
  spinnerRow: { flexDirection: 'row', gap: 10 },

  sectionDivider: { height: 1, backgroundColor: 'rgba(26,26,26,0.06)' },

  actions: { flexDirection: 'row', gap: 12, paddingTop: 4 },
  cancelBtn: {
    flex: 1, height: 50, borderRadius: 100,
    borderWidth: 1.5, borderColor: 'rgba(26,26,26,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelTxt: { fontSize: 15, fontWeight: '600', color: '#717171' },
  applyBtn: {
    flex: 2, height: 50, borderRadius: 100,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
  },
  applyTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
