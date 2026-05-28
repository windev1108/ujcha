"use client";

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
};

function serviceLabel(t: string): string {
  if (t === "delivery") return "Giao hàng";
  if (t === "table") return "Tại bàn";
  if (t === "pickup") return "Mang đi";
  return t;
}

function payLabel(t: string): string {
  return t === "cash" ? "Tiền mặt" : "Chuyển khoản";
}

function buildItemsHtml(items: ReceiptOrderItem[]): string {
  const lines: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const lineTotal = (typeof it.price === "string" ? parseFloat(it.price) : it.price) * it.quantity;
    const optStr = Object.entries(it.options)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    lines.push(
      `<div style="display:grid;grid-template-columns:22px minmax(0,1fr) auto;column-gap:6px;align-items:start;margin:4px 0 2px;">` +
      `<div><span style="display:inline-block;width:20px;height:20px;line-height:18px;background:#fff;border:1.5px solid #000;color:#000;text-align:center;font-weight:bold;font-size:11px;vertical-align:middle;">${it.quantity}x</span></div>` +
      `<div style="font-weight:bold;font-size:13px;word-break:break-word;line-height:1.3;color:#000;">${esc(it.productName)}</div>` +
      `<div style="text-align:right;font-size:13px;font-weight:bold;white-space:nowrap;padding-left:4px;min-width:60px;color:#000;">${esc(vnd(lineTotal))}</div>` +
      `</div>`,
    );

    if (optStr) {
      lines.push(`<div style="margin-left:26px;font-size:11px;margin-bottom:1px;color:#000;">${esc(optStr)}</div>`);
    }
    for (const ex of it.extras) {
      const exPrice = typeof ex.price === "string" ? parseFloat(ex.price) : ex.price;
      lines.push(
        `<div style="display:flex;justify-content:space-between;margin-left:26px;font-size:11px;margin-bottom:1px;color:#000;">` +
        `<span>+ ${esc(ex.name)}</span>` +
        (exPrice > 0 ? `<span style="white-space:nowrap;padding-left:4px;">${esc(vnd(exPrice))}</span>` : "") +
        `</div>`,
      );
    }
    if (it.note) {
      lines.push(`<div style="margin-left:26px;font-style:italic;font-size:11px;color:#000;">Ghi chú: ${esc(it.note)}</div>`);
    }
    if (i < items.length - 1) {
      lines.push(`<div style="border-bottom:1px dashed #000;margin:5px 0 4px;"></div>`);
    }
  }
  return lines.join("");
}

export function buildReceiptHtml(order: ReceiptOrder): string {
  const ref = `#${order.paymentCode}`;
  const date = new Date(order.createdAt).toLocaleString("vi-VN");
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
    // Shop header
    `<div style="text-align:center;font-size:22px;font-weight:bold;letter-spacing:4px;color:#000;">KUN</div>`,
    `<div style="border-top:2px dashed #000;margin:6px 0;"></div>`,

    // Order meta
    `<div style="font-size:12px;margin-bottom:1px;color:#000;">Đơn: <b>${esc(ref)}</b></div>`,
    `<div style="font-size:11px;color:#444;margin-bottom:1px;">${esc(date)}</div>`,
    `<div style="font-size:12px;margin-bottom:1px;color:#000;">Loại: <b>${esc(serviceLabel(order.type))}</b></div>`,
    order.deliveryAddress
      ? `<div style="font-size:11px;color:#444;margin-bottom:1px;">Địa chỉ: ${esc(order.deliveryAddress)}</div>`
      : "",
    order.tableName
      ? `<div style="font-size:11px;color:#444;margin-bottom:1px;">Bàn: ${esc(order.tableName)}${order.tableArea ? ` — ${esc(order.tableArea)}` : ""}</div>`
      : "",
    `<div style="border-top:2px dashed #000;margin:6px 0;"></div>`,

    // Items
    buildItemsHtml(order.items),
    `<div style="border-top:2px dashed #000;margin:6px 0;"></div>`,

    // Totals
    `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;color:#000;"><span>Tạm tính</span><span style="white-space:nowrap;">${esc(vnd(subtotal))}</span></div>`,
    discount > 0
      ? `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;color:#000;"><span>Giảm giá</span><span style="white-space:nowrap;">-${esc(vnd(discount))}</span></div>`
      : "",
    pointDiscount > 0
      ? `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;color:#000;"><span>Điểm UjCha</span><span style="white-space:nowrap;">-${esc(vnd(pointDiscount))}</span></div>`
      : "",
    order.type === "delivery"
      ? `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;color:#000;"><span>Phí vận chuyển</span><span style="white-space:nowrap;">${shipping > 0 ? esc(vnd(shipping)) : "Miễn phí"}</span></div>`
      : "",
    `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:15px;margin-top:3px;color:#000;"><span>Tổng cộng</span><span style="white-space:nowrap;">${esc(vnd(total))}</span></div>`,
    `<div style="font-size:12px;margin-top:2px;color:#000;">Thanh toán: <b>${esc(payLabel(order.paymentType))}</b></div>`,
    order.paymentStatus === "paid"
      ? `<div style="font-size:12px;font-weight:bold;color:green;margin-top:1px;">✓ Đã thanh toán</div>`
      : `<div style="font-size:12px;color:#888;margin-top:1px;">Chờ thanh toán</div>`,

    `<div style="border-top:1px dashed #ccc;margin:4px 0;"></div>`,
    `<div style="text-align:center;font-size:10px;color:#999;">kunrituals.com</div>`,
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

export function printReceipt(order: ReceiptOrder): void {
  const html = buildReceiptHtml(order);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 600);
}
