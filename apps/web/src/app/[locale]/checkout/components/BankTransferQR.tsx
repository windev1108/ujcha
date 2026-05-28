"use client";

import { motion } from "motion/react";
import { CheckCircle2, Clock, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { usePublicPaymentConfigQuery } from "@/services/payment-config/hooks";
import { useOrderPaymentSocket } from "@/hooks/useOrderPaymentSocket";
import { revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";

const SEPAY_QR_BASE = "https://qr.sepay.vn/img";
const EXPIRE_MINUTES = 15;

function buildQrUrl(bank: string, acc: string, amount: number, des: string): string {
  const params = new URLSearchParams({
    bank,
    acc,
    template: "",
    amount: String(Math.round(amount)),
    des,
  });
  return `${SEPAY_QR_BASE}?${params.toString()}`;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Props = {
  orderId: string;
  paymentCode: string;
  total: number;
  createdAt: Date;
  onPaid: () => void;
  onExpired: () => void;
};

export function BankTransferQR({ orderId, paymentCode, total, createdAt, onPaid, onExpired }: Props) {
  const { data: payConfig } = usePublicPaymentConfigQuery();
  const { isPaid } = useOrderPaymentSocket({
    orderId,
    onPaid,
    enabled: !!(payConfig?.isEnabled),
  });

  const expireAt = new Date(createdAt.getTime() + EXPIRE_MINUTES * 60_000);
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.round((expireAt.getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (isPaid) return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.round((expireAt.getTime() - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        clearInterval(timer);
        onExpired();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expireAt, isPaid, onExpired]);

  const qrUrl =
    payConfig?.bankCode && payConfig?.accountNumber
      ? buildQrUrl(payConfig.bankCode, payConfig.accountNumber, total, paymentCode)
      : null;

  const isExpired = remaining === 0 && !isPaid;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={revealTransition}
      className="rounded-3xl border border-black/6 bg-white p-6 shadow-[0_8px_32px_-16px_rgba(0,0,0,0.1)]"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        Thanh toán chuyển khoản
      </p>

      {isPaid ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-kun-mint/20 p-4">
          <CheckCircle2 className="size-8 shrink-0 text-kun-products-forest" />
          <div>
            <p className="font-semibold text-kun-products-forest">Thanh toán thành công!</p>
            <p className="text-sm text-foreground/60">
              Đơn hàng đang được xử lý.
            </p>
          </div>
        </div>
      ) : isExpired ? (
        <div className="mt-4 rounded-2xl bg-red-50 p-4">
          <p className="font-semibold text-red-600">Đơn hàng đã hết hạn</p>
          <p className="mt-1 text-sm text-red-500">
            Quá 15 phút không thanh toán — đơn đã bị huỷ.
          </p>
        </div>
      ) : (
        <>
          {/* Countdown */}
          <div className="mt-3 flex items-center gap-2">
            <Clock className="size-4 text-amber-500 shrink-0" />
            <span className="text-sm font-medium text-amber-600">
              Thanh toán trong{" "}
              <span className="tabular-nums font-bold">{formatCountdown(remaining)}</span>
              {" "}— hết hạn sau {EXPIRE_MINUTES} phút
            </span>
          </div>

          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {/* QR */}
            <div className="flex-shrink-0">
              {qrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrUrl}
                  alt="SePay QR thanh toán"
                  className="h-52 w-52 rounded-2xl object-contain ring-1 ring-black/8"
                />
              ) : (
                <div className="flex h-52 w-52 items-center justify-center rounded-2xl bg-kun-filter-pill-bg ring-1 ring-black/8">
                  <QrCode className="size-14 text-foreground/25" />
                </div>
              )}
            </div>

            {/* Bank details */}
            {payConfig && (
              <div className="flex-1 space-y-1.5 rounded-3xl bg-kun-sage/10 px-4 py-4 text-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45 mb-2">
                  Thông tin chuyển khoản
                </p>
                <div className="space-y-2">
                  <Row label="Ngân hàng" value={payConfig.bankCode} />
                  <Row label="Số tài khoản" value={payConfig.accountNumber} mono />
                  {payConfig.accountName && (
                    <Row label="Chủ tài khoản" value={payConfig.accountName} />
                  )}
                  <Row
                    label="Số tiền"
                    value={new Intl.NumberFormat("vi-VN").format(Math.round(total)) + "đ"}
                    highlight
                  />
                  <Row label="Nội dung CK" value={paymentCode} mono highlight />
                </div>
              </div>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-foreground/50">
            Quét mã QR bằng app ngân hàng và chuyển đúng số tiền + nội dung. Hệ thống tự xác nhận.
          </p>
        </>
      )}
    </motion.div>
  );
}

function Row({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="w-28 flex-shrink-0 text-xs text-foreground/55">{label}</span>
      <span
        className={`text-right text-xs font-semibold ${highlight ? "text-kun-products-forest" : "text-foreground"} ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
