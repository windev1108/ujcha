"use client";

import type { ApiCartItem } from "@/services/cart/types";
import { normalizeOptionGroups } from "@/lib/product-options";


function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function vnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

export type WebReceiptData = {
  orderId: string;
  paymentCode: string;
  createdAt: Date;
  type: "delivery" | "pickup";
  items: ApiCartItem[];
  total: number;
  paymentMethod: "cash" | "bank_transfer";
  address?: string;
  contactName?: string;
  contactPhone?: string;
};

export function buildWebReceiptHtml(d: WebReceiptData): string {
  const ref = `#${d.orderId.slice(0, 8).toUpperCase()}`;
  const date = d.createdAt.toLocaleString("vi-VN");
  const serviceLabel = d.type === "delivery" ? "Giao hàng" : "Mang đi";
  const payLabel = d.paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản";

  let itemLines = "";
  for (const item of d.items) {
    const discounted = item.product.finalPrice;
    const groups = normalizeOptionGroups(item.product.optionGroups);

    let unitPrice = discounted;
    for (const g of groups) {
      const sel = item.selectedOptions[g.name];
      const v = sel ? g.values.find((vv) => vv.label === sel) : null;
      if (v) unitPrice += v.priceDelta;
    }
    for (const t of (item.toppings ?? [])) {
      unitPrice += parseFloat(t.topping.price);
    }
    const lineTotal = unitPrice * item.quantity;

    itemLines += `<div style="display:grid;grid-template-columns:22px 1fr auto;gap:4px;align-items:start;margin:3px 0 1px;">`;
    itemLines += `<b style="font-size:12px;">${item.quantity}x</b>`;
    itemLines += `<span style="font-weight:bold;font-size:13px;word-break:break-word;">${esc(item.product.name)}</span>`;
    itemLines += `<span style="text-align:right;white-space:nowrap;font-weight:bold;font-size:13px;">${esc(vnd(lineTotal))}</span>`;
    itemLines += `</div>`;

    for (const [k, v] of Object.entries(item.selectedOptions)) {
      const grp = groups.find((g) => g.name === k);
      const val = grp?.values.find((vv) => vv.label === v);
      const pd = val?.priceDelta ?? 0;
      itemLines += `<div style="margin-left:26px;font-size:11px;color:#333;">+ ${esc(k)}: ${esc(v)}${pd > 0 ? ` (+${esc(vnd(pd))})` : ""}</div>`;
    }

    for (const t of (item.toppings ?? [])) {
      const tp = parseFloat(t.topping.price);
      itemLines += `<div style="margin-left:26px;font-size:11px;color:#333;display:flex;justify-content:space-between;">`;
      itemLines += `<span>+ ${esc(t.topping.name)}</span><span>${esc(vnd(tp))}</span>`;
      itemLines += `</div>`;
    }

    itemLines += `<div style="border-bottom:1px dashed #bbb;margin:4px 0 3px;"></div>`;
  }

  const contactLine = [d.contactName, d.contactPhone].filter(Boolean).join(" · ");

  const body = [
    `<div style="text-align:center;font-size:22px;font-weight:bold;letter-spacing:4px;margin-bottom:2px;">Ujcha</div>`,
    `<div style="border-top:2px dashed #000;margin:5px 0;"></div>`,
    `<div style="font-size:12px;margin-bottom:1px;">Đơn: <b>${esc(ref)}</b></div>`,
    `<div style="font-size:11px;color:#444;margin-bottom:1px;">${esc(date)}</div>`,
    `<div style="font-size:12px;margin-bottom:1px;">Loại: <b>${esc(serviceLabel)}</b></div>`,
    contactLine ? `<div style="font-size:12px;margin-bottom:1px;">${esc(contactLine)}</div>` : "",
    d.address ? `<div style="font-size:11px;color:#444;margin-bottom:1px;">${esc(d.address)}</div>` : "",
    `<div style="border-top:2px dashed #000;margin:5px 0;"></div>`,
    itemLines,
    `<div style="border-top:2px dashed #000;margin:5px 0;"></div>`,
    `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:15px;">`,
    `<span>Tổng cộng</span><span>${esc(vnd(d.total))}</span>`,
    `</div>`,
    `<div style="font-size:12px;margin-top:2px;">Thanh toán: <b>${esc(payLabel)}</b></div>`,
    `<div style="border-top:2px dashed #000;margin:8px 0 4px;"></div>`,
    `<div style="text-align:center;font-size:11px;color:#555;">Cảm ơn bạn đã đến với Ujcha!</div>`,
  ].join("");

  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"/>` +
    `<title>Hóa đơn ${esc(ref)}</title>` +
    `<style>` +
    `@page { size: 80mm auto; margin: 4mm; }` +
    `body { font-family: ui-sans-serif, system-ui, sans-serif; width: 80mm; margin: 0 auto; font-size: 13px; color: #000; }` +
    `* { box-sizing: border-box; }` +
    `</style></head><body>${body}</body></html>`
  );
}

export function printWebReceipt(data: WebReceiptData): void {
  const html = buildWebReceiptHtml(data);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}
