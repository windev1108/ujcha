import { useEffect, useState, useCallback } from 'react'
import {
  ArrowLeft, RefreshCw, Clock, CheckCircle2, XCircle,
  ShoppingBag, MapPin, Phone, User, Loader2, ChevronRight,
  TrendingUp, X, ChevronDown, ChevronUp, PackageCheck,
  Printer, Tag, AlertCircle, Receipt,
} from 'lucide-react'
import { fetchExternalOrders, updateOrderStatus } from '../api'
import type { AdminOrder, OrderStatus, QuickDate } from '../types/common'
import { fmt, formatDate } from '@/lib/utils'
import { OrderDetailModal } from './OrderDetailModal'
import shopeeFoodLogo from '../assets/shopee-food.png'
import grabFoodLogo from '../assets/grab-food.png'
import type { BillConfig, LabelConfig } from '../../../preload'
import type { GrabFull } from '@/lib/grab-print'
import { GRAB_STATUS_COLOR, GRAB_STATUS_DOT, GRAB_STATUS_LABEL, QUICK_DATES, STATUS_COLOR, STATUS_DOT, STATUS_LABEL } from '@/lib/constants'
import GrabOrderDetailModal from './GrabOrderDetailModal'

// ─── Vietnam timezone helpers ─────────────────────────────────────────────────

function vnDateStr(offsetDays = 0): string {
  const ms = Date.now() + 7 * 60 * 60 * 1000 - offsetDays * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

// ─── electronAPI bridge ───────────────────────────────────────────────────────

type GrabDailyEntry = {
  ID: string
  deliveryStatus: string
  createdAt: string
  bookingCode: string
  displayID: string
  orderEarningsInMinorUnit: number
  [key: string]: unknown
}

type GrabPreparingOrder = {
  orderID: string
  displayID: string
  state: string
  orderValue: string
  eater: { ID: number; name: string }
  itemInfo: { count: number; items: Array<{ itemID?: string; name: string; quantity: number; comment?: string }> }
  times: { createdAt: string; estimatedPickUpTime?: string, readyAt?: string | null }
  preparationTaskID?: string
  labels?: { isRead: boolean; acceptedViaAA?: boolean }
  [key: string]: unknown
}


type SpfPartnerTransaction = {
  status: number
  amount: string
  create_time: string
  order_code: string
  order_id: number
  type: number
  transaction_id: string
}

function grabAPI() {
  return (window as unknown as {
    electronAPI: {
      grab: {
        listOrders(startDate?: string, endDate?: string, pageIndex?: number): Promise<{
          ok: boolean; orders: GrabDailyEntry[]
          hasMore: boolean; pageIndex: number; error?: string
        }>
        listPreparingOrders(): Promise<{ ok: boolean; orders: GrabPreparingOrder[]; merchantID?: string; error?: string }>
        listLiveOrders(pageType: string): Promise<{ ok: boolean; orders: GrabPreparingOrder[]; merchantID?: string; error?: string }>
        getOrder(id: string): Promise<{ ok: boolean; order?: GrabFull; error?: string }>
        syncRevenue(date?: string): Promise<{ ok: boolean; data?: unknown; error?: string }>
        markOrderReady(orderID: string, preparationTaskID?: string): Promise<{ ok: boolean; error?: string }>
      }
      spfPartner: {
        getStatus(): Promise<{ connected: boolean; restaurantId: string | null; restaurantName: string | null }>
        getTransactions(restaurantId: string, fromDate: string, toDate: string): Promise<{
          ok: boolean
          data?: { total_amount: { value: number; text: string; unit: string }; transactions: SpfPartnerTransaction[] }
          error?: string
        }>
      }
      printer: {
        printBillByAddress(address: string, printerName: string, html: string, copies: number, cfg?: BillConfig): Promise<{ ok: boolean; error?: string }>
        printLabelsByAddress(address: string, printerName: string, labels: string[], cfg?: LabelConfig): Promise<{ ok: boolean; error?: string }>
      }
    }
  }).electronAPI
}

// ─── Helpers ─────────────────────────────────────────────────────────────────


function parsePlatform(raw: string | null): { platform: string; customerName: string } {
  if (!raw) return { platform: 'EXTERNAL', customerName: '' }
  const m = raw.match(/^\[([^\]]+)\]\s*(.*)$/)
  if (m) return { platform: m[1].toUpperCase(), customerName: m[2].trim() }
  return { platform: 'EXTERNAL', customerName: raw }
}

const PLATFORM_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  GRABFOOD: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  SHOPEEFOOD: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  BAEMIN: { bg: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-500' },
  EXTERNAL: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
}

function platformStyle(p: string) {
  for (const [key, val] of Object.entries(PLATFORM_STYLE)) {
    if (p.includes(key)) return val
  }
  return PLATFORM_STYLE.EXTERNAL
}


function toISO(d: Date) { return d.toISOString().split('T')[0] }
function dateRange(key: QuickDate): { from?: string; to?: string } {
  const now = new Date()
  if (key === 'today') { const d = toISO(now); return { from: d, to: d } }
  if (key === 'week') {
    const day = now.getDay()
    const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { from: toISO(mon), to: toISO(sun) }
  }
  return {}
}

type PlatformFilter = 'all' | 'grabfood' | 'shopeefood' | 'other'
const PLATFORM_FILTERS: { key: PlatformFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'grabfood', label: 'GrabFood' },
  { key: 'shopeefood', label: 'ShopeeFood' },
  { key: 'other', label: 'Khác' },
]
function platformLogo(p: string): string | null {
  if (p.includes('GRAB')) return grabFoodLogo
  if (p.includes('SHOPEE')) return shopeeFoodLogo
  return null
}


// ─── Main component ───────────────────────────────────────────────────────────

export function ExternalOrdersModal({
  onClose,
  initialTab = 'all',
  grabConnected = false,
  shopeePartnerConnected = false,
}: {
  onClose: () => void
  initialTab?: PlatformFilter
  grabConnected?: boolean
  shopeePartnerConnected?: boolean
}) {
  // ── DB-based orders (all / shopeefood / other tabs) ────────────────────────
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [quickDate, setQuickDate] = useState<QuickDate>('today')
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  // ── GrabFood direct API state ──────────────────────────────────────────────
  const [grabOrders, setGrabOrders] = useState<GrabDailyEntry[]>([])
  const [grabLoading, setGrabLoading] = useState(false)
  const [grabLoadingMore, setGrabLoadingMore] = useState(false)
  const [grabError, setGrabError] = useState<string | null>(null)
  const [grabHasMore, setGrabHasMore] = useState(false)
  const [grabCurrentPage, setGrabCurrentPage] = useState(0)
  const [grabFrom, setGrabFrom] = useState(() => vnDateStr(0))
  const [grabTo, setGrabTo] = useState(() => vnDateStr(0))
  const [grabQuick, setGrabQuick] = useState<'today' | 'yesterday' | 'week' | 'custom'>('today')
  const [grabDetail, setGrabDetail] = useState<{ id: string; data: GrabFull | null; loading: boolean; preparationTaskID?: string } | null>(null)
  const [revenueSyncing, setRevenueSyncing] = useState(false)
  const [revenueResult, setRevenueResult] = useState<{ ok: boolean; msg: string } | null>(null)
  // ── GrabFood sub-tabs ──────────────────────────────────────────────────────
  type GrabSubTab = 'preparing' | 'ready' | 'upcoming' | 'history'
  const [grabSubTab, setGrabSubTab] = useState<GrabSubTab>('preparing')

  // Live orders from PreparingV2
  const [liveOrders, setLiveOrders] = useState<GrabPreparingOrder[]>([])
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)

  // Ready orders from Ready
  const [readyOrders, setReadyOrders] = useState<GrabPreparingOrder[]>([])
  const [readyLoading, setReadyLoading] = useState(false)
  const [readyError, setReadyError] = useState<string | null>(null)

  // Upcoming orders from UpcomingV2
  const [upcomingOrders, setUpcomingOrders] = useState<GrabPreparingOrder[]>([])
  const [upcomingLoading, setUpcomingLoading] = useState(false)
  const [upcomingError, setUpcomingError] = useState<string | null>(null)

  // Mark-ready state per orderID
  const [markingReadyIds, setMarkingReadyIds] = useState<Set<string>>(new Set())
  const [markReadyResults, setMarkReadyResults] = useState<Record<string, { ok: boolean; msg: string }>>({})

  // ── ShopeeFood Partner API state ───────────────────────────────────────────
  const [spfRestaurantId, setSpfRestaurantId] = useState<string | null>(null)
  const [spfRestaurantName, setSpfRestaurantName] = useState<string | null>(null)
  const [spfTransactions, setSpfTransactions] = useState<SpfPartnerTransaction[]>([])
  const [spfTotalAmount, setSpfTotalAmount] = useState(0)
  const [spfLoading, setSpfLoading] = useState(false)
  const [spfError, setSpfError] = useState<string | null>(null)
  const [spfFrom, setSpfFrom] = useState(() => vnDateStr(0))
  const [spfTo, setSpfTo] = useState(() => vnDateStr(0))
  const [spfQuick, setSpfQuick] = useState<'today' | 'yesterday' | 'week' | 'custom'>('today')

  const loadSpfTransactions = useCallback(async (from: string, to: string, rid?: string) => {
    const restaurantId = rid ?? spfRestaurantId
    if (!restaurantId) return
    setSpfLoading(true)
    setSpfError(null)
    try {
      const result = await grabAPI().spfPartner.getTransactions(restaurantId, from, to)
      if (result.ok && result.data) {
        const sorted = [...(result.data.transactions ?? [])].sort(
          (a, b) => new Date(b.create_time).getTime() - new Date(a.create_time).getTime()
        )
        setSpfTransactions(sorted)
        setSpfTotalAmount(result.data.total_amount?.value ?? 0)
      } else {
        setSpfError(result.error ?? 'Lỗi không xác định')
      }
    } catch (e) { setSpfError(String(e)) }
    finally { setSpfLoading(false) }
  }, [spfRestaurantId])

  // ── Platform filter ────────────────────────────────────────────────────────
  const visibleFilters = PLATFORM_FILTERS.filter(f => {
    if (f.key === 'grabfood') return grabConnected
    if (f.key === 'shopeefood') return shopeePartnerConnected
    return true
  })
  const safeInitialTab = visibleFilters.some(f => f.key === initialTab) ? initialTab : 'all'
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>(safeInitialTab)

  // ── Load DB orders ─────────────────────────────────────────────────────────
  const load = useCallback(async (key: QuickDate) => {
    setLoading(true)
    try {
      const { from, to } = dateRange(key)
      const data = await fetchExternalOrders(1, 200, from, to)
      setOrders((data as { items: AdminOrder[] }).items ?? [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (platformFilter !== 'grabfood') void load(quickDate)
  }, [quickDate, load, platformFilter])

  // ── Load ready orders (PageType=Ready) ────────────────────────────────────
  const loadReadyOrders = useCallback(async () => {
    setReadyLoading(true)
    setReadyError(null)
    try {
      const result = await grabAPI().grab.listLiveOrders('Ready')
      if (result.ok) setReadyOrders(result.orders)
      else setReadyError(result.error ?? 'Lỗi không xác định')
    } catch (e) { setReadyError(String(e)) }
    finally { setReadyLoading(false) }
  }, [])

  // ── Load live/preparing orders (PageType=PreparingV2) ─────────────────────
  const loadLiveOrders = useCallback(async () => {
    setLiveLoading(true)
    setLiveError(null)
    try {
      const result = await grabAPI().grab.listLiveOrders('PreparingV2')
      if (result.ok) setLiveOrders(result.orders)
      else setLiveError(result.error ?? 'Lỗi không xác định')
    } catch (e) { setLiveError(String(e)) }
    finally { setLiveLoading(false) }
  }, [])

  // ── Load upcoming orders (PageType=UpcomingV2) ────────────────────────────
  const loadUpcomingOrders = useCallback(async () => {
    setUpcomingLoading(true)
    setUpcomingError(null)
    try {
      const result = await grabAPI().grab.listLiveOrders('UpcomingV2')
      if (result.ok) setUpcomingOrders(result.orders)
      else setUpcomingError(result.error ?? 'Lỗi không xác định')
    } catch (e) { setUpcomingError(String(e)) }
    finally { setUpcomingLoading(false) }
  }, [])

  const markReady = useCallback(async (orderID: string, preparationTaskID?: string) => {
    setMarkingReadyIds(prev => new Set(prev).add(orderID))
    try {
      const result = await grabAPI().grab.markOrderReady(orderID, preparationTaskID)
      setMarkReadyResults(prev => ({
        ...prev,
        [orderID]: { ok: result.ok, msg: result.ok ? 'Đã báo sẵn sàng' : (result.error ?? 'Lỗi') },
      }))
      if (result.ok) {
        void loadLiveOrders()
        void loadReadyOrders()
      }
    } catch (e) {
      setMarkReadyResults(prev => ({ ...prev, [orderID]: { ok: false, msg: String(e) } }))
    } finally {
      setMarkingReadyIds(prev => { const s = new Set(prev); s.delete(orderID); return s })
    }
  }, [loadLiveOrders, loadReadyOrders])

  // ── Load GrabFood history orders ───────────────────────────────────────────
  const loadGrabOrders = useCallback(async (from: string, to: string, page: number, append = false) => {
    if (append) setGrabLoadingMore(true)
    else { setGrabLoading(true); setGrabError(null) }
    try {
      const result = await grabAPI().grab.listOrders(from, to, page)
      if (result.ok) {
        const sorted = [...result.orders].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setGrabOrders(prev => append ? [...prev, ...sorted] : sorted)
        setGrabHasMore(result.hasMore)
        setGrabCurrentPage(result.pageIndex)
      } else {
        setGrabError(result.error ?? 'Lỗi không xác định')
      }
    } catch (e) { setGrabError(String(e)) }
    finally {
      if (append) setGrabLoadingMore(false)
      else setGrabLoading(false)
    }
  }, [])

  const applyGrabFilter = useCallback((from: string, to: string) => {
    setGrabFrom(from); setGrabTo(to)
    void loadGrabOrders(from, to, 0)
  }, [loadGrabOrders])

  useEffect(() => {
    if (platformFilter === 'grabfood') {
      void loadLiveOrders()
      void loadReadyOrders()
      void loadUpcomingOrders()
      const today = vnDateStr(0)
      setGrabFrom(today); setGrabTo(today); setGrabQuick('today')
      void loadGrabOrders(today, today, 0)
      setGrabSubTab('preparing')
    }
  }, [platformFilter, loadLiveOrders, loadReadyOrders, loadUpcomingOrders, loadGrabOrders])

  useEffect(() => {
    if (platformFilter === 'shopeefood' && shopeePartnerConnected) {
      void (async () => {
        try {
          const s = await grabAPI().spfPartner.getStatus()
          if (s.restaurantId) {
            setSpfRestaurantId(s.restaurantId)
            setSpfRestaurantName(s.restaurantName)
            const today = vnDateStr(0)
            setSpfFrom(today); setSpfTo(today); setSpfQuick('today')
            await loadSpfTransactions(today, today, s.restaurantId)
          }
        } catch { /* ignore */ }
      })()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformFilter, shopeePartnerConnected])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // ── DB order status change ─────────────────────────────────────────────────
  const handleStatus = async (id: string, status: OrderStatus) => {
    setBusyIds(prev => new Set(prev).add(id))
    try {
      await updateOrderStatus(id, status)
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    } catch { /* ignore */ } finally {
      setBusyIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  // ── GrabFood: open detail ──────────────────────────────────────────────────
  const openGrabDetail = useCallback(async (id: string, preparationTaskID?: string) => {
    setGrabDetail({ id, data: null, loading: true, preparationTaskID })
    try {
      const result = await grabAPI().grab.getOrder(id)
      setGrabDetail({ id, data: result.ok ? (result.order as GrabFull ?? null) : null, loading: false, preparationTaskID })
    } catch {
      setGrabDetail({ id, data: null, loading: false, preparationTaskID })
    }
  }, [])

  // ── GrabFood: sync revenue summary ────────────────────────────────────────
  const syncRevenue = useCallback(async () => {
    setRevenueSyncing(true)
    setRevenueResult(null)
    try {
      const result = await grabAPI().grab.syncRevenue(grabFrom)
      setRevenueResult({
        ok: result.ok,
        msg: result.ok ? 'Đã sync doanh thu thành công' : (result.error ?? 'Lỗi không xác định'),
      })
    } catch (e) {
      setRevenueResult({ ok: false, msg: String(e) })
    } finally {
      setRevenueSyncing(false)
    }
  }, [grabFrom])
  // ── DB filtered list ───────────────────────────────────────────────────────
  const filtered = orders.filter(o => {
    if (platformFilter === 'all') return true
    const { platform } = parsePlatform(o.guestDeliveryName)
    if (platformFilter === 'other') {
      return !['GRABFOOD', 'SHOPEEFOOD', 'BAEMIN'].some(p => platform.includes(p))
    }
    return platform.toLowerCase().includes(platformFilter)
  })

  const counts: Record<string, number> = { all: orders.length }
  for (const o of orders) {
    const { platform } = parsePlatform(o.guestDeliveryName)
    const key = ['GRABFOOD', 'SHOPEEFOOD', 'BAEMIN'].find(p => platform.includes(p))?.toLowerCase() ?? 'other'
    counts[key] = (counts[key] ?? 0) + 1
  }

  const isGrabTab = platformFilter === 'grabfood'
  const isSpfPartnerTab = platformFilter === 'shopeefood' && shopeePartnerConnected

  return (
    <>
      <div className="fixed inset-0 z-40 flex flex-col bg-gray-50 animate-in fade-in duration-200">

        {/* ── Header ── */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 shadow-sm">
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-black text-gray-900">Đơn hàng từ đối tác</h1>
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
              {isGrabTab ? liveOrders.filter(o => o.state === 'ORDER_IN_PREPARE').length : isSpfPartnerTab ? spfTransactions.length : filtered.length}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!isGrabTab && (
              <div className="flex items-center gap-1">
                {QUICK_DATES.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setQuickDate(f.key)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${quickDate === f.key
                      ? 'bg-brand text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                if (isGrabTab) {
                  void loadLiveOrders()
                  void loadReadyOrders()
                  void loadUpcomingOrders()
                  void loadGrabOrders(grabFrom, grabTo, 0)
                } else if (isSpfPartnerTab) {
                  void loadSpfTransactions(spfFrom, spfTo)
                } else {
                  void load(quickDate)
                }
              }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className={`size-4 ${(isGrabTab ? liveLoading || upcomingLoading || grabLoading : isSpfPartnerTab ? spfLoading : loading) ? 'animate-spin' : ''}`} />
              Tải lại
            </button>
          </div>
        </div>

        {/* ── Platform tabs ── */}
        <div className="shrink-0 border-b border-gray-200 bg-white">
          <div className="flex px-4 overflow-x-auto">
            {visibleFilters.map(f => {
              const cnt = f.key === 'grabfood'
                ? liveOrders.filter(o => o.state === 'ORDER_IN_PREPARE').length
                : (counts[f.key] ?? 0)
              const isActive = platformFilter === f.key
              const logo = f.key === 'grabfood' ? grabFoodLogo : f.key === 'shopeefood' ? shopeeFoodLogo : null
              const dot = !logo && f.key !== 'all' ? platformStyle(f.key.toUpperCase()).dot : ''
              return (
                <button
                  key={f.key}
                  onClick={() => setPlatformFilter(f.key)}
                  className={`relative flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${isActive
                    ? 'border-brand text-brand'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  {logo
                    ? <img src={logo} className="h-4 w-4 object-contain shrink-0" alt="" />
                    : dot && <span className={`size-2 rounded-full ${dot}`} />
                  }
                  {f.label}
                  {cnt > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-500'}`}>
                      {cnt}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-4 py-5 scrollbar-thin pb-20">

          {/* ShopeeFood Partner API tab */}
          {isSpfPartnerTab ? (
            <SpfPartnerTabContent
              restaurantId={spfRestaurantId}
              restaurantName={spfRestaurantName}
              transactions={spfTransactions}
              totalAmount={spfTotalAmount}
              loading={spfLoading}
              error={spfError}
              from={spfFrom}
              to={spfTo}
              quick={spfQuick}
              onQuickChange={(q, from, to) => { setSpfQuick(q); setSpfFrom(from); setSpfTo(to); void loadSpfTransactions(from, to) }}
              onCustomDateBlur={() => spfQuick === 'custom' && void loadSpfTransactions(spfFrom, spfTo)}
              onFromChange={v => { setSpfQuick('custom'); setSpfFrom(v) }}
              onToChange={v => { setSpfQuick('custom'); setSpfTo(v) }}
              onApplyCustom={() => void loadSpfTransactions(spfFrom, spfTo)}
            />
          ) : null}

          {/* GrabFood direct API tab */}
          {isGrabTab ? (
            <>
              {/* ── GrabFood sub-tabs ── */}
              {(() => {
                const preparingList = liveOrders.filter(o => o.state === 'ORDER_IN_PREPARE')

                const GRAB_SUB_TABS: { key: GrabSubTab; label: string; count?: number }[] = [
                  { key: 'preparing', label: 'Đang chuẩn bị', count: preparingList.length },
                  { key: 'ready', label: 'Sẵn sàng', count: readyOrders.length },
                  { key: 'upcoming', label: 'Sắp tới', count: upcomingOrders.length },
                  { key: 'history', label: 'Lịch sử' },
                ]

                return (
                  <>
                    {/* Sub-tab bar */}
                    <div className="mb-4 flex gap-1 border-b border-gray-200 pb-0 -mx-4 px-4 overflow-x-auto">
                      {GRAB_SUB_TABS.map(t => (
                        <button
                          key={t.key}
                          onClick={() => setGrabSubTab(t.key)}
                          className={`relative flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${grabSubTab === t.key
                            ? 'border-green-600 text-green-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                          {t.label}
                          {t.count !== undefined && t.count > 0 && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${grabSubTab === t.key ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {t.count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* ── "Đang chuẩn bị" sub-tab ── */}
                    {grabSubTab === 'preparing' && (
                      liveLoading ? (
                        <div className="flex h-48 items-center justify-center gap-2 text-sm text-gray-400">
                          <Loader2 className="size-4 animate-spin" /> Đang tải từ GrabFood…
                        </div>
                      ) : liveError ? (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-6 py-8 text-center">
                          <p className="text-sm font-medium text-red-600">{liveError}</p>
                          {liveError.toLowerCase().includes('merchant') && (
                            <p className="text-xs text-gray-500">Vào <b>Cài đặt → GrabFood</b> và bấm "Sync session" để tự lấy Merchant ID</p>
                          )}
                          <button onClick={() => void loadLiveOrders()} className="text-xs text-green-600 underline">Thử lại</button>
                        </div>
                      ) : preparingList.length === 0 ? (
                        <div className="flex h-48 flex-col items-center justify-center gap-2 text-gray-400">
                          <PackageCheck className="size-8 opacity-30" />
                          <p className="text-sm">Không có đơn đang chuẩn bị</p>
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {preparingList.map(order => (
                            <GrabPreparingOrderCard
                              key={order.orderID}
                              order={order}
                              showMarkReady={true}
                              marking={markingReadyIds.has(order.orderID)}
                              result={markReadyResults[order.orderID]}
                              onMarkReady={() => void markReady(order.orderID, order.preparationTaskID as string | undefined)}
                              onOpen={() => void openGrabDetail(order.orderID, order.preparationTaskID as string | undefined)}
                            />
                          ))}
                        </div>
                      )
                    )}

                    {/* ── "Sẵn sàng" sub-tab ── */}
                    {grabSubTab === 'ready' && (
                      readyLoading ? (
                        <div className="flex h-48 items-center justify-center gap-2 text-sm text-gray-400">
                          <Loader2 className="size-4 animate-spin" /> Đang tải…
                        </div>
                      ) : readyError ? (
                        <div className="flex h-48 flex-col items-center justify-center gap-2">
                          <p className="text-sm text-red-500">{readyError}</p>
                          <button onClick={() => void loadReadyOrders()} className="text-xs text-green-600 underline">Thử lại</button>
                        </div>
                      ) : readyOrders.length === 0 ? (
                        <div className="flex h-48 flex-col items-center justify-center gap-2 text-gray-400">
                          <CheckCircle2 className="size-8 opacity-30" />
                          <p className="text-sm">Không có đơn nào đang chờ shipper</p>
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {readyOrders.map(order => (
                            <GrabPreparingOrderCard
                              key={order.orderID}
                              order={order}
                              showMarkReady={false}
                              marking={false}
                              result={undefined}
                              onMarkReady={() => { }}
                              onOpen={() => void openGrabDetail(order.orderID)}
                            />
                          ))}
                        </div>
                      )
                    )}

                    {/* ── "Sắp tới" sub-tab ── */}
                    {grabSubTab === 'upcoming' && (
                      upcomingLoading ? (
                        <div className="flex h-48 items-center justify-center gap-2 text-sm text-gray-400">
                          <Loader2 className="size-4 animate-spin" /> Đang tải…
                        </div>
                      ) : upcomingError ? (
                        <div className="flex h-48 flex-col items-center justify-center gap-2">
                          <p className="text-sm text-red-500">{upcomingError}</p>
                          <button onClick={() => void loadUpcomingOrders()} className="text-xs text-green-600 underline">Thử lại</button>
                        </div>
                      ) : upcomingOrders.length === 0 ? (
                        <div className="flex h-48 flex-col items-center justify-center gap-2 text-gray-400">
                          <Clock className="size-8 opacity-30" />
                          <p className="text-sm">Không có đơn đặt trước</p>
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {upcomingOrders.map(order => (
                            <GrabPreparingOrderCard
                              key={order.orderID}
                              order={order}
                              showMarkReady={false}
                              marking={false}
                              result={undefined}
                              onMarkReady={() => { }}
                              onOpen={() => void openGrabDetail(order.orderID)}
                            />
                          ))}
                        </div>
                      )
                    )}

                    {/* ── "Lịch sử" sub-tab ── */}
                    {grabSubTab === 'history' && (
                      <>
                        {/* Date filter bar */}
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                          {([
                            { key: 'today', label: 'Hôm nay', from: vnDateStr(0), to: vnDateStr(0) },
                            { key: 'yesterday', label: 'Hôm qua', from: vnDateStr(1), to: vnDateStr(1) },
                            { key: 'week', label: '7 ngày', from: vnDateStr(6), to: vnDateStr(0) },
                          ] as const).map(preset => (
                            <button
                              key={preset.key}
                              onClick={() => { setGrabQuick(preset.key); applyGrabFilter(preset.from, preset.to) }}
                              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${grabQuick === preset.key ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                              {preset.label}
                            </button>
                          ))}
                          <div className="flex items-center gap-1.5 ml-1">
                            <input type="date" value={grabFrom}
                              onChange={e => { setGrabQuick('custom'); setGrabFrom(e.target.value) }}
                              onBlur={() => grabQuick === 'custom' && applyGrabFilter(grabFrom, grabTo)}
                              className="rounded-xl border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-green-500 focus:outline-none"
                            />
                            <span className="text-xs text-gray-400">→</span>
                            <input type="date" value={grabTo}
                              onChange={e => { setGrabQuick('custom'); setGrabTo(e.target.value) }}
                              onBlur={() => grabQuick === 'custom' && applyGrabFilter(grabFrom, grabTo)}
                              className="rounded-xl border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-green-500 focus:outline-none"
                            />
                            {grabQuick === 'custom' && (
                              <button onClick={() => applyGrabFilter(grabFrom, grabTo)}
                                className="rounded-xl bg-green-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-green-700">
                                Lọc
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Sync revenue bar */}
                        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-green-100 bg-green-50 px-4 py-3">
                          <TrendingUp className="size-4 text-green-600 shrink-0" />
                          <span className="text-sm font-semibold text-green-800 flex-1">
                            Sync doanh thu {grabFrom}{grabFrom !== grabTo ? ` → ${grabTo}` : ''} vào hệ thống
                          </span>
                          {revenueResult && (
                            <span className={`text-xs font-medium ${revenueResult.ok ? 'text-teal-700' : 'text-red-600'}`}>
                              {revenueResult.ok ? <CheckCircle2 className="size-3 inline mr-0.5" /> : null}
                              {revenueResult.msg}
                            </span>
                          )}
                          <button onClick={() => void syncRevenue()} disabled={revenueSyncing}
                            className="flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-60 transition-colors">
                            {revenueSyncing ? <Loader2 className="size-3.5 animate-spin" /> : <TrendingUp className="size-3.5" />}
                            {revenueSyncing ? 'Đang sync…' : 'Sync doanh thu'}
                          </button>
                        </div>

                        {grabLoading ? (
                          <div className="flex h-48 items-center justify-center gap-2 text-sm text-gray-400">
                            <Loader2 className="size-4 animate-spin" /> Đang tải từ GrabFood…
                          </div>
                        ) : grabError ? (
                          <div className="flex h-48 flex-col items-center justify-center gap-2">
                            <p className="text-sm text-red-500">{grabError}</p>
                            <button onClick={() => void loadGrabOrders(grabFrom, grabTo, 0)} className="text-xs text-green-600 underline">Thử lại</button>
                          </div>
                        ) : grabOrders.length === 0 ? (
                          <div className="flex h-48 flex-col items-center justify-center gap-2 text-gray-400">
                            <ShoppingBag className="size-8 opacity-30" />
                            <p className="text-sm">Không có đơn hàng trong khoảng thời gian này</p>
                          </div>
                        ) : (
                          <>
                            <div className="mb-2 text-xs text-gray-400">({grabOrders.length} đơn{grabHasMore ? '+' : ''})</div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                              {grabOrders.map(order => (
                                <GrabOrderCard key={order.ID} order={order} onOpen={() => void openGrabDetail(order.ID)} />
                              ))}
                            </div>
                            {grabHasMore && (
                              <div className="mt-4 flex justify-center">
                                <button onClick={() => void loadGrabOrders(grabFrom, grabTo, grabCurrentPage + 1, true)} disabled={grabLoadingMore}
                                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors shadow-sm">
                                  {grabLoadingMore ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                                  Tải thêm (trang {grabCurrentPage + 2})
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </>
                )
              })()}
            </>
          ) : isSpfPartnerTab ? null : (
            /* DB-based orders */
            loading ? (
              <div className="flex h-48 items-center justify-center gap-2 text-sm text-gray-400">
                <Loader2 className="size-4 animate-spin" /> Đang tải đơn hàng…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-gray-400">
                <ShoppingBag className="size-8 opacity-30" />
                <p className="text-sm">Chưa có đơn hàng từ đối tác</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map(order => (
                  <ExternalOrderCard
                    key={order.id}
                    order={order}
                    onOpen={() => setSelectedOrder(order)}
                    onStatusChange={handleStatus}
                    isBusy={busyIds.has(order.id)}
                  />
                ))}
              </div>
            )
          )}
        </div>

      </div>

      {/* DB order detail modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {/* GrabFood order detail modal */}
      {grabDetail && (
        <GrabOrderDetailModal
          id={grabDetail.id}
          data={grabDetail.data}
          loading={grabDetail.loading}
          preparationTaskID={grabDetail.preparationTaskID}
          markingReady={markingReadyIds.has(grabDetail.id)}
          markReadyResult={markReadyResults[grabDetail.id]}
          onMarkReady={() => void markReady(grabDetail.id, grabDetail.preparationTaskID)}
          onClose={() => setGrabDetail(null)}
        />
      )}
    </>
  )
}

// ─── GrabFood Preparing Order Card (NO print buttons — print only in detail modal) ──

function GrabPreparingOrderCard({
  order, showMarkReady, marking, result, onMarkReady, onOpen,
}: {
  order: GrabPreparingOrder
  showMarkReady: boolean
  marking: boolean
  result?: { ok: boolean; msg: string }
  onMarkReady: () => void
  onOpen: () => void
}) {
  const stateLabel: Record<string, string> = {
    ORDER_IN_PREPARE: showMarkReady ? 'Đang chuẩn bị' : 'Sẵn sàng',
    ACCEPTED: 'Đã nhận',
    PLACED: 'Mới đặt',
    ORDER_EXECUTING: 'Đang giao',
    DRIVER_AT_STORE: 'Tài xế đến',
  }
  const label = stateLabel[order.state] ?? order.state
  const amount = order.orderValue ? Number(order.orderValue) : 0
  return (
    <div className="relative flex flex-col rounded-2xl border border-green-100 bg-white shadow-sm transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-2xl bg-green-50 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <img src={grabFoodLogo} className="h-4 w-4 object-contain shrink-0" alt="" />
          <span className="text-xs font-black tracking-wide text-green-700">GRABFOOD</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
          <span className="size-1.5 rounded-full bg-blue-500" />
          {label}
        </span>
      </div>

      {/* Info */}
      <button onClick={onOpen} className="px-4 pt-3 pb-2 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="font-mono text-sm font-black text-gray-800 tracking-tight">
                {order.displayID}
              </span>
              <ChevronRight className="size-3 text-gray-300" />
            </div>
            {order.eater.name && order.eater.name !== '***' && (
              <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                <User className="size-2.5" />{order.eater.name}
              </p>
            )}
            <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(order.times.createdAt)}</p>
          </div>
          {amount > 0 && (
            <div className="shrink-0 text-right">
              <p className="text-sm font-black text-brand">{order?.orderValue}đ</p>
              <p className="text-[10px] text-gray-400">{order.itemInfo.count} món</p>
            </div>
          )}
        </div>
      </button>

      {/* Items preview */}
      {order.itemInfo.items.length > 0 && (
        <>
          <div className="mx-4 border-t border-gray-50" />
          <div className="px-4 py-2 space-y-1">
            {order.itemInfo.items.slice(0, 3).map((item, i) => (
              <div key={item.itemID ?? i} className="flex items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-green-50 text-[10px] font-bold text-green-700">{item.quantity}×</span>
                <span className="text-xs text-gray-700 truncate flex-1">{item.name}</span>
              </div>
            ))}
            {order.itemInfo.items.length > 3 && (
              <p className="text-[10px] text-gray-400">+{order.itemInfo.items.length - 3} món khác…</p>
            )}
          </div>
        </>
      )}

      {/* View detail hint */}
      <div className="mx-4 border-t border-gray-50" />
      <button
        onClick={onOpen}
        className="flex items-center justify-center gap-1 px-4 py-2 text-[11px] text-gray-400 hover:text-green-600 transition-colors"
      >
        <ChevronRight className="size-3" /> Xem chi tiết &amp; in
      </button>

      {/* Mark ready button — only for ORDER_IN_PREPARE */}
      {showMarkReady && (
        <>
          <div className="mx-4 border-t border-gray-50" />
          <div className="px-4 pb-4 pt-3 flex flex-col gap-2">
            {result && (
              <p className={`text-[11px] font-medium ${result.ok ? 'text-teal-600' : 'text-red-500'}`}>
                {result.ok ? '✓ ' : '✗ '}{result.msg}
              </p>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onMarkReady() }}
              disabled={marking || result?.ok}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {marking
                ? <Loader2 className="size-3.5 animate-spin" />
                : <PackageCheck className="size-3.5" />
              }
              {marking ? 'Đang gửi…' : result?.ok ? 'Đã báo sẵn sàng' : 'Sẵn sàng — báo shipper'}
            </button>
          </div>
        </>
      )}

      {/* Bottom padding if no mark-ready */}
      {!showMarkReady && <div className="pb-2" />}
    </div>
  )
}

// ─── GrabFood Order Card (history) ───────────────────────────────────────────

function GrabOrderCard({
  order, onOpen,
}: {
  order: GrabDailyEntry
  onOpen: () => void
}) {
  const status = order.deliveryStatus.toUpperCase()
  const label = GRAB_STATUS_LABEL[status] ?? status
  const color = GRAB_STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  const dot = GRAB_STATUS_DOT[status] ?? 'bg-gray-400'
  const amount = order.orderEarningsInMinorUnit

  return (
    <div className="relative flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md">

      {/* Header: Grab badge + status */}
      <div className="flex items-center justify-between rounded-t-2xl px-4 py-2.5 bg-green-50">
        <div className="flex items-center gap-1.5">
          <img src={grabFoodLogo} className="h-4 w-4 object-contain shrink-0" alt="" />
          <span className="font-bold font-mono text-base text-gray-800 tracking-tight">
            {order.displayID || order.bookingCode}
          </span>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${color}`}>
          <span className={`size-1.5 rounded-full ${dot}`} />
          {label}
        </span>
      </div>

      {/* Main info */}
      <button onClick={onOpen} className="px-4 pt-3 pb-2 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <ChevronRight className="size-3 text-gray-300" />
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">{`Giờ đặt: ${formatDate(order.createdAt)}`}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-base font-black text-brand">{fmt(amount)}</p>
            <p className="text-[10px] text-gray-400">Thu nhập</p>
          </div>
        </div>
      </button>

      {/* Booking code + detail button */}
      <div className="mx-4 border-t border-gray-50" />
      <div className="flex items-center justify-between px-4 py-2.5">
        <p className="text-[11px] text-gray-400">
          Mã: <span className="font-mono font-semibold text-gray-600">{order.bookingCode}</span>
        </p>
        <button
          onClick={onOpen}
          className="flex items-center gap-1 rounded-xl bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <ChevronRight className="size-3" /> Chi tiết
        </button>
      </div>
    </div>
  )
}

function ExternalOrderCard({
  order, onOpen, onStatusChange, isBusy,
}: {
  order: AdminOrder
  onOpen: () => void
  onStatusChange: (id: string, status: OrderStatus) => Promise<void>
  isBusy: boolean
}) {
  const { platform, customerName } = parsePlatform(order.guestDeliveryName)
  const pStyle = platformStyle(platform)
  const logo = platformLogo(platform)
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className={`relative flex flex-col rounded-2xl border bg-white shadow-sm transition-all ${isBusy ? 'opacity-70' : 'hover:shadow-md'} border-gray-100`}>

      {isBusy && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/60">
          <Loader2 className="size-6 animate-spin text-brand" />
        </div>
      )}

      <div className={`flex items-center justify-between rounded-t-2xl px-4 py-2.5 ${pStyle.bg}`}>
        <div className="flex items-center gap-1.5">
          {logo
            ? <img src={logo} className="h-4 w-4 object-contain shrink-0" alt="" />
            : <span className={`size-2 rounded-full ${pStyle.dot}`} />
          }
          <span className={`text-xs font-black tracking-wide ${pStyle.text}`}>{platform}</span>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[order.status]}`}>
          <span className={`size-1.5 rounded-full ${STATUS_DOT[order.status]}`} />
          {STATUS_LABEL[order.status]}
        </span>
      </div>

      <button onClick={onOpen} disabled={isBusy} className="px-4 pt-3 pb-2 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="font-mono text-sm font-black text-gray-800 tracking-tight">
                {order.paymentCode}
              </span>
              <ChevronRight className="size-3 text-gray-300" />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.createdAt)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-base font-black text-brand">{fmt(order.finalAmount ?? order.totalAmount)}</p>
            <p className="text-[10px] text-gray-400">{totalQty} món</p>
          </div>
        </div>
      </button>

      <div className="mx-4 border-t border-gray-50" />
      <div className="px-4 py-2.5 space-y-1">
        {customerName && (
          <div className="flex items-center gap-1.5 text-xs text-gray-700">
            <User className="size-3 shrink-0 text-gray-400" />
            <span className="font-medium truncate">{customerName}</span>
          </div>
        )}
        {order.guestDeliveryPhone && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Phone className="size-3 shrink-0 text-gray-400" />
            <span>{order.guestDeliveryPhone}</span>
          </div>
        )}
        {order.guestDeliveryAddress && (
          <div className="flex items-start gap-1.5 text-xs text-gray-500">
            <MapPin className="size-3 shrink-0 mt-0.5 text-gray-400" />
            <span className="line-clamp-2 leading-relaxed">{order.guestDeliveryAddress}</span>
          </div>
        )}
      </div>

      <div className="mx-4 border-t border-gray-50" />
      <button onClick={onOpen} disabled={isBusy} className="px-4 py-3 text-left space-y-1.5 flex-1">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[10px] font-bold text-gray-500">
              {item.quantity}×
            </div>
            <span className="text-xs text-gray-800 truncate flex-1">{item.product?.name}</span>
            <span className="shrink-0 text-[11px] font-semibold text-gray-500 tabular-nums">
              {fmt(Number(item.price) * item.quantity)}
            </span>
          </div>
        ))}
        {order.items.some(i => i.note) && (
          <p className="text-[10px] text-amber-600 italic mt-1">
            📝 {order.items.filter(i => i.note).map(i => i.note).join(' | ')}
          </p>
        )}
      </button>

      {(order.status === 'pending' || order.status === 'preparing' || order.status === 'ready') && (
        <>
          <div className="mx-4 border-t border-gray-50" />
          <div className="flex gap-1.5 px-4 pb-4 pt-3">
            {order.status === 'pending' && (
              <button
                onClick={(e) => { e.stopPropagation(); void onStatusChange(order.id, 'preparing') }}
                disabled={isBusy}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                <Clock className="size-3" /> Bắt đầu làm
              </button>
            )}
            {order.status === 'preparing' && (
              <button
                onClick={(e) => { e.stopPropagation(); void onStatusChange(order.id, 'ready') }}
                disabled={isBusy}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="size-3" /> Xong
              </button>
            )}
            {order.status === 'ready' && (
              <button
                onClick={(e) => { e.stopPropagation(); void onStatusChange(order.id, 'completed') }}
                disabled={isBusy}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-gray-100 px-2.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="size-3" /> Hoàn thành
              </button>
            )}
            {(order.status === 'pending' || order.status === 'preparing') && (
              <button
                onClick={(e) => { e.stopPropagation(); void onStatusChange(order.id, 'cancelled') }}
                disabled={isBusy}
                className="flex items-center justify-center gap-1 rounded-xl bg-red-50 px-2.5 py-2 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                <XCircle className="size-3" /> Huỷ
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── ShopeeFood Partner transactions tab ─────────────────────────────────────

function SpfPartnerTabContent({
  restaurantId, restaurantName, transactions, totalAmount, loading, error,
  from, to, quick, onQuickChange, onFromChange, onToChange, onCustomDateBlur, onApplyCustom,
}: {
  restaurantId: string | null
  restaurantName: string | null
  transactions: SpfPartnerTransaction[]
  totalAmount: number
  loading: boolean
  error: string | null
  from: string
  to: string
  quick: string
  onQuickChange(q: 'today' | 'yesterday' | 'week' | 'custom', from: string, to: string): void
  onFromChange(v: string): void
  onToChange(v: string): void
  onCustomDateBlur(): void
  onApplyCustom(): void
}) {
  const vnDateStr = (offsetDays = 0) => {
    const ms = Date.now() + 7 * 60 * 60 * 1000 - offsetDays * 86_400_000
    return new Date(ms).toISOString().slice(0, 10)
  }

  if (!restaurantId) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 text-gray-400">
        <p className="text-sm">Không tìm thấy Restaurant ID — vào Cài đặt → ShopeeFood để kết nối lại</p>
      </div>
    )
  }

  return (
    <div>
      {/* Restaurant info */}
      {restaurantName && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3">
          <img src={shopeeFoodLogo} className="h-5 w-5 object-contain shrink-0" alt="" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-orange-800 truncate">{restaurantName}</p>
            <p className="text-xs text-orange-500 font-mono">ID: {restaurantId}</p>
          </div>
          {totalAmount > 0 && (
            <div className="text-right shrink-0">
              <p className="text-sm font-black text-orange-700">{fmt(totalAmount)}</p>
              <p className="text-[10px] text-orange-400">Tổng kỳ</p>
            </div>
          )}
        </div>
      )}

      {/* Date filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([
          { key: 'today', label: 'Hôm nay', from: vnDateStr(0), to: vnDateStr(0) },
          { key: 'yesterday', label: 'Hôm qua', from: vnDateStr(1), to: vnDateStr(1) },
          { key: 'week', label: '7 ngày', from: vnDateStr(6), to: vnDateStr(0) },
        ] as const).map(p => (
          <button
            key={p.key}
            onClick={() => onQuickChange(p.key, p.from, p.to)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${quick === p.key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-1">
          <input type="date" value={from}
            onChange={e => onFromChange(e.target.value)}
            onBlur={onCustomDateBlur}
            className="rounded-xl border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-orange-400 focus:outline-none"
          />
          <span className="text-xs text-gray-400">→</span>
          <input type="date" value={to}
            onChange={e => onToChange(e.target.value)}
            onBlur={onCustomDateBlur}
            className="rounded-xl border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-orange-400 focus:outline-none"
          />
          {quick === 'custom' && (
            <button onClick={onApplyCustom}
              className="rounded-xl bg-orange-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-orange-600">
              Lọc
            </button>
          )}
        </div>
      </div>

      {/* Transaction list */}
      {loading ? (
        <div className="flex h-48 items-center justify-center gap-2 text-sm text-gray-400">
          <Loader2 className="size-4 animate-spin" /> Đang tải từ ShopeeFood…
        </div>
      ) : error ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-gray-400">
          <ShoppingBag className="size-8 opacity-30" />
          <p className="text-sm">Không có giao dịch trong khoảng thời gian này</p>
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs text-gray-400">{transactions.length} giao dịch</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {transactions.map(txn => (
              <SpfTransactionCard key={txn.transaction_id} txn={txn} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SpfTransactionCard({ txn }: { txn: SpfPartnerTransaction }) {
  const timeStr = txn.create_time ? txn.create_time.slice(11, 16) : ''
  const dateStr = txn.create_time ? txn.create_time.slice(0, 10) : ''

  return (
    <div className="relative flex flex-col rounded-2xl border border-orange-100 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-2xl bg-orange-50 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <img src={shopeeFoodLogo} className="h-4 w-4 object-contain shrink-0" alt="" />
          <span className="font-bold font-mono text-sm text-gray-800 tracking-tight">{txn.order_code}</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Hoàn thành
        </span>
      </div>

      {/* Content */}
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-gray-400">{dateStr} {timeStr && `lúc ${timeStr}`}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-base font-black text-orange-600">{txn.amount}</p>
            <p className="text-[10px] text-gray-400">Giao dịch</p>
          </div>
        </div>
      </div>
    </div>
  )
}
