"use client";

import { Fragment } from "react";
import dynamic from "next/dynamic";
import {
  Avatar,
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
  Crown,
  ExternalLink,
  FileText,
  MapPin,
  Phone,
  ShoppingBag,
  Trash2,
  Truck,
  User,
  UserPlus,
  Users,
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
  markGroupParticipantPaid,
} from "@/services/admin/orders-api";
import type { AdminOrder, AdminOrderStatus } from "@/services/admin/types";

import { AssignShipperModal } from "./AssignShipperModal";
import {
  canAssignShipper,
  customerDisplayName,
  formatOrderRef,
  orderStatusChipClass,
  orderStatusLabel,
} from "./order-display";
import { groupOrderItems } from "./receipt-shared";
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
                    <div className="relative">
                      {active && (
                        <span className="absolute -inset-[5px] animate-ping rounded-full bg-[#1a3c34]/15" aria-hidden />
                      )}
                      <div
                        className={`relative flex size-9 items-center justify-center rounded-full transition-all ${active
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
                    </div>
                    {!isLast && (
                      <div
                        className={`mt-1 w-0.5 flex-1 min-h-[24px] rounded-full sm:hidden ${i < activeIdx ? "bg-[#1a3c34]/20" : "bg-black/8"
                          }`}
                      />
                    )}
                  </div>
                  <div className={`pt-1.5 sm:pt-0 sm:text-center ${isLast ? "" : "pb-5 sm:pb-0"}`}>
                    <p
                      className={`text-sm font-semibold leading-tight sm:text-[11px] transition-colors ${active ? "text-[#1a3c34]" : done ? "text-foreground/75" : "text-foreground/30"
                        }`}
                    >
                      {STATUS_META[step].label}
                    </p>
                  </div>
                </div>
                {!isLast && (
                  <div
                    className={`hidden sm:block h-0.5 min-w-3 flex-1 self-start mt-[18px] rounded-full ${i < activeIdx ? "bg-[#1a3c34]/20" : "bg-black/8"
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

  const order = orderQuery.data;

  const deleteMut = useMutation({
    mutationFn: () => deleteAdminOrder(orderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      router.push(ROUTES.ORDERS);
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const markPaidMut = useMutation({
    mutationFn: (participantId: string) => markGroupParticipantPaid(orderId, participantId),
    onSuccess: (updated) => {
      queryClient.setQueryData(adminKeys.order(orderId), updated);
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
  const hasDeliveryInfo = o.type === "delivery" && (o.guestDeliveryName || o.guestDeliveryPhone || o.guestDeliveryAddress || o.address);
  const mapLat = o.address?.lat;
  const mapLng = o.address?.lng;
  const hasMap = typeof mapLat === "number" && typeof mapLng === "number";
  const deliveryAddress = o.address?.fullAddress ?? o.guestDeliveryAddress ?? null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-16">
      {/* Back nav */}
      <button
        type="button"
        onClick={() => router.push(ROUTES.ORDERS)}
        className="group -ml-1.5 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-foreground/55 transition-colors hover:bg-black/[0.04] hover:text-foreground"
      >
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        Danh sách đơn
      </button>

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

      {/* ─── Hero Order Card ─── */}
      <Card className="rounded-3xl border border-black/6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.10)]">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-6 sm:p-6">
            {/* Left: ref + service + status */}
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xl font-bold tracking-tight text-[#1a3c34]">
                  {formatOrderRef(o)}
                </span>
                {o.type === "delivery" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
                    <Bike className="size-3" aria-hidden />
                    Giao hàng
                  </span>
                )}
                {o.type === "table" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200/80">
                    <UtensilsCrossed className="size-3" aria-hidden />
                    {o.table?.name ? `Bàn ${o.table.name}` : "Tại bàn"}
                  </span>
                )}
                {o.type === "pickup" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200/80">
                    <ShoppingBag className="size-3" aria-hidden />
                    Mang đi
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground/55">
                {customerDisplayName(o)} · {new Date(o.createdAt).toLocaleString("vi-VN")}
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

            {/* Right: amount */}
            <div className="shrink-0 rounded-2xl bg-[#1a3c34]/[0.04] px-4 py-3 text-right sm:min-w-[172px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">Tổng cộng</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-[#1a3c34]">
                {formatVnd(orderTotal)}
              </p>
              {Number(o.discountAmount) > 0 && (
                <p className="mt-0.5 text-xs text-foreground/50">
                  Giảm <span className="font-medium text-red-500">-{formatVnd(o.discountAmount)}</span>
                </p>
              )}
              <p className="mt-1.5 text-[11px] text-foreground/40">
                Mã: <span className="font-mono font-medium text-foreground/60">{o.paymentCode}</span>
              </p>
            </div>
          </div>

          {/* Action toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-black/6 px-5 py-3 sm:px-6">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-black/12 text-sm"
              onPress={() => router.push(ROUTES.orderInvoice(o.id))}
            >
              <FileText className="mr-1.5 size-3.5" />
              Hóa đơn
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-black/12 text-sm"
              onPress={() => setEditOpen(o)}
            >
              Sửa trạng thái
            </Button>
            {canAssignShipper(o) ? (
              <Button
                size="sm"
                className="rounded-full bg-[#1a3c34] font-semibold text-white"
                onPress={() => setAssignOpen(o)}
              >
                <UserPlus className="mr-1.5 size-3.5" />
                Gán shipper
              </Button>
            ) : null}
            <div className="flex-1" />
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-red-700 hover:bg-red-50"
              onPress={async () => {
                const ok = await confirm({
                  title: "Xóa đơn hàng?",
                  description: "Xóa đơn này? Nếu đã có thanh toán, giao dịch đó sẽ bị xóa theo. Không thể hoàn tác.",
                  tone: "danger",
                  confirmLabel: "Xóa đơn",
                });
                if (ok) deleteMut.mutate();
              }}
              isDisabled={deleteMut.isPending}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Xóa
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status timeline */}
      <StatusTimeline order={o} />


      {/* Service + recipient combined card */}
      <Card className="rounded-2xl border border-black/6">
        <CardContent className="p-5">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
            Thông tin giao nhận
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {o.type === "delivery" && (
              <div className="flex items-center gap-2.5 rounded-xl border border-black/6 px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                  <Bike className="size-4 text-emerald-700" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">Dịch vụ</p>
                  <p className="truncate text-sm font-medium">Giao hàng</p>
                  {o.shipper && <p className="truncate text-xs text-foreground/50">{o.shipper.name}</p>}
                </div>
              </div>
            )}
            {o.type === "table" && (
              <div className="flex items-center gap-2.5 rounded-xl border border-black/6 px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-50">
                  <UtensilsCrossed className="size-4 text-amber-700" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">Dịch vụ</p>
                  <p className="truncate text-sm font-medium">{o.table?.name ? `Bàn ${o.table.name}` : "Tại bàn"}</p>
                </div>
              </div>
            )}
            {o.type === "pickup" && (
              <div className="flex items-center gap-2.5 rounded-xl border border-black/6 px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-50">
                  <ShoppingBag className="size-4 text-violet-700" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">Dịch vụ</p>
                  <p className="truncate text-sm font-medium">Mang đi</p>
                </div>
              </div>
            )}
            {(o.guestDeliveryName ?? o.user?.name) && (
              <div className="flex items-center gap-2.5 rounded-xl border border-black/6 px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-50">
                  <User className="size-4 text-sky-600" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">Khách hàng</p>
                  <p className="truncate text-sm font-medium">{o.guestDeliveryName ?? o.user?.name}</p>
                </div>
              </div>
            )}
            {(o.guestDeliveryPhone ?? o.user?.phone) && (
              <div className="flex items-center gap-2.5 rounded-xl border border-black/6 px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-50">
                  <Phone className="size-4 text-sky-600" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">Điện thoại</p>
                  <a
                    href={`tel:${o.guestDeliveryPhone ?? o.user?.phone}`}
                    className="truncate font-mono text-sm text-[#1a3c34] hover:underline"
                  >
                    {o.guestDeliveryPhone ?? o.user?.phone}
                  </a>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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

      {/* Group order participants */}
      {o.groupOrder && o.groupOrder.participants.length > 0 && (() => {
        const go = o.groupOrder!;
        const isSplit = go.paymentMode === "split";
        const shipping = o.type === "delivery" ? Number(o.shippingFee) : 0;
        const discount = Number(o.discountAmount) + Number(o.pointDiscountAmount);
        const activeParticipants = go.participants.filter((p) => p.items.length > 0);
        const totalSubtotal = activeParticipants.reduce(
          (s, p) => s + p.items.reduce((sum, it) => sum + Number(it.unitPrice) * it.quantity, 0), 0
        );
        const discountFraction = totalSubtotal > 0 ? discount / totalSubtotal : 0;
        const shippingFeeMode = go.shippingFeeMode ?? "split";
        const perPersonShipping = isSplit && shippingFeeMode === "split" && activeParticipants.length > 0
          ? Math.round(shipping / activeParticipants.length) : 0;

        function calcParticipantTotal(subtotal: number, isHost: boolean) {
          if (!isSplit) return subtotal;
          const discountShare = Math.round(subtotal * discountFraction);
          const shippingShare = shippingFeeMode === "host_pays"
            ? (isHost ? shipping : 0)
            : perPersonShipping;
          return { total: Math.round(subtotal - discountShare + shippingShare), discountShare, shippingShare };
        }

        return (
          <Card className="rounded-2xl border border-violet-200 bg-violet-50/30">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 border-b border-violet-200/60 px-5 py-4">
                <Users className="size-4 text-violet-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
                    Đơn nhóm · {go.participants.length} thành viên ·{" "}
                    {go.paymentMode === "host_pays" ? "Chủ trả" : "Chia tiền"}
                  </p>
                </div>
                <a
                  href={`/group-orders/${go.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:underline"
                >
                  <ExternalLink className="size-3" />
                  Xem nhóm
                </a>
              </div>
              <div className="divide-y divide-black/5">
                {go.participants.map((p) => {
                  const name = p.user?.name ?? p.guestName ?? "Khách";
                  const subtotal = p.items.reduce((s, it) => s + Number(it.unitPrice) * it.quantity, 0);
                  const paymentCalc = calcParticipantTotal(subtotal, p.isHost);
                  const paymentTotal = typeof paymentCalc === "object" ? paymentCalc.total : paymentCalc;
                  const hasExtra = isSplit && typeof paymentCalc === "object" && (paymentCalc.discountShare > 0 || paymentCalc.shippingShare > 0);
                  const isPaidParticipant = p.paymentStatus === "paid";
                  const isBusy = markPaidMut.isPending && markPaidMut.variables === p.id;
                  return (
                    <div key={p.id} className="px-5 py-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Avatar className="shrink-0" size="md" {...({} as any)}>
                          <Avatar.Fallback className="text-xs font-bold" {...({} as any)}>
                            {name[0]?.toUpperCase() ?? "N/A"}
                          </Avatar.Fallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                          {name}
                        </span>
                        {p.isHost && (
                          <Crown className="size-3.5 shrink-0 text-amber-500" />
                        )}
                        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isPaidParticipant
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                          }`}>
                          {isPaidParticipant ? (
                            <><CheckCircle2 className="size-3" />Đã TT</>
                          ) : "Chưa TT"}
                        </span>
                        {!isPaidParticipant && p.items.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 rounded-full px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
                            isDisabled={isBusy || markPaidMut.isPending}
                            onPress={() => markPaidMut.mutate(p.id)}
                          >
                            {isBusy ? "…" : "Xác nhận TT"}
                          </Button>
                        )}
                      </div>
                      {p.items.length === 0 ? (
                        <p className="text-xs text-foreground/40 italic">Chưa chọn món</p>
                      ) : (
                        <div className="space-y-2">
                          {p.items.map((it) => {
                            const img = Array.isArray(it.product?.imageUrls) && typeof it.product?.imageUrls[0] === "string"
                              ? it.product.imageUrls[0] : null;
                            return (
                              <div key={it.id} className="flex flex-col gap-2">
                                <div className="flex items-center gap-3">
                                  <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-black/5">
                                    {img ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={img} alt="" className="size-full object-cover" />
                                    ) : (
                                      <div className="flex size-full items-center justify-center text-[9px] text-foreground/30">—</div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-foreground">
                                      {it.product?.name ?? "Sản phẩm"}
                                    </p>
                                    {it.note?.trim() && (
                                      <p className="text-xs italic text-amber-700">&ldquo;{it.note.trim()}&rdquo;</p>
                                    )}
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-xs text-foreground/50">×{it.quantity}</p>
                                    <p className="text-sm font-semibold tabular-nums text-[#1a3c34]">
                                      {formatVnd(Number(it.unitPrice) * it.quantity)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  {Object.entries(parseOrderItemOptions(it.selectedOptions)).map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="inline-block bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-md"
                                    >
                                      {k}: {v}
                                    </span>
                                  ))}
                                </div>
                                <div className="flex items-center gap-3">
                                  {Array.isArray(it.toppingsJson) && it.toppingsJson.map((topping) => (
                                    <span
                                      key={topping.id}
                                      className="inline-block bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-md"
                                    >
                                      {topping.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                          <div className="border-t border-black/6 pt-2 space-y-1">
                            {hasExtra && typeof paymentCalc === "object" && (
                              <>
                                <div className="flex justify-between text-xs text-foreground/50">
                                  <span>Tạm tính</span>
                                  <span className="tabular-nums">{formatVnd(subtotal)}</span>
                                </div>
                                {paymentCalc.discountShare > 0 && (
                                  <div className="flex justify-between text-xs text-foreground/50">
                                    <span>Giảm giá</span>
                                    <span className="tabular-nums text-red-500">-{formatVnd(paymentCalc.discountShare)}</span>
                                  </div>
                                )}
                                {paymentCalc.shippingShare > 0 && (
                                  <div className="flex justify-between text-xs text-foreground/50">
                                    <span>Phí ship</span>
                                    <span className="tabular-nums">+{formatVnd(paymentCalc.shippingShare)}</span>
                                  </div>
                                )}
                              </>
                            )}
                            <div className="flex justify-between text-xs font-semibold text-foreground/60">
                              <span>{isSplit ? "Phải trả" : `Tổng ${name.split(" ").pop()}`}</span>
                              <span className="tabular-nums text-[#1a3c34]">{formatVnd(paymentTotal)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Items — hidden for group orders (items shown per-participant above) */}
      {!o.groupOrder && <Card className="rounded-2xl border border-black/6">
        <CardContent className="p-0">
          <div className="border-b border-black/6 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Tổng hợp món ({groupOrderItems(o.items).reduce((s, it) => s + it.quantity, 0)} món)
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
      </Card>}

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
