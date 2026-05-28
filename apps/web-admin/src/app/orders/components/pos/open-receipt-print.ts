import { loadPrinterConfig } from "@/lib/printer-config";
import type { AdminOrder } from "@/services/admin/types";

import { buildReceiptDocumentHtml } from "../receipt-shared";

export { buildReceiptBodyHtml, buildReceiptDocumentHtml } from "../receipt-shared";

export function buildReceiptHtml(
  order: AdminOrder,
  loyaltyQrUrl?: string,
): string {
  return buildReceiptDocumentHtml(order, loyaltyQrUrl, loadPrinterConfig());
}

export function printOrderReceipt(
  order: AdminOrder,
  loyaltyQrUrl?: string,
): boolean {
  const html = buildReceiptDocumentHtml(order, loyaltyQrUrl, loadPrinterConfig());
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.onload = () => {
    w.print();
    w.close();
  };
  return true;
}
