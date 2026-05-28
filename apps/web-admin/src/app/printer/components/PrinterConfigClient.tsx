"use client";

import { Button, Card, CardContent, Input, Label, ListBox, Select, Switch } from "@heroui/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  CheckCircle2,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { buildReceiptBodyHtml } from "@/app/orders/components/receipt-shared";
import {
  adminFieldStack,
  adminInputClass,
  adminLabelClass,
  adminSelectTriggerClass,
  adminSelectValueClass,
} from "@/lib/admin-form-classes";
import {
  DEFAULT_PRINTER_CONFIG,
  ELEMENT_LABELS,
  loadPrinterConfig,
  savePrinterConfig,
  type PrinterConfig,
  type ReceiptElement,
} from "@/lib/printer-config";
import type { AdminOrder } from "@/services/admin/types";

const SAMPLE_ORDER = {
  id: "preview-sample",
  userId: null,
  type: "table" as const,
  addressId: null,
  guestDeliveryAddress: null,
  guestDeliveryPhone: null,
  guestDeliveryName: null,
  tableId: "tbl-1",
  pickupTime: null,
  totalAmount: "125000",
  discountAmount: "10000",
  pointDiscountAmount: "0",
  finalAmount: "115000",
  status: "pending" as const,
  paymentStatus: "pending" as const,
  paymentCode: "KUN241201",
  loyaltyQrToken: "00000000-0000-0000-0000-000000000000",
  shipperId: null,
  createdAt: new Date("2024-12-01T12:00:00").toISOString(),
  updatedAt: new Date("2024-12-01T12:00:00").toISOString(),
  user: null,
  shipper: null,
  table: { id: "tbl-1", name: "Bàn 1", qrCode: "" },
  address: null,
  typeDisplay: { kind: "table" as const, table: { tableId: "tbl-1", table: { id: "tbl-1", name: "Bàn 1", qrCode: "" } } },
  items: [
    {
      id: "item-1",
      quantity: 2,
      price: "45000",
      extrasJson: [{ toppingId: "t1", name: "Trân châu", price: 5000 }],
      optionsJson: { Size: "L" },
      note: null,
      product: { id: "p1", name: "Trà sữa Matcha", slug: "tra-sua-matcha", imageUrls: [], price: "45000" },
    },
    {
      id: "item-2",
      quantity: 1,
      price: "35000",
      extrasJson: [],
      optionsJson: {},
      note: "Ít đường",
      product: { id: "p2", name: "Cà phê sữa đá", slug: "ca-phe-sua-da", imageUrls: [], price: "35000" },
    },
  ],
} as AdminOrder;

type ElementRowProps = {
  el: ReceiptElement;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onUpdate: (patch: Partial<ReceiptElement>) => void;
  onRemove?: () => void;
};

function ElementRow({ el, isDragging, isDropTarget, onDragStart, onDragEnter, onUpdate, onRemove }: ElementRowProps) {
  const isDivider = el.type === "divider";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      className={[
        "flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 transition-all select-none",
        isDragging ? "opacity-40 scale-[0.98]" : "",
        isDropTarget ? "border-[#1a3c34] border-t-2" : "border-black/8",
      ].join(" ")}
    >
      <GripVertical className="size-4 shrink-0 cursor-grab text-foreground/25 active:cursor-grabbing" />

      <button
        type="button"
        onClick={() => onUpdate({ visible: !el.visible })}
        className="shrink-0 rounded p-0.5 text-foreground/40 hover:bg-black/5"
        title={el.visible ? "Ẩn" : "Hiện"}
      >
        {el.visible
          ? <Eye className="size-4 text-[#1a3c34]" />
          : <EyeOff className="size-4" />}
      </button>

      <span className={`flex-1 min-w-0 text-sm ${!el.visible ? "text-foreground/30" : "text-foreground"}`}>
        {el.type === "custom-text" ? (
          <input
            value={el.customText ?? ""}
            onChange={(e) => onUpdate({ customText: e.target.value })}
            placeholder="Nhập văn bản…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-foreground/30"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          ELEMENT_LABELS[el.type]
        )}
      </span>

      {!isDivider && (
        <>
          <div className="flex shrink-0 items-center gap-0.5">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => onUpdate({ align: a })}
                title={a}
                className={[
                  "rounded p-1 transition-colors",
                  el.align === a
                    ? "bg-[#1a3c34] text-white"
                    : "text-foreground/35 hover:bg-black/6 hover:text-foreground",
                ].join(" ")}
              >
                {a === "left" && <AlignLeft className="size-3" />}
                {a === "center" && <AlignCenter className="size-3" />}
                {a === "right" && <AlignRight className="size-3" />}
              </button>
            ))}
          </div>

          <input
            type="number"
            min={8}
            max={48}
            value={el.fontSize}
            onChange={(e) => onUpdate({ fontSize: Math.min(48, Math.max(8, Number(e.target.value))) })}
            title="Cỡ chữ (px)"
            className="w-10 shrink-0 rounded border border-black/10 bg-white px-1 py-0.5 text-center text-xs outline-none focus:border-[#1a3c34]"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            type="button"
            onClick={() => onUpdate({ bold: !el.bold })}
            title="In đậm"
            className={[
              "shrink-0 rounded px-1.5 py-0.5 text-xs font-bold transition-colors",
              el.bold
                ? "bg-[#1a3c34] text-white"
                : "text-foreground/35 hover:bg-black/6 hover:text-foreground",
            ].join(" ")}
          >
            B
          </button>
        </>
      )}

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Xoá"
          className="shrink-0 text-red-400 hover:text-red-600"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function PrinterConfigClient() {
  const [cfg, setCfg] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG);
  const [saved, setSaved] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  useEffect(() => { setCfg(loadPrinterConfig()); }, []);

  const previewHtml = buildReceiptBodyHtml(SAMPLE_ORDER, undefined, cfg);
  const paperPx = cfg.paperWidth * 3.78;

  function updateElement(id: string, patch: Partial<ReceiptElement>) {
    setCfg((c) => ({
      ...c,
      elements: c.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
    }));
  }

  function removeElement(id: string) {
    setCfg((c) => ({ ...c, elements: c.elements.filter((el) => el.id !== id) }));
  }

  function addCustomText() {
    const newEl: ReceiptElement = {
      id: `custom-${Date.now()}`,
      type: "custom-text",
      visible: true,
      align: "center",
      fontSize: 14,
      bold: false,
      customText: "",
    };
    setCfg((c) => ({ ...c, elements: [...c.elements, newEl] }));
  }

  function handleDragStart(idx: number) {
    dragRef.current = idx;
    setDragIdx(idx);
  }

  function handleDragEnter(idx: number) {
    if (dragRef.current !== null && idx !== dragRef.current) setDropIdx(idx);
  }

  function handleDrop() {
    const from = dragRef.current;
    const to = dropIdx;
    if (from !== null && to !== null && from !== to) {
      setCfg((c) => {
        const els = [...c.elements];
        const [moved] = els.splice(from, 1);
        els.splice(to, 0, moved);
        return { ...c, elements: els };
      });
    }
    dragRef.current = null;
    setDragIdx(null);
    setDropIdx(null);
  }

  function handleSave() {
    savePrinterConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-8 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">Máy in</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
            Cấu hình hóa đơn
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/55">
            Tùy chỉnh kích thước giấy, font chữ, thứ tự và kiểu dáng từng khối nội dung.
            Kéo để sắp xếp lại. Cấu hình được lưu trên trình duyệt này.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="ghost"
            className="rounded-full"
            onPress={() => setCfg(DEFAULT_PRINTER_CONFIG)}
          >
            <RotateCcw className="mr-2 size-4" />
            Mặc định
          </Button>
          <Button
            className="rounded-full bg-[#1a3c34] px-6 font-semibold text-white shadow-md shadow-[#1a3c34]/20"
            onPress={handleSave}
          >
            {saved
              ? <><CheckCircle2 className="mr-2 size-4" />Đã lưu</>
              : <><Save className="mr-2 size-4" />Lưu cấu hình</>}
          </Button>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* ── Left: settings + element list ── */}
        <div className="flex flex-col gap-6">
          {/* Paper settings */}
          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-5 px-5 py-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Cài đặt giấy
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className={adminFieldStack}>
                  <Label className={adminLabelClass}>Chiều rộng giấy (mm)</Label>
                  <Input
                    type="number"
                    min={40}
                    max={210}
                    step={1}
                    value={cfg.paperWidth}
                    onChange={(e) =>
                      setCfg((c) => ({
                        ...c,
                        paperWidth: Math.min(210, Math.max(40, Number(e.target.value))),
                      }))
                    }
                    className={adminInputClass}
                  />
                  <p className="text-[11px] text-foreground/45">
                    Khổ phổ biến: 58mm, 72mm, 80mm
                  </p>
                </div>

                <div className={adminFieldStack}>
                  <Label className={adminLabelClass}>Font chữ</Label>
                  <Select
                    value={cfg.fontFamily}
                    onChange={(key) =>
                      setCfg((c) => ({ ...c, fontFamily: key as PrinterConfig["fontFamily"] }))
                    }
                  >
                    <Select.Trigger className={adminSelectTriggerClass}>
                      <Select.Value className={adminSelectValueClass} />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox className="min-w-(--trigger-width) overflow-hidden outline-none">
                        <ListBox.Item id="monospace" textValue="Monospace (mặc định)" className="rounded-lg text-sm">
                          Monospace (mặc định)
                        </ListBox.Item>
                        <ListBox.Item id="sans-serif" textValue="Sans-serif" className="rounded-lg text-sm">
                          Sans-serif
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Element order */}
          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-4 px-5 py-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Thứ tự & kiểu dáng
                </p>
                <p className="text-[11px] text-foreground/40">Kéo ≡ để sắp xếp lại</p>
              </div>

              <div
                className="flex flex-col gap-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onDragEnd={handleDrop}
              >
                {cfg.elements.map((el, idx) => (
                  <ElementRow
                    key={el.id}
                    el={el}
                    isDragging={dragIdx === idx}
                    isDropTarget={dropIdx === idx}
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onUpdate={(patch) => updateElement(el.id, patch)}
                    onRemove={el.type === "custom-text" ? () => removeElement(el.id) : undefined}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={addCustomText}
                className="flex items-center gap-1.5 self-start rounded-xl border border-dashed border-black/15 px-4 py-2 text-xs font-medium text-foreground/50 transition-colors hover:border-[#1a3c34]/40 hover:text-[#1a3c34]"
              >
                <Plus className="size-3.5" />
                Thêm văn bản tuỳ chỉnh
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: preview ── */}
        <div className="flex flex-col gap-4">
          <Card className="sticky top-6 rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-4 px-5 py-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Xem trước ({cfg.paperWidth}mm)
              </p>

              <div className="overflow-y-auto rounded-xl border border-black/8 bg-white" style={{ maxHeight: 580 }}>
                {/* Paper shadow line */}
                <div
                  style={{
                    width: `${Math.min(paperPx, 320)}px`,
                    maxWidth: "100%",
                    margin: "0 auto",
                    padding: "16px 8px",
                    fontFamily: cfg.fontFamily === "monospace"
                      ? "ui-monospace, 'Courier New', monospace"
                      : "ui-sans-serif, system-ui, sans-serif",
                    fontSize: "17px",
                    lineHeight: 1.4,
                    color: "#000",
                  }}
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>

              <p className="text-[11px] text-foreground/40">
                Dữ liệu giả — hóa đơn thực dùng đơn hàng thật.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
