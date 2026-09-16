import {
    ArrowLeft, X, Printer, Tag, CheckCircle2, Loader2, AlertCircle,
    MapPin, Clock, ShoppingBag, Copy, Check as CheckIcon,
    Star, Box, Circle, Ban, ExternalLink, Phone, User, MoreHorizontal,
    Bike, UtensilsCrossed, Package, Truck, UserPlus, Users, Crown, XCircle, UserCheck, Sparkles,
    Maximize2,
    BanknoteIcon,
    CreditCardIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_BILL_CONFIG, DEFAULT_LABEL_CONFIG, RecipeResolveRequestItem, ResolvedRecipe, ResolvedRecipeMap, type AdminOrder, type OrderStatus } from '../types/common'
import { fetchShippers, assignShipper, updateOrderStatus, fetchShippingEstimate, fetchGroupOrderLive, type GroupOrderLive, API_URL, resolveRecipeBatch } from '../api'
import { io, type Socket } from 'socket.io-client'
import { buildOrderLabels, buildReceiptDocumentHtml, buildKunLoyaltyQrUrl, formatOptionDisplay, buildLabelPickerItems } from '@/lib/receipt-shared'
import { KEYS, loadLocal } from '@/lib/local-storage'
import { formatDate } from '@/lib/utils'
import { BillConfig, LabelConfig } from '../../../preload'
import { getFontBase64 } from '@/lib/font-cache'
import { LabelPickerModal } from './LabelPickerModal'
import { RecipeChecklist } from './RecipeChecklist'
import { useShowRecipe } from '@/hooks/useShowRecipe'
import { RecipeToggleButton } from './RecipeToggleButton'
import { Avatar, Button, Card, Chip, ListBox, Tooltip, Select } from '@heroui/react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eAPI = (window as any).electronAPI as import('../../../preload').ElectronAPI | undefined

function fmt(n: string | number | null | undefined): string {
    const num = Number(n)
    if (Number.isNaN(num)) return '—'
    return num.toLocaleString('vi-VN') + 'đ'
}

function computeSubtotal(items: AdminOrder['items']): number {
    return items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
}

function parseOptionsStr(raw: unknown): string {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ''
    const obj = raw as Record<string, unknown>
    return Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim())
        .map(([k, v]) => formatOptionDisplay(k, String(v)))
        .join(' · ')
}

function parseExtras(raw: unknown): { name: string; price: number }[] {
    if (!Array.isArray(raw)) return []
    return raw
        .filter((x): x is { name: string; price?: number } =>
            x != null && typeof x === 'object' && 'name' in x && typeof (x as { name: unknown }).name === 'string'
        )
        .map(x => ({ name: x.name, price: Number(x.price ?? 0) }))
}

// Detect ordering channel from the "[PLATFORM] name" convention used for
// orders synced in from delivery partners. Falls through to "direct" order.
function detectChannel(order: AdminOrder): { label: string; tone: 'grab' | 'shopee' | 'direct' } {
    const raw = order.guestDeliveryName ?? ''
    const m = raw.match(/^\[([^\]]+)\]/)
    const tag = (m?.[1] ?? '').toUpperCase()
    if (tag.includes('GRAB')) return { label: 'GrabFood', tone: 'grab' }
    if (tag.includes('SHOPEE')) return { label: 'ShopeeFood', tone: 'shopee' }
    return { label: 'Ujcha', tone: 'direct' }
}

const CHANNEL_TONE_CLS: Record<'grab' | 'shopee' | 'direct', string> = {
    grab: 'text-green-600',
    shopee: 'text-orange-600',
    direct: 'text-gray-700',
}

/** Build a keyless Google Maps embed URL — works via the public `output=embed` form. */
function buildMapEmbedUrl(lat?: number | null, lng?: number | null, address?: string | null): string | null {
    if (typeof lat === 'number' && typeof lng === 'number') {
        return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`
    }
    if (address) {
        return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`
    }
    return null
}

type PrintStatus = 'idle' | 'printing' | 'done' | 'error'

// ── Status timeline (vertical) ──────────────────────────────────────────────

const TIMELINE_STEPS_DELIVERY: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'delivering', 'arrived', 'completed']
const TIMELINE_STEPS_OTHER: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'completed']

const STEP_META: Record<OrderStatus, { label: string; desc: string; icon: React.ElementType }> = {
    pending: { label: 'Đặt hàng', desc: 'Đơn hàng đã được tạo', icon: Clock },
    confirmed: { label: 'Đã xác nhận', desc: 'Quán đã xác nhận đơn', icon: CheckCircle2 },
    preparing: { label: 'Đang làm', desc: 'Đang pha chế', icon: Box },
    ready: { label: 'Sẵn sàng', desc: 'Đơn đã sẵn sàng', icon: CheckCircle2 },
    delivering: { label: 'Đang giao', desc: 'Đơn đang được giao', icon: Truck },
    arrived: { label: 'Đã đến nơi', desc: 'Đơn đã đến địa điểm', icon: MapPin },
    completed: { label: 'Hoàn thành', desc: 'Đơn hàng thành công', icon: CheckCircle2 },
    cancelled: { label: 'Đã huỷ', desc: 'Đơn hàng đã bị huỷ', icon: Ban },
}

const STEP_TIME_FIELD: Partial<Record<OrderStatus, keyof AdminOrder>> = {
    pending: 'createdAt',
    confirmed: 'confirmedAt',
    preparing: 'preparingAt',
    ready: 'readyAt',
    delivering: 'deliveringAt',
    arrived: 'arrivedAt',
    completed: 'completedAt',
}

function formatStepTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function StatusTimelineCard({ order }: { order: AdminOrder }) {
    const status = order.status

    if (status === 'cancelled') {
        return (
            <div className="rounded-2xl border border-red-100 bg-white p-4">
                <p className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Trạng thái đơn hàng</p>
                <div className="flex items-center justify-between gap-2.5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3">
                    <div className="flex items-center gap-2.5">
                        <Ban className="size-4 shrink-0 text-red-500" />
                        <p className="text-sm font-semibold text-red-700">Đơn hàng đã bị huỷ</p>
                    </div>
                    {order.cancelledAt && (
                        <span className="text-xs font-medium text-red-500 tabular-nums">{formatStepTime(order.cancelledAt)}</span>
                    )}
                </div>
            </div>
        )
    }

    const steps = order.type === 'delivery' ? TIMELINE_STEPS_DELIVERY : TIMELINE_STEPS_OTHER
    const activeIdx = steps.indexOf(steps.includes(status) ? status : 'pending')

    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Trạng thái đơn hàng</p>
            <div>
                {steps.map((step, i) => {
                    const done = i <= activeIdx
                    const active = i === activeIdx
                    const isLast = i === steps.length - 1
                    const timeField = STEP_TIME_FIELD[step]
                    const timeValue = timeField ? (order[timeField] as string | null | undefined) : undefined

                    return (
                        <div key={step} className="flex gap-3">
                            <div className="flex flex-col items-center">
                                <div className={`flex size-6 shrink-0 items-center justify-center rounded-full transition-colors ${active
                                    ? 'bg-brand text-white ring-4 ring-brand/15'
                                    : done
                                        ? 'bg-brand text-white'
                                        : 'border-2 border-gray-200 bg-white'
                                    }`}>
                                    {done ? <CheckIcon className="size-3" /> : <Circle className="size-1.5 fill-gray-300 text-gray-300" />}
                                </div>
                                {!isLast && (
                                    <div className={`w-0.5 flex-1 min-h-[26px] rounded-full ${i < activeIdx ? 'bg-brand/30' : 'bg-gray-150'}`} />
                                )}
                            </div>
                            <div className="flex flex-1 items-start justify-between gap-2 pb-4">
                                <div>
                                    <p className={`text-md font-bold leading-tight ${done ? 'text-gray-900' : 'text-gray-300'}`}>
                                        {STEP_META[step].label}
                                    </p>
                                    <p className={`text-sm leading-snug ${done ? 'text-gray-400' : 'text-gray-300'}`}>
                                        {STEP_META[step].desc}
                                    </p>
                                </div>
                                {timeValue && (
                                    <span className="shrink-0 text-xs font-medium text-gray-400 tabular-nums">{formatStepTime(timeValue)}</span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ── Item row ───────────────────────────────────────────────────────────────────

function ItemRow({ item, recipe, showRecipe, isFetching }: { item: AdminOrder['items'][number]; recipe?: ResolvedRecipe; showRecipe: boolean, isFetching: boolean }) {
    const optsStr = parseOptionsStr(item.optionsJson)
    const extras = parseExtras(item.extrasJson)
    const lineTotal = Number(item.price) * item.quantity
    const sizeLabel = optsStr.split(' · ').find((s) => /size/i.test(s)) ?? optsStr.split(' · ')[0]

    return (
        <div className="flex flex-col gap-0 px-4 py-3">
            <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                    <div className="flex size-20 items-center justify-center rounded-xl bg-gray-100 ring-1 ring-black/6 overflow-hidden">
                        {item.product?.imageUrls?.[0] ? (
                            <img src={item.product.imageUrls[0]} alt={item.product.name} className="size-full object-cover" />
                        ) : (
                            <ShoppingBag className="size-4 text-gray-300" />
                        )}
                    </div>
                    <span className="absolute -bottom-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-brand text-sm font-black text-white ring-2 ring-white shadow-sm">
                        {item.quantity}
                    </span>
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900 leading-snug text-lg">{item.product?.name}</p>
                        <div className="shrink-0 text-right">
                            <p className="font-semibold text-gray-800 tabular-nums">{fmt(lineTotal)}</p>
                            {item.quantity > 1 && (
                                <p className="text-md text-gray-400 tabular-nums">{fmt(item.price)} / cái</p>
                            )}
                        </div>
                    </div>

                    {(optsStr || extras.length > 0) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {optsStr && optsStr.split(' · ').map((opt, i) => (
                                <span key={i} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-sm font-medium text-gray-600">
                                    {opt}
                                </span>
                            ))}
                            {extras.map((ex, i) => (
                                <span key={i} className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-sm font-medium text-emerald-700">
                                    + {ex.name}
                                    {ex.price > 0 && <span className="text-emerald-500">+{fmt(ex.price)}</span>}
                                </span>
                            ))}
                        </div>
                    )}
                    {item.note && (
                        <p className="mt-1.5 text-sm font-medium text-amber-700">Ghi chú: {item.note}</p>
                    )}
                </div>
            </div>
            {showRecipe && <RecipeChecklist fetching={isFetching} recipe={recipe} quantity={item.quantity} sizeLabel={sizeLabel} />}
        </div>
    )
}

const ORDER_TYPE_LABEL: Record<string, string> = {
    table: 'Tại bàn', delivery: 'Giao hàng', pickup: 'Mang đi',
}
const PAYMENT_TYPE_LABEL: Record<string, string> = {
    cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', card: 'Thẻ ngân hàng',
}

// ─── Main component ────────────────────────────────────────────────────────────

export function OrderDetailModal({
    order,
    isReturning,
    onClose,
    onStatusChange,
    onEdit,
}: {
    order: AdminOrder
    isReturning?: boolean
    onClose: () => void
    onStatusChange?: (id: string, status: OrderStatus) => Promise<void>
    /** Optional — shows the "Chỉnh sửa" header button when provided. */
    onEdit?: (order: AdminOrder) => void
}) {
    const [billCfg, setBillCfg] = useState<BillConfig>(DEFAULT_BILL_CONFIG)
    const [labelCfg, setLabelCfg] = useState<LabelConfig>(DEFAULT_LABEL_CONFIG)
    const [billStatus, setBillStatus] = useState<PrintStatus>('idle')
    const [labelStatus, setLabelStatus] = useState<PrintStatus>('idle')
    const [labelPickerOpen, setLabelPickerOpen] = useState(false)
    const [shippers, setShippers] = useState<{ id: string; name: string; phone?: string | null }[]>([])
    const [selectedShipperId, setSelectedShipperId] = useState(order.shipperId ?? '')
    const [assignBusy, setAssignBusy] = useState(false)
    const [assignDone, setAssignDone] = useState(false)
    const [changingShipper, setChangingShipper] = useState(false)
    const [distanceKm, setDistanceKm] = useState<number | null>(null)
    const [actionBusy, setActionBusy] = useState(false)
    const [localStatus, setLocalStatus] = useState<OrderStatus>(order.status)
    const [groupLive, setGroupLive] = useState<GroupOrderLive | null>(null)
    const groupSocketRef = useRef<Socket | null>(null)
    const [recipeMap, setRecipeMap] = useState<ResolvedRecipeMap>({})
    const { showRecipe, toggle: toggleRecipe } = useShowRecipe()
    const [isFetchingRecipe, setIsFetchingRecipe] = useState(false)

    // ── New for the redesign: print dropdown / "more" menu / fullscreen map ──
    const [printMenuOpen, setPrintMenuOpen] = useState(false)
    const [moreMenuOpen, setMoreMenuOpen] = useState(false)
    const [mapFullscreen, setMapFullscreen] = useState(false)
    const [copiedField, setCopiedField] = useState<'code' | 'phone' | null>(null)
    const headerMenuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const requestItems: RecipeResolveRequestItem[] = order.groupOrder
            ? order.groupOrder.participants.flatMap((p) =>
                p.items.map((it) => ({
                    key: it.id,
                    productId: it.product.id,
                    selectedLabels: [
                        ...Object.values(it.selectedOptions ?? {}).filter((v): v is string => !!v),
                        ...(Array.isArray(it.toppingsJson)
                            ? (it.toppingsJson as Array<{ name?: string }>).map((t) => t.name).filter((n): n is string => !!n)
                            : []),
                    ],
                })),
            )
            : order.items.map((it) => ({
                key: it.id,
                productId: it.product.id,
                selectedLabels: [
                    ...Object.values((it.optionsJson as Record<string, string>) ?? {}).filter(Boolean),
                    ...parseExtras(it.extrasJson).map((e) => e.name),
                ],
            }))

        if (requestItems.length === 0) return
        setIsFetchingRecipe(true)
        void resolveRecipeBatch(requestItems).then(setRecipeMap).catch(() => { }).finally(() => setIsFetchingRecipe(false))
    }, [order.id, order.groupOrder, order.items])

    useEffect(() => {
        setBillCfg(loadLocal<BillConfig>(KEYS.bill, DEFAULT_BILL_CONFIG))
        setLabelCfg(loadLocal<LabelConfig>(KEYS.label, DEFAULT_LABEL_CONFIG))
    }, [])

    useEffect(() => { setLocalStatus(order.status) }, [order.status])

    // Fetch live group order state and subscribe to socket for real-time paid count
    useEffect(() => {
        const token = order.groupOrder?.token
        if (!token || order.groupOrder?.paymentMode !== 'split') return

        void fetchGroupOrderLive(token).then(setGroupLive).catch(() => { })

        const socket = io(`${API_URL}/group`, { transports: ['websocket', 'polling'] })
        groupSocketRef.current = socket
        socket.emit('join-room', { token })
        socket.on('updated', (state: GroupOrderLive) => setGroupLive(state))

        return () => {
            socket.disconnect()
            groupSocketRef.current = null
        }
    }, [order.groupOrder?.token, order.groupOrder?.paymentMode])

    useEffect(() => {
        if (order.type !== 'delivery') return
        void fetchShippers().then(setShippers).catch(() => { })
    }, [order.type])

    useEffect(() => {
        const lat = order.address?.lat
        const lng = order.address?.lng
        if (order.type !== 'delivery' || typeof lat !== 'number' || typeof lng !== 'number') return
        void fetchShippingEstimate(lat, lng)
            .then((r) => setDistanceKm(r.distanceKm))
            .catch(() => { })
    }, [order.type, order.address?.lat, order.address?.lng])

    // Close header dropdowns on outside click / Escape
    useEffect(() => {
        if (!printMenuOpen && !moreMenuOpen) return
        const onDocClick = (e: MouseEvent) => {
            if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
                setPrintMenuOpen(false)
                setMoreMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', onDocClick)
        return () => document.removeEventListener('mousedown', onDocClick)
    }, [printMenuOpen, moreMenuOpen])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return
            if (mapFullscreen) { setMapFullscreen(false); return }
            onClose()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose, mapFullscreen])

    const handleAssignShipper = async () => {
        if (!selectedShipperId) return
        setAssignBusy(true)
        try {
            await assignShipper(order.id, selectedShipperId)
            await updateOrderStatus(order.id, 'delivering')
            setAssignDone(true)
            setTimeout(() => setAssignDone(false), 2500)
        } catch { /* ignore */ } finally {
            setAssignBusy(false)
        }
    }

    async function handlePrintBill() {
        setPrintMenuOpen(false)
        setBillStatus('printing')
        const address = billCfg.address || billCfg.printerId?.replace('manual-', '')
        const printerName = billCfg.printerName || address
        if (!address) { setBillStatus('error'); return }
        try {
            const fontBase64 = await getFontBase64()
            const loyaltyQrUrl = (order.paymentCode && (order.type === 'pickup' || order.type === 'table' || !order.userId))
                ? buildKunLoyaltyQrUrl(order.paymentCode) : undefined
            const html = buildReceiptDocumentHtml(order, loyaltyQrUrl, null, fontBase64)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await (eAPI?.printer as any)?.printBillByAddress(address, printerName, html, billCfg.copies, billCfg) ?? { ok: true }
            setBillStatus(result?.ok === false ? 'error' : 'done')
        } catch {
            setBillStatus('error')
        }
    }

    async function handlePrintLabel(selectedItemIds?: Set<string>) {
        setLabelStatus('printing')
        const address = labelCfg.address || labelCfg.printerId?.replace('manual-', '')
        const printerName = labelCfg.printerName || address
        if (!address) { setLabelStatus('error'); return }
        try {
            const allLabels = buildOrderLabels(order, {
                labelWidth: labelCfg.labelWidth,
                labelHeight: labelCfg.labelHeight,
                showProductName: labelCfg.showProductName,
                showPrice: labelCfg.showPrice,
                showNote: labelCfg.showNote,
                customText: labelCfg.customText,
                lineSpacing: labelCfg.lineSpacing,
                feedAfterCut: labelCfg.feedAfterCut,
                paddingTop: labelCfg.paddingTop,
                paddingBottom: labelCfg.paddingBottom,
                skipItemsWithoutOptions: labelCfg.skipItemsWithoutOptions,
            }, '', selectedItemIds)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await (eAPI?.printer as any)?.printLabelsByAddress(address, printerName, allLabels, labelCfg) ?? { ok: true }
            setLabelStatus(result?.ok === false ? 'error' : 'done')
        } catch {
            setLabelStatus('error')
        }
    }

    const handleModalStatus = async (status: OrderStatus) => {
        if (!onStatusChange || actionBusy) return
        setActionBusy(true)
        try {
            await onStatusChange(order.id, status)
            setLocalStatus(status)
        } catch { /* ignore */ } finally {
            setActionBusy(false)
        }
    }

    async function handleCopy(text: string, field: 'code' | 'phone') {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedField(field)
            setTimeout(() => setCopiedField(f => (f === field ? null : f)), 1500)
        } catch { /* ignore */ }
    }

    const orderRef = order.orderRef ?? order.id
    const subtotal = computeSubtotal(order.items)
    const discount = Number(order.discountAmount) || 0
    const pointDiscount = Number(order.pointDiscountAmount) || 0
    const shippingFee = order.type === 'delivery' ? (Number(order.shippingFee) || 0) : 0
    const vatAmount = Number(order.vatAmount) || 0
    const vatRate = Number(order.vatRate) || 0
    const finalAmount = subtotal - discount - pointDiscount + shippingFee + vatAmount
    const totalQty = order.items.reduce((s, i) => s + i.quantity, 0)

    const isSplitPay = order.groupOrder?.paymentMode === 'split'
    const activeParticipants = order.groupOrder?.participants.filter(p => p.items.length > 0) ?? []
    const allParticipantsPaid = isSplitPay && groupLive !== null && activeParticipants.length > 0
        && activeParticipants.every(p => groupLive.participants.find(lp => lp.id === p.id)?.paymentStatus === 'paid')
    const effectivePaymentStatus = (allParticipantsPaid && order.paymentStatus !== 'paid') ? 'paid' : order.paymentStatus
    const isPaid = effectivePaymentStatus === 'paid'

    const hasBillPrinter = billCfg.enabled && !!(billCfg.address || billCfg.printerId)
    const hasLabelPrinter = labelCfg.enabled && !!(labelCfg.address || labelCfg.printerId)
    const billDisabledReason = !billCfg.enabled ? 'Chưa bật in hóa đơn trong Cài đặt'
        : !(billCfg.address || billCfg.printerId) ? 'Chưa chọn máy in trong Cài đặt' : undefined
    const labelDisabledReason = !labelCfg.enabled ? 'Chưa bật in tem nhãn trong Cài đặt'
        : !(labelCfg.address || labelCfg.printerId) ? 'Chưa chọn máy in nhãn trong Cài đặt' : undefined
    const deliveryName = order.guestDeliveryName ?? order?.user?.name ?? null
    const deliveryPhone = order.guestDeliveryPhone ?? order?.user?.phone ?? null
    const deliveryAddr = order.guestDeliveryAddress ?? order.address?.fullAddress ?? null
    const mapLat = order.address?.lat
    const mapLng = order.address?.lng
    const hasMap = typeof mapLat === 'number' && typeof mapLng === 'number'
    const hasDelivery = order.type === 'delivery' && (deliveryName || deliveryPhone || deliveryAddr)
    const hasPickupContact = order.type === 'pickup' && (deliveryName || deliveryPhone)
    const mapsUrl = deliveryAddr
        ? hasMap
            ? `https://www.google.com/maps?q=${mapLat},${mapLng}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryAddr)}`
        : null
    const mapEmbedUrl = buildMapEmbedUrl(mapLat, mapLng, deliveryAddr)

    const channel = detectChannel(order)
    const cancellable = (['pending', 'confirmed', 'preparing'] as OrderStatus[]).includes(localStatus)
    const staffName = (order as unknown as { confirmedByName?: string; staffName?: string }).staffName
        ?? (order as unknown as { confirmedByName?: string }).confirmedByName

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 animate-in fade-in duration-200">

            {/* ── Header ── */}
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 sm:px-6">
                <button
                    onClick={onClose}
                    className="flex items-center justify-center rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                >
                    <ArrowLeft className="size-5" />
                </button>
                <div className="hidden h-6 w-px bg-gray-200 sm:block" />
                <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-base sm:text-lg font-black text-gray-900">
                        Đơn hàng {order.paymentCode ?? orderRef}
                    </p>
                </div>

                <div ref={headerMenuRef} className="flex shrink-0 items-center gap-2">
                    {/* "..." more menu */}
                    <div className="relative">
                        <button
                            onClick={() => { setMoreMenuOpen(v => !v); setPrintMenuOpen(false) }}
                            className="flex items-center justify-center rounded-full p-2.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        >
                            <MoreHorizontal className="size-4" />
                        </button>
                        {moreMenuOpen && (
                            <div className="absolute right-0 top-full z-10 mt-1.5 w-48 rounded-2xl border border-gray-100 bg-white py-1.5 shadow-xl">
                                <button
                                    onClick={() => { void handleCopy(order.paymentCode ?? order.orderRef ?? order.id, 'code'); setMoreMenuOpen(false) }}
                                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    {copiedField === 'code' ? <CheckIcon className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 text-gray-400" />}
                                    {copiedField === 'code' ? 'Đã sao chép' : 'Sao chép mã đơn'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* "In đơn" print dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => { setPrintMenuOpen(v => !v); setMoreMenuOpen(false) }}
                            className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            <Printer className="size-4" /> In đơn
                        </button>
                        {printMenuOpen && (
                            <div className="absolute right-0 top-full z-10 mt-1.5 w-56 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl">
                                <PrintMenuItem
                                    icon={<Printer className="size-3.5" />}
                                    label="In hóa đơn"
                                    disabled={!hasBillPrinter}
                                    disabledReason={billDisabledReason}
                                    status={billStatus}
                                    onClick={() => void handlePrintBill()}
                                />
                                <PrintMenuItem
                                    icon={<Tag className="size-3.5" />}
                                    label="In tem nhãn"
                                    disabled={!hasLabelPrinter}
                                    disabledReason={labelDisabledReason}
                                    status={labelStatus}
                                    onClick={() => { setPrintMenuOpen(false); setLabelPickerOpen(true) }}
                                />
                            </div>
                        )}
                    </div>

                    {onEdit && (
                        <button
                            onClick={() => onEdit(order)}
                            className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition-opacity"
                        >
                            Chỉnh sửa
                        </button>
                    )}
                </div>
            </div>

            {/* ── Body: 3-column layout ── */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 scrollbar-thin">
                <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-5 lg:grid-cols-[300px_1fr_320px] lg:items-start">

                    {/* Left column */}
                    <div className="space-y-4 lg:order-1">
                        <StatusTimelineCard order={order} />

                        {(hasDelivery || hasPickupContact) && (
                            <div className="rounded-2xl border border-gray-100 bg-white p-4">
                                <p className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Thông tin khách hàng</p>
                                <div className="space-y-2.5">
                                    {deliveryName && (
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2.5 text-sm">
                                                <User className="size-4 shrink-0 text-gray-400" />
                                                <span className="font-semibold text-gray-800">{deliveryName}</span>
                                            </div>
                                            {isReturning === true && (
                                                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                                    <UserCheck className="size-2.5" /> Khách quen
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {deliveryPhone && (
                                        <div className="flex items-center gap-2.5 text-md">
                                            <Phone className="size-4 shrink-0 text-gray-400" />
                                            <span className="font-mono font-medium text-gray-800">{deliveryPhone}</span>
                                            <button
                                                onClick={() => void handleCopy(deliveryPhone, 'phone')}
                                                className="text-gray-300 hover:text-brand transition-colors"
                                                title="Sao chép số điện thoại"
                                            >
                                                {copiedField === 'phone' ? <CheckIcon className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                                            </button>
                                        </div>
                                    )}
                                    {order.type === 'delivery' && deliveryAddr && (
                                        <div className="flex items-start gap-2.5 text-sm">
                                            <MapPin className="size-4 shrink-0 text-gray-400 mt-0.5" />
                                            <span className="leading-snug text-gray-600">{deliveryAddr}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {order.type === 'delivery' && hasMap && mapEmbedUrl && (
                            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                                <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                                    <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Địa điểm giao hàng</p>
                                    <button
                                        onClick={() => setMapFullscreen(true)}
                                        title="Xem toàn màn hình"
                                        className="flex items-center justify-center rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                    >
                                        <Maximize2 className="size-3.5" />
                                    </button>
                                </div>
                                <div className="relative mx-4 mb-3 h-40 overflow-hidden rounded-xl ring-1 ring-gray-200">
                                    <iframe
                                        title="Địa điểm giao hàng"
                                        src={mapEmbedUrl}
                                        className="size-full border-0"
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                    />
                                    <button
                                        onClick={() => setMapFullscreen(true)}
                                        className="absolute inset-0"
                                        aria-label="Mở bản đồ toàn màn hình"
                                    />
                                </div>
                                {deliveryAddr && (
                                    <p className="px-4 pb-1 text-sm leading-snug text-gray-500">{deliveryAddr}</p>
                                )}
                                {distanceKm !== null && (
                                    <p className="px-4 pb-1 text-sm font-medium text-emerald-600">Khoảng cách: {distanceKm.toFixed(1)} km</p>
                                )}
                                {mapsUrl && (
                                    <div className="px-4 pb-3.5 pt-1">
                                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline">
                                            <ExternalLink className="size-3.5" /> Xem trên Google Maps
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}

                        {order.type === 'delivery' && shippers.length > 0 && (
                            <Card>
                                <Card.Header className="flex">
                                    <p className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                        <Bike className="size-3" /> Thông tin tài xế
                                    </p>
                                    {order.shipper && (
                                        <Button
                                            variant="outline"
                                            onPress={() => setChangingShipper(v => !v)}
                                            className="h-6 min-w-0 px-2 mt-2 text-xs font-semibold"
                                        >
                                            {changingShipper ? 'Huỷ' : 'Đổi tài xế'}
                                        </Button>
                                    )}
                                </Card.Header>

                                <Card.Content>
                                    {order.shipper && !changingShipper ? (
                                        <div className="flex items-center gap-3 rounded-xl bg-sky-50 px-3.5 py-3 ring-1 ring-sky-100">
                                            <Avatar size="md">
                                                <Avatar.Fallback className="bg-sky-500 text-white">
                                                    <Bike className="size-5" />
                                                </Avatar.Fallback>
                                            </Avatar>

                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-bold text-sky-900">{order.shipper.name}</p>
                                                <Chip color="default" size="sm" className="mt-0.5">
                                                    <Chip.Label>Đang phụ trách</Chip.Label>
                                                </Chip>
                                            </div>

                                            {order.shipper.phone && (
                                                <Tooltip delay={200}>
                                                    <Tooltip.Trigger aria-label={`Gọi ${order.shipper.phone}`}>
                                                        <Button
                                                            isIconOnly
                                                            variant="outline"
                                                            className="rounded-full bg-white ring-1 ring-sky-200 text-sky-600"
                                                        >
                                                            <Phone className="size-4" />
                                                        </Button>
                                                    </Tooltip.Trigger>
                                                    <Tooltip.Content showArrow>
                                                        <Tooltip.Arrow />
                                                        Gọi {order.shipper.phone}
                                                    </Tooltip.Content>
                                                </Tooltip>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <Select
                                                placeholder="Chọn shipper…"
                                                value={selectedShipperId || null}
                                                onChange={(key) => setSelectedShipperId(key?.toString() ?? '')}
                                                className="flex-1"
                                            >
                                                <Select.Trigger className="rounded-full">
                                                    <Select.Value />
                                                    <Select.Indicator />
                                                </Select.Trigger>
                                                <Select.Popover>
                                                    <ListBox>
                                                        {shippers.map(s => (
                                                            <ListBox.Item key={s.id} id={s.id} textValue={s.name}>
                                                                {s.name}{s.phone ? ` · ${s.phone}` : ''}
                                                                <ListBox.ItemIndicator />
                                                            </ListBox.Item>
                                                        ))}
                                                    </ListBox>
                                                </Select.Popover>
                                            </Select>

                                            <Button
                                                isPending={assignBusy}
                                                isDisabled={!selectedShipperId || assignBusy}
                                                onPress={() => void handleAssignShipper()}
                                                className="shrink-0 rounded-full font-bold"
                                            >
                                                {({ isPending }) => (
                                                    <>
                                                        {isPending
                                                            ? <Loader2 className="size-4 animate-spin" />
                                                            : assignDone ? <CheckCircle2 className="size-4" /> : <UserPlus className="size-4" />}
                                                        {assignDone ? 'Đã gán' : 'Gán'}
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </Card.Content>
                            </Card>
                        )}
                    </div>

                    {/* Middle column: items */}
                    <div className="space-y-4 lg:order-2">
                        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                            <div className="flex items-center justify-between gap-3 border-b border-gray-50 px-4 py-3">
                                <p className="text-md font-bold text-gray-800">Chi tiết món ({totalQty})</p>
                                <RecipeToggleButton show={showRecipe} onToggle={toggleRecipe} />
                            </div>
                            {order.groupOrder ? (
                                <GroupOrderItemsSection
                                    go={order.groupOrder}
                                    totalQty={totalQty}
                                    liveParticipants={groupLive?.participants}
                                    recipeMap={recipeMap}
                                    showRecipe={showRecipe}
                                    isFetching={isFetchingRecipe}
                                />
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {order.items.map((item) => (
                                        <ItemRow key={item.id} isFetching={isFetchingRecipe} item={item} recipe={recipeMap[item.id]} showRecipe={showRecipe} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Note */}
                        <div className="rounded-2xl border border-gray-100 bg-white p-4">
                            <p className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-gray-400">
                                Ghi chú
                            </p>
                            <p className="text-sm text-gray-400">{order.note || 'Không có ghi chú'}</p>
                        </div>
                    </div>

                    {/* Right column: summary */}
                    <div className="space-y-4 lg:order-3 lg:sticky lg:top-0 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pb-2 scrollbar-thin">
                        <div className="rounded-2xl border border-gray-100 bg-white p-4">
                            <p className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Tổng kết đơn hàng</p>
                            <div className="space-y-2.5">
                                <PriceRow label={`Tổng tiền món (${totalQty})`} value={fmt(subtotal)} />
                                <PriceRow
                                    label="Phí giao hàng"
                                    value={order.type === 'delivery' ? (shippingFee > 0 ? fmt(shippingFee) : 'Miễn phí') : fmt(0)}
                                    valueClass={order.type === 'delivery' && shippingFee === 0 ? 'text-brand font-semibold' : undefined}
                                />
                                <PriceRow
                                    label="Giảm giá"
                                    value={discount + pointDiscount > 0 ? `-${fmt(discount + pointDiscount)}` : fmt(0)}
                                    valueClass={discount + pointDiscount > 0 ? 'text-green-600' : undefined}
                                />
                                {vatAmount > 0 && <PriceRow label={`VAT (${vatRate}%)`} value={`+${fmt(vatAmount)}`} valueClass="text-gray-500" />}
                                <div className="flex items-baseline justify-between border-t border-gray-100 pt-2.5">
                                    <span className="text-sm font-bold text-gray-900">Tổng thanh toán</span>
                                    <span className="text-xl font-black text-brand tabular-nums">{fmt(finalAmount)}</span>
                                </div>
                            </div>
                            {(order.pointsConsumed > 0 || order.pointsReserved > 0) && (
                                <div className="mt-3 flex items-center gap-2 rounded-xl bg-purple-50 px-3 py-2 text-xs text-purple-700">
                                    <Star className="size-3.5 shrink-0" />
                                    {order.pointsConsumed > 0 && <span>Đã dùng <strong>{order.pointsConsumed}</strong> điểm</span>}
                                    {order.pointsReserved > 0 && <span className="ml-1">· Giữ <strong>{order.pointsReserved}</strong></span>}
                                </div>
                            )}
                        </div>

                        {isPaid && (
                            <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                                    <CheckCircle2 className="size-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-emerald-800">
                                        Đã thanh toán{order.paidAt ? ` · ${formatStepTime(order.paidAt)}` : ''}
                                    </p>
                                    <p className="text-xs text-emerald-600">
                                        Thanh toán {order?.paymentType === 'cash' ? "bằng" : "qua"} {PAYMENT_TYPE_LABEL[order.paymentType] ?? order.paymentType}
                                        {channel.tone !== 'direct' ? ` · ${channel.label}` : ''}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="rounded-2xl border border-gray-100 bg-white p-4">
                            <p className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Thông tin đơn hàng</p>
                            <div className="space-y-2.5 text-sm">
                                <InfoRow label="Kênh đặt">
                                    <span className={`font-bold ${CHANNEL_TONE_CLS[channel.tone]}`}>{channel.label}</span>
                                </InfoRow>
                                <InfoRow label="Loại đơn">
                                    {ORDER_TYPE_LABEL[order.type] ?? order.type}
                                    {order.type === 'delivery' && order.shipper ? ` - ${order.shipper.name}` : ''}
                                    {order.type === 'table' && order.table?.name ? ` - Bàn ${order.table.name}` : ''}
                                </InfoRow>
                                {order.groupOrder && (
                                    <InfoRow label="Đơn nhóm">
                                        {order.groupOrder.paymentMode === 'split' ? 'Chia tiền' : 'Chủ nhóm trả'}
                                    </InfoRow>
                                )}
                                <InfoRow label="Trạng thái thanh toán">
                                    <PaymentBadge status={effectivePaymentStatus} />
                                </InfoRow>
                                <InfoRow label="Hình thức thanh toán">
                                    <div className="flex items-center gap-2">
                                        {order.paymentType === 'cash' ? <BanknoteIcon className='size-4 text-emerald-500' /> : <CreditCardIcon className='size-4 text-emerald-500' />}
                                        {PAYMENT_TYPE_LABEL[order.paymentType] ?? order.paymentType}
                                    </div>
                                </InfoRow>
                                <InfoRow label="Mã đơn hàng">
                                    <button
                                        onClick={() => void handleCopy(order.paymentCode ?? orderRef, 'code')}
                                        className="flex items-center gap-1 font-mono font-semibold text-gray-800 hover:text-brand transition-colors"
                                    >
                                        {order.paymentCode ?? orderRef}
                                        {copiedField === 'code' ? <CheckIcon className="size-3 text-emerald-500" /> : <Copy className="size-3 text-gray-300" />}
                                    </button>
                                </InfoRow>
                                <InfoRow label="Thời gian đặt">{formatDate(order.createdAt)}</InfoRow>
                                {order.completedAt && <InfoRow label="Thời gian hoàn thành">{formatDate(order.completedAt)}</InfoRow>}
                                {order.completedAt && (
                                    <InfoRow label="Thời gian làm món">
                                        {Math.max(0, Math.round((new Date(order.readyAt).getTime() - new Date(order.preparingAt).getTime()) / 60000))} phút
                                    </InfoRow>
                                )}

                                {order.completedAt && (
                                    <InfoRow label="Thời gian giao">
                                        {Math.max(0, Math.round((new Date(order.completedAt).getTime() - new Date(order.deliveringAt).getTime()) / 60000))} phút
                                    </InfoRow>
                                )}
                                {distanceKm !== null && (
                                    <InfoRow label="Khoảng cách">
                                        {distanceKm.toFixed(1)}km
                                    </InfoRow>

                                )}
                                {staffName && <InfoRow label="Nhân viên xử lý">{staffName}</InfoRow>}
                            </div>
                        </div>

                        {cancellable && onStatusChange && (
                            <button
                                onClick={() => void handleModalStatus('cancelled')}
                                disabled={actionBusy}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                            >
                                {actionBusy ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                                Huỷ đơn hàng
                            </button>
                        )}

                        {onStatusChange && (['pending', 'confirmed', 'preparing', 'ready', 'delivering', 'arrived'] as OrderStatus[]).includes(localStatus) && (
                            <div className="rounded-2xl border border-gray-100 bg-white p-4">
                                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
                                    <Box className="size-3" /> Cập nhật trạng thái
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {localStatus === 'pending' && (
                                        <ActionBtn color="blue" icon={<CheckCircle2 className="size-3.5" />} label="Xác nhận" busy={actionBusy} onClick={() => void handleModalStatus('confirmed')} />
                                    )}
                                    {localStatus === 'confirmed' && (
                                        <ActionBtn color="violet" icon={<Clock className="size-3.5" />} label="Bắt đầu làm" busy={actionBusy} onClick={() => void handleModalStatus('preparing')} />
                                    )}
                                    {localStatus === 'preparing' && (
                                        <ActionBtn color="teal" icon={<CheckCircle2 className="size-3.5" />} label="Xong" busy={actionBusy} onClick={() => void handleModalStatus('ready')} />
                                    )}
                                    {localStatus === 'ready' && order.type !== 'delivery' && (
                                        <ActionBtn color="emerald" icon={<CheckCircle2 className="size-3.5" />} label="Hoàn thành" busy={actionBusy} onClick={() => void handleModalStatus('completed')} />
                                    )}
                                    {localStatus === 'ready' && order.type === 'delivery' && (
                                        <ActionBtn color="sky" icon={<Bike className="size-3.5" />} label="Đang giao" busy={actionBusy} onClick={() => void handleModalStatus('delivering')} />
                                    )}
                                    {(localStatus === 'delivering' || localStatus === 'arrived') && (
                                        <ActionBtn color="emerald" icon={<CheckCircle2 className="size-3.5" />} label="Hoàn thành" busy={actionBusy} onClick={() => void handleModalStatus('completed')} />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Fullscreen map overlay ── */}
            {mapFullscreen && mapEmbedUrl && (
                <div className="fixed inset-0 z-[70] flex flex-col bg-black/90 animate-in fade-in duration-150">
                    <div className="flex h-14 shrink-0 items-center justify-between bg-white px-4">
                        <div className="flex items-center gap-2">
                            <MapPin className="size-4 text-brand" />
                            <p className="text-sm font-semibold text-gray-800 truncate">{deliveryAddr ?? 'Địa điểm giao hàng'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {mapsUrl && (
                                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                                    <ExternalLink className="size-3.5" /> Mở Google Maps
                                </a>
                            )}
                            <button
                                onClick={() => setMapFullscreen(false)}
                                className="flex items-center justify-center rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                    </div>
                    <iframe
                        title="Địa điểm giao hàng — toàn màn hình"
                        src={mapEmbedUrl}
                        className="flex-1 w-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                    />
                </div>
            )}

            {labelPickerOpen && (() => {
                const { items, defaultSelectedIds } = buildLabelPickerItems(order, labelCfg)
                return (
                    <LabelPickerModal
                        items={items}
                        initiallySelectedIds={defaultSelectedIds}
                        onClose={() => setLabelPickerOpen(false)}
                        onConfirm={(ids) => {
                            setLabelPickerOpen(false)
                            void handlePrintLabel(ids)
                        }}
                    />
                )
            })()}
        </div>
    )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-gray-400">{label}</span>
            <span className="text-right text-gray-800">{children}</span>
        </div>
    )
}

function PriceRow({
    label, value, valueClass = 'text-gray-700', icon,
}: {
    label: string; value: string; valueClass?: string; icon?: React.ReactNode
}) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-gray-500">
                {icon} {label}
            </span>
            <span className={`tabular-nums font-medium ${valueClass}`}>{value}</span>
        </div>
    )
}

const BADGE_TONE_CLS: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
    emerald: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    purple: 'bg-purple-100 text-purple-700 ring-purple-200',
    gray: 'bg-gray-100 text-gray-600 ring-gray-200',
}

function Badge({ tone, icon, children }: { tone: keyof typeof BADGE_TONE_CLS; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${BADGE_TONE_CLS[tone]}`}>
            {icon} {children}
        </span>
    )
}

function PaymentBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string }> = {
        paid: { label: 'Đã thanh toán', cls: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
        pending: { label: 'Chưa thanh toán', cls: 'bg-amber-100 text-amber-700 ring-amber-200' },
        failed: { label: 'Thất bại', cls: 'bg-red-100 text-red-600 ring-red-200' },
        refunded: { label: 'Đã hoàn tiền', cls: 'bg-purple-100 text-purple-700 ring-purple-200' },
    }
    const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 ring-gray-200' }
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${s.cls}`}>
            {s.label}
        </span>
    )
}

function PrintMenuItem({ icon, label, status, disabled, disabledReason, onClick }: {
    icon: React.ReactNode; label: string; status: PrintStatus; disabled: boolean; disabledReason?: string; onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={disabledReason}
            className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
            <span className="flex items-center gap-2">{icon} {label}</span>
            {status === 'printing' && <Loader2 className="size-3.5 animate-spin text-amber-500" />}
            {status === 'done' && <CheckCircle2 className="size-3.5 text-emerald-500" />}
            {status === 'error' && <AlertCircle className="size-3.5 text-red-500" />}
        </button>
    )
}

// ─── Group order items ─────────────────────────────────────────────────────────

function GroupOrderItemsSection({
    go,
    totalQty,
    liveParticipants,
    recipeMap, showRecipe,
    isFetching
}: {
    go: NonNullable<AdminOrder['groupOrder']>
    totalQty: number
    liveParticipants?: Array<{ id: string; paymentStatus: 'pending' | 'paid' }>
    recipeMap: ResolvedRecipeMap
    showRecipe: boolean
    isFetching: boolean
}) {
    const withItems = go.participants.filter((p) => p.items.length > 0)
    const paidCount = liveParticipants
        ? liveParticipants.filter((lp) => withItems.some((p) => p.id === lp.id) && lp.paymentStatus === 'paid').length
        : withItems.filter((p) => p.paymentStatus === 'paid').length
    const isSplit = go.paymentMode === 'split'
    return (
        <div>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50/60">
                <Users className="size-4 text-violet-500 shrink-0" />
                <p className="text-sm font-bold tracking-widest text-violet-500">
                    {withItems.length} thành viên · {totalQty} món
                </p>
                <div className="ml-auto flex items-center gap-2">
                    {isSplit && (
                        <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ${paidCount === withItems.length
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-violet-100 text-violet-700'
                            }`}>
                            {paidCount === withItems.length && <CheckCircle2 className="size-3.5" />}
                            {paidCount}/{withItems.length} TT
                        </span>
                    )}
                    <span className="text-sm font-semibold text-violet-400">
                        {isSplit ? 'Chia tiền' : 'Chủ nhóm trả'}
                    </span>
                </div>
            </div>
            <div className="divide-y divide-gray-50">
                {withItems.map((p) => {
                    const memberName = p.user?.name ?? p.guestName ?? 'Khách'
                    const memberSubtotal = p.items.reduce((s, i) => {
                        const toppings = Array.isArray(i.toppingsJson)
                            ? (i.toppingsJson as Array<{ price?: number }>).reduce((ts, t) => ts + Number(t.price ?? 0), 0)
                            : 0
                        return s + (Number(i.unitPrice) + toppings) * i.quantity
                    }, 0)
                    const livePaid = liveParticipants
                        ? liveParticipants.find((lp) => lp.id === p.id)?.paymentStatus === 'paid'
                        : p.paymentStatus === 'paid'
                    return (
                        <div key={p.id}>
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/70">
                                <div className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${p.isHost ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'}`}>
                                    {p.isHost ? <Crown className="size-4" /> : <User className="size-3.5" />}
                                </div>
                                <span className="flex-1 text-sm font-semibold text-gray-700">{memberName}</span>
                                {p.isHost && (
                                    <span className="text-xs font-bold uppercase tracking-wide text-amber-600">Chủ nhóm</span>
                                )}
                                {isSplit && (
                                    livePaid
                                        ? <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                                        : <Loader2 className="size-4 shrink-0 animate-spin text-gray-300" />
                                )}
                                <span className="text-sm font-semibold text-gray-600 tabular-nums">{fmt(memberSubtotal)}</span>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {p.items.map((item) => {
                                    const opts = item.selectedOptions && typeof item.selectedOptions === 'object'
                                        ? Object.entries(item.selectedOptions as Record<string, string>)
                                            .filter(([, v]) => v)
                                            .map(([k, v]) => formatOptionDisplay(k, v))
                                            .join(' · ')
                                        : ''
                                    const toppings = Array.isArray(item.toppingsJson)
                                        ? (item.toppingsJson as Array<{ name?: string; price?: number }>)
                                            .filter((t) => t.name)
                                            .map((t) => t.name!)
                                            .join(', ')
                                        : ''
                                    const toppingSum = Array.isArray(item.toppingsJson)
                                        ? (item.toppingsJson as Array<{ price?: number }>).reduce((s, t) => s + Number(t.price ?? 0), 0)
                                        : 0
                                    const lineTotal = (Number(item.unitPrice) + toppingSum) * item.quantity
                                    return (
                                        <div key={item.id} className="flex flex-col pl-14 pr-4 py-3">
                                            <div className="flex items-start gap-3">
                                                <div className="relative shrink-0">
                                                    <div className="flex size-16 items-center justify-center rounded-xl bg-gray-100 ring-1 ring-black/6 overflow-hidden">
                                                        {item.product.imageUrls?.[0] ? (
                                                            <img src={item.product.imageUrls[0]} alt={item.product.name} className="size-full object-cover" />
                                                        ) : (
                                                            <ShoppingBag className="size-4 text-gray-300" />
                                                        )}
                                                    </div>
                                                    <span className="absolute -bottom-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-brand text-xs font-black text-white ring-2 ring-white shadow-sm">
                                                        {item.quantity}
                                                    </span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="text-sm font-semibold text-gray-800 leading-snug">{item.product.name}</p>
                                                        <p className="shrink-0 text-sm font-semibold text-gray-700 tabular-nums">{fmt(lineTotal)}</p>
                                                    </div>
                                                    {(opts || toppings || item.note) && (
                                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                                            {opts && opts.split(' · ').map((o, i) => (
                                                                <span key={i} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{o}</span>
                                                            ))}
                                                            {toppings && (
                                                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">+{toppings}</span>
                                                            )}
                                                            {item.note && (
                                                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs italic text-amber-700">&ldquo;{item.note}&rdquo;</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {showRecipe && (
                                                <RecipeChecklist fetching={isFetching} recipe={recipeMap[item.id]} quantity={item.quantity} />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Action button ─────────────────────────────────────────────────────────────

type ActionBtnColor = 'blue' | 'violet' | 'teal' | 'emerald' | 'sky' | 'red'

const ACTION_BTN_CLS: Record<ActionBtnColor, string> = {
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
    violet: 'bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200',
    teal: 'bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200',
    emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200',
    sky: 'bg-sky-50 text-sky-700 hover:bg-sky-100 border-sky-200',
    red: 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200',
}

function ActionBtn({ color, icon, label, busy, onClick }: {
    color: ActionBtnColor; icon: React.ReactNode; label: string; busy: boolean; onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            disabled={busy}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${ACTION_BTN_CLS[color]}`}
        >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : icon}
            {label}
        </button>
    )
}