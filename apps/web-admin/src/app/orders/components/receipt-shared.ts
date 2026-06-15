import { formatOrderRef } from "@/app/orders/components/order-display";
import { formatVnd } from "@/lib/product-display";
import {
  DEFAULT_PRINTER_CONFIG,
  type PrinterConfig,
  type ReceiptElement,
} from "@/lib/printer-config";
import type { AdminOrder, AdminOrderItem, OrderItemExtraSnapshot, PaymentConfig } from "@/services/admin/types";
import { env } from "@/config/env";

export function buildVietQrUrl(
  cfg: PaymentConfig,
  amount: number,
  content: string,
): string {
  const p = new URLSearchParams({
    bank: cfg.bankCode,
    acc: cfg.accountNumber,
    template: "qronly",
    amount: String(Math.round(amount)),
    des: content,
  });
  return `https://qr.sepay.vn/img?${p.toString()}`;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseExtras(raw: unknown): OrderItemExtraSnapshot[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is OrderItemExtraSnapshot =>
      x != null &&
      typeof x === "object" &&
      "name" in x &&
      typeof (x as OrderItemExtraSnapshot).name === "string",
  );
}

export function parseOptions(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export function serviceLabel(t: AdminOrder["type"]): string {
  switch (t) {
    case "delivery": return "Giao hàng";
    case "table": return "Tại bàn";
    case "pickup": return "Mang đi";
    default: return t;
  }
}

export function groupOrderItems(items: AdminOrderItem[]): AdminOrderItem[] {
  const merged = new Map<string, AdminOrderItem>();
  for (const item of items) {
    const opts =
      item.optionsJson && typeof item.optionsJson === "object" && !Array.isArray(item.optionsJson)
        ? JSON.stringify(
          Object.fromEntries(
            Object.entries(item.optionsJson as Record<string, unknown>).sort(),
          ),
        )
        : "{}";
    const extras = Array.isArray(item.extrasJson)
      ? JSON.stringify(
        [...(item.extrasJson as Array<{ name: string }>)]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((e) => e.name),
      )
      : "[]";
    const key = [item.product.id, item.price, item.note ?? "", opts, extras].join("\0");
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, { ...existing, quantity: existing.quantity + item.quantity });
    } else {
      merged.set(key, { ...item });
    }
  }
  return [...merged.values()];
}

function renderItems(order: AdminOrder, el: ReceiptElement): string {
  const lines: string[] = [];
  const nameFs = Math.max(el.fontSize, 13);
  const subFs = Math.max(el.fontSize - 2, 11);
  const grouped = groupOrderItems(order.items);

  for (let i = 0; i < grouped.length; i++) {
    const it = grouped[i];
    const extras = parseExtras(it.extrasJson);
    const opts = parseOptions(it.optionsJson);
    const lineTotal = Number.parseFloat(it.price) * it.quantity;

    lines.push(
      `<div style="display:grid;grid-template-columns:22px minmax(0,1fr) auto;column-gap:6px;align-items:start;margin:4px 0 2px;">` +
      `<div style="padding-top:1px;"><span style="display:inline-block;width:20px;height:20px;line-height:18px;background:#fff;border:1.5px solid #000;color:#000;text-align:center;font-weight:bold;font-size:11px;vertical-align:middle;">${it.quantity}x</span></div>` +
      `<div style="font-weight:bold;font-size:${nameFs}px;word-break:break-word;line-height:1.3;color:#000;">${esc(it.product.name)}</div>` +
      `<div style="text-align:right;font-size:${nameFs}px;font-weight:bold;white-space:nowrap;padding-left:4px;color:#000;">${esc(formatVnd(lineTotal))}</div>` +
      `</div>`,
    );

    for (const [, v] of Object.entries(opts)) {
      lines.push(`<div style="margin-left:26px;font-size:${subFs}px;margin-bottom:1px;color:#000;">+ ${esc(v)}</div>`);
    }
    for (const ex of extras) {
      const exPrice = Number(ex.price ?? 0);
      lines.push(
        `<div style="display:flex;justify-content:space-between;margin-left:26px;font-size:${subFs}px;margin-bottom:1px;color:#000;">` +
        `<span>+ ${esc(ex.name)}</span>` +
        `${exPrice > 0 ? `<span style="white-space:nowrap;padding-left:4px;">${esc(formatVnd(exPrice))}</span>` : ""}` +
        `</div>`,
      );
    }
    if (it.note) {
      lines.push(`<div style="margin-left:26px;font-style:italic;font-size:${subFs}px;color:#000;">Ghi chú: ${esc(it.note)}</div>`);
    }
    if (i < grouped.length - 1) {
      lines.push(`<div style="border-bottom:1px dashed #000;margin:5px 0 4px;"></div>`);
    }
  }
  return lines.join("");
}

function renderElement(
  el: ReceiptElement,
  order: AdminOrder,
  loyaltyQrUrl?: string,
): string {
  if (!el.visible) return "";

  const aln = `text-align:${el.align};`;
  const fs = `font-size:${el.fontSize}px;`;
  const bold = el.bold ? "font-weight:bold;" : "";
  const base = `${aln}${fs}${bold}color:#000;`;

  switch (el.type) {
    case "shop-name":
      return `<div style="${base}letter-spacing:2px;">Ujcha</div>`;

    case "order-ref":
      return `<div style="${base}margin-bottom:2px;">${esc(formatOrderRef(order))}</div>`;

    case "date":
      return `<div style="${base}margin-bottom:2px;">${esc(new Date(order.createdAt).toLocaleString("vi-VN"))}</div>`;

    case "service-type":
      return `<div style="${base}margin-bottom:2px;">Loại: ${esc(serviceLabel(order.type))}</div>`;

    case "divider":
      return `<div style="border-top:2px dashed #000;margin:6px 0;"></div>`;

    case "items":
      return renderItems(order, el);

    case "subtotal":
      return `<div style="display:flex;justify-content:space-between;${fs}${bold}margin-bottom:2px;color:#000;"><span>Tạm tính</span><span style="white-space:nowrap;">${esc(formatVnd(order.totalAmount))}</span></div>`;

    case "discount": {
      const disc = Number(order.discountAmount) || 0;
      const ptDisc = Number(order.pointDiscountAmount) || 0;
      let html = "";
      if (disc > 0) html += `<div style="display:flex;justify-content:space-between;${fs}${bold}margin-bottom:2px;color:#000;"><span>Giảm giá</span><span style="white-space:nowrap;">-${esc(formatVnd(disc))}</span></div>`;
      if (ptDisc > 0) html += `<div style="display:flex;justify-content:space-between;${fs}${bold}margin-bottom:2px;color:#000;"><span>Điểm UjCha</span><span style="white-space:nowrap;">-${esc(formatVnd(ptDisc))}</span></div>`;
      return html;
    }

    case "total": {
      const subtotal = Number(order.totalAmount) || 0;
      const disc = Number(order.discountAmount) || 0;
      const ptDisc = Number(order.pointDiscountAmount) || 0;
      const ship = order.type === "delivery" ? (Number(order.shippingFee) || 0) : 0;
      const total = subtotal - disc - ptDisc + ship;
      let html = "";
      if (order.type === "delivery") {
        html += `<div style="display:flex;justify-content:space-between;${fs}margin-bottom:2px;color:#000;"><span>Phí vận chuyển</span><span style="white-space:nowrap;">${ship > 0 ? esc(formatVnd(ship)) : "Miễn phí"}</span></div>`;
      }
      html += `<div style="display:flex;justify-content:space-between;${fs}${bold}margin-top:3px;color:#000;"><span>Tổng cộng</span><span style="white-space:nowrap;">${esc(formatVnd(total))}</span></div>`;
      return html;
    }

    case "payment-status":
      return `<div style="${fs}${bold}margin-bottom:3px;color:#000;"><b>Trạng thái:</b> ${order.paymentStatus === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}</div>`;

    case "qr-code":
      if (loyaltyQrUrl) {
        return (
          `<div style="border-top:2px dashed #000;margin:8px 0 6px;"></div>` +
          `<div style="text-align:center;font-size:12px;font-weight:bold;letter-spacing:0.5px;margin-bottom:6px;color:#000;">QUÉT ĐỂ TÍCH ĐIỂM</div>` +
          `<img src="${loyaltyQrUrl}" style="display:block;margin:0 auto 4px;width:160px;height:160px;" />` +
          `<div style="text-align:center;font-size:10px;color:#000;margin-bottom:6px;">${process.env.NEXT_PUBLIC_WEB_URL ?? 'https://ujcha.vn'}</div>`
        );
      }
      return "";

    case "custom-text":
      return el.customText?.trim()
        ? `<div style="${base}margin-bottom:2px;">${esc(el.customText)}</div>`
        : "";

    default:
      return "";
  }
}

export function buildReceiptBodyHtml(
  order: AdminOrder,
  loyaltyQrUrl?: string,
  printerCfg?: PrinterConfig | null,
): string {
  const cfg = printerCfg ?? DEFAULT_PRINTER_CONFIG;
  return cfg.elements.map((el) => renderElement(el, order, loyaltyQrUrl)).join("");
}

export function buildReceiptDocumentHtml(
  order: AdminOrder,
  loyaltyQrUrl?: string,
  printerCfg?: PrinterConfig | null,
): string {
  const cfg = printerCfg ?? DEFAULT_PRINTER_CONFIG;
  const body = buildReceiptBodyHtml(order, loyaltyQrUrl, cfg);
  const ff = cfg.fontFamily === "monospace"
    ? "ui-monospace, monospace"
    : "ui-sans-serif, system-ui, sans-serif";
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"/>` +
    `<title>Hóa đơn ${esc(formatOrderRef(order))}</title>` +
    `<style>` +
    `@page { size: ${cfg.paperWidth}mm auto; margin: 2mm; }` +
    `body { font-family: ${ff}; font-size: 17px; width: 100%; margin: 0; box-sizing: border-box; color: #000; }` +
    `@media print { body { font-size: 19px !important; } }` +
    `</style></head><body>${body}</body></html>`
  );
}
