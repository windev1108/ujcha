"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { useRouter } from "@/i18n/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Package, ShoppingBag, Star, Users } from "lucide-react";
import { Button } from "@heroui/react";
import { useMyOrdersQuery } from "@/services/order/hooks";
import { useProfileQuery } from "@/services/profile/hooks";
import { revealTransition, easeOutSmooth } from "@/app/[locale]/(landing)/components/RevealSection";
import { ROUTES } from "@/lib/routes";
import type { UserOrder, UserOrderItem, OrderStatus } from "@/services/order/api";

function formatVnd(s: string | number) {
  const n = typeof s === "string" ? parseFloat(s) : s;
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

function formatDateCompact(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Hôm nay, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Hôm qua, ${time}`;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) + `, ${time}`;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  pending:    { label: "Chờ xác nhận", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  confirmed:  { label: "Đã xác nhận",  className: "bg-blue-50 text-blue-700 ring-blue-200" },
  preparing:  { label: "Đang pha chế", className: "bg-purple-50 text-purple-700 ring-purple-200" },
  ready:      { label: "Sẵn sàng",     className: "bg-teal-50 text-teal-700 ring-teal-200" },
  delivering: { label: "Đang giao",    className: "bg-sky-50 text-sky-700 ring-sky-200" },
  completed:  { label: "Hoàn thành",   className: "bg-green-50 text-green-700 ring-green-200" },
  cancelled:  { label: "Đã huỷ",       className: "bg-red-50 text-red-600 ring-red-200" },
};

const TYPE_LABEL: Record<string, string> = {
  delivery: "Giao hàng",
  pickup:   "Mang đi",
  table:    "Tại bàn",
};

function ProductImageStack({ items }: { items: UserOrderItem[] }) {
  const maxShow = 3;
  const shown = items.slice(0, maxShow);
  const rest = items.length - maxShow;

  return (
    <div className="flex items-center">
      {shown.map((item, i) => {
        const imgUrl = item.product.imageUrls[0] ?? null;
        return (
          <div
            key={item.id}
            className="relative size-11 shrink-0 overflow-hidden rounded-2xl ring-2 ring-white"
            style={{ zIndex: maxShow - i, marginLeft: i === 0 ? 0 : -10 }}
          >
            {imgUrl ? (
              <Image
                src={imgUrl}
                alt={item.product.name}
                fill
                className="object-cover"
                sizes="44px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#1a3c34]">
                <span className="select-none text-xs font-bold text-white/30">
                  {item.product.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        );
      })}
      {rest > 0 && (
        <div
          className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface-card ring-2 ring-white text-[11px] font-bold text-muted"
          style={{ zIndex: 0, marginLeft: -10 }}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, index = 0 }: { order: UserOrder; index?: number }) {
  const router = useRouter();
  const statusCfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const displayItems = order.items.slice(0, 2);
  const moreCount = order.items.length - 2;
  const fmtPoints = Number.isInteger(order.earnedPoints)
    ? order.earnedPoints
    : (order.earnedPoints as number).toFixed(1);
  const isGroupOrder = order.isGroupOrder;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: easeOutSmooth, delay: index * 0.055 }}
      onClick={() => router.push(ROUTES.ORDER_DETAIL(order.paymentCode))}
      className="group cursor-pointer rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.10)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_36px_-10px_rgba(0,0,0,0.18)]"
    >
      {/* Top: image stack + badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <ProductImageStack items={order.items} />
          {isGroupOrder && (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#1a3c34]/8 px-2.5 py-1 text-[11px] font-semibold text-[#1a3c34]">
              <Users className="size-3" />
              Đơn nhóm
            </span>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusCfg.className}`}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* Item names */}
      <div className="mt-3.5 space-y-1">
        {displayItems.map((item, i) => (
          <p key={i} className="truncate text-sm leading-snug text-foreground">
            <span className="font-normal text-foreground/40">{item.quantity}×</span>
            {" "}
            <span className="font-semibold">{item.product.name}</span>
          </p>
        ))}
        {moreCount > 0 && (
          <p className="text-xs text-muted">+{moreCount} món khác</p>
        )}
      </div>

      {/* Footer: type + date / amount + points */}
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-black/5 pt-3.5">
        <div className="space-y-1.5">
          <span className="rounded-full bg-surface-card px-2.5 py-1 text-[11px] font-semibold text-foreground/60">
            {TYPE_LABEL[order.type] ?? order.type}
          </span>
          <p className="text-[11px] text-muted">{formatDateCompact(order.createdAt)}</p>
        </div>

        <div className="text-right">
          <p className="text-base font-bold tabular-nums text-[#1a3c34]">
            {formatVnd(order.finalAmount)}
          </p>
          {order.earnedPoints > 0 && (
            <div className="mt-1 flex items-center justify-end gap-1 text-[11px] font-semibold text-amber-600">
              <Star className="size-3 fill-amber-500 text-amber-500" />
              +{fmtPoints} điểm
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyOrders() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOutSmooth }}
        className="mb-6 flex size-20 items-center justify-center rounded-full bg-surface-card"
      >
        <Package className="size-9 text-foreground/25" />
      </motion.div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        Chưa có đơn nào
      </p>
      <p className="mt-2 text-lg font-bold text-foreground">Hãy đặt món đầu tiên</p>
      <p className="mt-1.5 max-w-[260px] text-sm text-muted">
        Khám phá thực đơn và đặt món — đơn hàng của bạn sẽ hiện ngay tại đây.
      </p>
      <button
        type="button"
        onClick={() => router.push("/")}
        className="mt-6 flex items-center gap-2 rounded-full bg-[#1a3c34] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <ShoppingBag className="size-4" />
        Xem thực đơn
      </button>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="size-11 animate-pulse rounded-2xl bg-surface-card ring-2 ring-white"
              style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }}
            />
          ))}
        </div>
        <div className="h-6 w-24 animate-pulse rounded-full bg-surface-card" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded-lg bg-surface-card" />
        <div className="h-4 w-1/2 animate-pulse rounded-lg bg-surface-card" />
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-black/5 pt-3.5">
        <div className="space-y-1.5">
          <div className="h-5 w-20 animate-pulse rounded-full bg-surface-card" />
          <div className="h-3 w-28 animate-pulse rounded-lg bg-surface-card" />
        </div>
        <div className="h-6 w-24 animate-pulse rounded-lg bg-surface-card" />
      </div>
    </div>
  );
}

export function OrdersPageShell() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyOrdersQuery(page);
  const { data: profile } = useProfileQuery();

  const fmtBalance = profile
    ? Number.isInteger(profile.pointBalance)
      ? profile.pointBalance.toLocaleString("vi-VN")
      : (profile.pointBalance as number).toFixed(1)
    : null;

  return (
    <div className="min-h-screen bg-surface-soft pb-16 pt-6 sm:pt-8">
      <div className="container mx-auto max-w-2xl px-4 sm:px-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={revealTransition}
          className="mb-7"
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-1.5 text-sm text-foreground/50 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Quay lại
          </button>

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                Đơn hàng của bạn
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Lịch sử đơn hàng
              </h1>
            </div>
            {profile && fmtBalance !== null && (
              <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700 ring-1 ring-amber-200">
                <Star className="size-4 fill-amber-500 text-amber-500" />
                {fmtBalance} điểm
              </div>
            )}
          </div>
        </motion.div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyOrders />
        ) : (
          <div className="space-y-4">
            {data.items.map((order, index) => (
              <OrderCard key={order.id} order={order} index={index} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button
              isIconOnly
              variant="outline"
              isDisabled={page <= 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              className="size-9 rounded-full"
              aria-label="Trang trước"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm text-foreground/70">
              Trang {data.page} / {data.totalPages}
            </span>
            <Button
              isIconOnly
              variant="outline"
              isDisabled={page >= data.totalPages}
              onPress={() => setPage((p) => p + 1)}
              className="size-9 rounded-full"
              aria-label="Trang sau"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
