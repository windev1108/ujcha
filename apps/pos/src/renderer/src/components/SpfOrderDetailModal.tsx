import { ArrowLeft, User, MapPin, Loader2, XCircle, Bike, Clock3, Printer, Tag, CheckCircle2 } from 'lucide-react'
import shopeeFoodLogo from '../assets/shopee-food.png'
import { fmt } from '@/lib/utils'
import { useState } from 'react'
import { printSpfBill, printSpfLabels } from '@/lib/spf-print'

interface SpfOrderItemOption {
    id: number
    name: string
    original_price: number
    discount_price: number
    quantity: number
}
interface SpfOrderItemOptionGroup {
    id: number
    name: string
    options: SpfOrderItemOption[]
}
interface SpfOrderItem {
    id: number
    dish: { name: string; image?: string; discount_price: number; description?: string }
    quantity: number
    discount_price: number
    note?: string
    options_groups: SpfOrderItemOptionGroup[]
}
export interface SpfOrderFull {
    code: string
    id: number
    order_status: number
    order_time: number
    actual_deliver_time?: number
    order_user: { name: string; avatar_url?: string; latest_rating?: number }
    assignee?: { name: string; avatar_url?: string }
    deliver_address: { contact_name: string; address: string }
    order_items: SpfOrderItem[]
    total_dish: number
    order_value_amount: number
    total_value_amount: number
    customer_bill: {
        sub_total: number
        total_amount: number
        shipping_fee: number
        total_discount: number
        packing_fee?: number
        bad_weather_fee?: number
    }
    cancel_info?: { allow_cancel: boolean; reason?: string; type?: number }
    bad_order_note_content?: string | null
    is_asap?: boolean
    shipping_info?: { distance: number }
    [key: string]: unknown
}

function vnTime(ts?: number): string {
    if (!ts) return '—'
    return new Date(ts * 1000).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
}

export function statusInfo(order: SpfOrderFull): { label: string; color: string; dot: string } {
    if (order.order_status === 8 || order.cancel_info?.type) {
        return { label: 'Đã huỷ', color: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-500' }
    }
    if (order.order_status === 7) {
        return { label: 'Hoàn thành', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
    }
    if (order.order_status === 6) {
        return { label: 'Đã lấy hàng', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' }
    }
    if (order.order_status === 5) {
        return { label: 'Đang chuẩn bị', color: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' }
    }
    return { label: 'Đang xử lý', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' }
}

export default function SpfOrderDetailModal({
    code, data, loading, onClose,
}: {
    code: string
    data: SpfOrderFull | null
    loading: boolean
    onClose: () => void
}) {
    const [printingBill, setPrintingBill] = useState(false)
    const [billResult, setBillResult] = useState<{ ok: boolean; msg: string } | null>(null)
    const [printingLabels, setPrintingLabels] = useState(false)
    const [labelsResult, setLabelsResult] = useState<{ ok: boolean; msg: string } | null>(null)

    const handlePrintBill = async () => {
        if (!data) return
        setPrintingBill(true)
        setBillResult(null)
        try {
            const result = await printSpfBill(data)
            setBillResult({ ok: result.ok, msg: result.ok ? 'Đã gửi in hóa đơn' : (result.error ?? 'Lỗi không xác định') })
        } catch (e) {
            setBillResult({ ok: false, msg: String(e) })
        } finally {
            setPrintingBill(false)
        }
    }

    const handlePrintLabels = async () => {
        if (!data) return
        setPrintingLabels(true)
        setLabelsResult(null)
        try {
            const result = await printSpfLabels(data)
            setLabelsResult({ ok: result.ok, msg: result.ok ? 'Đã gửi in tem nhãn' : (result.error ?? 'Lỗi không xác định') })
        } catch (e) {
            setLabelsResult({ ok: false, msg: String(e) })
        } finally {
            setPrintingLabels(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
                    <button
                        onClick={onClose}
                        className="flex items-center justify-center rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    >
                        <ArrowLeft className="size-5" />
                    </button>
                    <img src={shopeeFoodLogo} className="h-5 w-5 object-contain shrink-0" alt="" />
                    <span className="font-mono text-sm font-black text-gray-800 tracking-tight">{code}</span>
                    {data && (() => {
                        const s = statusInfo(data)
                        return (
                            <span className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${s.color}`}>
                                <span className={`size-1.5 rounded-full ${s.dot}`} />
                                {s.label}
                            </span>
                        )
                    })()}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {loading || !data ? (
                        <div className="flex h-48 items-center justify-center gap-2 text-sm text-gray-400">
                            <Loader2 className="size-4 animate-spin" /> Đang tải chi tiết đơn…
                        </div>
                    ) : (
                        <>
                            {/* Cancel banner */}
                            {data.cancel_info?.reason && (
                                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                                    <XCircle className="size-4 shrink-0 text-red-500 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-red-700">Đơn đã bị huỷ</p>
                                        <p className="text-xs text-red-600 mt-0.5">{data.cancel_info.reason}</p>
                                    </div>
                                </div>
                            )}
                            {data.bad_order_note_content && (() => {
                                try {
                                    const parsed = JSON.parse(data.bad_order_note_content) as { vi?: string; en?: string }
                                    return (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                                            ⚠ {parsed.vi ?? parsed.en ?? data.bad_order_note_content}
                                        </div>
                                    )
                                } catch {
                                    return null
                                }
                            })()}

                            {/* Timing */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center gap-1.5 text-gray-500">
                                    <Clock3 className="size-3.5 shrink-0" /> Đặt lúc: <span className="font-semibold text-gray-700">{vnTime(data.order_time)}</span>
                                </div>
                                {data.actual_deliver_time && (
                                    <div className="flex items-center gap-1.5 text-gray-500">
                                        <Bike className="size-3.5 shrink-0" /> Giao lúc: <span className="font-semibold text-gray-700">{vnTime(data.actual_deliver_time)}</span>
                                    </div>
                                )}
                            </div>

                            {/* Customer */}
                            <div className="rounded-xl bg-gray-50 px-3 py-3 space-y-1.5">
                                <div className="flex items-center gap-1.5 text-sm text-gray-800">
                                    <User className="size-3.5 shrink-0 text-gray-400" />
                                    <span className="font-semibold">{data.deliver_address.contact_name || data.order_user.name}</span>
                                </div>
                                <div className="flex items-start gap-1.5 text-xs text-gray-500">
                                    <MapPin className="size-3.5 shrink-0 mt-0.5 text-gray-400" />
                                    <span className="leading-relaxed">{data.deliver_address.address}</span>
                                </div>
                                {data.assignee?.name && (
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <Bike className="size-3.5 shrink-0 text-gray-400" />
                                        Tài xế: <span className="font-medium text-gray-700">{data.assignee.name}</span>
                                    </div>
                                )}
                            </div>

                            {/* Items */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                    Món ({data.total_dish})
                                </p>
                                {data.order_items.map(item => (
                                    <div key={item.id} className="flex items-start gap-2 rounded-xl border border-gray-100 px-3 py-2.5">
                                        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-orange-50 text-[10px] font-bold text-orange-700 mt-0.5">
                                            {item.quantity}×
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-gray-800">{item.dish.name}</p>
                                            {item.options_groups.flatMap(g => g.options.map(o => (
                                                <p key={o.id} className="text-[11px] text-gray-500 mt-0.5">
                                                    + {g.name}: {o.name}{o.discount_price > 0 ? ` (+${fmt(o.discount_price)})` : ''}
                                                </p>
                                            )))}
                                            {item.note && (
                                                <p className="text-[11px] text-amber-600 italic mt-0.5">📝 {item.note}</p>
                                            )}
                                        </div>
                                        <span className="shrink-0 text-xs font-semibold text-gray-600 tabular-nums">
                                            {fmt(item.discount_price)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Bill */}
                            <div className="space-y-1.5 rounded-xl bg-gray-50 px-3 py-3 text-xs">
                                <div className="flex justify-between text-gray-500">
                                    <span>Tạm tính</span><span>{fmt(data.customer_bill.sub_total)}</span>
                                </div>
                                {data.customer_bill.total_discount > 0 && (
                                    <div className="flex justify-between text-emerald-600">
                                        <span>Giảm giá</span><span>-{fmt(data.customer_bill.total_discount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-gray-500">
                                    <span>Phí vận chuyển (khách trả)</span><span>{fmt(data.customer_bill.shipping_fee)}</span>
                                </div>
                                <div className="mt-1 flex justify-between border-t border-gray-200 pt-1.5 text-sm font-black text-gray-800">
                                    <span>Khách thanh toán</span><span>{fmt(data.customer_bill.total_amount)}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <button
                                    onClick={() => void handlePrintBill()}
                                    disabled={printingBill}
                                    className="flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2.5 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
                                >
                                    {printingBill ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />}
                                    {printingBill ? 'Đang in…' : 'In hoá đơn'}
                                </button>
                                <button
                                    onClick={() => void handlePrintLabels()}
                                    disabled={printingLabels}
                                    className="flex items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs font-bold text-orange-700 hover:bg-orange-100 disabled:opacity-60 transition-colors"
                                >
                                    {printingLabels ? <Loader2 className="size-3.5 animate-spin" /> : <Tag className="size-3.5" />}
                                    {printingLabels ? 'Đang in…' : 'In tem nhãn'}
                                </button>
                                {billResult && (
                                    <p className={`col-span-2 text-[11px] font-medium ${billResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {billResult.ok && <CheckCircle2 className="size-3 inline mr-0.5" />}{billResult.msg}
                                    </p>
                                )}
                                {labelsResult && (
                                    <p className={`col-span-2 text-[11px] font-medium ${labelsResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {labelsResult.ok && <CheckCircle2 className="size-3 inline mr-0.5" />}{labelsResult.msg}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}