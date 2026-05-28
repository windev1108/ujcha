export type ReceiptElementType =
  | "shop-name"
  | "order-ref"
  | "date"
  | "service-type"
  | "divider"
  | "items"
  | "subtotal"
  | "discount"
  | "total"
  | "payment-status"
  | "qr-code"
  | "custom-text";

export type ReceiptElement = {
  id: string;
  type: ReceiptElementType;
  visible: boolean;
  align: "left" | "center" | "right";
  fontSize: number;
  bold: boolean;
  customText?: string;
};

export type PrinterConfig = {
  paperWidth: number;
  fontFamily: "monospace" | "sans-serif";
  elements: ReceiptElement[];
};

export const ELEMENT_LABELS: Record<ReceiptElementType, string> = {
  "shop-name": "Tên cửa hàng",
  "order-ref": "Mã đơn hàng",
  date: "Ngày giờ",
  "service-type": "Loại dịch vụ",
  divider: "Đường kẻ (---)",
  items: "Danh sách món",
  subtotal: "Tạm tính",
  discount: "Giảm giá",
  total: "Tổng cộng",
  "payment-status": "Trạng thái thanh toán",
  "qr-code": "QR tích điểm",
  "custom-text": "Văn bản tuỳ chỉnh",
};

export const DEFAULT_ELEMENTS: ReceiptElement[] = [
  { id: "shop-name", type: "shop-name", visible: true, align: "center", fontSize: 28, bold: true },
  { id: "order-ref", type: "order-ref", visible: true, align: "center", fontSize: 20, bold: true },
  { id: "date", type: "date", visible: true, align: "center", fontSize: 13, bold: false },
  { id: "service-type", type: "service-type", visible: true, align: "center", fontSize: 14, bold: false },
  { id: "divider-1", type: "divider", visible: true, align: "center", fontSize: 14, bold: false },
  { id: "items", type: "items", visible: true, align: "left", fontSize: 14, bold: false },
  { id: "divider-2", type: "divider", visible: true, align: "center", fontSize: 14, bold: false },
  { id: "subtotal", type: "subtotal", visible: true, align: "left", fontSize: 14, bold: false },
  { id: "discount", type: "discount", visible: true, align: "left", fontSize: 14, bold: false },
  { id: "total", type: "total", visible: true, align: "left", fontSize: 15, bold: true },
  { id: "divider-3", type: "divider", visible: true, align: "center", fontSize: 14, bold: false },
  { id: "payment-status", type: "payment-status", visible: true, align: "left", fontSize: 14, bold: false },
  { id: "qr-code", type: "qr-code", visible: true, align: "center", fontSize: 12, bold: false },
];

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  paperWidth: 58,
  fontFamily: "monospace",
  elements: DEFAULT_ELEMENTS,
};

const STORAGE_KEY = "kun-printer-config-v1";

export function loadPrinterConfig(): PrinterConfig {
  if (typeof window === "undefined") return DEFAULT_PRINTER_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRINTER_CONFIG;
    const parsed = JSON.parse(raw) as Partial<PrinterConfig>;
    return {
      ...DEFAULT_PRINTER_CONFIG,
      ...parsed,
      elements: parsed.elements ?? DEFAULT_ELEMENTS,
    };
  } catch {
    return DEFAULT_PRINTER_CONFIG;
  }
}

export function savePrinterConfig(cfg: PrinterConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}
