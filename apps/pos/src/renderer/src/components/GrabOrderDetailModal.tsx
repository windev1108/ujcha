import { GRAB_STATUS_COLOR, GRAB_STATUS_DOT, GRAB_STATUS_LABEL } from "@/lib/constants";
import { GrabFull, grabFullToAdminOrder, printGrabBill, printGrabLabels } from "@/lib/grab-print"
import { KEYS, loadLocal } from "@/lib/local-storage";
import { DEFAULT_BILL_CONFIG, DEFAULT_LABEL_CONFIG } from "@/types/common";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, PackageCheck, Phone, Printer, Receipt, Tag, User, X } from "lucide-react";
import { useState } from "react"
import { BillConfig, LabelConfig } from "src/preload";
import grabFoodLogo from '../assets/grab-food.png'
import { fmt, formatDate } from "@/lib/utils";

function Row({ label, value, green, bold }: { label: string; value: string; green?: boolean; bold?: boolean }) {
    return (
        <div className={`flex justify-between ${bold ? 'font-bold text-gray-800' : ''}`}>
            <span>{label}</span>
            <span className={green ? 'text-green-600' : ''}>{value}đ</span>
        </div>
    )
}

// ─── Print Button ─────────────────────────────────────────────────────────────

type PrintStatus = 'idle' | 'printing' | 'done' | 'error'

function PrintButton({ icon, label, subLabel, status, disabled, disabledReason, onPrint, onRetry }: {
    icon: React.ReactNode; label: string; subLabel?: string
    status: PrintStatus; disabled: boolean; disabledReason?: string
    onPrint: () => void; onRetry: () => void
}) {
    if (status === 'printing') return (
        <div className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border border-gray-100 bg-gray-50 text-xs text-amber-600">
            <Loader2 className="size-4 animate-spin" /><span>Đang in…</span>
        </div>
    )
    if (status === 'done') return (
        <button onClick={onRetry} className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border border-green-200 bg-green-50 text-xs font-semibold text-green-700 hover:bg-green-100">
            <CheckCircle2 className="size-4" /><span>Đã in · In lại</span>
        </button>
    )
    if (status === 'error') return (
        <button onClick={onRetry} className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-600 hover:bg-red-100">
            <AlertCircle className="size-4" /><span>Lỗi · Thử lại</span>
        </button>
    )
    return (
        <button
            onClick={onPrint} disabled={disabled} title={disabledReason}
            className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 transition hover:border-brand hover:bg-brand/5 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:bg-white disabled:hover:text-gray-700"
        >
            <span className="flex items-center gap-1.5">{icon} {label}</span>
            {subLabel && <span className="text-[10px] font-normal text-gray-400">{subLabel}</span>}
        </button>
    )
}

export default function GrabOrderDetailModal({
    id, data, loading, preparationTaskID, markingReady, markReadyResult, onMarkReady, onClose,
}: {
    id: string
    data: GrabFull | null
    loading: boolean
    preparationTaskID?: string
    markingReady?: boolean
    markReadyResult?: { ok: boolean; msg: string }
    onMarkReady?: () => void
    onClose: () => void
}) {
    const [fareOpen, setFareOpen] = useState(false)
    const [billStatus, setBillStatus] = useState<PrintStatus>('idle')
    const [labelStatus, setLabelStatus] = useState<PrintStatus>('idle')

    const billCfg = loadLocal<BillConfig>(KEYS.bill, DEFAULT_BILL_CONFIG)
    const labelCfg = loadLocal<LabelConfig>(KEYS.label, DEFAULT_LABEL_CONFIG)
    const hasBillPrinter = billCfg.enabled && !!(billCfg.address || billCfg.printerId)
    const hasLabelPrinter = labelCfg.enabled && !!(labelCfg.address || labelCfg.printerId)

    const billDisabledReason = !billCfg.enabled
        ? 'Chưa bật in hóa đơn trong Cài đặt'
        : !(billCfg.address || billCfg.printerId)
            ? 'Chưa chọn máy in trong Cài đặt'
            : undefined

    const labelDisabledReason = !labelCfg.enabled
        ? 'Chưa bật in tem nhãn trong Cài đặt'
        : !(labelCfg.address || labelCfg.printerId)
            ? 'Chưa chọn máy in nhãn trong Cài đặt'
            : undefined

    async function handlePrintBill() {
        if (!data) return
        setBillStatus('printing')
        const adminOrder = grabFullToAdminOrder(data)
        const res = await printGrabBill(adminOrder)
        setBillStatus(res.ok ? 'done' : 'error')
    }

    async function handlePrintLabel() {
        if (!data) return
        setLabelStatus('printing')
        const adminOrder = grabFullToAdminOrder(data)
        const res = await printGrabLabels(adminOrder)
        setLabelStatus(res.ok ? 'done' : 'error')
    }

    const totalQty = data?.itemInfo.items.reduce((s, i) => s + i.quantity, 0) ?? 0

    const status = data?.state?.toUpperCase() ?? ''
    const label = status === 'ORDER_IN_PREPARE' && preparationTaskID ? 'Sẵn sàng' : GRAB_STATUS_LABEL[status] ?? status
    const color = GRAB_STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'
    const dot = GRAB_STATUS_DOT[status] ?? 'bg-gray-400'

    // Suppress unused var warning — id is used for key tracking in parent
    void id
    void preparationTaskID

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-in fade-in duration-150">
            <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <div className="flex items-center gap-2.5">
                        <img src={grabFoodLogo} className="h-6 w-6 object-contain" alt="" />
                        {data && (
                            <p className="text-lg font-bold">{data.displayID}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {data && (
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${color}`}>
                                <span className={`size-1.5 rounded-full ${dot}`} />
                                {label}
                            </span>
                        )}
                        <button onClick={onClose} className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                            <X className="size-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex h-48 items-center justify-center gap-2 text-sm text-gray-400">
                            <Loader2 className="size-5 animate-spin" /> Đang tải chi tiết…
                        </div>
                    ) : !data ? (
                        <div className="flex h-48 flex-col items-center justify-center gap-2 text-gray-400">
                            <p className="text-sm">Không lấy được chi tiết đơn</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">

                            {/* Eater info */}
                            {(data.eater.name || data.eater.comment) && (
                                <div className="px-5 py-4 space-y-1.5">
                                    {data.eater.name && data.eater.name !== '***' && (
                                        <div className="flex items-center gap-2 text-sm text-gray-700">
                                            <User className="size-4 shrink-0 text-gray-400" />
                                            <span className="font-semibold">{data.eater.name}</span>
                                        </div>
                                    )}
                                    {data.eater.comment && (
                                        <div className="flex items-start gap-2 text-sm text-amber-700">
                                            <span className="mt-0.5 shrink-0 text-base">📝</span>
                                            <span className="italic">{data.eater.comment}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Items */}
                            <div className="px-5 py-4">
                                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                                    Món ({data.itemInfo.count})
                                </p>
                                <div className="space-y-4">
                                    {data.itemInfo.items.map((item, i) => (
                                        <div key={item.itemID ?? i}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                                    <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-green-100 text-xs font-black text-green-700">
                                                        {item.quantity}×
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-gray-800 leading-snug">{item.name}</p>
                                                        {/* Modifier groups — each group shows its modifiers */}
                                                        {item.modifierGroups?.map((grp, gi) => (
                                                            <div key={gi} className="mt-1 flex flex-wrap gap-1">
                                                                {grp.modifiers.map((mod, mi) => (
                                                                    <span
                                                                        key={mi}
                                                                        className="inline-block rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600"
                                                                    >
                                                                        {mod.modifierName}
                                                                        {mod.priceDisplay !== '0' && ` +${mod.priceDisplay}đ`}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ))}
                                                        {item.comment && (
                                                            <p className="mt-1 text-[11px] italic text-amber-600">{item.comment}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="shrink-0 text-sm font-bold text-gray-700 tabular-nums">
                                                    {fmt(item.fare.priceFloat * item.quantity)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Fare breakdown (collapsible) */}
                            <div className="px-5 py-3">
                                <button
                                    onClick={() => setFareOpen(v => !v)}
                                    className="flex w-full items-center justify-between text-sm font-bold text-gray-700"
                                >
                                    <span>Tổng cộng</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-black text-brand">{data.fare.subTotalDisplay}đ</span>
                                        {fareOpen ? <ChevronUp className="size-4 text-gray-400" /> : <ChevronDown className="size-4 text-gray-400" />}
                                    </div>
                                </button>
                                {fareOpen && (
                                    <div className="mt-3 space-y-1.5 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                                        <Row label="Tiền món" value={data.fare.subTotalDisplay} />
                                        {data.fare.deliveryFeeDisplay && <Row label="Phí giao hàng" value={data.fare.deliveryFeeDisplay} />}
                                        {data.fare.promotionDisplay && data.fare.promotionDisplay !== '0' && (
                                            <Row label="Khuyến mãi" value={`-${data.fare.promotionDisplay}`} green />
                                        )}
                                        {data.fare.smallOrderFeeDisplay && data.fare.smallOrderFeeDisplay !== '0' && (
                                            <Row label="Phí đơn nhỏ" value={data.fare.smallOrderFeeDisplay} />
                                        )}
                                        <div className="border-t border-gray-200 pt-1.5">
                                            <Row label="Khách trả" value={data.fare.passengerTotalDisplay} bold />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Driver info */}
                            {data.driver?.name && (
                                <div className="px-5 py-4 flex items-center gap-3">
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold text-sm overflow-hidden">
                                        {data.driver.avatar
                                            ? <img src={data.driver.avatar} alt={data.driver.name} className="size-full rounded-full object-cover" />
                                            : data.driver.name.charAt(0)
                                        }
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">{data.driver.name}</p>
                                        {data.driver.mobileNumber && (
                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                <Phone className="size-3" /> {data.driver.mobileNumber}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Payment + time */}
                            <div className="grid grid-cols-2 divide-x divide-gray-50 px-5 py-3">
                                <div className="pr-4">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Thanh toán</p>
                                    <p className="mt-0.5 text-sm font-semibold text-gray-700">{data.paymentMethod === 'Cash' ? 'Tiền mặt' : 'Chuyển khoản'}</p>
                                </div>
                                <div className="pl-4">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Giờ đặt</p>
                                    <p className="mt-0.5 text-sm font-semibold text-gray-700">{formatDate(data.times.createdAt)}</p>
                                </div>
                            </div>

                            {/* Mark ready button — only for ORDER_IN_PREPARE */}
                            {preparationTaskID && (data?.state === 'ORDER_IN_PREPARE' || !data) && (
                                <div className="px-5 py-4 flex flex-col gap-2">
                                    {markReadyResult && (
                                        <p className={`text-xs font-medium ${markReadyResult.ok ? 'text-teal-600' : 'text-red-500'}`}>
                                            {markReadyResult.ok ? '✓ ' : '✗ '}{markReadyResult.msg}
                                        </p>
                                    )}
                                    <button
                                        onClick={onMarkReady}
                                        disabled={markingReady || markReadyResult?.ok}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                                    >
                                        {markingReady
                                            ? <Loader2 className="size-4 animate-spin" />
                                            : <PackageCheck className="size-4" />
                                        }
                                        {markingReady ? 'Đang gửi…' : markReadyResult?.ok ? 'Đã báo sẵn sàng' : 'Sẵn sàng — báo shipper đến lấy'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Print footer ── */}
                {data && (
                    <div className="border-t border-gray-100 px-5 py-4 shrink-0">
                        <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
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
                                subLabel={totalQty > 0 ? `${totalQty} tem` : undefined}
                                status={labelStatus}
                                disabled={!hasLabelPrinter}
                                disabledReason={labelDisabledReason}
                                onPrint={() => void handlePrintLabel()}
                                onRetry={() => setLabelStatus('idle')}
                            />
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}