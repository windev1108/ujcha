import { GRAB_STATUS_COLOR, GRAB_STATUS_DOT } from "@/lib/constants";
import { GrabFull, grabFullToAdminOrder, printGrabBill, printGrabLabels } from "@/lib/grab-print"
import { KEYS, loadLocal } from "@/lib/local-storage";
import { DEFAULT_BILL_CONFIG, DEFAULT_LABEL_CONFIG, ResolvedRecipeMap } from "@/types/common";
import {
    ArrowLeft, AlertCircle, CheckCircle2, Loader2, MoreHorizontal,
    PackageCheck, Phone, Printer, Tag, Copy, Check as CheckIcon,
    ShoppingBag,
    Sparkles,
    UserCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react"
import { BillConfig, LabelConfig } from "src/preload";
import grabFoodLogo from '../assets/grab-food.png'
import { fmt, formatDate, formatMeterToKm } from "@/lib/utils";
import { buildLabelPickerItems } from "@/lib/receipt-shared";
import { LabelPickerModal } from "./LabelPickerModal";
import { resolveRecipeBatch } from "@/api";
import { RecipeChecklist } from "./RecipeChecklist";
import { useShowRecipe } from "@/hooks/useShowRecipe";
import { RecipeToggleButton } from "./RecipeToggleButton";
import { GrabOrderContext, grabOrderLabel } from "@/lib/grab-status";
import { getCachedNet, getLearnedCommissionRate, learnFromDetail } from "../../../shared/grab-net-cache";
import { getCachedEaterInfo, isMaskedValue, learnEaterInfo } from "../../../shared/grab-eater-cache";
import { DEFAULT_GRAB_COMMISSION_RATE, estimateGrabNetReceived } from "../../../shared/grab-fees";
import { Chip, ChipLabel } from "@heroui/react";

function Row({ label, value, green, bold, showUnit = true }: { label: string; value: string; green?: boolean; bold?: boolean, showUnit?: boolean }) {
    return (
        <div className={`flex justify-between text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
            <span>{label}</span>
            <span className={green ? 'text-green-600' : bold ? 'text-gray-900' : 'text-gray-700'}>{value}{showUnit && "đ"}</span>
        </div>
    )
}

/**
 * Grab's order payload carries several merchant-settlement fields that aren't
 * part of the strict `GrabFull['fare']` type yet (commission, taxes, BCRS
 * packaging deposit, etc). We read them defensively via an extended shape so
 * this keeps working even before the type declaration in `lib/grab-print.ts`
 * is updated to include them.
 */
type FareWithSettlement = GrabFull['fare'] & {
    mexCommissionDisplay?: string
    onBehalfWithholdTaxDisplay?: string
    mexVatAmountDisplay?: string
    mexPitAmountDisplay?: string
    originalPriceInMin?: number
    bcrsDepositDisplay?: string
    bcrsDepositInCent?: number
    bcrsDepositItemCount?: number
}

type OrderWithDiscounts = GrabFull & {
    orderLevelDiscounts?: {
        discountType: string
        discountName: string
        discountAmountDisplay: string
        discountAmountValueInMin: number
        isNewPromotion: boolean
    }[]
}

/** Parses Grab's Vietnamese-formatted display strings ("8.737" -> 8737). */
function parseVNDDisplay(display?: string | null): number {
    if (!display) return 0
    const cleaned = display.replace(/\./g, '').trim()
    const n = parseInt(cleaned, 10)
    return Number.isNaN(n) ? 0 : n
}

type PrintStatus = 'idle' | 'printing' | 'done' | 'error'

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

export default function GrabOrderDetailModal({
    id, context = 'history', data, loading, preparationTaskID, markingReady, markReadyResult, onMarkReady, onClose, onDismissAlert, hasActiveAlert = false
}: {
    id: string
    data: GrabFull | null
    context?: GrabOrderContext
    loading: boolean
    preparationTaskID?: string
    markingReady?: boolean
    markReadyResult?: { ok: boolean; msg: string }
    onMarkReady?: () => void
    onClose: () => void
    onDismissAlert?: () => void
    hasActiveAlert?: boolean
}) {
    const [billStatus, setBillStatus] = useState<PrintStatus>('idle')
    const [labelStatus, setLabelStatus] = useState<PrintStatus>('idle')
    const [labelPickerOpen, setLabelPickerOpen] = useState(false)
    const [printMenuOpen, setPrintMenuOpen] = useState(false)
    const [moreMenuOpen, setMoreMenuOpen] = useState(false)
    const headerMenuRef = useRef<HTMLDivElement>(null)
    const billCfg = loadLocal<BillConfig>(KEYS.bill, DEFAULT_BILL_CONFIG)
    const labelCfg = loadLocal<LabelConfig>(KEYS.label, DEFAULT_LABEL_CONFIG)
    const hasBillPrinter = billCfg.enabled && !!(billCfg.address || billCfg.printerId)
    const hasLabelPrinter = labelCfg.enabled && !!(labelCfg.address || labelCfg.printerId)
    const { showRecipe, toggle: toggleRecipe } = useShowRecipe()
    const [recipeMap, setRecipeMap] = useState<ResolvedRecipeMap>({})
    const [copiedField, setCopiedField] = useState<'code' | 'eaterPhone' | 'driverPhone' | null>(null)
    const cachedEater = data ? getCachedEaterInfo(data.displayID) : null
    const eaterName = (!isMaskedValue(data?.eater.name) ? data?.eater.name : null) || cachedEater?.eaterName
    const eaterMobile = data?.eater.mobileNumber || cachedEater?.mobileNumber
    const eaterAddress = data?.eater.address || cachedEater?.address
    const driverMobile = data?.driver?.mobileNumber || cachedEater?.driverMobileNumber
    const isNewCustomer = data?.flags?.isPaxNewCustomer === true
    useEffect(() => {
        if (!data) return
        learnEaterInfo(data.displayID, {
            eaterName: data.eater.name,
            mobileNumber: data.eater.mobileNumber,
            address: data.eater.address,
            driverMobileNumber: data.driver?.mobileNumber,
        })
    }, [data])

    useEffect(() => {
        if (!data) return
        const requestItems = data.itemInfo.items.map((item, i) => ({
            key: item.itemKey ?? `${item.itemID}-${i}`,
            sku: `GRAB-${item.itemID}`,
            selectedLabels: (item.modifierGroups ?? []).flatMap((g) => g.modifiers.map((m) => m.modifierName)),
        }))
        if (requestItems.length === 0) return
        void resolveRecipeBatch(requestItems).then(setRecipeMap).catch(() => { })
    }, [data])

    useEffect(() => {
        if (!data) return
        const fare = data.fare as FareWithSettlement
        const base = fare.originalPriceInMin ?? parseVNDDisplay(data.fare.subTotalDisplay)
        const commission = parseVNDDisplay(fare.mexCommissionDisplay)
        if (!base || !commission) return
        const vat = parseVNDDisplay(fare.mexVatAmountDisplay)
        const pit = parseVNDDisplay(fare.mexPitAmountDisplay)
        const withhold = parseVNDDisplay(fare.onBehalfWithholdTaxDisplay)
        const discount = ((data as OrderWithDiscounts).orderLevelDiscounts ?? [])
            .reduce((s, d) => s + (d.discountAmountValueInMin ?? parseVNDDisplay(d.discountAmountDisplay)), 0)
        learnFromDetail(data.displayID, base - discount - commission - vat - pit - withhold, commission / base)
    }, [data])

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
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

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
        setPrintMenuOpen(false)
        if (!data) return
        setBillStatus('printing')
        const adminOrder = grabFullToAdminOrder(data)
        const res = await printGrabBill(adminOrder)
        setBillStatus(res.ok ? 'done' : 'error')
    }

    async function handlePrintLabel(selectedItemIds?: Set<string>) {
        if (!data) return
        setLabelStatus('printing')
        const adminOrder = grabFullToAdminOrder(data)
        const res = await printGrabLabels(adminOrder, selectedItemIds)
        setLabelStatus(res.ok ? 'done' : 'error')
    }


    async function handleCopy(text: string, field: 'code' | 'eaterPhone' | 'driverPhone') {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedField(field)
            setTimeout(() => setCopiedField(f => (f === field ? null : f)), 1500)
        } catch { /* ignore */ }
    }

    // const totalQty = data?.itemInfo.items.reduce((s, i) => s + i.quantity, 0) ?? 0

    const status = data?.state?.toUpperCase() ?? ''
    const label = data ? grabOrderLabel(status, context) : ''
    const color = GRAB_STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'
    const dot = GRAB_STATUS_DOT[status] ?? 'bg-gray-400'
    const isCompleted = data?.state === "COMPLETED"
    void id
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
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <img src={grabFoodLogo} className="h-5 w-5 shrink-0 object-contain" alt="" />
                    {data && <p className="truncate font-mono text-base sm:text-lg font-black text-gray-900">Đơn hàng {data.displayID}</p>}
                    {data && (
                        <Chip size="lg" className={`pl-3 ${color}`}>
                            <span className={`size-1.5 rounded-full ${dot}`} />
                            <ChipLabel>{label}</ChipLabel>
                        </Chip>
                    )}
                </div>

                <div ref={headerMenuRef} className="flex shrink-0 items-center gap-2">
                    {data && (
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
                                        onClick={() => void handleCopy(data.displayID, 'code')}
                                        className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        {copiedField === 'code' ? <CheckIcon className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 text-gray-400" />}
                                        {copiedField === 'code' ? 'Đã sao chép' : 'Sao chép mã đơn'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {data && (
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
                    )}
                </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
                {loading ? (
                    <div className="flex h-64 items-center justify-center gap-2 text-sm text-gray-400">
                        <Loader2 className="size-5 animate-spin" /> Đang tải chi tiết…
                    </div>
                ) : !data ? (
                    <div className="flex h-64 flex-col items-center justify-center gap-2 text-gray-400">
                        <p className="text-sm">Không lấy được chi tiết đơn</p>
                    </div>
                ) : (
                    <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">

                        {/* Left / main column */}
                        <div className="space-y-4 lg:order-1">
                            {(data.eater.name.length || data.eater.comment.length || eaterMobile || eaterAddress) && (
                                <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-1.5">
                                    <p className="mb-1 text-md font-bold uppercase tracking-widest text-gray-400">Khách hàng</p>
                                    {eaterName && (
                                        <div className="flex items-center gap-2 text-md text-gray-700">
                                            <span className="font-semibold">{eaterName}</span>
                                        </div>
                                    )}
                                    {isNewCustomer ? (
                                        <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                                            <Sparkles className="size-2.5" /> Khách mới
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                            <UserCheck className="size-2.5" /> Khách quen
                                        </span>
                                    )}
                                    {eaterMobile && (
                                        <div className="flex items-center gap-1.5 text-md text-gray-500">
                                            <Phone className="size-3" />
                                            <span>{eaterMobile}</span>
                                            <button
                                                onClick={() => void handleCopy(eaterMobile, 'eaterPhone')}
                                                className="text-gray-300 hover:text-brand transition-colors"
                                                title="Sao chép số điện thoại"
                                            >
                                                {copiedField === 'eaterPhone' ? <CheckIcon className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                                            </button>
                                        </div>
                                    )}
                                    {eaterAddress && (
                                        <p className="text-xs text-gray-500">{eaterAddress}</p>
                                    )}
                                    {data.eater.comment && (
                                        <div className="flex items-start gap-2 text-sm text-amber-700">
                                            <span className="shrink-0 text-base">📝</span>
                                            <span className="italic">{data.eater.comment}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                                <div className="flex items-center justify-between border-b border-gray-50 px-4 py-3">
                                    <p className="text-md font-bold text-gray-800">Chi tiết món ({data.itemInfo.count})</p>
                                    <RecipeToggleButton show={showRecipe} onToggle={toggleRecipe} />
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {data.itemInfo.items.map((item, i) => {
                                        const key = item.itemKey ?? `${item.itemID}-${i}`
                                        const sizeLabel = item.modifierGroups
                                            ?.find((g) => /size/i.test(g.modifierGroupName))
                                            ?.modifiers[0]?.modifierName
                                        return (
                                            <div key={key} className="px-4 py-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="relative shrink-0">
                                                        <div className="flex size-20 items-center justify-center rounded-xl bg-gray-100 ring-1 ring-black/6 overflow-hidden">
                                                            {item.image ? (
                                                                <img src={item.image} alt={item.name} className="size-full object-cover" />
                                                            ) : (
                                                                <ShoppingBag className="size-4 text-gray-300" />
                                                            )}
                                                        </div>
                                                        <span className="absolute -bottom-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-brand text-sm font-black text-white ring-2 ring-white shadow-sm">
                                                            {item.quantity}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="font-semibold text-gray-900 leading-snug text-lg">{item.name}</p>
                                                            <span className="shrink-0 text-sm font-bold text-gray-700 tabular-nums">
                                                                {fmt(item.fare.priceFloat * item.quantity)}
                                                            </span>
                                                        </div>
                                                        {item.modifierGroups?.map((grp, gi) => (
                                                            <div key={gi} className="mt-1.5 flex flex-wrap gap-1">
                                                                {grp.modifiers.map((mod, mi) => (
                                                                    <span
                                                                        key={mi}
                                                                        className="inline-block rounded-md bg-gray-100 px-1.5 py-0.5 text-sm text-gray-600"
                                                                    >
                                                                        {mod.modifierName}
                                                                        {mod.priceDisplay !== '0' && ` +${mod.priceDisplay}đ`}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ))}
                                                        {item.comment && (
                                                            <p className="mt-1.5 text-sm italic text-amber-600">{item.comment}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                {showRecipe && <RecipeChecklist recipe={recipeMap[key]} quantity={item.quantity} sizeLabel={sizeLabel} />}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {data.driver?.name && (
                                <div className="rounded-2xl border border-gray-100 bg-white p-4 flex items-center gap-3">
                                    <div className="flex flex-col gap-2">
                                        <p className="mb-1 text-md font-bold uppercase tracking-widest text-gray-400">Tài xế</p>

                                        <div className="flex items-center gap-3">
                                            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold text-sm overflow-hidden">
                                                {data.driver.avatar
                                                    ? <img src={data.driver.avatar} alt={data.driver.name} className="size-full rounded-full object-cover" />
                                                    : data.driver.name.charAt(0)
                                                }
                                            </div>
                                            <div>

                                                <p className="text-sm font-semibold text-gray-800">{data.driver.name}</p>
                                                {driverMobile && (
                                                    <div className="flex items-center gap-1.5 text-md text-gray-500">
                                                        <Phone className="size-3" />
                                                        <span>{driverMobile}</span>
                                                        <button
                                                            onClick={() => void handleCopy(driverMobile, 'driverPhone')}
                                                            className="text-gray-300 hover:text-brand transition-colors"
                                                            title="Sao chép số điện thoại"
                                                        >
                                                            {copiedField === 'driverPhone' ? <CheckIcon className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right / summary column */}
                        <div className="space-y-4 lg:order-2">
                            <div className="rounded-2xl border border-gray-100 bg-white p-4">
                                <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Tổng kết đơn hàng</p>
                                <FareBreakdown data={data} />
                                <MerchantSettlementBreakdown data={data} />
                            </div>

                            <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2.5 text-sm">
                                <p className="mb-1 text-sm font-bold uppercase tracking-widest text-gray-400">Thông tin đơn hàng</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Kênh đặt</span>
                                    <span className="font-bold text-green-600">GrabFood</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Mã đơn hàng</span>
                                    <button onClick={() => void handleCopy(data.displayID, 'code')} className="flex items-center gap-1 font-mono font-semibold text-gray-800 hover:text-brand transition-colors">
                                        {data.displayID}
                                        {copiedField === 'code' ? <CheckIcon className="size-3 text-emerald-500" /> : <Copy className="size-3 text-gray-300" />}
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Thanh toán</span>
                                    <span className="font-semibold text-gray-800">{data.paymentMethod === 'Cash' ? 'Tiền mặt' : 'Chuyển khoản'}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Giờ đặt</span>
                                    <span className="font-semibold text-gray-800">{formatDate(data.times.createdAt)}</span>
                                </div>
                                {Boolean(isCompleted && data.times.completedAt) &&
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400">Giờ hoàn thành</span>
                                        <span className="font-semibold text-gray-800">{formatDate(data.times.completedAt!)}</span>
                                    </div>
                                }
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Loại đơn</span>
                                    <span className="font-semibold text-gray-800">{data.isOrderWithFriends ? "Đơn nhóm" : "Đơn thường"}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Khoảng cách</span>
                                    <span className="font-semibold text-gray-800">{formatMeterToKm(data.leadsGenData?.paxDistanceToMex) ?? 0}</span>
                                </div>
                            </div>

                            {preparationTaskID && (data?.state === 'ORDER_IN_PREPARE' || !data) && (
                                <div className="rounded-2xl border border-gray-100 bg-white p-4 flex flex-col gap-2">
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
                    </div>
                )}
            </div>

            {labelPickerOpen && data && (() => {
                const adminOrder = grabFullToAdminOrder(data)
                const { items, defaultSelectedIds } = buildLabelPickerItems(adminOrder, labelCfg)
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

function FareBreakdown({ data }: { data: GrabFull }) {
    return (
        <div className="mt-3 space-y-2">
            <Row label="Tiền món" value={data.fare.subTotalDisplay} />
            {data.fare.deliveryFeeDisplay && <Row label="Phí giao hàng" value={data.fare.deliveryFeeDisplay} />}
            {data.fare.promotionDisplay && data.fare.promotionDisplay !== '0' && (
                <Row label="Khuyến mãi" value={data.fare.promotionDisplay !== "-" ? `-${data.fare.promotionDisplay}` : "-"} green />
            )}
            {data.fare.smallOrderFeeDisplay && data.fare.smallOrderFeeDisplay !== '0' && (
                <Row label="Phí đơn nhỏ" value={data.fare.smallOrderFeeDisplay} />
            )}
            <div className="flex items-baseline justify-between border-t border-gray-100 pt-2.5">
                <span className="text-sm font-bold text-gray-900">Khách trả</span>
                <span className="text-xl font-black text-brand tabular-nums">{data.fare.passengerTotalDisplay}đ</span>
            </div>
        </div>
    )
}

/**
 * Breaks down what the merchant actually keeps after Grab's commission,
 * taxes withheld on the merchant's behalf, and any order-level promo codes
 * that were funded by the merchant rather than Grab.
 *
 * This is a best-effort estimate computed from the fields Grab returns on
 * the order payload. Treat it as a quick reference in the UI — always
 * reconcile against Grab's official merchant settlement statement for
 * accounting purposes, since Grab may apply additional adjustments that
 * don't appear on the per-order response (e.g. batched subsidies,
 * rounding, or retroactive corrections).
 */
function MerchantSettlementBreakdown({ data }: { data: GrabFull }) {
    const fare = data.fare as FareWithSettlement
    const orderDiscounts = (data as OrderWithDiscounts).orderLevelDiscounts ?? []

    const orderDiscountTotal = orderDiscounts.reduce(
        (sum, d) => sum + (d.discountAmountValueInMin ?? parseVNDDisplay(d.discountAmountDisplay)),
        0
    )

    const commission = parseVNDDisplay(fare.mexCommissionDisplay)
    const vat = parseVNDDisplay(fare.mexVatAmountDisplay)
    const pit = parseVNDDisplay(fare.mexPitAmountDisplay)
    const withholdTax = parseVNDDisplay(fare.onBehalfWithholdTaxDisplay)
    const originalPrice = fare.originalPriceInMin ?? parseVNDDisplay(data.fare.subTotalDisplay)
    const hasBcrsDeposit = (fare.bcrsDepositItemCount ?? 0) > 0
    const bcrsDepositAmount = fare.bcrsDepositInCent ?? parseVNDDisplay(fare.bcrsDepositDisplay)

    const totalMerchantFees = commission + vat + pit + withholdTax
    // Grab chỉ trả mexCommissionDisplay/VAT/PIT thật ở một số trạng thái/đơn nhất định.
    // Khi tất cả đều "0" (chưa có dữ liệu phí thật) → fallback sang cache/ước tính,
    // đồng bộ với cách GrabOrderCard ở màn hình danh sách đang hiển thị.
    const hasRealFeeData = totalMerchantFees > 0

    if (!originalPrice) return null // không có gì để tính, bỏ qua luôn

    if (!hasRealFeeData) {
        const cachedNet = getCachedNet(data.displayID)
        const rate = getLearnedCommissionRate(DEFAULT_GRAB_COMMISSION_RATE)
        const estimatedNet = cachedNet ?? estimateGrabNetReceived(originalPrice, rate, orderDiscountTotal)

        return (
            <div className="mt-4 space-y-2 border-t border-dashed border-gray-200 pt-3">
                <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Quán thực nhận (ước tính)</p>

                <Row label="Giá gốc món" value={fmt(originalPrice)} showUnit={false} />

                {orderDiscounts.map((d, i) => (
                    <Row
                        key={`${d.discountName}-${i}`}
                        label={d.discountName}
                        value={fmt(`-${d.discountAmountValueInMin ?? parseVNDDisplay(d.discountAmountDisplay)}`)}
                        showUnit={false}
                        green
                    />
                ))}

                {hasBcrsDeposit && <Row label="Cọc bao bì (BCRS)" value={fmt(bcrsDepositAmount)} showUnit={false} />}

                <div className="flex items-baseline justify-between border-t border-gray-100 pt-2.5">
                    <span className="text-sm font-bold text-gray-900">Quán thực nhận</span>
                    <span className="text-lg font-black text-emerald-600 tabular-nums">{fmt(estimatedNet)}</span>
                </div>

                <p className="pt-0.5 text-[10px] leading-snug text-gray-400">
                    {cachedNet != null
                        ? '* Lấy từ dữ liệu đã đồng bộ trước đó ("Sync doanh thu"), có thể lệch nhẹ so với bảng sao kê chính thức của Grab.'
                        : `* Ước tính theo tỉ lệ hoa hồng đã học (${(rate * 100).toFixed(1)}%) — Grab chưa trả phí chi tiết cho đơn này. Bấm "Sync doanh thu" ở tab GrabFood để cập nhật số liệu chính xác hơn.`}
                </p>
            </div>
        )
    }

    // ── Có dữ liệu phí thật từ Grab → hiển thị breakdown chính xác như cũ ──
    const netReceived = originalPrice - orderDiscountTotal - totalMerchantFees

    return (
        <div className="mt-4 space-y-2 border-t border-dashed border-gray-200 pt-3">
            <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Quán thực nhận</p>

            <Row label="Giá gốc món" value={fmt(originalPrice)} showUnit={false} />

            {orderDiscounts.map((d, i) => (
                <Row
                    key={`${d.discountName}-${i}`}
                    label={d.discountName}
                    value={fmt(`-${d.discountAmountValueInMin ?? parseVNDDisplay(d.discountAmountDisplay)}`)}
                    showUnit={false}
                    green
                />
            ))}

            {commission > 0 && <Row label="Hoa hồng Grab" value={`-${fmt(commission)}`} showUnit={false} />}
            {vat > 0 && <Row label="Thuế GTGT (VAT)" value={`-${fmt(vat)}`} showUnit={false} />}
            {pit > 0 && <Row label="Thuế TNCN" value={`-${fmt(pit)}`} showUnit={false} />}
            {withholdTax > 0 && <Row label="Khấu trừ hộ khác" value={`-${fmt(withholdTax)}`} showUnit={false} />}
            {hasBcrsDeposit && <Row label="Cọc bao bì (BCRS)" value={fmt(bcrsDepositAmount)} showUnit={false} />}

            <div className="flex items-baseline justify-between border-t border-gray-100 pt-2.5">
                <span className="text-sm font-bold text-gray-900">Quán thực nhận</span>
                <span className="text-lg font-black text-emerald-600 tabular-nums">{fmt(netReceived)}</span>
            </div>
        </div>
    )
}