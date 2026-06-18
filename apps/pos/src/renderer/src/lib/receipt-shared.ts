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

function buildBillItems(order: AdminOrder, paperWidth: number): string {
  const nameFs = paperWidth <= 58 ? 11 : 13
  const subFs = paperWidth <= 58 ? 10 : 11
  const grouped = groupOrderItems(order.items)
  const lines: string[] = []
  for (let i = 0; i < grouped.length; i++) {
    const it = grouped[i]
    const extras = parseExtras(it.extrasJson)
    const opts = parseOptions(it.optionsJson)
    const lineTotal = Number.parseFloat(it.price) * it.quantity
    const colGap = paperWidth <= 58 ? 4 : 6
    lines.push(
      `<div style="display:grid;grid-template-columns:22px minmax(0,1fr) auto;column-gap:${colGap}px;align-items:start;margin:4px 0 2px;">` +
      `<div><span style="display:inline-block;width:20px;height:20px;line-height:18px;background:#fff;border:1.5px solid #000;color:#000;text-align:center;font-weight:bold;font-size:${subFs}px;vertical-align:middle;">${it.quantity}x</span></div>` +
      `<div style="font-weight:bold;font-size:${nameFs}px;word-break:break-word;line-height:1.3;color:#000;">${esc(it.product.name)}</div>` +
      `<div style="text-align:right;font-size:${nameFs}px;font-weight:bold;white-space:nowrap;padding-left:4px;min-width:0;color:#000;">${esc(formatVnd(lineTotal))}</div>` +
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
        (exPrice > 0 ? `<span style="white-space:nowrap;padding-left:4px;">${esc(formatVnd(exPrice))}</span>` : '') +
        `</div>`,
      )
    }
    if (it.note) {
      lines.push(`<div style="margin-left:26px;font-style:italic;font-size:${subFs}px;color:#000;">${esc(RECEIPT_I18N.note)}: ${esc(it.note)}</div>`)
    }
    if (i < grouped.length - 1) {
      lines.push(`<div style="border-bottom:1px dashed #000;margin:5px 0 4px;"></div>`)
    }
  }
  return lines.join('')
}

function renderItems(order: AdminOrder, el: ReceiptElement, paperWidth: number): string {
  const lines: string[] = []
  // FIX: font size nhỏ hơn cho 58mm để không tràn giấy
  const nameFs = paperWidth <= 58 ? Math.max(el.fontSize - 2, 11) : Math.max(el.fontSize, 13)
  const subFs = paperWidth <= 58 ? Math.max(el.fontSize - 4, 9) : Math.max(el.fontSize - 2, 11)
  const grouped = groupOrderItems(order.items)

  for (let i = 0; i < grouped.length; i++) {
    const it = grouped[i]
    const extras = parseExtras(it.extrasJson)
    const opts = parseOptions(it.optionsJson)

    const lineTotal = Number.parseFloat(it.price) * it.quantity

    // Item row: qty box | name | price
    lines.push(
      `<div style="display:grid;grid-template-columns:22px minmax(0,1fr) auto;column-gap:4px;align-items:start;margin:4px 0 2px;">` +
      `<div style="padding-top:1px;"><span style="display:inline-block;width:20px;height:20px;line-height:18px;background:#fff;border:1.5px solid #000;color:#000;text-align:center;font-weight:bold;font-size:${subFs}px;vertical-align:middle;">${it.quantity}x</span></div>` +
      `<div style="font-weight:bold;font-size:${nameFs}px;word-break:break-word;line-height:1.3;color:#000;">${esc(it.product.name)}</div>` +
      `<div style="text-align:right;font-size:${nameFs}px;font-weight:bold;white-space:nowrap;padding-left:2px;min-width:0;color:#000;">${esc(formatVnd(lineTotal))}</div>` +
      `</div>`,
    )

    for (const [k, v] of Object.entries(opts)) {
      lines.push(`<div style="margin-left:26px;font-size:${subFs}px;font-weight:bold;margin-bottom:1px;color:#000;">+ ${esc(k)}: ${esc(v)}</div>`)
    }

    // Extras / Toppings
    for (const ex of extras) {
      const exPrice = Number(ex.price ?? 0)
      lines.push(
        `<div style="display:flex;justify-content:space-between;margin-left:26px;font-size:${subFs}px;margin-bottom:1px;color:#000;">` +
        `<span>+ ${esc(ex.name)}</span>` +
        `${exPrice > 0 ? `<span style="white-space:nowrap;padding-left:4px;">${esc(formatVnd(exPrice))}</span>` : ''}` +
        `</div>`,
      )
    }

    // Ghi chú
    if (it.note) {
      lines.push(
        `<div style="margin-left:26px;font-style:italic;font-size:${subFs}px;color:#000;">Ghi chú: ${esc(it.note)}</div>`,
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
  const bold = el.bold ? 'font-weight:bold;' : ''
  const base = `${aln}${fs}${bold}color:#000;`

  switch (el.type) {
    case 'shop-name':
      return (
        `<div style="${aln}font-size:${paperWidth <= 58 ? 16 : 20}px;font-weight:bold;letter-spacing:2px;color:#000;margin-bottom:1px;">Ujcha</div>`
      )

    case 'order-ref':
      return (
        `<div style="${aln}font-size:${paperWidth <= 58 ? 18 : 22}px;font-weight:bold;letter-spacing:1px;color:#000;margin-bottom:2px;">${esc(order.paymentCode ?? formatOrderRef(order))}</div>` +
        (order.items.length > 0
          ? `<div style="${aln}font-size:${paperWidth <= 58 ? 9 : 11}px;color:#000;margin-bottom:1px;">${order.items.reduce((s, i) => s + i.quantity, 0)} san pham${order.guestDeliveryName ? ` cho ${esc(order.guestDeliveryName)}` : ''}</div>`
          : '')
      )

    case 'date':
      return `<div style="${base}margin-bottom:2px;">${esc(new Date(order.createdAt).toLocaleString('vi-VN'))}</div>`

    case 'service-type': {
      let html = `<div style="${base}margin-bottom:2px;">Loai: ${esc(serviceLabel(order.type))}</div>`
      if (order.type === 'delivery') {
        const name = order.guestDeliveryName
        const phone = order.guestDeliveryPhone
        const addr = order.guestDeliveryAddress
        if (name || phone) {
          html += `<div style="${base}margin-bottom:1px;">`
          if (name) html += esc(name)
          if (name && phone) html += ' - '
          if (phone) html += esc(phone)
          html += `</div>`
        }
        if (addr) {
          html += `<div style="${aln}font-size:${Math.max(scaledFontSize - 2, 8)}px;color:#000;word-break:break-word;margin-bottom:2px;">${esc(addr)}</div>`
        }
      }
      return html
    }

    case 'divider':
      return `<div style="border-top:1px dashed #000;margin:4px 0;"></div>`

    case 'items':
      return renderItems(order, el, paperWidth)

    case 'subtotal':
      return `<div style="display:flex;justify-content:space-between;${fs}${bold}margin-bottom:2px;color:#000;"><span>Tam tinh</span><span style="white-space:nowrap;">${esc(formatVnd(order.totalAmount))}</span></div>`

    case 'discount': {
      const disc = Number(order.discountAmount) || 0
      const ptDisc = Number(order.pointDiscountAmount) || 0
      let html = ''
      if (disc > 0) html += `<div style="display:flex;justify-content:space-between;${fs}${bold}margin-bottom:2px;color:#000;"><span>Giảm giá</span><span style="white-space:nowrap;">-${esc(formatVnd(disc))}</span></div>`
      if (ptDisc > 0) html += `<div style="display:flex;justify-content:space-between;${fs}${bold}margin-bottom:2px;color:#000;"><span>Điểm UjCha</span><span style="white-space:nowrap;">-${esc(formatVnd(ptDisc))}</span></div>`
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
        html += `<div style="display:flex;justify-content:space-between;${fs}${bold}margin-bottom:2px;color:#000;"><span>Phi van chuyen</span><span style="white-space:nowrap;">${ship > 0 ? esc(formatVnd(ship)) : 'Mien phi'}</span></div>`
      }
      html += `<div style="display:flex;justify-content:space-between;${fs}${bold}margin-top:3px;color:#000;"><span>Tong cong</span><span style="white-space:nowrap;">${esc(formatVnd(total))}</span></div>`
      return html
    }

    case 'payment-status':
      return `<div style="${fs}${bold}margin-bottom:3px;color:#000;"><b>Trang thai:</b> ${order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}</div>`

    case 'qr-code':
      if (loyaltyQrUrl) {
        return (
          `<div style="border-top:2px dashed #000;margin:8px 0 6px;"></div>` +
          `<div style="text-align:center;font-size:12px;font-weight:bold;letter-spacing:0.5px;margin-bottom:6px;color:#000;">QUÉT ĐỂ TÍCH ĐIỂM UJCHA</div>` +
          `<img src="${loyaltyQrUrl}" style="display:block;margin:0 auto 4px;width:160px;height:160px;" />` +
          `<div style="text-align:center;font-size:10px;color:#000;margin-bottom:6px;">Đăng nhập &amp; tích điểm ngay từ đơn hàng này</div>`
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
  const shopNameFs = paperWidth <= 58 ? 18 : 22
  const qrSize = paperWidth <= 58 ? 120 : 160

  const ref = `#${order.paymentCode ?? order.orderRef}`
  const date = new Date(order.createdAt).toLocaleString('vi-VN')
  const subtotal = Number(order.totalAmount) || 0
  const discount = Number(order.discountAmount) || 0
  const pointDiscount = Number(order.pointDiscountAmount) || 0
  const ship = order.type === 'delivery' ? (Number(order.shippingFee) || 0) : 0
  const total = subtotal - discount - pointDiscount + ship

  const deliveryAddr = order.guestDeliveryAddress ?? order.address?.fullAddress
  const hasContact = order.guestDeliveryName || order.guestDeliveryPhone

  const body = [
    `<div style="text-align:center;font-size:${shopNameFs}px;font-weight:bold;letter-spacing:4px;color:#000;">Ujcha</div>`,
    `<div style="border-top:2px dashed #000;margin:6px 0;"></div>`,

    `<div style="font-size:12px;margin-bottom:1px;color:#000;">${esc(RECEIPT_I18N.order)}: <b>${esc(ref)}</b></div>`,
    `<div style="font-size:11px;color:#000;font-weight:bold;margin-bottom:1px;">${esc(date)}</div>`,
    `<div style="font-size:12px;margin-bottom:1px;color:#000;">${esc(RECEIPT_I18N.type)}: <b>${esc(receiptServiceLabel(order.type))}</b></div>`,

    deliveryAddr ? `<div style="font-size:11px;color:#000;font-weight:bold;margin-bottom:1px;">${esc(RECEIPT_I18N.address)}: ${esc(deliveryAddr)}</div>` : '',
    hasContact ? `<div style="font-size:11px;color:#000;font-weight:bold;margin-bottom:1px;">${[order.guestDeliveryName, order.guestDeliveryPhone].filter(Boolean).map((s) => esc(s!)).join(' · ')}</div>` : '',
    order.table?.name ? `<div style="font-size:11px;color:#000;font-weight:bold;margin-bottom:1px;">${esc(RECEIPT_I18N.table)}: ${esc(order.table.name)}</div>` : '',

    `<div style="border-top:2px dashed #000;margin:6px 0;"></div>`,

    buildBillItems(order, paperWidth),
    `<div style="border-top:2px dashed #000;margin:6px 0;"></div>`,

    `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;color:#000;"><span>${esc(RECEIPT_I18N.subtotal)}</span><span style="white-space:nowrap;">${esc(formatVnd(subtotal))}</span></div>`,
    discount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;color:#000;"><span>${esc(RECEIPT_I18N.discount)}</span><span style="white-space:nowrap;">-${esc(formatVnd(discount))}</span></div>` : '',
    pointDiscount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;color:#000;"><span>${esc(RECEIPT_I18N.points)}</span><span style="white-space:nowrap;">-${esc(formatVnd(pointDiscount))}</span></div>` : '',
    order.type === 'delivery' ? `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;color:#000;"><span>${esc(RECEIPT_I18N.shipping)}</span><span style="white-space:nowrap;">${ship > 0 ? esc(formatVnd(ship)) : esc(RECEIPT_I18N.free)}</span></div>` : '',
    `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:15px;margin-top:3px;color:#000;"><span>${esc(RECEIPT_I18N.total)}</span><span style="white-space:nowrap;">${esc(formatVnd(total))}</span></div>`,
    `<div style="font-size:12px;margin-top:2px;color:#000;">${esc(RECEIPT_I18N.payment)}: <b>${esc(receiptPayLabel(order.paymentType))}</b></div>`,
    order.paymentStatus === 'paid'
      ? `<div style="font-size:12px;font-weight:bold;color:#000;margin-top:1px;">${esc(RECEIPT_I18N.paid)}</div>`
      : `<div style="font-size:12px;color:#000;margin-top:1px;">${esc(RECEIPT_I18N.pending)}</div>`,

    loyaltyQrUrl
      ? (
        `<div style="border-top:2px dashed #000;margin:8px 0 6px;"></div>` +
        `<div style="text-align:center;font-size:12px;font-weight:bold;letter-spacing:0.5px;margin-bottom:6px;color:#000;">${esc(RECEIPT_I18N.scan_loyalty)}</div>` +
        `<img src="${loyaltyQrUrl}" style="display:block;margin:0 auto 4px;width:${qrSize}px;height:${qrSize}px;" />` +
        `<div style="text-align:center;font-size:10px;color:#000;margin-bottom:6px;">${esc(RECEIPT_I18N.scan_sub)}</div>`
      )
      : '',

    `<div style="border-top:1px dashed #000;margin:4px 0;"></div>`,
    WEB_URL ? `<div style="text-align:center;font-size:10px;color:#000;">${esc(WEB_URL)}</div>` : '',
  ].join('')

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

  const lines: string[] = []

  lines.push(
    `<div style="display:flex;justify-content:space-between;align-items:center;font-weight:bold;font-size:10px;">` +
    `<span style="color:#000;font-size:11px;">${orderRef}</span>` +
    `<span style="color:#000;font-size:11px;">${itemIndex}/${totalLabels}</span>` +
    `</div>`,
  )

  lines.push(`<div style="border-top:1px dashed #000;margin:2px 0;"></div>`)

  if (cfg.showProductName) {
    lines.push(`<div style="font-weight:bold;font-size:11px;line-height:1.2;color:#000;">${esc(item.product.name)}</div>`)
  }

  for (const [k, v] of optEntries) {
    lines.push(`<div style="font-size:9px;line-height:1.2;color:#000;font-weight:bold;">+ ${esc(k)}: ${esc(v)}</div>`)
  }

  for (const ex of extras) {
    lines.push(`<div style="font-size:9px;line-height:1.2;color:#000;font-weight:bold;">+ ${esc(ex.name)}</div>`)
  }

  if (cfg.showNote && item.note) {
    lines.push(`<div style="font-size:9px;line-height:1.2;font-style:italic;color:#000;">* ${esc(item.note)}</div>`)
  }

  if (cfg.customText) {
    lines.push(`<div style="font-size:9px;color:#000;">${esc(cfg.customText)}</div>`)
  }

  // lines.push(`<div style="border-top:1px dashed #000;margin:2px 0;"></div>`)

  const footerLeft = cfg.showPrice ? priceStr : ''
  lines.push(
    `<div style="display:flex;justify-content:space-between;align-items:center;font-size:9px;margin-top:3px;">` +
    `<span style="color:#000;">${esc(footerLeft)}</span>` +
    `<span style="color:#000;">${esc(printedAt)}</span>` +
    `</div>`,
  )

  const titleText = `Label ${itemIndex} of ${totalLabels}`
  const fontFace = getFontFaceStyle(fontBase64)
  return (
    `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/>` +
    `<title>${titleText}</title>` +
    `<style>` +
    fontFace +
    `@page { size: ${w}mm auto; margin: 0; }` +
    `* { box-sizing: border-box; }` +
    `html { -webkit-text-size-adjust: none; text-size-adjust: none; }` +
    `body {` +
    `  font-family: ${FONT_FAMILY};` +
    `  font-weight: 700;` +
    `  ${FONT_SMOOTHING}` +
    `  margin: 0; padding: 1mm 2mm;` +
    `  width: ${w}mm; color: #000; background: #fff;` +
    `  font-size: 10px;` +
    `}` +
    `</style></head><body>` +
    lines.join('') +
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
  const printedAt = dayjs(now).locale('vi').format('DD/MM/YYYY HH:mm ')
  const totalLabels = order.items.reduce((sum, item) => sum + item.quantity, 0)
  let labelIndex = 1
  for (const item of order.items) {
    for (let i = 0; i < item.quantity; i++) {
      labels.push(
        buildSingleLabelHtml(
          item,
          cfg,
          order.paymentCode ?? order?.orderRef,
          labelIndex,
          totalLabels,
          printedAt,
          fontBase64
        ),
      )
      labelIndex++
    }
  }
  return labels
}