"use client";

import { Button, Modal, useOverlayState } from "@heroui/react";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import { formatOrderRef } from "@/app/orders/components/order-display";
import { buildVietQrUrl } from "@/app/orders/components/receipt-shared";
import { formatVnd } from "@/lib/product-display";
import type { AdminOrder, PaymentConfig } from "@/services/admin/types";

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

type Props = {
  order: AdminOrder | null;
  paymentConfig: PaymentConfig | null;
  isOpen: boolean;
  onGoToDetail: () => void;
};

export function QrBillModal({ order, paymentConfig, isOpen, onGoToDetail }: Props) {
  const overlay = useOverlayState({ isOpen, onOpenChange: () => {} });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const amount = order ? Math.round(Number.parseFloat(order.finalAmount)) : 0;
  const qrSrc = order && paymentConfig ? buildVietQrUrl(paymentConfig, amount, order.paymentCode) : null;

  useEffect(() => {
    if (!qrSrc) return;
    let cancelled = false;
    setQrDataUrl(null);
    fetchAsDataUrl(qrSrc)
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { /* fallback to qrSrc */ });
    return () => { cancelled = true; };
  }, [qrSrc]);

  if (!order || !paymentConfig || !qrSrc) return null;

  return (
    <Modal.Root state={overlay}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md">
          <Modal.Dialog className="max-w-sm rounded-2xl border border-black/6 p-0 shadow-xl">
            <Modal.Header className="border-b border-black/6 px-5 py-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                <Modal.Heading className="text-left text-base font-semibold text-[#1a3c34]">
                  Tạo đơn thành công
                </Modal.Heading>
              </div>
              <p className="mt-1 text-xs text-foreground/55">
                Khách quét QR để chuyển khoản đúng số tiền và nội dung.
              </p>
            </Modal.Header>

            <Modal.Body className="flex flex-col items-center gap-4 px-5 py-4">
              <div className="overflow-hidden rounded-2xl border border-black/10 bg-white p-2 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl ?? qrSrc}
                  alt="QR chuyển khoản"
                  className="h-56 w-56 object-contain"
                />
              </div>
              <div className="w-full space-y-1.5 rounded-xl bg-[#f3f9f6] px-4 py-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-foreground/55">Mã đơn</span>
                  <span className="font-semibold">{formatOrderRef(order)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-foreground/55">Nội dung CK</span>
                  <span className="font-semibold tracking-wide text-[#1a3c34]">
                    {order.paymentCode}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-foreground/55">Số tiền</span>
                  <span className="font-bold text-[#1a3c34]">
                    {formatVnd(order.finalAmount)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-foreground/55">Ngân hàng</span>
                  <span className="font-medium">
                    {paymentConfig.bankCode} · {paymentConfig.accountNumber}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-foreground/55">Chủ tài khoản</span>
                  <span className="font-medium">{paymentConfig.accountName}</span>
                </div>
              </div>
            </Modal.Body>

            <Modal.Footer className="border-t border-black/6 px-5 py-4">
              <Button
                className="w-full rounded-full bg-[#1a3c34] font-semibold text-white"
                onPress={onGoToDetail}
              >
                Xem chi tiết đơn
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
