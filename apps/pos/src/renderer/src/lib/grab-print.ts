import type { AdminOrder } from '../types/common'
import type { BillConfig, LabelConfig } from '../../../preload'
import { DEFAULT_BILL_CONFIG, DEFAULT_LABEL_CONFIG } from '../types/common'
import { KEYS, loadLocal } from './local-storage'
import { buildReceiptDocumentHtml, buildOrderLabels } from './receipt-shared'
import { loadPrinterConfig } from './printer-config'
import { getFontBase64 } from './font-cache'

// ─── GrabFull types ───────────────────────────────────────────────────────────

type GrabItemModifier = { modifierName: string; quantity: number; priceDisplay: string }
type GrabItemModGroup = { modifierGroupName: string; modifiers: GrabItemModifier[] }

export type GrabItemFull = {
  name: string
  quantity: number
  fare: { priceDisplay: string; priceFloat: number }
  comment: string
  modifierGroups: GrabItemModGroup[]
  itemID?: string
}

export type GrabFull = {
  orderID: string
  displayID: string
  state: string
  bookingCode: string
  paymentMethod: string
  itemInfo: { count: number; items: GrabItemFull[] }
  fare: {
    subTotalDisplay: string
    totalDisplay: string
    deliveryFeeDisplay: string
    promotionDisplay: string
    passengerTotalDisplay: string
    smallOrderFeeDisplay?: string
  }
  eater: { name: string; comment: string }
  driver?: { name: string; mobileNumber: string; avatar?: string }
  times: {
    createdAt: string
    acceptedAt?: string | null
    completedAt?: string | null
    cancelledAt?: string | null
  }
}

// ─── Convert GrabFull → AdminOrder ───────────────────────────────────────────

export function grabFullToAdminOrder(grab: GrabFull): AdminOrder {
  const parseAmt = (s: string | undefined): number => {
    if (!s) return 0
    return Number(s.replace(/[^\d]/g, '')) || 0
  }

  const subtotal = parseAmt(grab.fare.subTotalDisplay)
  const total = parseAmt(grab.fare.passengerTotalDisplay) || subtotal

  const items = grab.itemInfo.items.map((it, idx) => ({
    id: it.itemID ?? String(idx),
    quantity: it.quantity,
    price: String(it.fare.priceFloat),
    note: it.comment || undefined,
    // Map modifier groups: {groupName: "modName [+price]"} for bill/label rendering
    optionsJson: it.modifierGroups?.length
      ? Object.fromEntries(
        it.modifierGroups.map(g => {
          const val = g.modifiers
            .map(m => m.modifierName + (m.priceDisplay && m.priceDisplay !== '0' ? ` +${m.priceDisplay}đ` : ''))
            .join(', ')
          return [g.modifierGroupName, val]
        })
      )
      : null,
    extrasJson: null,
    product: {
      id: it.itemID ?? String(idx),
      name: it.name,
      imageUrls: [],
    },
  }))

  return {
    id: grab.orderID,
    paymentCode: grab.displayID,
    orderRef: grab.displayID,
    type: 'delivery' as const,
    status: 'preparing' as const,
    paymentStatus: 'paid',
    paymentType: grab.paymentMethod === 'Cash' ? 'cash' : 'bank_transfer',
    totalAmount: subtotal,
    finalAmount: total,
    discountAmount: 0,
    pointDiscountAmount: 0,
    vatAmount: 0,
    vatRate: 0,
    pointsConsumed: 0,
    pointsReserved: 0,
    createdAt: grab.times.createdAt,
    paidAt: grab.times.completedAt ?? null,
    pickupTime: null,
    table: null,
    guestDeliveryName: grab.eater.name || null,
    guestDeliveryPhone: grab.driver?.mobileNumber || null,
    guestDeliveryAddress: null,
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

export async function printGrabBill(order: AdminOrder): Promise<{ ok: boolean; error?: string }> {
  const billCfg = loadLocal<BillConfig>(KEYS.bill, DEFAULT_BILL_CONFIG)
  const address = billCfg.address || billCfg.printerId?.replace('manual-', '')
  const printerName = billCfg.printerName || address
  if (!address || !billCfg.enabled) return { ok: false, error: 'Chưa cấu hình máy in' }
  try {
    const fontBase64 = await getFontBase64()
    const printerCfg = loadPrinterConfig()
    const html = buildReceiptDocumentHtml(order, undefined, printerCfg, fontBase64)
    return await printerBridge().printBillByAddress(address, printerName!, html, billCfg.copies ?? 1, billCfg)
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function printGrabLabels(order: AdminOrder): Promise<{ ok: boolean; error?: string }> {
  const labelCfg = loadLocal<LabelConfig>(KEYS.label, DEFAULT_LABEL_CONFIG)
  const address = labelCfg.address || labelCfg.printerId?.replace('manual-', '')
  const printerName = labelCfg.printerName || address
  if (!address || !labelCfg.enabled) return { ok: false, error: 'Chưa cấu hình máy in tem nhãn' }
  try {
    const fontBase64 = await getFontBase64()
    const labels = buildOrderLabels(order, {
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