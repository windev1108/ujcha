import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, Bell, Clock, CheckCircle2, XCircle, RefreshCw,
  ShoppingBag, CreditCard, ChevronRight, Search,
  Loader2, Calendar, Check, ListChecks, X, Bike, Truck, Utensils,
} from 'lucide-react'
import { io } from 'socket.io-client'
import { fetchOrders, updateOrderStatus, bulkUpdateOrderStatus, fetchShippers, assignShipper, API_URL } from '../api'
import type { AdminOrder, OrderStatus } from '../types/common'
import newOrderMp3 from '../assets/mp3/new-order.mp3'
import { formatDate } from '@/lib/utils'
import { OrderDetailModal } from './OrderDetailModal'

function fmt(n: string | number) { return Number(n).toLocaleString('vi-VN') + 'đ' }

function parseOptionsStr(raw: unknown): string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ''
  return Object.entries(raw as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ')
}

function parseExtrasStr(raw: unknown): string {
  if (!Array.isArray(raw)) return ''
  return raw
    .filter((x): x is { name: string } =>
      x != null && typeof x === 'object' && 'name' in x && typeof (x as { name: unknown }).name === 'string'
    )
    .map(x => x.name)
    .join(', ')
}

function buildItemSubtitle(item: AdminOrder['items'][number]): string {
  const parts: string[] = []
  const opts = parseOptionsStr(item.optionsJson)
  if (opts) parts.push(opts)
  const extras = parseExtrasStr(item.extrasJson)
  if (extras) parts.push(extras)
  if (item.note) parts.push(`Ghi chú: ${item.note}`)
  return parts.join(' | ')
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  completed: 'Hoàn thành',
  pending: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang làm',
  ready: 'Sẵn sàng',
  delivering: 'Đang giao',
  cancelled: 'Đã huỷ',
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
  preparing: 'bg-violet-100 text-violet-700 border-violet-200',
  ready: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  delivering: 'bg-sky-100 text-sky-700 border-sky-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
  completed: 'bg-teal-100 text-teal-700 border-teal-200',
}

const STATUS_DOT: Record<OrderStatus, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-blue-500',
  preparing: 'bg-violet-500',
  ready: 'bg-emerald-500',
  delivering: 'bg-sky-500',
  cancelled: 'bg-red-500',
  completed: 'bg-teal-500',
}

const ORDER_TYPE_LABEL: Record<string, { label: string; Icon: React.ElementType }> = {
  table:    { label: 'Tại bàn',   Icon: Utensils },
  delivery: { label: 'Giao hàng', Icon: Truck },
  pickup:   { label: 'Mang về',   Icon: ShoppingBag },
}

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  card: 'Thẻ',
}

const STATUS_FILTERS: { key: 'all' | OrderStatus; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ xử lý' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'preparing', label: 'Đang làm' },
  { key: 'ready', label: 'Sẵn sàng' },
  { key: 'delivering', label: 'Đang giao' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'cancelled', label: 'Đã huỷ' },
]

const BULK_STATUS_OPTIONS: { status: OrderStatus; label: string; color: string }[] = [
  { status: 'confirmed', label: 'Xác nhận', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200' },
  { status: 'preparing', label: 'Đang làm', color: 'bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200' },
  { status: 'ready', label: 'Xong', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200' },
  { status: 'completed', label: 'Hoàn thành', color: 'bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200' },
  { status: 'cancelled', label: 'Huỷ đơn', color: 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200' },
]

type QuickDate = 'today' | 'week' | 'month' | 'all'

const QUICK_DATE_FILTERS: { key: QuickDate; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'week', label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
  { key: 'all', label: 'Tất cả' },
]

const QUICK_DATE_TITLES: Record<QuickDate, string> = {
  today: 'Đơn hàng hôm nay',
  week: 'Đơn hàng tuần này',
  month: 'Đơn hàng tháng này',
  all: 'Tất cả đơn hàng',
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getApiDateRange(key: QuickDate, dateFrom: string, dateTo: string): { from?: string; to?: string } {
  const now = new Date()
  if (key === 'today') {
    const d = toISODate(now)
    return { from: d, to: d }
  }
  if (key === 'week') {
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return { from: toISODate(monday), to: toISODate(sunday) }
  }
  if (key === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from: toISODate(start), to: toISODate(end) }
  }
  return { from: dateFrom || undefined, to: dateTo || undefined }
}

// ── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="relative flex flex-col rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm animate-pulse">
      <div className="absolute top-0 left-0 bottom-0 w-1 bg-gray-200 rounded-l-2xl" />
      <div className="px-4 pt-4 pb-3 pl-10 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            <div className="h-4 bg-gray-100 rounded-full w-28" />
            <div className="flex gap-1.5">
              <div className="h-4 bg-gray-100 rounded-full w-20" />
              <div className="h-4 bg-gray-100 rounded-full w-14" />
            </div>
          </div>
          <div className="space-y-1 text-right">
            <div className="h-5 bg-gray-100 rounded-full w-20 ml-auto" />
            <div className="h-3 bg-gray-100 rounded-full w-10 ml-auto" />
          </div>
        </div>
      </div>
      <div className="mx-4 h-px bg-gray-50" />
      <div className="px-4 py-2 flex gap-3">
        <div className="h-3 bg-gray-100 rounded-full w-16" />
        <div className="h-3 bg-gray-100 rounded-full w-20" />
        <div className="h-3 bg-gray-100 rounded-full w-14 ml-auto" />
      </div>
      <div className="mx-4 h-px bg-gray-50" />
      <div className="px-4 py-2.5 space-y-2 flex-1">
        {[0, 1].map(i => (
          <div key={i} className="flex items-start gap-2">
            <div className="size-7 bg-gray-100 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-gray-100 rounded-full w-3/4" />
              <div className="h-2.5 bg-gray-100 rounded-full w-1/2" />
            </div>
            <div className="h-3 bg-gray-100 rounded-full w-14 shrink-0" />
          </div>
        ))}
      </div>
      <div className="mx-4 h-px bg-gray-50" />
      <div className="px-4 pb-3.5 pt-3 flex gap-1.5">
        <div className="h-8 bg-gray-100 rounded-full flex-1" />
        <div className="h-8 bg-gray-100 rounded-full w-14" />
      </div>
    </div>
  )
}

export function OrdersModal({ onClose }: { onClose: () => void }) {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all')
  const [search, setSearch] = useState('')
  const [quickDate, setQuickDate] = useState<QuickDate>('today')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Queue: IDs of pending orders that arrived since last full-clear; audio plays until queue is empty
  const [newOrderQueue, setNewOrderQueue] = useState<Set<string>>(new Set())

  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = new Audio(newOrderMp3)
    audio.loop = true
    audio.preload = 'auto'
    audio.load()
    audioRef.current = audio
    audio.play()
      .then(() => { audio.pause(); audio.currentTime = 0 })
      .catch(() => {})
    return () => { audio.pause(); audio.src = ''; audioRef.current = null }
  }, [])

  // Drive audio from queue size: play when queue non-empty, stop when empty
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (newOrderQueue.size > 0) {
      if (audio.paused) {
        audio.currentTime = 0
        audio.play().catch((e) => console.warn('[POS] audio play failed:', e))
      }
    } else {
      audio.pause()
      audio.currentTime = 0
    }
  }, [newOrderQueue.size])

  // Remove order from queue (called on confirmed or cancelled)
  const removeFromQueue = (ids: string[]) => {
    setNewOrderQueue(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.delete(id))
      return next
    })
  }

  const load = async (from?: string, to?: string, addToQueue = false) => {
    setLoading(true)
    try {
      const data = await fetchOrders(1, 100, from, to)
      const items = (data as { items: AdminOrder[] }).items ?? []
      setOrders(items)
      if (addToQueue) {
        // Add all currently pending orders to queue so audio plays until they're all confirmed
        setNewOrderQueue(prev => {
          const next = new Set(prev)
          items.filter(o => o.status === 'pending').forEach(o => next.add(o.id))
          return next
        })
      }
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  const loadRef = useRef(load)
  loadRef.current = load
  const quickDateRef = useRef(quickDate)
  quickDateRef.current = quickDate
  const dateFromRef = useRef(dateFrom)
  dateFromRef.current = dateFrom
  const dateToRef = useRef(dateTo)
  dateToRef.current = dateTo

  useEffect(() => {
    const { from, to } = getApiDateRange(quickDate, dateFrom, dateTo)
    void load(from, to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickDate, dateFrom, dateTo])

  useEffect(() => {
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    })
    const fullReload = (addToQueue = false) => {
      const { from, to } = getApiDateRange(quickDateRef.current, dateFromRef.current, dateToRef.current)
      void loadRef.current(from, to, addToQueue)
    }
    socket.on('order:status', (payload: { orderId: string; status: string }) => {
      setOrders(prev => prev.map(o =>
        o.id === payload.orderId ? { ...o, status: payload.status as OrderStatus } : o
      ))
      // Confirmed/cancelled from another terminal also clears from queue
      if (payload.status === 'confirmed' || payload.status === 'cancelled') {
        removeFromQueue([payload.orderId])
      }
    })
    socket.on('order:paid', (payload: { orderId: string }) => {
      setOrders(prev => prev.map(o =>
        o.id === payload.orderId ? { ...o, paymentStatus: 'paid' as const } : o
      ))
    })
    socket.on('order:new', () => fullReload(true))
    socket.on('order:shipper-assigned', () => fullReload(false))
    socket.on('order:external', () => fullReload(true))
    return () => { socket.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const [assignTarget, setAssignTarget] = useState<AdminOrder | null>(null)

  const handleStatus = async (id: string, status: OrderStatus) => {
    setBusyIds(prev => new Set(prev).add(id))
    try {
      await updateOrderStatus(id, status)
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    } catch { /* ignore */ } finally {
      setBusyIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const handleStatusOrAssign = async (id: string, status: OrderStatus) => {
    // Audio clears only when order is confirmed or cancelled — not for arbitrary status changes
    if (status === 'confirmed' || status === 'cancelled') {
      removeFromQueue([id])
    }
    if (status === 'delivering') {
      const order = orders.find(o => o.id === id)
      if (order && order.type === 'delivery' && !order.shipperId) {
        setAssignTarget(order)
        return
      }
    }
    await handleStatus(id, status)
  }

  const handleBulkStatus = async (status: OrderStatus) => {
    const ids = [...selectedIds]
    setBulkBusy(true)
    try {
      await bulkUpdateOrderStatus(ids, status)
      setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status } : o))
      if (status === 'confirmed' || status === 'cancelled') {
        removeFromQueue(ids)
      }
      setSelectedIds(new Set())
    } catch { /* ignore */ } finally {
      setBulkBusy(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1
    return acc
  }, {})

  const filtered = orders.filter(o => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus
    const q = search.toLowerCase()
    const matchSearch = !q
      || (o.paymentCode ?? '').toLowerCase().includes(q)
      || (o.orderRef ?? '').toLowerCase().includes(q)
      || o.items.some(i => i.product?.name?.toLowerCase().includes(q))
      || (o.table?.name ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const handleRefresh = () => {
    const { from, to } = getApiDateRange(quickDate, dateFrom, dateTo)
    setSelectedIds(new Set())
    void load(from, to)
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every(o => selectedIds.has(o.id))
  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(o => o.id)))
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 flex flex-col bg-gray-50 animate-in fade-in duration-200">

        {/* ── Header ── */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 shadow-sm">
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-black text-gray-900">{QUICK_DATE_TITLES[quickDate]}</h1>
            <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">
              {filtered.length}
            </span>
          </div>
          {newOrderQueue.size > 0 && (
            <button
              onClick={() => setFilterStatus('pending')}
              title={`${newOrderQueue.size} đơn cần xác nhận — nhấn để lọc`}
              className="relative flex items-center gap-1.5 rounded-full bg-red-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg hover:bg-red-600 transition-colors"
            >
              <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />
              <Bell className="size-3.5 animate-bounce" />
              {newOrderQueue.size} đơn mới!
            </button>
          )}
          <div className="ml-auto">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              Tải lại
            </button>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="shrink-0 border-b border-gray-100 bg-white px-4 py-3 space-y-2.5">

          {/* Row 1: Quick date + custom range + search */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              {QUICK_DATE_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setQuickDate(f.key)}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${quickDate === f.key
                    ? 'bg-brand text-white shadow-sm shadow-brand/25'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {quickDate === 'all' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 h-8 rounded-full border border-gray-200 bg-gray-50 px-3">
                  <Calendar className="size-3 text-gray-400 shrink-0" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-28 bg-transparent text-xs text-gray-700 outline-none"
                  />
                </div>
                <span className="text-xs text-gray-400 select-none">→</span>
                <div className="flex items-center gap-1.5 h-8 rounded-full border border-gray-200 bg-gray-50 px-3">
                  <Calendar className="size-3 text-gray-400 shrink-0" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-28 bg-transparent text-xs text-gray-700 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="relative ml-auto w-56">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm mã, món, bàn..."
                className="h-8 w-full rounded-full border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10"
              />
            </div>
          </div>

          {/* Row 2: Status filter chips with color dots */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {STATUS_FILTERS.map(f => {
              const count = f.key === 'all' ? orders.length : (counts[f.key] ?? 0)
              return (
                <button
                  key={f.key}
                  onClick={() => setFilterStatus(f.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${filterStatus === f.key
                    ? 'bg-brand text-white shadow-sm shadow-brand/25'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {f.key !== 'all' && (
                    <span className={`size-1.5 rounded-full shrink-0 ${filterStatus === f.key ? 'bg-white/70' : STATUS_DOT[f.key]}`} />
                  )}
                  {f.label}
                  {count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${filterStatus === f.key
                      ? 'bg-white/25 text-white'
                      : 'bg-gray-300/70 text-gray-600'
                      }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Bulk action bar ── */}
        {selectedIds.size > 0 && (
          <div className="shrink-0 flex items-center gap-3 border-b border-brand/15 bg-gradient-to-r from-brand/5 via-brand/8 to-brand/5 px-4 py-2.5">
            <ListChecks className="size-4 shrink-0 text-brand" />
            <span className="text-sm font-semibold text-brand">
              Đã chọn <strong>{selectedIds.size}</strong> đơn
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              {BULK_STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.status}
                  onClick={() => void handleBulkStatus(opt.status)}
                  disabled={bulkBusy}
                  className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${opt.color}`}
                >
                  {bulkBusy ? <Loader2 className="size-3 animate-spin" /> : null}
                  → {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto rounded-full p-1.5 text-brand/40 hover:bg-brand/10 hover:text-brand transition-colors"
              aria-label="Bỏ chọn tất cả"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-4 py-5 scrollbar-thin">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-3 text-gray-400">
              <div className="flex size-16 items-center justify-center rounded-full bg-gray-100">
                <ShoppingBag className="size-7 opacity-40" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-500">Không có đơn hàng nào</p>
                <p className="text-xs text-gray-400 mt-1">Thử thay đổi bộ lọc hoặc tải lại</p>
              </div>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 hover:border-brand hover:text-brand transition-colors shadow-sm"
              >
                <RefreshCw className="size-3.5" /> Tải lại
              </button>
            </div>
          ) : (
            <>
              {/* Select all row */}
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                >
                  <div className={`size-4 rounded-md border-2 flex items-center justify-center transition-colors ${allFilteredSelected ? 'border-brand bg-brand' : 'border-gray-300 bg-white'
                    }`}>
                    {allFilteredSelected && <Check className="size-2.5 text-white" />}
                  </div>
                  {allFilteredSelected ? 'Bỏ chọn tất cả' : `Chọn tất cả ${filtered.length} đơn`}
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onOpen={() => { setSelectedOrder(order) }}
                    onStatusChange={handleStatusOrAssign}
                    isBusy={busyIds.has(order.id)}
                    isSelected={selectedIds.has(order.id)}
                    onToggleSelect={() => toggleSelect(order.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {assignTarget && (
        <AssignShipperPosModal
          order={assignTarget}
          onClose={() => setAssignTarget(null)}
          onConfirm={async (shipperId) => {
            await assignShipper(assignTarget.id, shipperId)
            await updateOrderStatus(assignTarget.id, 'delivering')
            setOrders(prev => prev.map(o =>
              o.id === assignTarget.id
                ? { ...o, shipperId, status: 'delivering' as OrderStatus }
                : o
            ))
            setAssignTarget(null)
          }}
        />
      )}
    </>
  )
}

// ── Order Card ──────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onOpen,
  onStatusChange,
  isBusy,
  isSelected,
  onToggleSelect,
}: {
  order: AdminOrder
  onOpen: () => void
  onStatusChange: (id: string, status: OrderStatus) => Promise<void>
  isBusy: boolean
  isSelected: boolean
  onToggleSelect: () => void
}) {
  const typeInfo = ORDER_TYPE_LABEL[order.type] ?? { label: order.type, Icon: ShoppingBag }
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0)
  const paymentCode = order.paymentCode ?? order.orderRef ?? order.id.slice(0, 8).toUpperCase()
  const orderTotal = order.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0)
    - (Number(order.discountAmount) || 0)
    - (Number(order.pointDiscountAmount) || 0)
    + (order.type === 'delivery' ? (Number(order.shippingFee) || 0) : 0)

  const visibleItems = order.items.slice(0, 2)
  const hiddenCount = order.items.length - visibleItems.length
  const showActions = ['pending', 'confirmed', 'preparing', 'ready', 'delivering'].includes(order.status)

  return (
    <div className={`relative flex flex-col rounded-2xl border bg-white overflow-hidden transition-all duration-200 ${isSelected
      ? 'border-brand/50 ring-2 ring-brand/15 shadow-lg shadow-brand/10'
      : 'border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 hover:border-gray-200'
      } ${isBusy ? 'opacity-60' : ''}`}>

      {/* Left status accent bar */}
      <div className={`absolute top-0 left-0 bottom-0 w-1 rounded-l-2xl ${STATUS_DOT[order.status]}`} />

      {/* Checkbox */}
      <div
        className="absolute top-3.5 left-4 z-10"
        onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
      >
        <div className={`size-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all shadow-sm ${isSelected
          ? 'border-brand bg-brand'
          : 'border-gray-300 bg-white hover:border-brand/60'
          }`}>
          {isSelected && <Check className="size-3 text-white" />}
        </div>
      </div>

      {/* Busy overlay */}
      {isBusy && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
          <Loader2 className="size-6 animate-spin text-brand" />
        </div>
      )}

      {/* Card Header */}
      <button
        onClick={onOpen}
        disabled={isBusy}
        className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 pl-10 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-black tracking-tight text-gray-900">
              {paymentCode}
            </span>
            <ChevronRight className="size-3 text-gray-300" />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[order.status]}`}>
              <span className={`size-1.5 rounded-full ${STATUS_DOT[order.status]}`} />
              {STATUS_LABEL[order.status]}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
              <typeInfo.Icon className="size-3 shrink-0" />
              {typeInfo.label}
            </span>
            {order.type === 'delivery' && order.shipper && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                <Bike className="size-2.5" />{order.shipper.name}
              </span>
            )}
            {order.paymentStatus === 'paid' && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <CheckCircle2 className="size-2.5" /> Đã TT
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-black text-brand tabular-nums">
            {fmt(orderTotal)}
          </p>
          <p className="text-[10px] text-gray-400">{totalQty} món</p>
        </div>
      </button>

      <div className="mx-4 h-px bg-gray-50" />

      {/* Meta info row */}
      <div className="px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {order.table && (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
            <Utensils className="size-3 shrink-0" />{order.table.name}
          </span>
        )}
        {order.type === 'pickup' && order.pickupTime && (
          <span className="flex items-center gap-1 text-[11px] text-gray-500">
            <Clock className="size-3 text-gray-400" />
            {formatDate(order.pickupTime)}
          </span>
        )}
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          <CreditCard className="size-3 text-gray-400" />
          {PAYMENT_TYPE_LABEL[order.paymentType] ?? order.paymentType}
        </span>
        <span className="text-[11px] text-gray-400 ml-auto">{formatDate(order.createdAt)}</span>
      </div>

      <div className="mx-4 h-px bg-gray-50" />

      {/* Items list — max 2 */}
      <button onClick={onOpen} disabled={isBusy} className="px-4 py-2.5 text-left space-y-1.5 flex-1">
        {visibleItems.map((item) => {
          const subtitle = buildItemSubtitle(item)
          return (
            <div key={item.id} className="flex items-start gap-2">
              {item.product?.imageUrls?.[0] ? (
                <img
                  src={item.product.imageUrls[0]}
                  alt={item.product.name}
                  className="size-7 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="size-7 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center">
                  <ShoppingBag className="size-3 text-gray-300" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-semibold text-gray-800 truncate">{item.product?.name}</span>
                  <span className="shrink-0 text-[10px] font-bold text-gray-400">×{item.quantity}</span>
                </div>
                {subtitle && (
                  <p className="text-[10px] leading-snug text-gray-400 line-clamp-1">{subtitle}</p>
                )}
              </div>
              <span className="shrink-0 text-xs font-semibold text-gray-600 tabular-nums">
                {fmt(Number(item.price) * item.quantity)}
              </span>
            </div>
          )
        })}
        {hiddenCount > 0 && (
          <p className="text-[10px] font-semibold text-brand/60">+{hiddenCount} món khác →</p>
        )}
      </button>

      {/* Action buttons */}
      {showActions && (
        <>
          <div className="mx-4 h-px bg-gray-50" />
          <div className="flex gap-1.5 px-4 pb-3.5 pt-3 flex-wrap">
            {order.status === 'pending' && (
              <button
                onClick={(e) => { e.stopPropagation(); void onStatusChange(order.id, 'confirmed') }}
                disabled={isBusy}
                className="flex flex-1 items-center justify-center gap-1 rounded-full bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="size-3" /> Xác nhận đơn
              </button>
            )}
            {order.status === 'confirmed' && (
              <button
                onClick={(e) => { e.stopPropagation(); void onStatusChange(order.id, 'preparing') }}
                disabled={isBusy}
                className="flex flex-1 items-center justify-center gap-1 rounded-full bg-violet-50 px-2.5 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors"
              >
                <Clock className="size-3" /> Bắt đầu làm
              </button>
            )}
            {order.status === 'preparing' && (
              <button
                onClick={(e) => { e.stopPropagation(); void onStatusChange(order.id, 'ready') }}
                disabled={isBusy}
                className="flex flex-1 items-center justify-center gap-1 rounded-full bg-teal-50 px-2.5 py-2 text-xs font-bold text-teal-700 hover:bg-teal-100 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="size-3" /> Xong
              </button>
            )}
            {order.status === 'ready' && order.type !== 'delivery' && (
              <button
                onClick={(e) => { e.stopPropagation(); void onStatusChange(order.id, 'completed') }}
                disabled={isBusy}
                className="flex flex-1 items-center justify-center gap-1 rounded-full bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="size-3" /> Hoàn thành
              </button>
            )}
            {order.status === 'ready' && order.type === 'delivery' && (
              <button
                onClick={(e) => { e.stopPropagation(); void onStatusChange(order.id, 'delivering') }}
                disabled={isBusy}
                className="flex flex-1 items-center justify-center gap-1 rounded-full bg-sky-50 px-2.5 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-50 transition-colors"
              >
                <Bike className="size-3" /> Đang giao
              </button>
            )}
            {order.status === 'delivering' && (
              <button
                onClick={(e) => { e.stopPropagation(); void onStatusChange(order.id, 'completed') }}
                disabled={isBusy}
                className="flex flex-1 items-center justify-center gap-1 rounded-full bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="size-3" /> Hoàn thành
              </button>
            )}
            {(['pending', 'confirmed', 'preparing'] as OrderStatus[]).includes(order.status) && (
              <button
                onClick={(e) => { e.stopPropagation(); void onStatusChange(order.id, 'cancelled') }}
                disabled={isBusy}
                className="flex items-center justify-center gap-1 rounded-full bg-red-50 px-2.5 py-2 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
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

// ── Assign Shipper Modal (POS) ──────────────────────────────────────────────

function AssignShipperPosModal({ order, onClose, onConfirm }: {
  order: AdminOrder
  onClose: () => void
  onConfirm: (shipperId: string) => Promise<void>
}) {
  const [shippers, setShippers] = useState<{ id: string; name: string; phone?: string | null }[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loadingShippers, setLoadingShippers] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetchShippers()
      .then(data => { setShippers(data); setLoadingShippers(false) })
      .catch(() => setLoadingShippers(false))
  }, [])

  const handleConfirm = async () => {
    if (!selectedId || busy) return
    setBusy(true)
    try { await onConfirm(selectedId) } catch { /* ignore */ } finally { setBusy(false) }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="font-bold text-gray-900">Gán shipper</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              Đơn <span className="font-mono font-bold text-brand">{order.paymentCode}</span> · Giao hàng
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {loadingShippers ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
              <Loader2 className="size-4 animate-spin" /> Đang tải danh sách…
            </div>
          ) : shippers.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Không có shipper nào đang hoạt động.</p>
          ) : (
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {shippers.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors ${selectedId === s.id
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-gray-50 text-gray-800 hover:bg-gray-100'
                    }`}
                >
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${selectedId === s.id ? 'bg-white/20' : 'bg-gray-200'}`}>
                    <Bike className="size-4" />
                  </div>
                  <span className="flex-1 font-semibold">{s.name}</span>
                  {s.phone && (
                    <span className={`font-mono text-xs ${selectedId === s.id ? 'text-white/70' : 'text-gray-400'}`}>
                      {s.phone}
                    </span>
                  )}
                  {selectedId === s.id && <CheckCircle2 className="size-4 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-gray-100 px-5 py-3.5">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={!selectedId || busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Bike className="size-4" />}
            Gán &amp; Đang giao
          </button>
        </div>
      </div>
    </div>
  )
}
