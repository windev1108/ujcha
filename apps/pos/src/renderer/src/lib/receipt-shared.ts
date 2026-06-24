import {
  DEFAULT_PRINTER_CONFIG,
  type PrinterConfig,
  type ReceiptElement,
} from './printer-config'
import type {
  AdminOrder,
  AdminOrderItem,
  OrderItemExtraSnapshot,
  PaymentConfig,
} from '../types/common'
import { formatOrderRef, formatVnd } from './utils'
import dayjs from 'dayjs'
import { fileURLToPath } from 'url'
import path from 'path'
import { FONT_FAMILY, FONT_SMOOTHING, getFontFaceStyle } from './font-cache'
export interface BillSpacingConfig {
  lineSpacing?: number
  feedAfterCut?: number
}

export interface LabelSpacingConfig {
  lineSpacing?: number
  feedAfterCut?: number
  paddingTop?: number
  paddingBottom?: number
}

export function buildVietQrUrl(
  cfg: PaymentConfig,
  amount: number,
  content: string,
): string {
  const p = new URLSearchParams({
    bank: cfg.bankCode,
    acc: cfg.accountNumber,
    template: 'qronly',
    amount: String(Math.round(amount)),
    des: content,
  })
  return `https://qr.sepay.vn/img?${p.toString()}`
}

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stickyNoteIcon(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0;"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>`
}

function userIcon(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0;"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`
}

function buildGroupParticipantMap(
  groupOrder: AdminOrder['groupOrder'],
): Map<string, string[]> {
  if (!groupOrder) return new Map()
  const map = new Map<string, string[]>()
  for (const p of groupOrder.participants) {
    const name = p.user?.name ?? p.guestName ?? '?'
    for (const item of p.items) {
      const opts = item.selectedOptions
        ? JSON.stringify(Object.fromEntries(Object.entries(item.selectedOptions).sort()))
        : '{}'
      const extras = Array.isArray(item.toppingsJson)
        ? JSON.stringify(
            [...(item.toppingsJson as Array<{ name: string }>)]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((e) => e.name),
          )
        : '[]'
      const key = [item.productId, opts, extras, item.note ?? ''].join('\0')
      const existing = map.get(key) ?? []
      if (!existing.includes(name)) existing.push(name)
      map.set(key, existing)
    }
  }
  return map
}

export function parseExtras(raw: unknown): OrderItemExtraSnapshot[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (x): x is OrderItemExtraSnapshot =>
      x != null &&
      typeof x === 'object' &&
      'name' in x &&
      typeof (x as OrderItemExtraSnapshot).name === 'string',
  )
}

export function parseOptions(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

export function serviceLabel(t: AdminOrder['type']): string {
  switch (t) {
    case 'delivery': return 'Giao hàng'
    case 'table': return 'Tại bàn'
    case 'pickup': return 'Mang đi'
    default: return t
  }
}

export function groupOrderItems(items: AdminOrderItem[]): AdminOrderItem[] {
  const merged = new Map<string, AdminOrderItem>()
  for (const item of items) {
    const opts =
      item.optionsJson &&
        typeof item.optionsJson === 'object' &&
        !Array.isArray(item.optionsJson)
        ? JSON.stringify(
          Object.fromEntries(
            Object.entries(item.optionsJson as Record<string, unknown>).sort(),
          ),
        )
        : '{}'
    const extras = Array.isArray(item.extrasJson)
      ? JSON.stringify(
        [...(item.extrasJson as Array<{ name: string }>)]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((e) => e.name),
      )
      : '[]'
    const key = [item.product.id, item.price, item.note ?? '', opts, extras].join('\0')
    const existing = merged.get(key)
    if (existing) {
      merged.set(key, { ...existing, quantity: existing.quantity + item.quantity })
    } else {
      merged.set(key, { ...item })
    }
  }
  return [...merged.values()]
}

const WEB_URL = (import.meta.env.VITE_WEB_URL as string | undefined) ?? ''

export function buildKunLoyaltyQrUrl(paymentCode: string): string {
  const loyaltyUrl = `${WEB_URL}/loyalty?code=${encodeURIComponent(paymentCode)}`
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(loyaltyUrl)}&size=160x160&margin=4`
}

// ─── Bill HTML builders ───────────────────────────────────────────────────────

const RECEIPT_I18N = {
  order: 'Đơn',
  type: 'Loại',
  address: 'Địa chỉ',
  table: 'Bàn',
  subtotal: 'Tạm tính',
  discount: 'Giảm giá',
  points: 'Điểm UjCha',
  shipping: 'Phí vận chuyển',
  free: 'Miễn phí',
  total: 'Tổng cộng',
  payment: 'Thanh toán',
  paid: '✓ Đã thanh toán',
  pending: 'Chờ thanh toán',
  note: 'Ghi chú',
  type_delivery: 'Giao hàng',
  type_table: 'Tại bàn',
  type_pickup: 'Mang đi',
  pay_cash: 'Tiền mặt',
  pay_transfer: 'Chuyển khoản',
  invoice: 'Hóa đơn',
  scan_loyalty: 'QUÉT ĐỂ TÍCH ĐIỂM UJCHA',
  scan_sub: 'Đăng nhập & tích điểm ngay',
} as const

function receiptServiceLabel(type: AdminOrder['type']): string {
  if (type === 'delivery') return RECEIPT_I18N.type_delivery
  if (type === 'table') return RECEIPT_I18N.type_table
  if (type === 'pickup') return RECEIPT_I18N.type_pickup
  return type
}

function receiptPayLabel(type: string): string {
  return type === 'cash' ? RECEIPT_I18N.pay_cash : RECEIPT_I18N.pay_transfer
}

function renderItems(order: AdminOrder, el: ReceiptElement, paperWidth: number): string {
  const lines: string[] = []
  const nameFs = paperWidth <= 58 ? Math.max(el.fontSize - 2, 11) : Math.max(el.fontSize, 13)
  const subFs = paperWidth <= 58 ? Math.max(el.fontSize - 4, 9) : Math.max(el.fontSize - 2, 11)
  const colGap = paperWidth <= 58 ? 4 : 6
  const grouped = groupOrderItems(order.items)

  for (let i = 0; i < grouped.length; i++) {
    const it = grouped[i]
    const extras = parseExtras(it.extrasJson)
    const opts = parseOptions(it.optionsJson)
    const lineTotal = Number.parseFloat(it.price) * it.quantity

    lines.push(
      `<div data-pos="item" data-qty="${it.quantity}x" data-name="${esc(it.product.name)}" data-price="${esc(formatVnd(lineTotal))}" style="display:grid;grid-template-columns:22px minmax(0,1fr) auto;column-gap:${colGap}px;align-items:start;margin:4px 0 2px;">` +
      `<div style="padding-top:1px;"><span style="display:inline-block;width:20px;height:20px;line-height:18px;background:#fff;border:1.5px solid #000;color:#000;text-align:center;font-weight:bold;font-size:${subFs}px;vertical-align:middle;">${it.quantity}x</span></div>` +
      `<div style="font-weight:bold;font-size:${nameFs}px;word-break:break-word;line-height:1.3;color:#000;">${esc(it.product.name)}</div>` +
      `<div style="text-align:right;font-size:${nameFs}px;font-weight:bold;white-space:nowrap;padding-left:2px;min-width:0;color:#000;">${esc(formatVnd(lineTotal))}</div>` +
      `</div>`,
    )

    for (const [k, v] of Object.entries(opts)) {
      lines.push(`<div style="margin-left:26px;font-size:${subFs}px;font-weight:bold;margin-bottom:1px;color:#000;">+ ${esc(k)}: ${esc(v)}</div>`)
    }

    for (const ex of extras) {
      const exPrice = Number(ex.price ?? 0)
      lines.push(
        `<div style="display:flex;justify-content:space-between;margin-left:26px;font-size:${subFs}px;margin-bottom:1px;color:#000;">` +
        `<span>+ ${esc(ex.name)}</span>` +
        `${exPrice > 0 ? `<span style="white-space:nowrap;padding-left:4px;">${esc(formatVnd(exPrice))}</span>` : ''}` +
        `</div>`,
      )
    }

    if (it.note) {
      lines.push(
        `<div style="display:flex;align-items:center;gap:2px;margin-left:26px;font-size:${subFs}px;color:#000;">${stickyNoteIcon(subFs)}<span>${esc(it.note)}</span></div>`,
      )
    }

    if (i < grouped.length - 1) {
      lines.push(`<div style="border-bottom:1px dashed #000;margin:4px 0 3px;"></div>`)
    }
  }
  return lines.join('')
}

function renderElement(
  el: ReceiptElement,
  order: AdminOrder,
  loyaltyQrUrl?: string,
  paperWidth = 58,
): string {
  if (!el.visible) return ''

  const aln = `text-align:${el.align};`
  const scaledFontSize = paperWidth <= 58 ? Math.max(el.fontSize - 2, 9) : el.fontSize
  const fs = `font-size:${scaledFontSize}px;`
  const smlFs = `font-size:${Math.max(scaledFontSize - 1, 8)}px;`
  const bold = el.bold ? 'font-weight:bold;' : ''
  const base = `${aln}${fs}${bold}color:#000;`

  switch (el.type) {
    case 'shop-name':
      return `<div style="${aln}font-family:Georgia,'Times New Roman',serif;font-size:${paperWidth <= 58 ? 22 : 26}px;font-weight:bold;letter-spacing:3px;color:#000;margin-bottom:4px;">Ujcha</div>`

    case 'order-ref':
    {
      const totalQty = order.items.reduce((s, i) => s + i.quantity, 0)
      const customerName = order.guestDeliveryName
      const qtyLabel = customerName
        ? `${totalQty} sản phẩm cho ${customerName}`
        : `${totalQty} sản phẩm`
      const qtyFs = paperWidth <= 58 ? 10 : 12
      return (
        `<div style="${aln}font-size:${paperWidth <= 58 ? 18 : 22}px;font-weight:bold;letter-spacing:1px;color:#000;margin-bottom:2px;">${esc(order.paymentCode ?? formatOrderRef(order))}</div>` +
        `<div style="text-align:center;font-size:${qtyFs}px;color:#000;margin-bottom:4px;">${esc(qtyLabel)}</div>`
      )
    }

    case 'date':
      return `<div style="${base}margin-bottom:2px;">${esc(new Date(order.createdAt).toLocaleString('vi-VN'))}</div>`

    case 'service-type': {
      let html = `<div style="${base}margin-bottom:2px;">${esc(RECEIPT_I18N.type)}: <b>${esc(receiptServiceLabel(order.type))}</b></div>`
      if (order.type === 'delivery') {
        const name = order.guestDeliveryName
        const phone = order.guestDeliveryPhone
        if (name || phone) {
          html += `<div style="${base}margin-bottom:1px;">`
          if (name) html += esc(name)
          if (name && phone) html += ' - '
          if (phone) html += esc(phone)
          html += `</div>`
        }
      }
      if (order.table?.name) {
        html += `<div style="${base}margin-bottom:1px;">${esc(RECEIPT_I18N.table)}: ${esc(order.table.name)}</div>`
      }
      return html
    }

    case 'divider':
      return `<div style="border-top:2px dashed #000;margin:6px 0;"></div>`

    case 'items':
      return renderItems(order, el, paperWidth)

    case 'subtotal':
      return `<div style="display:flex;justify-content:space-between;${smlFs}${bold}margin-bottom:2px;color:#000;"><span>${esc(RECEIPT_I18N.subtotal)}</span><span style="white-space:nowrap;">${esc(formatVnd(order.totalAmount))}</span></div>`

    case 'discount': {
      const disc = Number(order.discountAmount) || 0
      const ptDisc = Number(order.pointDiscountAmount) || 0
      let html = ''
      if (disc > 0) html += `<div style="display:flex;justify-content:space-between;${smlFs}${bold}margin-bottom:2px;color:#000;"><span>${esc(RECEIPT_I18N.discount)}</span><span style="white-space:nowrap;">-${esc(formatVnd(disc))}</span></div>`
      if (ptDisc > 0) html += `<div style="display:flex;justify-content:space-between;${smlFs}${bold}margin-bottom:2px;color:#000;"><span>${esc(RECEIPT_I18N.points)}</span><span style="white-space:nowrap;">-${esc(formatVnd(ptDisc))}</span></div>`
      return html
    }

    case 'total': {
      const subtotal = Number(order.totalAmount) || 0
      const disc = Number(order.discountAmount) || 0
      const ptDisc = Number(order.pointDiscountAmount) || 0
      const ship = order.type === 'delivery' ? (Number(order.shippingFee) || 0) : 0
      const total = subtotal - disc - ptDisc + ship
      let html = ''
      if (order.type === 'delivery') {
        html += `<div style="display:flex;justify-content:space-between;${smlFs}${bold}margin-bottom:2px;color:#000;"><span>${esc(RECEIPT_I18N.shipping)}</span><span style="white-space:nowrap;">${ship > 0 ? esc(formatVnd(ship)) : esc(RECEIPT_I18N.free)}</span></div>`
      }
      html += `<div style="display:flex;justify-content:space-between;${smlFs}${bold}margin-top:3px;color:#000;"><span>${esc(RECEIPT_I18N.total)}</span><span style="white-space:nowrap;">${esc(formatVnd(total))}</span></div>`
      return html
    }

    case 'payment-status':
      return (
        `<div style="${smlFs}${bold}margin-bottom:2px;color:#000;">${esc(RECEIPT_I18N.payment)}: <b>${esc(receiptPayLabel(order.paymentType))}</b></div>` +
        (order.paymentStatus === 'paid'
          ? `<div style="${smlFs}font-weight:bold;color:#000;margin-top:1px;">${esc(RECEIPT_I18N.paid)}</div>`
          : `<div style="${smlFs}color:#000;margin-top:1px;">${esc(RECEIPT_I18N.pending)}</div>`)
      )

    case 'qr-code':
      if (loyaltyQrUrl) {
        const qrSize = paperWidth <= 58 ? 120 : 160
        return (
          `<div style="border-top:2px dashed #000;margin:8px 0 6px;"></div>` +
          `<div style="text-align:center;font-size:12px;font-weight:bold;letter-spacing:0.5px;margin-bottom:6px;color:#000;">${esc(RECEIPT_I18N.scan_loyalty)}</div>` +
          `<div style="text-align:center;"><img src="${loyaltyQrUrl}" style="display:block;margin:0 auto 4px;width:${qrSize}px;height:${qrSize}px;" /></div>` +
          `<div style="text-align:center;font-size:10px;color:#000;margin-bottom:6px;">${esc(RECEIPT_I18N.scan_sub)}</div>`
        )
      }
      return ''

    case 'custom-text':
      return el.customText?.trim()
        ? `<div style="${base}margin-bottom:2px;color:#000;">${esc(el.customText)}</div>`
        : ''

    default:
      return ''
  }
}

export function buildReceiptBodyHtml(
  order: AdminOrder,
  loyaltyQrUrl?: string,
  printerCfg?: PrinterConfig | null,
): string {
  const cfg = printerCfg ?? DEFAULT_PRINTER_CONFIG
  const paperWidth = cfg.paperWidth ?? 58
  return cfg.elements.map((el) => renderElement(el, order, loyaltyQrUrl, paperWidth)).join('')
}

export function buildReceiptDocumentHtml(
  order: AdminOrder,
  loyaltyQrUrl?: string,
  printerCfg?: PrinterConfig | null,
  _fontBase64 = '',
): string {
  const cfg = printerCfg ?? DEFAULT_PRINTER_CONFIG
  const paperWidth = cfg.paperWidth ?? 58
  const printableWidth = paperWidth - 4
  const baseFontSize = paperWidth <= 58 ? 11 : 13

  const body = buildReceiptBodyHtml(order, loyaltyQrUrl, cfg) +
    (WEB_URL
      ? `<div style="border-top:1px dashed #000;margin:4px 0;"></div><div style="text-align:center;font-size:10px;color:#000;">${esc(WEB_URL)}</div>`
      : '')

  const orderTitle = order.paymentCode ?? formatOrderRef(order)
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"/>` +
    `<meta name="viewport" content="width=${printableWidth}mm, initial-scale=1.0, maximum-scale=1.0"/>` +
    `<title>${esc(RECEIPT_I18N.invoice)} ${esc(orderTitle)}</title>` +
    `<style>` +
    `@page { size: ${paperWidth}mm auto; margin: 2mm; }` +
    `* { box-sizing: border-box; max-width: 100%; }` +
    `html { -webkit-text-size-adjust: none; text-size-adjust: none; }` +
    `body {` +
    `  font-family: ui-sans-serif, system-ui, 'Segoe UI', Arial, sans-serif;` +
    `  font-size: ${baseFontSize}px;` +
    `  font-weight: bold;` +
    `  width: ${printableWidth}mm;` +
    `  margin: 0 auto;` +
    `  padding: 0;` +
    `  color: #000; background: #fff;` +
    `  -webkit-print-color-adjust: exact;` +
    `  print-color-adjust: exact;` +
    `}` +
    `@media print {` +
    `  html { -webkit-text-size-adjust: none !important; }` +
    `  body { font-size: ${baseFontSize}px !important; width: ${printableWidth}mm !important; margin: 0 !important; }` +
    `}` +
    `</style></head><body>${body}</body></html>`
  )
}

// ─── Label HTML builders ──────────────────────────────────────────────────────

export interface LabelHtmlConfig {
  labelWidth: number
  labelHeight?: number
  showProductName: boolean
  showPrice: boolean
  showNote: boolean
  customText: string
  lineSpacing?: number
  feedAfterCut?: number
  paddingTop?: number
  paddingBottom?: number
}


export function buildSingleLabelHtml(
  item: AdminOrderItem,
  cfg: LabelHtmlConfig,
  orderRef: string,
  itemIndex: number,
  totalLabels: number,
  printedAt: string,
  fontBase64 = '',
  participantName?: string,
): string {
  const optEntries =
    item.optionsJson &&
      typeof item.optionsJson === 'object' &&
      !Array.isArray(item.optionsJson)
      ? Object.entries(item.optionsJson as Record<string, string>).filter(([, v]) => Boolean(v))
      : []

  const extras = parseExtras(item.extrasJson)
  const priceStr = formatVnd(Number.parseFloat(item.price))
  const w = cfg.labelWidth
  const h = cfg.labelHeight ?? 30

  // ── Header (always at top) ────────────────────────────────────────────────
  const headerHtml =
    `<div style="flex-shrink:0;">` +
    `<div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;font-weight:bold;">` +
    `<span style="font-size:11px;color:#000;">${orderRef}</span>` +
    `<span style="font-size:11px;color:#000;">${itemIndex}/${totalLabels}</span>` +
    `</div>` +
    `<div style="border-top:1px dashed #000;margin:1px 0;"></div>` +
    `</div>`

  // ── Content middle (clips overflow — never pushes to page 2) ─────────────
  const contentLines: string[] = []

  if (cfg.showProductName) {
    contentLines.push(`<div style="font-weight:bold;font-size:10px;line-height:1.1;color:#000;">${esc(item.product.name)}</div>`)
  }

  for (const [k, v] of optEntries) {
    const kLower = k.toLowerCase()
    const vLower = v.toLowerCase()
    const isNgot = kLower.includes('ngọt')
    const hasSweetener = vLower.includes('sữa') || vLower.includes('đường')
    const isSweetenerAdd = hasSweetener && !vLower.includes('không')
    const isSweetenerNone = hasSweetener && vLower.includes('không')
    const hideKey = kLower.includes('size') || kLower.includes('đá') || kLower.includes('kích cỡ') || kLower.includes('chọn ly') || isNgot || isSweetenerAdd || isSweetenerNone
    let displayVal: string
    if (isSweetenerNone) {
      displayVal = 'Ít Ngọt'
    } else if (isSweetenerAdd) {
      displayVal = 'Ngọt vừa'
    } else if (isNgot) {
      displayVal = vLower.includes('ngọt') ? v : `Ngọt ${v.charAt(0).toLowerCase()}${v.slice(1)}`
    } else {
      displayVal = v
    }
    const label = hideKey ? esc(displayVal) : `${esc(k)}: ${esc(displayVal)}`
    contentLines.push(`<div style="font-size:9px;line-height:1.1;color:#000;font-weight:bold;">+ ${label}</div>`)
  }

  for (const ex of extras) {
    contentLines.push(`<div style="font-size:9px;line-height:1.1;color:#000;font-weight:bold;">+ ${esc(ex.name)}</div>`)
  }

  if (cfg.showNote && item.note) {
    contentLines.push(`<div style="display:flex;align-items:center;gap:2px;font-size:9px;line-height:1.1;color:#000;">${stickyNoteIcon(9)}<span style="line-height:1;">${esc(item.note)}</span></div>`)
  }

  if (participantName) {
    contentLines.push(
      `<div style="display:flex;align-items:center;gap:3px;font-size:9px;font-weight:bold;color:#000;">${userIcon(9)}<span style="line-height:1;">${esc(participantName)}</span></div>`,
    )
  }

  if (cfg.customText) {
    contentLines.push(`<div style="font-size:9px;color:#000;">${esc(cfg.customText)}</div>`)
  }

  const contentHtml =
    `<div style="flex:1;overflow:hidden;min-height:0;">` +
    contentLines.join('') +
    `</div>`

  // ── Footer (price/time — pinned to bottom, offset 2mm from edge) ──────────
  const footerHtml =
    `<div style="flex-shrink:0;">` +
    `<div style="display:flex;justify-content:space-between;align-items:center;font-size:9px;">` +
    `<span style="color:#000;">${esc(cfg.showPrice ? priceStr : '')}</span>` +
    `<span style="color:#000;">${esc(printedAt)}</span>` +
    `</div>` +
    `</div>`

  const titleText = `Label ${itemIndex} of ${totalLabels}`
  const fontFace = getFontFaceStyle(fontBase64)
  return (
    `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/>` +
    `<title>${titleText}</title>` +
    `<style>` +
    fontFace +
    `@page { size: ${w}mm ${h}mm; margin: 0; }` +
    `* { box-sizing: border-box; }` +
    `html { -webkit-text-size-adjust: none; text-size-adjust: none; }` +
    `body {` +
    `  font-family: ${FONT_FAMILY};` +
    `  font-weight: 700;` +
    `  ${FONT_SMOOTHING}` +
    `  margin: 0; padding: 0.5mm 2mm 1.5mm;` +
    `  width: ${w - 2}mm; height: ${h}mm;` +
    `  color: #000; background: #fff;` +
    `  font-size: 10px;` +
    `  display: flex; flex-direction: column; overflow: hidden;` +
    `}` +
    `</style></head><body>` +
    headerHtml + contentHtml + footerHtml +
    `</body></html>`
  )
}

export function buildOrderLabels(
  order: AdminOrder,
  cfg: LabelHtmlConfig,
  fontBase64 = '',
): string[] {
  const labels: string[] = []
  const now = new Date()
  const printedAt = dayjs(now).format('DD/MM HH:mm')
  const totalLabels = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const participantMap = buildGroupParticipantMap(order.groupOrder)
  let labelIndex = 1
  for (const item of order.items) {
    let participantName: string | undefined
    if (participantMap.size > 0) {
      const opts = item.optionsJson
        ? JSON.stringify(Object.fromEntries(Object.entries(item.optionsJson).sort()))
        : '{}'
      const extras = Array.isArray(item.extrasJson)
        ? JSON.stringify(
            [...(item.extrasJson as Array<{ name: string }>)]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((e) => e.name),
          )
        : '[]'
      const key = [item.productId, opts, extras, item.note ?? ''].join('\0')
      const names = participantMap.get(key)
      if (names?.length) participantName = names.join(', ')
    }
    for (let i = 0; i < item.quantity; i++) {
      labels.push(
        buildSingleLabelHtml(
          item,
          cfg,
          order.paymentCode ?? order?.orderRef,
          labelIndex,
          totalLabels,
          printedAt,
          fontBase64,
          participantName,
        ),
      )
      labelIndex++
    }
  }
  return labels
}
