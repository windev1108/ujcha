//spf-print.ts
import type { AdminOrder } from '../types/common'
import type { BillConfig, LabelConfig } from '../../../preload'
import { DEFAULT_BILL_CONFIG, DEFAULT_LABEL_CONFIG } from '../types/common'
import { KEYS, loadLocal } from './local-storage'
import { buildReceiptDocumentHtml, buildOrderLabels } from './receipt-shared'
import { loadPrinterConfig } from './printer-config'
import { getFontBase64 } from './font-cache'
import { SpfOrderFull } from 'src/main/shopee-partner-poller'

// ─── Convert SpfOrderFull → AdminOrder ───────────────────────────────────────

export function spfOrderFullToAdminOrder(order: SpfOrderFull): AdminOrder {
    const items = order.order_items.map((it, idx) => {
        // Flatten options_groups into { groupName: "optName [+priceđ]" }, same
        // shape grab-print.ts produces so receipt-shared renders both identically.
        const optionsJson = it.options_groups?.length
            ? Object.fromEntries(
                it.options_groups.map(g => {
                    const val = g.options
                        .map(o => o.name + (o.discount_price > 0 ? ` +${o.discount_price}đ` : ''))
                        .join(', ')
                    return [g.name, val]
                }),
            )
            : null

        return {
            id: String(it.id ?? idx),
            quantity: it.quantity,
            price: String(it.discount_price ?? it.dish.discount_price ?? 0),
            note: it.note || undefined,
            optionsJson,
            extrasJson: null,
            product: {
                id: String(it.dish?.id ?? it.id ?? idx),
                name: it.dish.name,
                imageUrls: it.dish.image ? [it.dish.image] : [],
            },
        }
    })

    const isCancelled = order.order_status === 8 || !!order.cancel_info?.type
    const createdAtIso = new Date(order.order_time * 1000).toISOString()
    const paidAtIso = order.actual_deliver_time
        ? new Date(order.actual_deliver_time * 1000).toISOString()
        : null

    return {
        id: String(order.id),
        paymentCode: order.code,
        orderRef: order.code,
        type: 'delivery' as const,
        status: isCancelled ? 'cancelled' as const : 'preparing' as const,
        paymentStatus: 'paid',
        // ShopeeFood settles via the platform, not cash-on-hand at the counter —
        // treat as bank_transfer for receipt display purposes (matches Grab).
        paymentType: 'bank_transfer',
        totalAmount: order.customer_bill.sub_total,
        finalAmount: order.customer_bill.total_amount,
        discountAmount: order.customer_bill.total_discount ?? 0,
        pointDiscountAmount: 0,
        vatAmount: 0,
        vatRate: 0,
        pointsConsumed: 0,
        pointsReserved: 0,
        createdAt: createdAtIso,
        paidAt: paidAtIso,
        pickupTime: null,
        table: null,
        guestDeliveryName: order.deliver_address?.contact_name || order.order_user?.name || null,
        guestDeliveryPhone: null,
        guestDeliveryAddress: order.deliver_address?.address || null,
        items,
    } as unknown as AdminOrder
}

// ─── Printer bridge (renderer-side) ──────────────────────────────────────────

function printerBridge() {
    return (window as unknown as {
        electronAPI: {
            printer: {
                printBillByAddress(
                    address: string, printerName: string, html: string, copies: number, cfg?: BillConfig
                ): Promise<{ ok: boolean; error?: string }>
                printLabelsByAddress(
                    address: string, printerName: string, labels: string[], cfg?: LabelConfig
                ): Promise<{ ok: boolean; error?: string }>
            }
        }
    }).electronAPI.printer
}

// ─── Print helpers ────────────────────────────────────────────────────────────

export async function printSpfBill(order: SpfOrderFull): Promise<{ ok: boolean; error?: string }> {
    const billCfg = loadLocal<BillConfig>(KEYS.bill, DEFAULT_BILL_CONFIG)
    const address = billCfg.address || billCfg.printerId?.replace('manual-', '')
    const printerName = billCfg.printerName || address
    if (!address || !billCfg.enabled) return { ok: false, error: 'Chưa cấu hình máy in' }
    try {
        const adminOrder = spfOrderFullToAdminOrder(order)
        const fontBase64 = await getFontBase64()
        const printerCfg = loadPrinterConfig()
        const html = buildReceiptDocumentHtml(adminOrder, undefined, printerCfg, fontBase64)
        return await printerBridge().printBillByAddress(address, printerName!, html, billCfg.copies ?? 1, billCfg)
    } catch (e) {
        return { ok: false, error: String(e) }
    }
}

export async function printSpfLabels(order: SpfOrderFull): Promise<{ ok: boolean; error?: string }> {
    const labelCfg = loadLocal<LabelConfig>(KEYS.label, DEFAULT_LABEL_CONFIG)
    const address = labelCfg.address || labelCfg.printerId?.replace('manual-', '')
    const printerName = labelCfg.printerName || address
    if (!address || !labelCfg.enabled) return { ok: false, error: 'Chưa cấu hình máy in tem nhãn' }
    try {
        const adminOrder = spfOrderFullToAdminOrder(order)
        const fontBase64 = await getFontBase64()
        const labels = buildOrderLabels(adminOrder, {
            labelWidth: labelCfg.labelWidth,
            labelHeight: labelCfg.labelHeight,
            showProductName: labelCfg.showProductName ?? true,
            showPrice: labelCfg.showPrice ?? true,
            showNote: labelCfg.showNote ?? true,
            customText: labelCfg.customText ?? '',
            lineSpacing: labelCfg.lineSpacing,
            feedAfterCut: labelCfg.feedAfterCut,
            paddingTop: labelCfg.paddingTop,
            paddingBottom: labelCfg.paddingBottom,
        }, fontBase64)
        return await printerBridge().printLabelsByAddress(address, printerName!, labels, labelCfg)
    } catch (e) {
        return { ok: false, error: String(e) }
    }
}