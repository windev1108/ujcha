"use client";

import { Button } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, Printer, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { OrderPaidPayload } from "@/hooks/useOrderSocket";
import { useOrderSocket } from "@/hooks/useOrderSocket";
import { DEFAULT_PRINTER_CONFIG, loadPrinterConfig, type PrinterConfig } from "@/lib/printer-config";
import { formatVnd } from "@/lib/product-display";
import { ROUTES } from "@/lib/routes";
import { adminKeys } from "@/services/admin/keys";
import { fetchAdminOrder } from "@/services/admin/orders-api";

import { printOrderReceipt } from "./pos/open-receipt-print";
import { buildReceiptBodyHtml } from "./receipt-shared";

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? "";

function buildLoyaltyQrUrl(paymentCode: string): string {
  const loyaltyUrl = `${WEB_URL}/loyalty?code=${encodeURIComponent(paymentCode)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(loyaltyUrl)}&size=160x160&margin=4`;
}

type Props = { orderId: string };

export function OrderInvoiceClient({ orderId }: Props) {
  const router = useRouter();
  const [paidInfo, setPaidInfo] = useState<OrderPaidPayload | null>(null);
  const [printerCfg, setPrinterCfg] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG);

  useEffect(() => { setPrinterCfg(loadPrinterConfig()); }, []);

  const q = useQuery({
    queryKey: adminKeys.order(orderId),
    queryFn: () => fetchAdminOrder(orderId),
  });

  useOrderSocket({
    orderId,
    onOrderPaid: (p) => setPaidInfo(p),
  });

  const order = q.data;

  if (q.isError) {
    return (
      <div className="py-16 text-center text-sm text-red-700">
        Không tải được đơn.
      </div>
    );
  }

  if (q.isLoading || !q.data) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6 pb-16">
        <div className="h-10 w-40 animate-pulse rounded-full bg-black/5" />
        <div className="h-[480px] animate-pulse rounded-2xl bg-black/5 ring-1 ring-black/6" />
      </div>
    );
  }

  const isPaid = order?.paymentStatus === "paid";
  const loyaltyQrUrl = buildLoyaltyQrUrl(order!.paymentCode);
  const innerHtml = buildReceiptBodyHtml(order!, loyaltyQrUrl, printerCfg);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 pb-16 print:max-w-none print:pb-0">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button
          variant="ghost"
          className="rounded-full"
          onPress={() => router.push(ROUTES.orderDetail(orderId))}
        >
          <ArrowLeft className="mr-2 size-4" />
          Chi tiết đơn
        </Button>
        <Button
          variant="ghost"
          className="rounded-full"
          onPress={() => router.push(ROUTES.ORDERS)}
        >
          Lịch sử đơn
        </Button>
        <Button
          className="ml-auto rounded-full bg-[#1a3c34] font-semibold text-white"
          onPress={() => printOrderReceipt(order!, loyaltyQrUrl)}
        >
          <Printer className="mr-2 size-4" />
          In (58mm)
        </Button>
      </div>

      {/* Payment received banner */}
      {paidInfo && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm print:hidden">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-emerald-900">Thanh toán thành công!</p>
            <p className="mt-0.5 text-sm text-emerald-700">
              {formatVnd(paidInfo.transferAmount)} · Mã GD&nbsp;
              <span className="font-mono">#{paidInfo.transactionId}</span>
            </p>
          </div>
          <button
            onClick={() => setPaidInfo(null)}
            className="shrink-0 rounded-full p-1 text-emerald-600 hover:bg-emerald-100"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Payment status badge */}
      <div className="flex items-center justify-between print:hidden">
        {isPaid ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm">
            <CheckCircle2 className="size-4" />
            Đã thanh toán
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm">
            <Clock className="size-4" />
            Đang chờ thanh toán
          </span>
        )}
      </div>

      {/* Receipt preview */}
      <div className={`overflow-hidden rounded-2xl border bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)] print:rounded-none print:border-0 print:shadow-none ${isPaid ? "border-emerald-200" : "border-black/8"}`}>
        <div
          className="receipt-screen mx-auto max-w-[80mm] px-4 py-8 text-[16px] leading-snug text-black [&_div]:text-inherit print:max-w-none print:px-2 print:py-4"
          // eslint-disable-next-line react/no-danger -- nội dung từ API, cùng nguồn với bill in
          dangerouslySetInnerHTML={{ __html: innerHtml }}
        />
      </div>
    </div>
  );
}
