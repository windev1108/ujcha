import {
    X, Printer, Tag, CheckCircle2, Loader2, AlertCircle,
    MapPin, CreditCard, Clock, ShoppingBag, Percent,
    Star, Receipt, Box, Circle, Ban, ExternalLink, Phone, User,
    Bike, UtensilsCrossed, Package, Truck, UserPlus, Users, Crown, XCircle, UserCheck, Sparkles,
} from 'lucide-react'
import { Fragment, useState, useEffect } from 'react'
import { DEFAULT_BILL_CONFIG, DEFAULT_LABEL_CONFIG, type AdminOrder, type OrderStatus } from '../types/common'
import { fetchShippers, assignShipper, updateOrderStatus, fetchShippingEstimate } from '../api'
import { buildOrderLabels, buildReceiptDocumentHtml, buildKunLoyaltyQrUrl } from '@/lib/receipt-shared'
import { KEYS, loadLocal } from '@/lib/local-storage'
import { formatDate } from '@/lib/utils'
import { BillConfig, LabelConfig } from '../../../preload'
import { getFontBase64 } from '@/lib/font-cache'
import { LeafletMap } from './LeafletMap'

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
        .map(([k, v]) => `${k}: ${v}`)
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

type PrintStatus = 'idle' | 'printing' | 'done' | 'error'

// ── Status timeline ────────────────────────────────────────────────────────────

const TIMELINE_STEPS_DELIVERY: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'delivering', 'arrived', 'completed']
const TIMELINE_STEPS_OTHER: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'completed']

const STEP_META: Record<OrderStatus, { label: string; icon: React.ElementType }> = {
    pending: { label: 'Chờ xử lý', icon: Clock },
    confirmed: { label: 'Đã xác nhận', icon: CheckCircle2 },
    preparing: { label: 'Đang làm', icon: Box },
    ready: { label: 'Sẵn sàng', icon: CheckCircle2 },
    delivering: { label: 'Đang giao', icon: Truck },
    arrived: { label: 'Đã đến nơi', icon: MapPin },
    completed: { label: 'Hoàn thành', icon: CheckCircle2 },
    cancelled: { label: 'Đã huỷ', icon: Ban },
}

function StatusTimeline({ status, orderType }: { status: OrderStatus; orderType: string }) {
    if (status === 'cancelled') {
        return (
            <div className="flex items-center gap-2.5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                <Ban className="size-4 shrink-0 text-red-500" />
                <p className="text-sm font-semibold text-red-700">Đơn hàng đã bị huỷ</p>
            </div>
        )
    }

    const steps = orderType === 'delivery' ? TIMELINE_STEPS_DELIVERY : TIMELINE_STEPS_OTHER
    const activeIdx = steps.indexOf(steps.includes(status) ? status : 'pending')

    return (
        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-4">
            <div className="flex items-start">
                {steps.map((step, i) => {
                    const done = i <= activeIdx
                    const active = i === activeIdx
                    const isLast = i === steps.length - 1
                    const StepIcon = STEP_META[step].icon

                    return (
                        <Fragment key={step}>
                            <div className="flex flex-1 flex-col items-center gap-2">
                                <div className={`relative flex size-9 items-center justify-center rounded-full transition-all duration-300 ${active
                                    ? 'bg-brand text-white shadow-lg shadow-brand/30 ring-4 ring-brand/15'
                                    : done
                                        ? 'bg-brand/12 text-brand'
                                        : 'border-2 border-gray-200 bg-white text-gray-300'
                                    }`}>
                                    {active && (
                                        <span className="absolute inset-0 rounded-full bg-brand animate-ping opacity-20" />
                                    )}
                                    {done
                                        ? active
                                            ? <StepIcon className="size-4" />
                                            : <CheckCircle2 className="size-4" />
                                        : <Circle className="size-3.5 opacity-50" />
                                    }
                                </div>
                                <p className={`text-center text-[10px] font-semibold leading-tight ${active ? 'text-brand' : done ? 'text-gray-500' : 'text-gray-300'
                                    }`}>
                                    {STEP_META[step].label}
                                </p>
                            </div>
                            {!isLast && (
                                <div className={`mt-[18px] h-0.5 flex-1 rounded-full transition-all duration-500 ${i < activeIdx ? 'bg-brand/30' : 'bg-gray-200'
                                    }`} />
                            )}
                        </Fragment>
                    )
                })}
            </div>
        </div>
    )
}

// ── Item row ───────────────────────────────────────────────────────────────────

function ItemRow({ item }: { item: AdminOrder['items'][number] }) {
    const optsStr = parseOptionsStr(item.optionsJson)
    const extras = parseExtras(item.extrasJson)
    const lineTotal = Number(item.price) * item.quantity

    return (
        <div className="flex items-start gap-3 px-4 py-3">
            <div className="relative shrink-0 size-11">
                {item.product.imageUrls?.[0] ? (
                    <img src={item.product.imageUrls[0]} alt={item.product.name} className="size-11 rounded-xl object-cover ring-1 ring-black/6" />
                ) : (
                    <div className="size-11 rounded-xl bg-gray-100 flex items-center justify-center ring-1 ring-black/6">
                        <ShoppingBag className="size-4 text-gray-300" />
                    </div>
                )}
                <span className="absolute -bottom-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-brand text-[10px] font-black text-white ring-2 ring-white shadow-sm">
                    {item.quantity}
                </span>
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 leading-snug">{item.product?.name}</p>
                    <div className="shrink-0 text-right">
                        <p className="font-semibold text-gray-800 tabular-nums">{fmt(lineTotal)}</p>
                        {item.quantity > 1 && (
                            <p className="text-[11px] text-gray-400 tabular-nums">{fmt(item.price)} / cái</p>
                        )}
                    </div>
                </div>

                {(optsStr || extras.length > 0) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                        {optsStr && optsStr.split(' · ').map((opt, i) => (
                            <span key={i} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                                {opt}
                            </span>
                        ))}
                        {extras.map((ex, i) => (
                            <span key={i} className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                + {ex.name}
                                {ex.price > 0 && <span className="text-emerald-500">+{fmt(ex.price)}</span>}
                            </span>
                        ))}
                    </div>
                )}
                {item.note && (
                    <p className="mt-1.5 text-[11px] font-medium text-amber-700">Ghi chú: {item.note}</p>
                )}
            </div>
        </div>
    )
}

const ORDER_TYPE_LABEL: Record<string, string> = {
    table: 'Tại bàn', delivery: 'Giao hàng', pickup: 'Mang về',
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
}: {
    order: AdminOrder
    isReturning?: boolean
    onClose: () => void
    onStatusChange?: (id: string, status: OrderStatus) => Promise<void>
}) {
    const [billCfg, setBillCfg] = useState<BillConfig>(DEFAULT_BILL_CONFIG)
    const [labelCfg, setLabelCfg] = useState<LabelConfig>(DEFAULT_LABEL_CONFIG)
    const [billStatus, setBillStatus] = useState<PrintStatus>('idle')
    const [labelStatus, setLabelStatus] = useState<PrintStatus>('idle')

    const [shippers, setShippers] = useState<{ id: string; name: string; phone?: string | null }[]>([])
    const [selectedShipperId, setSelectedShipperId] = useState(order.shipperId ?? '')
    const [assignBusy, setAssignBusy] = useState(false)
    const [assignDone, setAssignDone] = useState(false)
    const [distanceKm, setDistanceKm] = useState<number | null>(null)
    const [actionBusy, setActionBusy] = useState(false)
    const [localStatus, setLocalStatus] = useState<OrderStatus>(order.status)

    useEffect(() => {
        setBillCfg(loadLocal<BillConfig>(KEYS.bill, DEFAULT_BILL_CONFIG))
        setLabelCfg(loadLocal<LabelConfig>(KEYS.label, DEFAULT_LABEL_CONFIG))
    }, [])

    useEffect(() => { setLocalStatus(order.status) }, [order.status])

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

    async function handlePrintLabel() {
        setLabelStatus('printing')
        const address = labelCfg.address || labelCfg.printerId?.replace('manual-', '')
        const printerName = labelCfg.printerName || address
        if (!address) { setLabelStatus('error'); return }
        try {
            const fontBase64 = await getFontBase64()
            const allLabels = buildOrderLabels(order, {
                labelWidth: labelCfg.labelWidth,
                showProductName: labelCfg.showProductName,
                showPrice: labelCfg.showPrice,
                showNote: labelCfg.showNote,
                customText: labelCfg.customText,
                lineSpacing: labelCfg.lineSpacing,
                feedAfterCut: labelCfg.feedAfterCut,
                paddingTop: labelCfg.paddingTop,
                paddingBottom: labelCfg.paddingBottom,
            }, fontBase64)
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

    const orderRef = order.orderRef ?? order.id
    const subtotal = computeSubtotal(order.items)
    const discount = Number(order.discountAmount) || 0
    const pointDiscount = Number(order.pointDiscountAmount) || 0
    const shippingFee = order.type === 'delivery' ? (Number(order.shippingFee) || 0) : 0
    const vatAmount = Number(order.vatAmount) || 0
    const vatRate = Number(order.vatRate) || 0
    const finalAmount = subtotal - discount - pointDiscount + shippingFee + vatAmount
    const totalQty = order.items.reduce((s, i) => s + i.quantity, 0)
    const isPaid = order.paymentStatus === 'paid'

    const hasBillPrinter = billCfg.enabled && !!(billCfg.address || billCfg.printerId)
    const hasLabelPrinter = labelCfg.enabled && !!(labelCfg.address || labelCfg.printerId)

    const billDisabledReason = !billCfg.enabled ? 'Chưa bật in hóa đơn trong Cài đặt'
        : !(billCfg.address || billCfg.printerId) ? 'Chưa chọn máy in trong Cài đặt' : undefined

    const labelDisabledReason = !labelCfg.enabled ? 'Chưa bật in tem nhãn trong Cài đặt'
        : !(labelCfg.address || labelCfg.printerId) ? 'Chưa chọn máy in nhãn trong Cài đặt' : undefined

    const deliveryName = order.guestDeliveryName ?? null
    const deliveryPhone = order.guestDeliveryPhone ?? null
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

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="relative flex w-full sm:max-w-3xl flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl max-h-[94vh] sm:max-h-[92vh] overflow-hidden">

                {/* Drag handle (mobile) */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="h-1 w-10 rounded-full bg-gray-200" />
                </div>

                {/* Header */}
                <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4 shrink-0">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <p className="font-mono text-lg font-black text-brand leading-tight">{order.paymentCode ?? orderRef}</p>
                            {order.groupOrder && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200">
                                    <Users className="size-3" /> Đơn nhóm
                                </span>
                            )}
                            <PaymentBadge status={order.paymentStatus} />
                            {isReturning === true && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                                    <UserCheck className="size-3" /> Khách quen
                                </span>
                            )}
                            {isReturning === false && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold text-violet-600 ring-1 ring-violet-200">
                                    <Sparkles className="size-3" /> Khách mới
                                </span>
                            )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            {order.type === 'delivery' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                                    <Bike className="size-3" />
                                    Giao hàng{order.shipper ? ` · ${order.shipper.name}` : ''}
                                </span>
                            )}
                            {order.type === 'table' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                                    <UtensilsCrossed className="size-3" />
                                    {order.table?.name ? `Bàn ${order.table.name}` : 'Tại bàn'}
                                </span>
                            )}
                            {order.type === 'pickup' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
                                    <Package className="size-3" />
                                    Mang về{order.pickupTime ? ` · ${formatDate(order.pickupTime)}` : ''}
                                </span>
                            )}
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                                <CreditCard className="size-3" />
                                {PAYMENT_TYPE_LABEL[order.paymentType] ?? order.paymentType}
                            </span>
                            {order.paidAt && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                    <CheckCircle2 className="size-3" />
                                    Đã TT · {formatDate(order.paidAt)}
                                </span>
                            )}
                            <span className="text-xs text-gray-400">{formatDate(order.createdAt)}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="ml-3 shrink-0 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                        <X className="size-5" />
                    </button>
                </div>

                {/* Body — 2-column on sm+ */}
                <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">

                    {/* Status timeline — full width at top */}
                    <div className="px-6 pt-4 pb-3 border-b border-gray-100">
                        <StatusTimeline status={order.status} orderType={order.type} />
                    </div>

                    <div className="px-6 py-4 space-y-4">

                        {/* Delivery info */}
                        {hasDelivery && (
                            <div className="rounded-2xl border border-sky-200 bg-sky-50/50 overflow-hidden">
                                <p className="px-4 pt-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-sky-500">
                                    Thông tin giao hàng
                                </p>
                                <div className="px-4 pb-3 space-y-2">
                                    {deliveryName && (
                                        <div className="flex items-center gap-2.5 text-sm">
                                            <User className="size-4 shrink-0 text-sky-500" />
                                            <span className="font-semibold text-gray-800">{deliveryName}</span>
                                        </div>
                                    )}
                                    {deliveryPhone && (
                                        <div className="flex items-center gap-2.5 text-sm">
                                            <Phone className="size-4 shrink-0 text-sky-500" />
                                            <span className="font-mono font-medium text-gray-800">{deliveryPhone}</span>
                                        </div>
                                    )}
                                    {deliveryAddr && (
                                        <div className="flex items-start gap-2.5 text-sm">
                                            <MapPin className="size-4 shrink-0 text-sky-500 mt-0.5" />
                                            <span className="text-gray-700 leading-snug">{deliveryAddr}</span>
                                        </div>
                                    )}
                                </div>
                                {hasMap && (
                                    <div className="h-44 mx-4 mb-3 overflow-hidden rounded-xl ring-1 ring-sky-200">
                                        <LeafletMap lat={mapLat} lng={mapLng} address={deliveryAddr ?? undefined} />
                                    </div>
                                )}
                                {mapsUrl && (
                                    <div className="px-4 pb-3">
                                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:underline">
                                            <ExternalLink className="size-3.5" />
                                            Xem trên Google Maps
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Pickup contact */}
                        {hasPickupContact && (
                            <div className="rounded-2xl border border-violet-200 bg-violet-50/50 overflow-hidden">
                                <p className="px-4 pt-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-violet-500">
                                    Thông tin người nhận
                                </p>
                                <div className="px-4 pb-3 space-y-2">
                                    {deliveryName && (
                                        <div className="flex items-center gap-2.5 text-sm">
                                            <User className="size-4 shrink-0 text-violet-500" />
                                            <span className="font-semibold text-gray-800">{deliveryName}</span>
                                        </div>
                                    )}
                                    {deliveryPhone && (
                                        <div className="flex items-center gap-2.5 text-sm">
                                            <Phone className="size-4 shrink-0 text-violet-500" />
                                            <span className="font-mono font-medium text-gray-800">{deliveryPhone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Items */}
                        {order.groupOrder ? (
                            <GroupOrderItemsSection go={order.groupOrder} totalQty={totalQty} />
                        ) : (
                            <div className="rounded-2xl border border-gray-100 overflow-hidden">
                                <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                    Món đặt · {totalQty} món
                                </p>
                                <div className="divide-y divide-gray-50">
                                    {order.items.map((item) => (
                                        <ItemRow key={item.id} item={item} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Shipper assignment */}
                        {order.type === 'delivery' && shippers.length > 0 && (
                            <div className="rounded-2xl border border-gray-100 overflow-hidden">
                                <p className="px-4 pt-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                    <Bike className="size-3" /> Shipper
                                </p>
                                {order.shipper && (
                                    <div className="px-4 pb-2 flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200">
                                            <Bike className="size-3" />{order.shipper.name}
                                        </span>
                                        <span className="text-[10px] text-gray-400">đang phụ trách</span>
                                    </div>
                                )}
                                <div className="px-4 pb-3 flex gap-2">
                                    <select
                                        value={selectedShipperId}
                                        onChange={e => setSelectedShipperId(e.target.value)}
                                        className="flex-1 min-w-0 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                                    >
                                        <option value="">Chọn shipper…</option>
                                        {shippers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ''}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => void handleAssignShipper()}
                                        disabled={!selectedShipperId || assignBusy}
                                        className="shrink-0 flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-sm font-bold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                                    >
                                        {assignBusy ? <Loader2 className="size-4 animate-spin" /> : assignDone ? <CheckCircle2 className="size-4" /> : <UserPlus className="size-4" />}
                                        {assignDone ? 'Đã gán' : 'Gán'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Pricing */}
                        <div className="rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="px-4 py-3.5 space-y-2.5 bg-gray-50/80">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Thanh toán</p>
                                <PriceRow label="Tạm tính" value={fmt(subtotal)} />
                                {discount > 0 && (
                                    <PriceRow label="Giảm giá" value={`-${fmt(discount)}`} valueClass="text-green-600" icon={<Percent className="size-3" />} />
                                )}
                                {pointDiscount > 0 && (
                                    <PriceRow label="Giảm điểm" value={`-${fmt(pointDiscount)}`} valueClass="text-purple-600" icon={<Star className="size-3" />} />
                                )}
                                {order.type === 'delivery' && (
                                    <PriceRow
                                        label={distanceKm !== null ? `Phí giao · ${distanceKm.toFixed(1)} km` : 'Phí giao hàng'}
                                        value={shippingFee > 0 ? fmt(shippingFee) : 'Miễn phí'}
                                        valueClass={shippingFee > 0 ? 'text-gray-700' : 'text-brand font-semibold'}
                                    />
                                )}
                                {vatAmount > 0 && (
                                    <PriceRow label={`VAT (${vatRate}%)`} value={`+${fmt(vatAmount)}`} valueClass="text-gray-500" />
                                )}
                                <div className="flex items-baseline justify-between border-t border-gray-200 pt-2.5">
                                    <span className="font-bold text-gray-900 text-sm">Tổng cộng</span>
                                    <span className="text-xl font-black text-brand tabular-nums">{fmt(finalAmount)}</span>
                                </div>
                            </div>
                            {(order.pointsConsumed > 0 || order.pointsReserved > 0) && (
                                <div className="border-t border-gray-100 bg-purple-50 px-4 py-2.5 flex items-center gap-2 text-xs text-purple-700">
                                    <Star className="size-3.5 shrink-0" />
                                    {order.pointsConsumed > 0 && <span>Đã dùng <strong>{order.pointsConsumed}</strong> điểm</span>}
                                    {order.pointsReserved > 0 && <span className="ml-1">· Giữ <strong>{order.pointsReserved}</strong></span>}
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                {/* Footer: actions + print */}
                <div className="border-t border-gray-100 bg-gray-50/60 px-6 py-4 shrink-0 space-y-3">
                    {onStatusChange && (['pending', 'confirmed', 'preparing', 'ready', 'delivering', 'arrived'] as OrderStatus[]).includes(localStatus) && (
                        <div>
                            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
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
                                {(['pending', 'confirmed', 'preparing'] as OrderStatus[]).includes(localStatus) && (
                                    <ActionBtn color="red" icon={<XCircle className="size-3.5" />} label="Huỷ đơn" busy={actionBusy} onClick={() => void handleModalStatus('cancelled')} />
                                )}
                            </div>
                        </div>
                    )}
                    <div>
                        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            <Receipt className="size-3" /> In ấn
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <PrintButton
                                icon={<Printer className="size-4" />}
                                label="In hóa đơn"
                                subLabel={billCfg.copies > 1 ? `${billCfg.copies} bản` : undefined}
                                status={billStatus}
                                disabled={!hasBillPrinter}
                                disabledReason={billDisabledReason}
                                onPrint={() => void handlePrintBill()}
                                onRetry={() => setBillStatus('idle')}
                            />
                            <PrintButton
                                icon={<Tag className="size-4" />}
                                label="In tem nhãn"
                                subLabel={`${totalQty} tem`}
                                status={labelStatus}
                                disabled={!hasLabelPrinter}
                                disabledReason={labelDisabledReason}
                                onPrint={() => void handlePrintLabel()}
                                onRetry={() => setLabelStatus('idle')}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

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

// ─── Group order items ─────────────────────────────────────────────────────────

function GroupOrderItemsSection({
    go,
    totalQty,
}: {
    go: NonNullable<AdminOrder['groupOrder']>
    totalQty: number
}) {
    const withItems = go.participants.filter((p) => p.items.length > 0)
    return (
        <div className="rounded-2xl border border-violet-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 bg-violet-50/60">
                <Users className="size-3.5 text-violet-500 shrink-0" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">
                    Đơn nhóm · {withItems.length} thành viên · {totalQty} món
                </p>
                <span className="ml-auto text-[10px] font-semibold text-violet-400">
                    {go.paymentMode === 'split' ? 'Chia tiền' : 'Chủ nhóm trả'}
                </span>
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
                    return (
                        <div key={p.id}>
                            {/* Participant header */}
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/70">
                                <div className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${p.isHost ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'}`}>
                                    {p.isHost ? <Crown className="size-3.5" /> : <User className="size-3" />}
                                </div>
                                <span className="flex-1 text-xs font-semibold text-gray-700">{memberName}</span>
                                {p.isHost && (
                                    <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600">Chủ nhóm</span>
                                )}
                                <span className="text-xs font-semibold text-gray-600 tabular-nums">{fmt(memberSubtotal)}</span>
                            </div>
                            {/* Participant items */}
                            <div className="divide-y divide-gray-50">
                                {p.items.map((item) => {
                                    const opts = item.selectedOptions && typeof item.selectedOptions === 'object'
                                        ? Object.entries(item.selectedOptions as Record<string, string>)
                                            .filter(([, v]) => v)
                                            .map(([k, v]) => `${k}: ${v}`)
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
                                        <div key={item.id} className="flex items-start gap-3 pl-12 pr-4 py-2.5">
                                            {item.product.imageUrls?.[0] ? (
                                                <img src={item.product.imageUrls[0]} alt={item.product.name} className="size-9 shrink-0 rounded-lg object-cover ring-1 ring-black/6" />
                                            ) : (
                                                <div className="size-9 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center ring-1 ring-black/6">
                                                    <ShoppingBag className="size-3.5 text-gray-300" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-xs font-semibold text-gray-800 leading-snug">{item.product.name}</p>
                                                    <div className="shrink-0 text-right">
                                                        <p className="text-xs font-semibold text-gray-700 tabular-nums">{fmt(lineTotal)}</p>
                                                        <span className="text-[10px] font-bold text-gray-400">×{item.quantity}</span>
                                                    </div>
                                                </div>
                                                {(opts || toppings || item.note) && (
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {opts && opts.split(' · ').map((o, i) => (
                                                            <span key={i} className="rounded-full bg-gray-100 px-2 py-px text-[10px] text-gray-500">{o}</span>
                                                        ))}
                                                        {toppings && (
                                                            <span className="rounded-full bg-emerald-50 px-2 py-px text-[10px] text-emerald-700">+{toppings}</span>
                                                        )}
                                                        {item.note && (
                                                            <span className="rounded-full bg-amber-50 px-2 py-px text-[10px] italic text-amber-700">&ldquo;{item.note}&rdquo;</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
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
    blue:    'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
    violet:  'bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200',
    teal:    'bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200',
    emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200',
    sky:     'bg-sky-50 text-sky-700 hover:bg-sky-100 border-sky-200',
    red:     'bg-red-50 text-red-600 hover:bg-red-100 border-red-200',
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

function PrintButton({ icon, label, subLabel, status, disabled, disabledReason, onPrint, onRetry }: {
    icon: React.ReactNode; label: string; subLabel?: string
    status: PrintStatus; disabled: boolean; disabledReason?: string
    onPrint: () => void; onRetry: () => void
}) {
    if (status === 'printing') return (
        <div className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-full border border-gray-100 bg-gray-50 text-xs text-amber-600">
            <Loader2 className="size-4 animate-spin" /><span>Đang in…</span>
        </div>
    )
    if (status === 'done') return (
        <button onClick={onRetry} className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
            <CheckCircle2 className="size-4" /><span>Đã in · In lại</span>
        </button>
    )
    if (status === 'error') return (
        <button onClick={onRetry} className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-full border border-red-200 bg-red-50 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors">
            <AlertCircle className="size-4" /><span>Lỗi · Thử lại</span>
        </button>
    )
    return (
        <button
            onClick={onPrint} disabled={disabled} title={disabledReason}
            className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-full border border-gray-200 bg-white text-xs font-semibold text-gray-700 transition-colors hover:border-brand hover:bg-brand/5 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:bg-white disabled:hover:text-gray-700"
        >
            <span className="flex items-center gap-1.5">{icon} {label}</span>
            {subLabel && <span className="text-[10px] font-normal text-gray-400">{subLabel}</span>}
        </button>
    )
}
