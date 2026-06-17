"use client";

import { env } from "@/config/env";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function vnd(n: string | number): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  return new Intl.NumberFormat("vi-VN").format(Math.round(num)) + "đ";
}

const RECEIPT_I18N = {
  vi: {
    order: "Đơn",
    type: "Loại",
    address: "Địa chỉ",
    table: "Bàn",
    subtotal: "Tạm tính",
    discount: "Giảm giá",
    points: "Điểm UjCha",
    shipping: "Phí vận chuyển",
    free: "Miễn phí",
    total: "Tổng cộng",
    payment: "Thanh toán",
    paid: "✓ Đã thanh toán",
    pending: "Chờ thanh toán",
    note: "Ghi chú",
    type_delivery: "Giao hàng",
    type_table: "Tại bàn",
    type_pickup: "Mang đi",
    pay_cash: "Tiền mặt",
    pay_transfer: "Chuyển khoản",
    invoice: "Hóa đơn",
    loyalty_qr_label: "Quét để tích điểm UjCha",
    loyalty_qr_sub: "Tạo tài khoản & nhận điểm cho đơn này",
  },
  en: {
    order: "Order",
    type: "Type",
    address: "Address",
    table: "Table",
    subtotal: "Subtotal",
    discount: "Discount",
    points: "UjCha Points",
    shipping: "Shipping fee",
    free: "Free",
    total: "Total",
    payment: "Payment",
    paid: "✓ Paid",
    pending: "Pending payment",
    note: "Note",
    type_delivery: "Delivery",
    type_table: "Dine in",
    type_pickup: "Pickup",
    pay_cash: "Cash",
    pay_transfer: "Bank transfer",
    invoice: "Invoice",
    loyalty_qr_label: "Scan to earn UjCha points",
    loyalty_qr_sub: "Create an account & claim points for this order",
  },
} as const;

type I18nStrings = typeof RECEIPT_I18N[keyof typeof RECEIPT_I18N];

function getI18n(locale: string): I18nStrings {
  return locale === "en" ? RECEIPT_I18N.en : RECEIPT_I18N.vi;
}

export type ReceiptOrderItem = {
  quantity: number;
  price: string | number;
  productName: string;
  options: Record<string, string>;
  extras: { name: string; price: string | number }[];
  note?: string | null;
};

export type ReceiptOrder = {
  paymentCode: string;
  createdAt: string | Date;
  type: "delivery" | "pickup" | "table" | string;
  paymentType: "cash" | "bank_transfer" | string;
  paymentStatus: "paid" | "pending" | string;
  totalAmount: string | number;
  discountAmount: string | number;
  pointDiscountAmount?: string | number | null;
  shippingFee?: string | number | null;
  finalAmount: string | number;
  items: ReceiptOrderItem[];
  deliveryAddress?: string | null;
  tableName?: string | null;
  tableArea?: string | null;
  earnedPoints?: number | null;
};

function serviceLabel(type: string, i18n: I18nStrings): string {
  if (type === "delivery") return i18n.type_delivery;
  if (type === "table") return i18n.type_table;
  if (type === "pickup") return i18n.type_pickup;
  return type;
}

function payLabel(type: string, i18n: I18nStrings): string {
  return type === "cash" ? i18n.pay_cash : i18n.pay_transfer;
}

function buildItemsHtml(items: ReceiptOrderItem[], i18n: I18nStrings): string {
  const lines: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const lineTotal = (typeof it.price === "string" ? parseFloat(it.price) : it.price) * it.quantity;
    lines.push(
      `<div style="display:grid;grid-template-columns:20px minmax(0,1fr) auto;column-gap:4px;align-items:start;margin:3px 0 2px;">` +
      `<div><span style="display:inline-block;width:18px;height:18px;line-height:16px;background:#fff;border:1.5px solid #000;color:#000;text-align:center;font-weight:bold;font-size:10px;vertical-align:middle;">${it.quantity}x</span></div>` +
      `<div style="font-weight:bold;font-size:11px;word-break:break-word;line-height:1.3;color:#000;">${esc(it.productName)}</div>` +
      `<div style="text-align:right;font-size:11px;font-weight:bold;white-space:nowrap;padding-left:3px;min-width:0;color:#000;">${esc(vnd(lineTotal))}</div>` +
      `</div>`,
    );

    for (const [, v] of Object.entries(it.options)) {
      lines.push(`<div style="margin-left:26px;font-size:11px;font-weight:bold;margin-bottom:1px;color:#000;">+ ${esc(v)}</div>`);
    }
    for (const ex of it.extras) {
      const exPrice = typeof ex.price === "string" ? parseFloat(ex.price) : ex.price;
      lines.push(
        `<div style="display:flex;justify-content:space-between;margin-left:26px;font-size:11px;font-weight:bold;margin-bottom:1px;color:#000;">` +
        `<span>+ ${esc(ex.name)}</span>` +
        (exPrice > 0 ? `<span style="white-space:nowrap;padding-left:4px;">${esc(vnd(exPrice))}</span>` : "") +
        `</div>`,
      );
    }
    if (it.note) {
      lines.push(`<div style="margin-left:26px;font-style:italic;font-size:11px;color:#000;">${esc(i18n.note)}: ${esc(it.note)}</div>`);
    }
    if (i < items.length - 1) {
      lines.push(`<div style="border-bottom:1px dashed #000;margin:5px 0 4px;"></div>`);
    }
  }
  return lines.join("");
}

export function buildReceiptHtml(order: ReceiptOrder, locale = "vi"): string {
  const i18n = getI18n(locale);
  const ref = `#${order.paymentCode}`;
  const localeTag = locale === "en" ? "en-US" : "vi-VN";
  const date = new Date(order.createdAt).toLocaleString(localeTag);
  const subtotal = typeof order.totalAmount === "string" ? parseFloat(order.totalAmount) : order.totalAmount;
  const discount = typeof order.discountAmount === "string" ? parseFloat(order.discountAmount) : order.discountAmount;
  const pointDiscount = order.pointDiscountAmount
    ? (typeof order.pointDiscountAmount === "string" ? parseFloat(order.pointDiscountAmount) : order.pointDiscountAmount)
    : 0;
  const shipping = order.type === "delivery" && order.shippingFee
    ? (typeof order.shippingFee === "string" ? parseFloat(order.shippingFee) : order.shippingFee)
    : 0;
  const total = subtotal - discount - pointDiscount + shipping;

  const body = [
    `<div style="text-align:center;font-size:18px;font-weight:bold;letter-spacing:4px;color:#000;">Ujcha</div>`,
    `<div style="border-top:2px dashed #000;margin:6px 0;"></div>`,

    `<div style="font-size:11px;margin-bottom:1px;color:#000;">${esc(i18n.order)}: <b>${esc(ref)}</b></div>`,
    `<div style="font-size:11px;color:#000;font-weight:bold;margin-bottom:1px;">${esc(date)}</div>`,
    `<div style="font-size:11px;margin-bottom:1px;color:#000;">${esc(i18n.type)}: <b>${esc(serviceLabel(order.type, i18n))}</b></div>`,
    order.deliveryAddress
      ? `<div style="font-size:10px;color:#000;font-weight:bold;margin-bottom:1px;">${esc(i18n.address)}: ${esc(order.deliveryAddress)}</div>`
      : "",
    order.tableName
      ? `<div style="font-size:10px;color:#000;font-weight:bold;margin-bottom:1px;">${esc(i18n.table)}: ${esc(order.tableName)}${order.tableArea ? ` — ${esc(order.tableArea)}` : ""}</div>`
      : "",
    `<div style="border-top:2px dashed #000;margin:6px 0;"></div>`,

    buildItemsHtml(order.items, i18n),
    `<div style="border-top:2px dashed #000;margin:6px 0;"></div>`,

    `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;color:#000;"><span>${esc(i18n.subtotal)}</span><span style="white-space:nowrap;">${esc(vnd(subtotal))}</span></div>`,
    discount > 0
      ? `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;color:#000;"><span>${esc(i18n.discount)}</span><span style="white-space:nowrap;">-${esc(vnd(discount))}</span></div>`
      : "",
    pointDiscount > 0
      ? `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;color:#000;"><span>${esc(i18n.points)}</span><span style="white-space:nowrap;">-${esc(vnd(pointDiscount))}</span></div>`
      : "",
    order.type === "delivery"
      ? `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;color:#000;"><span>${esc(i18n.shipping)}</span><span style="white-space:nowrap;">${shipping > 0 ? esc(vnd(shipping)) : esc(i18n.free)}</span></div>`
      : "",
    `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;margin-top:3px;color:#000;"><span>${esc(i18n.total)}</span><span style="white-space:nowrap;">${esc(vnd(total))}</span></div>`,
    `<div style="font-size:11px;margin-top:2px;color:#000;">${esc(i18n.payment)}: <b>${esc(payLabel(order.paymentType, i18n))}</b></div>`,
    order.paymentStatus === "paid"
      ? `<div style="font-size:11px;font-weight:bold;color:#000;margin-top:1px;">${esc(i18n.paid)}</div>`
      : `<div style="font-size:11px;color:#000;margin-top:1px;">${esc(i18n.pending)}</div>`,

    `<div style="border-top:1px dashed #000;margin:4px 0;"></div>`,
    !(order.earnedPoints) ? (
      `<div style="text-align:center;margin:6px 0 4px;">` +
      `<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`${env.SITE_URL}/${locale}/register?order=${order.paymentCode}`)}" width="80" height="80" style="display:block;margin:0 auto;" alt="QR"/>` +
      `<div style="font-size:10px;font-weight:bold;color:#000;margin-top:3px;">${esc(i18n.loyalty_qr_label)}</div>` +
      `<div style="font-size:9px;color:#444;margin-top:1px;">${esc(i18n.loyalty_qr_sub)}</div>` +
      `</div>` +
      `<div style="border-top:1px dashed #000;margin:4px 0;"></div>`
    ) : "",
    `<div style="text-align:center;font-size:10px;color:#000;">${env.SITE_URL}</div>`,
  ].join("");

  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"/>` +
    `<title>${esc(i18n.invoice)} ${esc(ref)}</title>` +
    `<style>` +
    `@page { size: auto; margin: 1.5mm; }` +
    `body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 55mm; width: 100%; margin: 0; font-size: 11px; font-weight: bold; color: #000; }` +
    `* { box-sizing: border-box; }` +
    `</style></head><body>${body}</body></html>`
  );
}

export function printReceipt(order: ReceiptOrder, locale = "vi"): void {
  const html = buildReceiptHtml(order, locale);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 600);
}
