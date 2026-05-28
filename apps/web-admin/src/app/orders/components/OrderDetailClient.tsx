"use client";

import { Fragment } from "react";
import dynamic from "next/dynamic";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Table,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Bike,
  Box,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  Phone,
  ShoppingBag,
  Trash2,
  Truck,
  User,
  UserPlus,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import type { OrderPaidPayload } from "@/hooks/useOrderSocket";
import { useOrderSocket } from "@/hooks/useOrderSocket";
import { formatVnd } from "@/lib/product-display";
import { ROUTES } from "@/lib/routes";
import { adminKeys } from "@/services/admin/keys";
import {
  deleteAdminOrder,
  fetchAdminOrder,
} from "@/services/admin/orders-api";
import { fetchPaymentConfig } from "@/services/admin/payment-config-api";
import type { AdminOrder, AdminOrderStatus } from "@/services/admin/types";

import { AssignShipperModal } from "./AssignShipperModal";
import {
  canAssignShipper,
  customerDisplayName,
  formatOrderRef,
  orderStatusChipClass,
  orderStatusLabel,
  serviceTypeLabel,
} from "./order-display";
import { buildVietQrUrl, groupOrderItems } from "./receipt-shared";
import {
  parseOrderItemExtras,
  parseOrderItemOptions,
} from "./order-line-format";
import { OrderEditModal } from "./OrderEditModal";

const LeafletMap = dynamic(
  () => import("@/components/common/LeafletMapInner"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse rounded-2xl bg-black/5" />
    ),
  },
);

function axiosMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const d = err.response?.data;
  if (d && typeof d === "object") {
    const m = d.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  if (e instanceof Error) return e.message;
  return "Có lỗi xảy ra.";
}

// ── Status timeline ───────────────────────────────────────────────────────────

const STATUS_STEPS_DELIVERY: AdminOrderStatus[] = [
  "pending", "confirmed", "preparing", "ready", "delivering", "completed",
];
const STATUS_STEPS_NO_DELIVERY: AdminOrderStatus[] = [
  "pending", "confirmed", "preparing", "ready", "completed",
];

const STATUS_META: Record<AdminOrderStatus, {
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
}> = {
  pending: { label: "Chờ xác nhận", icon: Clock, bg: "bg-amber-50", text: "text-amber-700" },
  confirmed: { label: "Đã xác nhận", icon: BadgeCheck, bg: "bg-blue-50", text: "text-blue-700" },
  preparing: { label: "Đang làm", icon: Box, bg: "bg-violet-50", text: "text-violet-700" },
  ready: { label: "Sẵn sàng", icon: CheckCircle2, bg: "bg-teal-50", text: "text-teal-700" },
  delivering: { label: "Đang giao", icon: Truck, bg: "bg-sky-50", text: "text-sky-700" },
  completed: { label: "Hoàn thành", icon: CheckCircle2, bg: "bg-green-50", text: "text-green-700" },
  cancelled: { label: "Đã huỷ", icon: Ban, bg: "bg-red-50", text: "text-red-600" },
};

function StatusTimeline({ order }: { order: AdminOrder }) {
  const isCancelled = order.status === "cancelled";
  const steps = order.type === "delivery" ? STATUS_STEPS_DELIVERY : STATUS_STEPS_NO_DELIVERY;
  const activeIdx = isCancelled ? -1 : steps.indexOf(order.status);

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-5 py-4">
        <Ban className="size-5 shrink-0 text-red-500" />
        <div>
          <p className="text-sm font-semibold text-red-700">Đơn hàng đã bị huỷ</p>
          <p className="mt-0.5 text-xs text-red-500/80">Liên hệ khách nếu cần xử lý hoàn tiền.</p>
        </div>
      </div>
    );
  }

  return (
    <Card className="rounded-2xl border border-black/6">
      <CardContent className="p-5">
        <p className="mb-5 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
          Tiến trình đơn hàng
        </p>
        <div className="flex flex-col sm:flex-row sm:items-start">
          {steps.map((step, i) => {
            const done = i <= activeIdx;
            const active = i === activeIdx;
            const isLast = i === steps.length - 1;
            const StepIcon = STATUS_META[step].icon;

            return (
              <Fragment key={step}>
                <div className="flex gap-4 sm:flex-1 sm:flex-col sm:items-center sm:gap-1.5">
                  <div className="flex shrink-0 flex-col items-center">
                    <div
                      className={`flex size-9 items-center justify-center rounded-full transition-all ${
                        active
                          ? "bg-[#1a3c34] text-white shadow-[0_0_0_4px_rgba(26,60,52,0.12)]"
                          : done
                            ? "bg-[#1a3c34]/10 text-[#1a3c34]"
                            : "bg-black/5 text-foreground/25"
                      }`}
                    >
                      {done ? (
                        active ? (
                          <StepIcon className="size-4" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )
                      ) : (
                        <Circle className="size-3.5 opacity-40" />
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className={`mt-1 w-0.5 flex-1 min-h-[24px] rounded-full sm:hidden ${
                          i < activeIdx ? "bg-[#1a3c34]/20" : "bg-black/8"
                        }`}
                      />
                    )}
                  </div>
                  <div className={`pt-1.5 sm:pt-0 sm:text-center ${isLast ? "" : "pb-5 sm:pb-0"}`}>
                    <p
                      className={`text-sm font-semibold leading-tight sm:text-[11px] transition-colors ${
                        active ? "text-[#1a3c34]" : done ? "text-foreground/75" : "text-foreground/30"
                      }`}
                    >
                      {STATUS_META[step].label}
                    </p>
                  </div>
                </div>
                {!isLast && (
                  <div
                    className={`hidden sm:block h-0.5 min-w-3 flex-1 self-start mt-[18px] rounded-full ${
                      i < activeIdx ? "bg-[#1a3c34]/20" : "bg-black/8"
                    }`}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Item option / extra badges ────────────────────────────────────────────────

function ItemBadges({ item }: { item: AdminOrder["items"][number] }) {
  const opts = parseOrderItemOptions(item.optionsJson);
  const extras = parseOrderItemExtras(item.extrasJson);
  const optEntries = Object.entries(opts);
  if (optEntries.length === 0 && extras.length === 0 && !item.note) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {optEntries.map(([, v]) => (
        <span
          key={v}
          className="inline-flex items-center rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-foreground/65"
        >
          {v}
        </span>
      ))}
      {extras.map((ex, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
        >
          +{ex.name}
          {Number(ex.price) > 0 && (
            <span className="text-[10px] text-emerald-600/70">
              &nbsp;+{formatVnd(Number(ex.price))}
            </span>
          )}
        </span>
      ))}
      {item.note?.trim() && (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] italic text-amber-700">
          &ldquo;{item.note.trim()}&rdquo;
        </span>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type Props = { orderId: string };

export function OrderDetailClient({ orderId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirm, showAlert } = useAppDialog();
  const [assignOpen, setAssignOpen] = useState<AdminOrder | null>(null);
  const [editOpen, setEditOpen] = useState<AdminOrder | null>(null);
  const [paidInfo, setPaidInfo] = useState<OrderPaidPayload | null>(null);

  useOrderSocket({
    orderId,
    onOrderPaid: (p) => setPaidInfo(p),
  });

  useEffect(() => {
    if (!paidInfo) return;
    const amount = Number(paidInfo.transferAmount).toLocaleString("vi-VN");
    const text = `Đã nhận thanh toán ${amount} đồng`;

    let ttsConfig: Record<string, unknown> = {};
    try {
      const raw = localStorage.getItem("kun_tts_config");
      if (raw) ttsConfig = JSON.parse(raw) as Record<string, unknown>;
    } catch { /* ignore */ }

    let objectUrl: string | null = null;

    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...ttsConfig }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("tts_error");
        return res.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        const audio = new Audio(objectUrl);
        audio.play().catch(() => { });
        audio.addEventListener("ended", () => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        });
      })
      .catch(() => { });
  }, [paidInfo]);

  const orderQuery = useQuery({
    queryKey: adminKeys.order(orderId),
    queryFn: () => fetchAdminOrder(orderId),
  });

  const { data: paymentConfig = null } = useQuery({
    queryKey: adminKeys.paymentConfig,
    queryFn: fetchPaymentConfig,
  });

  const order = orderQuery.data;

  const deleteMut = useMutation({
    mutationFn: () => deleteAdminOrder(orderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      router.push(ROUTES.ORDERS);
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  if (orderQuery.isError) {
    return (
      <div className="py-16 text-center text-sm text-red-700">
        Không tải được đơn.
      </div>
    );
  }

  if (orderQuery.isLoading || !order) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-16">
        <div className="h-10 w-48 animate-pulse rounded-full bg-black/5" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-black/5 ring-1 ring-black/6"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-black/5 ring-1 ring-black/6" />
      </div>
    );
  }

  const o = order;
  const isPaid = o.paymentStatus === "paid";
  const orderTotal = Number(o.totalAmount)
    - Number(o.discountAmount)
    - Number(o.pointDiscountAmount)
    + (o.type === "delivery" ? Number(o.shippingFee) : 0);
  const showPaymentQr = !isPaid && paymentConfig?.isEnabled && o.paymentType === "bank_transfer";
  const paymentQrSrc = showPaymentQr
    ? `/api/qr-proxy?url=${encodeURIComponent(buildVietQrUrl(paymentConfig!, Math.round(orderTotal), o.paymentCode))}`
    : null;

  const hasDeliveryInfo = o.type === "delivery" && (o.guestDeliveryName || o.guestDeliveryPhone || o.guestDeliveryAddress || o.address);
  const mapLat = o.address?.lat;
  const mapLng = o.address?.lng;
  const hasMap = typeof mapLat === "number" && typeof mapLng === "number";
  const deliveryAddress = o.address?.fullAddress ?? o.guestDeliveryAddress ?? null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-16">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          className="rounded-full"
          onPress={() => router.push(ROUTES.ORDERS)}
        >
          <ArrowLeft className="mr-2 size-4" />
          Danh sách đơn
        </Button>
      </div>

      {/* Payment received banner */}
      {paidInfo && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
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

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xl font-bold text-[#1a3c34]">
            {formatOrderRef(o)}
          </p>
          <p className="text-sm text-foreground/55">
            {customerDisplayName(o)} · {serviceTypeLabel(o.type)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              size="sm"
              variant="soft"
              className={`border-0 font-semibold uppercase text-xs ${orderStatusChipClass(o.status)}`}
            >
              <Chip.Label>{orderStatusLabel(o.status)}</Chip.Label>
            </Chip>
            {isPaid ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="size-3.5" />
                Đã thanh toán
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                <Clock className="size-3.5" />
                Chưa thanh toán
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-full border-black/15"
            onPress={() => router.push(ROUTES.orderInvoice(o.id))}
          >
            <FileText className="mr-2 size-4" />
            Hóa đơn
          </Button>
          <Button
            variant="outline"
            className="rounded-full border-black/15"
            onPress={() => setEditOpen(o)}
          >
            Sửa trạng thái
          </Button>
          {canAssignShipper(o) ? (
            <Button
              className="rounded-full bg-[#1a3c34] font-semibold text-white"
              onPress={() => setAssignOpen(o)}
            >
              <UserPlus className="mr-2 size-4" />
              Gán shipper
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="rounded-full text-red-700 hover:bg-red-50"
            onPress={async () => {
              const ok = await confirm({
                title: "Xóa đơn hàng?",
                description: "Xóa đơn này? Chỉ khi chưa có giao dịch thanh toán.",
                tone: "danger",
                confirmLabel: "Xóa đơn",
              });
              if (ok) deleteMut.mutate();
            }}
            isDisabled={deleteMut.isPending}
          >
            <Trash2 className="mr-2 size-4" />
            Xóa
          </Button>
        </div>
      </header>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className={`rounded-2xl border ${isPaid ? "border-emerald-200 bg-emerald-50/40" : "border-black/6"}`}>
          <CardContent className="space-y-2 p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Tổng cộng
            </p>
            <p className="text-3xl font-bold tabular-nums text-[#1a3c34]">
              {formatVnd(orderTotal)}
            </p>
            {Number(o.discountAmount) > 0 && (
              <p className="text-xs text-foreground/50">
                Giảm giá: <span className="font-medium text-red-600">-{formatVnd(o.discountAmount)}</span>
              </p>
            )}
            <p className="text-xs text-foreground/50">
              Mã TT:{" "}
              <span className="font-mono font-semibold tracking-wide">{o.paymentCode}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/6">
          <CardContent className="space-y-3 p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Trạng thái đơn
            </p>
            <Chip
              size="md"
              variant="soft"
              className={`border-0 font-bold uppercase ${orderStatusChipClass(o.status)}`}
            >
              <Chip.Label>{orderStatusLabel(o.status)}</Chip.Label>
            </Chip>
            <div className="flex items-center gap-2 pt-1">
              {isPaid ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="size-4" />
                  Đã thanh toán
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-800">
                  <Clock className="size-4" />
                  Chưa thanh toán
                </span>
              )}
            </div>
            <p className="text-[11px] text-foreground/40">
              {new Date(o.createdAt).toLocaleString("vi-VN")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status timeline */}
      <StatusTimeline order={o} />

      {/* QR payment */}
      {showPaymentQr && paymentQrSrc && (
        <Card className="rounded-2xl border border-amber-200 bg-amber-50/40">
          <CardContent className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-start">
            <div className="shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-white p-2 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={paymentQrSrc}
                alt="QR chuyển khoản"
                className="h-44 w-44 object-contain"
              />
            </div>
            <div className="flex-1 space-y-2 text-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Chuyển khoản ngân hàng
              </p>
              <p className="text-xl font-bold tabular-nums text-[#1a3c34]">
                {formatVnd(orderTotal)}
              </p>
              <div className="space-y-1 text-foreground/70">
                <p><span className="font-medium">Ngân hàng:</span> {paymentConfig!.bankCode}</p>
                <p><span className="font-medium">Số TK:</span> <span className="font-mono">{paymentConfig!.accountNumber}</span></p>
                <p><span className="font-medium">Chủ TK:</span> {paymentConfig!.accountName}</p>
                <p>
                  <span className="font-medium">Nội dung CK:</span>{" "}
                  <span className="font-mono font-semibold text-[#1a3c34]">{o.paymentCode}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service card */}
      <Card className="rounded-2xl border border-black/6">
        <CardContent className="space-y-4 p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">Dịch vụ</p>
          <div className="flex flex-wrap gap-3 text-sm">
            {o.type === "delivery" && (
              <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-950">
                <Bike className="size-4" />
                Giao hàng{o.shipper ? ` · ${o.shipper.name}` : ""}
              </span>
            )}
            {o.type === "table" && (
              <span className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-950">
                <UtensilsCrossed className="size-4" />
                {o.table?.name ? `Bàn ${o.table.name}` : "Bàn"}
              </span>
            )}
            {o.type === "pickup" && (
              <span className="inline-flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-violet-950">
                <ShoppingBag className="size-4" />
                Mang đi
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recipient personal info card */}
      {hasDeliveryInfo && (o.guestDeliveryName || o.guestDeliveryPhone || o.user) && (
        <Card className="rounded-2xl border border-sky-200 bg-sky-50/40">
          <CardContent className="p-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Người nhận
            </p>
            <div className="space-y-2.5">
              {(o.guestDeliveryName ?? o.user?.name) && (
                <div className="flex items-center gap-2.5 text-sm">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-100">
                    <User className="size-4 text-sky-600" />
                  </div>
                  <span className="font-semibold text-foreground">{o.guestDeliveryName ?? o.user?.name}</span>
                </div>
              )}
              {o.guestDeliveryPhone && (
                <div className="flex items-center gap-2.5 text-sm">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-100">
                    <Phone className="size-4 text-sky-600" />
                  </div>
                  <span className="font-mono text-foreground">{o.guestDeliveryPhone}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery address + map card */}
      {hasDeliveryInfo && deliveryAddress && (
        <Card className="rounded-2xl border border-black/6">
          <CardContent className="p-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Địa chỉ giao hàng
            </p>
            <div className="flex items-start gap-2.5 text-sm">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-soft">
                <MapPin className="size-4 text-[#1a3c34]" />
              </div>
              <span className="leading-snug text-foreground">{deliveryAddress}</span>
            </div>

            {hasMap && (
              <div className="mt-4 space-y-2">
                <div className="h-52 overflow-hidden rounded-2xl ring-1 ring-black/6">
                  <LeafletMap
                    lat={mapLat}
                    lng={mapLng}
                    address={deliveryAddress ?? undefined}
                  />
                </div>
                <a
                  href={`https://www.google.com/maps?q=${mapLat},${mapLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#1a3c34] hover:underline"
                >
                  <ExternalLink className="size-3" />
                  Mở trong Google Maps
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card className="rounded-2xl border border-black/6">
        <CardContent className="p-0">
          <div className="border-b border-black/6 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Món trong đơn ({groupOrderItems(o.items).reduce((s, it) => s + it.quantity, 0)} món)
            </p>
          </div>
          <Table.Root aria-label="Chi tiết món">
            <Table.ScrollContainer>
              <Table.Content>
                <Table.Header>
                  <Table.Column
                    isRowHeader={true}
                    textValue="Sản phẩm"
                    className="px-5 py-2 text-xs uppercase text-foreground/45"
                  >
                    Sản phẩm
                  </Table.Column>
                  <Table.Column className="px-5 py-2 text-xs uppercase text-foreground/45">
                    SL
                  </Table.Column>
                  <Table.Column className="px-5 py-2 text-right text-xs uppercase text-foreground/45">
                    Thành tiền
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {groupOrderItems(o.items).map((it) => {
                    const urls = it.product.imageUrls;
                    const img = Array.isArray(urls) && typeof urls[0] === "string" ? urls[0] : null;
                    const lineTotal = Number.parseFloat(it.price) * it.quantity;
                    return (
                      <Table.Row key={it.id}>
                        <Table.Cell className="px-5 py-3">
                          <div className="flex items-start gap-3">
                            <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-[#f3f4f6]">
                              {img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={img} alt="" className="size-full object-cover" />
                              ) : (
                                <div className="flex size-full items-center justify-center text-[9px] text-foreground/35">
                                  —
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm font-medium">{it.product.name}</span>
                              <ItemBadges item={it} />
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 tabular-nums">
                          {it.quantity}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-right font-medium tabular-nums">
                          {formatVnd(lineTotal)}
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table.Root>

          {/* Payment summary */}
          {(() => {
            const subtotal = Number(o.totalAmount);
            const discount = Number(o.discountAmount);
            const pointDiscount = Number(o.pointDiscountAmount);
            const shipping = o.type === "delivery" ? Number(o.shippingFee) : 0;
            const total = subtotal - discount - pointDiscount + shipping;
            return (
              <div className="border-t border-black/6 px-5 py-4 space-y-2">
                <div className="flex justify-between text-sm text-foreground/60">
                  <span>Tạm tính</span>
                  <span className="tabular-nums font-medium text-foreground">{formatVnd(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-foreground/60">
                    <span>Giảm giá</span>
                    <span className="tabular-nums font-medium text-red-600">-{formatVnd(discount)}</span>
                  </div>
                )}
                {pointDiscount > 0 && (
                  <div className="flex justify-between text-sm text-foreground/60">
                    <span>Điểm tích lũy</span>
                    <span className="tabular-nums font-medium text-violet-600">-{formatVnd(pointDiscount)}</span>
                  </div>
                )}
                {o.type === "delivery" && (
                  <div className="flex justify-between text-sm text-foreground/60">
                    <span>Phí vận chuyển</span>
                    {shipping > 0 ? (
                      <span className="tabular-nums font-medium text-foreground">{formatVnd(shipping)}</span>
                    ) : (
                      <span className="font-semibold uppercase text-[#26634d]">Miễn phí</span>
                    )}
                  </div>
                )}
                <div className="flex items-baseline justify-between border-t border-black/6 pt-3">
                  <span className="font-semibold text-foreground/70">Tổng cộng</span>
                  <span className="text-xl font-bold tabular-nums text-[#1a3c34]">{formatVnd(total)}</span>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <AssignShipperModal
        order={assignOpen}
        isOpen={assignOpen !== null}
        onOpenChange={(open) => {
          if (!open) setAssignOpen(null);
        }}
      />
      <OrderEditModal
        order={editOpen}
        isOpen={editOpen !== null}
        onOpenChange={(open) => {
          if (!open) setEditOpen(null);
          if (!open) void orderQuery.refetch();
        }}
      />
    </div>
  );
}
