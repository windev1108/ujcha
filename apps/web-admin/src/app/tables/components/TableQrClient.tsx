"use client";

import { Button, Card, CardContent, Description } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  ArrowLeft,
  Copy,
  Download,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { ROUTES } from "@/lib/routes";
import { adminKeys } from "@/services/admin/keys";
import {
  fetchAdminTable,
  regenerateAdminTableQr,
} from "@/services/admin/tables-api";

function axiosMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const d = err.response?.data;
  if (d && typeof d === "object") {
    const m = d.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  return err.message || "Có lỗi xảy ra.";
}

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

type Props = { tableId: string };

export function TableQrClient({ tableId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showAlert } = useAppDialog();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [didAutoPrint, setDidAutoPrint] = useState(false);

  const tableQuery = useQuery({
    queryKey: adminKeys.table(tableId),
    queryFn: () => fetchAdminTable(tableId),
  });

  const regenMut = useMutation({
    mutationFn: () => regenerateAdminTableQr(tableId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.table(tableId) });
      await queryClient.invalidateQueries({ queryKey: adminKeys.tables });
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const table = tableQuery.data;
  const url = table?.qrCode ?? "";

  useEffect(() => {
    if (didAutoPrint) return;
    if (!table || !url) return;
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("print");
    if (q !== "1") return;
    setDidAutoPrint(true);
    const tid = window.setTimeout(() => {
      window.print();
      router.replace(ROUTES.tableQr(tableId), { scroll: false });
    }, 450);
    return () => window.clearTimeout(tid);
  }, [didAutoPrint, table, url, router, tableId]);

  const handleDownload = () => {
    const svg = wrapRef.current?.querySelector("svg");
    if (svg && table) {
      const safe = table.name.replace(/[^\w\d\-]+/g, "_").slice(0, 40);
      downloadQrSvg(svg, `qr-ban-${safe || table.id.slice(0, 8)}.svg`);
    }
  };

  const copyUrl = async () => {
    if (!url || typeof navigator === "undefined" || !navigator.clipboard) {
      void showAlert(url || "Không có URL.", "Sao chép");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      void showAlert(url, "Sao chép thủ công");
    }
  };

  if (tableQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6 pb-16">
        <div className="flex gap-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-black/5" />
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-black/5" />
            <div className="h-8 w-48 animate-pulse rounded-lg bg-black/5" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card className="rounded-2xl border border-black/6">
            <CardContent className="flex flex-col items-center gap-6 p-8">
              <div className="size-[280px] animate-pulse rounded-3xl bg-black/5" />
              <div className="h-10 w-full max-w-md animate-pulse rounded-xl bg-black/5" />
            </CardContent>
          </Card>
          <div className="h-40 animate-pulse rounded-2xl bg-black/5" />
        </div>
      </div>
    );
  }

  if (tableQuery.isError || !table) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">Không tìm thấy bàn.</p>
        <Button variant="ghost" onPress={() => router.push(ROUTES.TABLES)}>
          Về danh sách
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="mt-0.5 shrink-0 rounded-xl"
            onPress={() => router.push(ROUTES.TABLES)}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
              QR bàn
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34]">
              {table.name}
            </h1>
            <p className="mt-1 text-sm text-foreground/55">
              {(table.area ?? "Tầng 1").trim() || "Tầng 1"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-black/15"
            onPress={() => router.push(ROUTES.tableEdit(tableId))}
          >
            Sửa bàn
          </Button>
          <Button
            variant="ghost"
            className="rounded-xl"
            onPress={() => regenMut.mutate()}
            isDisabled={regenMut.isPending}
          >
            <RefreshCw className="mr-2 size-4" />
            Tạo lại URL
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="rounded-2xl border border-black/6 bg-white shadow-sm">
          <CardContent className="flex flex-col items-center gap-6 p-8">
            <div
              ref={wrapRef}
              className="rounded-3xl bg-white p-6 ring-2 ring-black/6"
            >
              <QRCode value={url} size={280} level="M" />
            </div>
            <div className="flex w-full max-w-md flex-col gap-2">
              <Description className="text-center text-xs text-foreground/50">
                URL đặt món tại bàn (đã lưu trên server)
              </Description>
              <p className="break-all rounded-xl bg-[#f9fafb] px-3 py-2 text-center font-mono text-xs text-foreground/80 ring-1 ring-black/6">
                {url}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                className="rounded-xl bg-[#1a3c34] font-semibold text-white"
                onPress={handleDownload}
              >
                <Download className="mr-2 size-4" />
                Tải mã QR (SVG)
              </Button>
              <Button
                variant="outline"
                className="rounded-xl border-black/15"
                onPress={() => void copyUrl()}
              >
                <Copy className="mr-2 size-4" />
                Sao chép URL
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit rounded-2xl border border-black/6 bg-[color-mix(in_oklab,#71b394_8%,white)]">
          <CardContent className="space-y-2 p-5 text-sm text-foreground/70">
            <p className="font-semibold text-[#1a3c34]">Gợi ý in QR</p>
            <p>
              In mã và đặt tại bàn để khách quét bằng camera điện thoại. Nếu đổi
              domain (APP_PUBLIC_URL), dùng &quot;Tạo lại URL&quot; để cập nhật
              liên kết lưu trong hệ thống.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
