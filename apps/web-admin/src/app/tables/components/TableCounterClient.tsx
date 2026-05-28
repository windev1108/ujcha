"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button, Card, CardContent, Input } from "@heroui/react";
import {
  ArrowLeft,
  Download,
  Maximize2,
  Minimize2,
  QrCode,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import NextLink from "next/link";
import QRCode from "react-qr-code";

import { ROUTES } from "@/lib/routes";
import { adminKeys } from "@/services/admin/keys";
import { fetchAdminTables } from "@/services/admin/tables-api";
import type { AdminTableRow } from "@/services/admin/types";

function downloadQrSvg(svg: SVGSVGElement, filename: string) {
  const serializer = new XMLSerializer();
  const src = serializer.serializeToString(svg);
  const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\r\n`, src], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function groupByArea(tables: AdminTableRow[]): Map<string, AdminTableRow[]> {
  const m = new Map<string, AdminTableRow[]>();
  for (const t of tables) {
    const a = (t.area ?? "Tầng 1").trim() || "Tầng 1";
    if (!m.has(a)) m.set(a, []);
    m.get(a)!.push(t);
  }
  return m;
}

// ── Full-screen QR overlay ────────────────────────────────────────────────────

function QrOverlay({
  table,
  onClose,
}: {
  table: AdminTableRow;
  onClose: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const url = table.qrCode || `https://local/table/${table.id}`;
  const area = (table.area ?? "Tầng 1").trim() || "Tầng 1";

  const handleDownload = () => {
    const svg = wrapRef.current?.querySelector("svg");
    if (svg) {
      const safe = table.name.replace(/[^\w\d-]+/g, "_").slice(0, 40);
      downloadQrSvg(svg, `qr-ban-${safe || table.id.slice(0, 8)}.svg`);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0d1f1a]/95 backdrop-blur-md">
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Đóng"
      >
        <X className="size-5" />
      </button>

      {/* Table info */}
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400/70">
        Khu vực {area}
      </p>
      <h2 className="mb-8 text-3xl font-bold text-white sm:text-5xl">
        {table.name}
      </h2>

      {/* QR code */}
      <div
        ref={wrapRef}
        className="rounded-3xl bg-white p-6 shadow-[0_0_80px_rgba(113,179,148,0.25)]"
      >
        <QRCode value={url} size={280} level="M" />
      </div>

      <p className="mt-6 text-sm text-white/50">
        Quét mã để đặt món tại bàn
      </p>

      {/* Download */}
      <button
        type="button"
        onClick={handleDownload}
        className="mt-6 flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
      >
        <Download className="size-4" />
        Tải mã QR (SVG)
      </button>
    </div>
  );
}

// ── Counter table card ────────────────────────────────────────────────────────

function CounterTableCard({
  table,
  onSelect,
}: {
  table: AdminTableRow;
  onSelect: (t: AdminTableRow) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const url = table.qrCode || `https://local/table/${table.id}`;
  const inUse = Boolean(table.inUse);
  const active = table.isActive;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const svg = wrapRef.current?.querySelector("svg");
    if (svg) {
      const safe = table.name.replace(/[^\w\d-]+/g, "_").slice(0, 40);
      downloadQrSvg(svg, `qr-ban-${safe || table.id.slice(0, 8)}.svg`);
    }
  };

  return (
    <Card
      className={`cursor-pointer rounded-2xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)] transition-shadow hover:shadow-[0_8px_32px_-8px_rgba(26,60,52,0.2)] ${!active ? "opacity-60" : ""}`}
      onClick={() => onSelect(table)}
    >
      <CardContent className="flex flex-col gap-3 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-[#1a3c34]">{table.name}</h3>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${inUse ? "text-emerald-700" : "text-foreground/40"}`}
              >
                <span className={`size-1.5 rounded-full ${inUse ? "bg-emerald-500" : "bg-foreground/20"}`} />
                {inUse ? "Đang dùng" : "Trống"}
              </span>
              {!active && (
                <span className="rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-foreground/45">
                  Đã tắt
                </span>
              )}
            </div>
          </div>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#1a3c34]/5 text-[#1a3c34]/50">
            <Maximize2 className="size-3.5" />
          </div>
        </div>

        {/* QR */}
        <div
          ref={wrapRef}
          className="flex aspect-square w-full max-w-[180px] mx-auto items-center justify-center rounded-2xl bg-[#f3f4f6] p-4 ring-1 ring-black/6"
        >
          <QRCode value={url} size={128} level="M" className="h-auto max-w-full" />
        </div>

        {/* Download */}
        <button
          type="button"
          onClick={handleDownload}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-black/10 py-2 text-xs font-semibold text-foreground/60 hover:bg-black/[0.03] transition-colors"
        >
          <Download className="size-3.5" />
          Tải SVG
        </button>
      </CardContent>
    </Card>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

export function TableCounterClient() {
  const [search, setSearch] = useState("");
  const [selectedTable, setSelectedTable] = useState<AdminTableRow | null>(null);

  const { data: tables = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: adminKeys.tables,
    queryFn: fetchAdminTables,
  });

  const filtered = tables.filter((t) => {
    if (!t.isActive) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const area = (t.area ?? "Tầng 1").trim() || "Tầng 1";
    return t.name.toLowerCase().includes(q) || area.toLowerCase().includes(q);
  });

  const grouped = groupByArea(filtered);

  return (
    <div className="relative flex flex-col gap-6 pb-24">
      {/* Full-screen overlay */}
      {selectedTable && (
        <QrOverlay table={selectedTable} onClose={() => setSelectedTable(null)} />
      )}

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <NextLink
            href={ROUTES.TABLES}
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl hover:bg-black/5 text-foreground/60 transition-colors"
            aria-label="Quay lại danh sách bàn"
          >
            <ArrowLeft className="size-4" />
          </NextLink>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
              Tại quầy
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34]">
              Quầy QR đặt món
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-foreground/55">
              Chọn bàn để hiển thị mã QR toàn màn hình — khách quét để đặt món ngay tại bàn.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="self-start rounded-full sm:self-auto"
          onPress={() => void refetch()}
          isDisabled={isFetching}
        >
          <RefreshCw className={`mr-2 size-4 ${isFetching ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </header>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/35" />
        <Input
          placeholder="Tìm bàn hoặc khu vực…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 rounded-xl border border-black/10 bg-white pl-9 pr-3 text-sm"
        />
      </div>

      {/* Hint */}
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200/60 bg-[color-mix(in_oklab,#71b394_8%,white)] px-4 py-3">
        <QrCode className="size-4 shrink-0 text-[#1a3c34]" />
        <p className="text-sm text-[#1a3c34]/70">
          Nhấn vào bất kỳ bàn nào để phóng to mã QR toàn màn hình. Nhấn{" "}
          <kbd className="rounded bg-black/8 px-1 py-0.5 text-[11px] font-mono">Esc</kbd>{" "}
          để đóng.
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-black/5" />
          ))}
        </div>
      ) : grouped.size === 0 ? (
        <Card className="rounded-2xl border border-black/6 bg-white">
          <CardContent className="p-10 text-center">
            <p className="text-sm font-medium text-foreground/60">
              {search ? "Không tìm thấy bàn nào phù hợp." : "Chưa có bàn nào đang hoạt động."}
            </p>
            {!search && (
              <NextLink
                href={ROUTES.TABLE_NEW}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1a3c34] px-5 py-2 text-sm font-semibold text-white"
              >
                Tạo bàn đầu tiên
              </NextLink>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-10">
          {Array.from(grouped.entries()).map(([area, rows]) => (
            <section key={area}>
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-lg font-bold text-[#1a3c34]">Khu vực {area}</h2>
                <span className="text-xs font-medium text-foreground/40">{rows.length} bàn</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rows.map((t) => (
                  <CounterTableCard key={t.id} table={t} onSelect={setSelectedTable} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
