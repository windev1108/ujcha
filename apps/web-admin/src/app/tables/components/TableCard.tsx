"use client";

import { Button, Card, CardContent, Dropdown } from "@heroui/react";
import {
  Download,
  MoreVertical,
  QrCode,
  Pencil,
  Power,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import QRCode from "react-qr-code";

import { ROUTES } from "@/lib/routes";
import type { AdminTableRow } from "@/services/admin/types";

function downloadQrSvg(svg: SVGSVGElement, filename: string) {
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const blob = new Blob(
    [`<?xml version="1.0" encoding="UTF-8"?>\r\n`, source],
    { type: "image/svg+xml;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  table: AdminTableRow;
  busy?: boolean;
  onDelete: () => void;
  onDeactivate: () => void;
  onRegenerateQr: () => void;
};

export function TableCard({
  table,
  busy,
  onDelete,
  onDeactivate,
  onRegenerateQr,
}: Props) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inUse = Boolean(table.inUse);
  const active = table.isActive;

  const handleDownload = () => {
    const svg = wrapRef.current?.querySelector("svg");
    if (svg) {
      const safe = table.name.replace(/[^\w\d\-]+/g, "_").slice(0, 40);
      downloadQrSvg(svg, `qr-ban-${safe || table.id.slice(0, 8)}.svg`);
    }
  };

  return (
    <Card
      className={`rounded-2xl border border-black/6 bg-white shadow-[0_8px_28px_-18px_rgba(0,0,0,0.12)] ${!active ? "opacity-75" : ""}`}
    >
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-bold text-[#1a3c34]">
                {table.name}
              </h3>
              {!active ? (
                <span className="shrink-0 rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold text-foreground/55">
                  Đã tắt
                </span>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${inUse ? "text-emerald-700" : "text-foreground/45"}`}
              >
                <span
                  className={`size-1.5 rounded-full ${inUse ? "bg-emerald-500" : "bg-foreground/25"}`}
                />
                {inUse ? "Đang dùng" : "Trống"}
              </span>
            </div>
          </div>
          <Dropdown.Root>
            <Dropdown.Trigger
              className={`inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-foreground outline-none transition-colors hover:bg-black/[0.06] data-[pressed]:bg-black/10 ${busy ? "pointer-events-none opacity-50" : ""}`}
              aria-label="Thao tác bàn"
              isDisabled={busy}
            >
              <MoreVertical className="size-4" />
            </Dropdown.Trigger>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu
                aria-label="Menu bàn"
                onAction={(key) => {
                  const k = String(key);
                  if (k === "edit") {
                    router.push(ROUTES.tableEdit(table.id));
                    return;
                  }
                  if (k === "qr") {
                    router.push(ROUTES.tableQr(table.id));
                    return;
                  }
                  if (k === "regen") onRegenerateQr();
                  if (k === "deactivate") onDeactivate();
                  if (k === "delete") onDelete();
                }}
              >
                <Dropdown.Item id="edit" textValue="Sửa bàn">
                  <span className="flex items-center gap-2">
                    <Pencil className="size-3.5" />
                    Sửa bàn
                  </span>
                </Dropdown.Item>
                <Dropdown.Item id="qr" textValue="Xem QR">
                  <span className="flex items-center gap-2">
                    <QrCode className="size-3.5" />
                    Xem mã QR
                  </span>
                </Dropdown.Item>
                <Dropdown.Item id="regen" textValue="Tạo lại QR">
                  Tạo lại URL QR
                </Dropdown.Item>
                {active ? (
                  <Dropdown.Item id="deactivate" textValue="Tắt bàn">
                    <span className="flex items-center gap-2">
                      <Power className="size-3.5" />
                      Vô hiệu hóa
                    </span>
                  </Dropdown.Item>
                ) : null}
                <Dropdown.Item id="delete" textValue="Xóa bàn">
                  <span className="flex items-center gap-2 text-red-700">
                    <Trash2 className="size-3.5" />
                    Xóa bàn
                  </span>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>
        </div>

        <div
          ref={wrapRef}
          className="flex aspect-square w-full max-w-[200px] mx-auto items-center justify-center rounded-2xl bg-[#f3f4f6] p-4 ring-1 ring-black/6"
        >
          <QRCode
            value={table.qrCode || `https://local/table/${table.id}`}
            size={148}
            level="M"
            className="h-auto max-w-full"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full rounded-xl border-black/15 font-semibold"
          onPress={handleDownload}
          isDisabled={busy}
        >
          <Download className="mr-2 size-4" />
          Tải mã QR
        </Button>
      </CardContent>
    </Card>
  );
}
