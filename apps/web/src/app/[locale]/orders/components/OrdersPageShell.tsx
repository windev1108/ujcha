"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { getDisplayName } from "@/lib/product-name";
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Package, ShoppingBag, Star, Truck, Utensils, Users } from "lucide-react";
import { Button } from "@heroui/react";
import { useMyOrdersQuery, orderKeys } from "@/services/order/hooks";
import { useOrderStatusSocket } from "@/hooks/useOrderStatusSocket";
import { useProfileQuery } from "@/services/profile/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { revealTransition, easeOutSmooth } from "@/app/[locale]/(landing)/components/RevealSection";
import { ROUTES } from "@/lib/routes";
import type { UserOrder, UserOrderItem, OrderStatus } from "@/services/order/api";

function formatVnd(s: string | number) {
  const n = typeof s === "string" ? parseFloat(s) : s;
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

type TFunction = ReturnType<typeof useTranslations>;

function formatDateCompact(iso: string, t: TFunction, locale: string) {
  const tag = locale === "vi" ? "vi-VN" : "en-US";
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const time = d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return t("today_at", { time });
  if (d.toDateString() === yesterday.toDateString()) return t("yesterday_at", { time });
  return d.toLocaleDateString(tag, { day: "2-digit", month: "2-digit" }) + `, ${time}`;
}

function ProductImageStack({ items, locale }: { items: UserOrderItem[]; locale: string }) {
  const maxShow = 3;
  const shown = items.slice(0, maxShow);
  const rest = items.length - maxShow;

  return (
    <div className="flex items-center">
      {shown.map((item, i) => {
        const imgUrl = item.product.imageUrls[0] ?? null;
        const name = getDisplayName(item.product, locale);
        return (
          <div
            key={item.id}
            className="relative size-11 shrink-0 overflow-hidden rounded-2xl ring-2 ring-white"
            style={{ zIndex: maxShow - i, marginLeft: i === 0 ? 0 : -10 }}
          >
            {imgUrl ? (
              <Image
                src={imgUrl}
                alt={name}
                fill
                className="object-cover"
                sizes="44px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#1a3c34]">
                <span className="select-none text-xs font-bold text-white/30">
                  {name.charAt(0).toUpperCase()}
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

const STATUS_STRIP: Record<OrderStatus, string> = {
  pending: "bg-amber-400",
  confirmed: "bg-blue-500",
  preparing: "bg-purple-500",
  ready: "bg-teal-500",
  delivering: "bg-sky-500",
  completed: "bg-green-500",
  cancelled: "bg-red-400",
  picked_up: "bg-slate-500",
  arrived: "bg-indigo-500",
};

const STATUS_ACTIVE: OrderStatus[] = ["pending", "confirmed", "preparing", "ready", "delivering"];

function OrderCard({ order, index = 0 }: { order: UserOrder; index?: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const STATUS_CONFIG: Record<OrderStatus, { label: string; badge: string }> = {
    pending: { label: t("status_pending"), badge: "bg-amber-50 text-amber-700 ring-amber-200" },
    confirmed: { label: t("status_confirmed"), badge: "bg-blue-50 text-blue-700 ring-blue-200" },
    preparing: { label: t("status_preparing"), badge: "bg-purple-50 text-purple-700 ring-purple-200" },
    ready: { label: t("status_ready"), badge: "bg-teal-50 text-teal-700 ring-teal-200" },
    delivering: { label: t("status_delivering"), badge: "bg-sky-50 text-sky-700 ring-sky-200" },
    completed: { label: t("status_completed"), badge: "bg-green-50 text-green-700 ring-green-200" },
    cancelled: { label: t("status_cancelled"), badge: "bg-red-50 text-red-600 ring-red-200" },
    picked_up: {
      label: t("picked_up"),
      badge: "bg-orange-50 text-orange-600 ring-orange-200"
    },
    arrived: {
      label: t("arrived"),
      badge: "bg-cyan-50 text-cyan-600 ring-cyan-200"
    }
  };

  const TYPE_META: Record<string, { label: string; Icon: React.ElementType }> = {
    delivery: { label: t("type_delivery"), Icon: Truck },
    pickup: { label: t("type_pickup"), Icon: ShoppingBag },
    table: { label: t("type_table"), Icon: Utensils },
  };

  const statusCfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const isActive = STATUS_ACTIVE.includes(order.status);
  const displayItems = order.items.slice(0, 2);
  const moreCount = order.items.length - 2;
  const fmtPoints = Number.isInteger(order.earnedPoints)
    ? order.earnedPoints
    : (order.earnedPoints as number).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: easeOutSmooth, delay: index * 0.05 }}
      onClick={() => router.push(ROUTES.ORDER_DETAIL(order.paymentCode))}
      className="group relative cursor-pointer overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-black/10 hover:shadow-[0_12px_36px_-10px_rgba(0,0,0,0.16)]"
    >
      {/* Status color strip */}
      <div className={`h-1 w-full ${STATUS_STRIP[order.status]}`} />

      <div className="p-4 sm:p-5">
        {/* Row 1: Image stack + Status badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ProductImageStack items={order.items} locale={locale} />
            {order.isGroupOrder && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#1a3c34]/8 px-2 py-0.5 text-[10px] font-semibold text-[#1a3c34]">
                <Users className="size-3" />
                {t("group_order_badge")}
              </span>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusCfg.badge} ${isActive ? "animate-pulse" : ""}`}>
            {statusCfg.label}
          </span>
        </div>

        {/* Row 2: Item names */}
        <div className="mt-3 space-y-1">
          {displayItems.map((item, i) => (
            <p key={i} className="truncate text-sm leading-snug">
              <span className="tabular-nums text-foreground/40 text-xs">{item.quantity}×</span>
              {" "}
              <span className="font-semibold text-foreground">{getDisplayName(item.product, locale)}</span>
            </p>
          ))}
          {moreCount > 0 && (
            <p className="text-[11px] text-muted">
              {t("n_more_items", { count: moreCount })}
            </p>
          )}
        </div>

        {/* Row 3: delivery address preview */}
        {order.type === "delivery" && order.address && (
          <div className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
            <MapPin className="mt-0.5 size-3 shrink-0 text-foreground/35" />
            <p className="truncate text-[11px] text-foreground/55 leading-snug">
              {order.address.fullAddress}
            </p>
          </div>
        )}

        {/* Row 4: Footer */}
        <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-black/5 pt-3">
          {/* Type + date */}
          <div className="flex items-center gap-2 min-w-0">
            {(() => {
              const meta = TYPE_META[order.type];
              const TypeIcon = meta?.Icon ?? ShoppingBag;
              return (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-surface-card px-2 py-0.5 text-[11px] font-semibold text-foreground/55">
                  <TypeIcon className="size-3 shrink-0" />
                  {meta?.label ?? order.type}
                </span>
              );
            })()}
            <p className="truncate text-[11px] text-muted">{formatDateCompact(order.createdAt, t, locale)}</p>
          </div>

          {/* Amount + points */}
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold tabular-nums text-[#1a3c34]">
              {formatVnd(order.finalAmount)}
            </p>
            {order.earnedPoints > 0 && (
              <div className="mt-0.5 flex items-center justify-end gap-1">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span className="text-[11px] font-semibold tabular-nums text-amber-600">
                  +{fmtPoints}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyOrders() {
  const t = useTranslations();
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
        {t("no_orders")}
      </p>
      <p className="mt-2 text-lg font-bold text-foreground">{t("no_orders_headline")}</p>
      <p className="mt-1.5 max-w-[260px] text-sm text-muted">
        {t("no_orders_desc")}
      </p>
      <button
        type="button"
        onClick={() => router.push("/")}
        className="mt-6 flex items-center gap-2 rounded-full bg-[#1a3c34] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <ShoppingBag className="size-4" />
        {t("view_menu")}
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
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyOrdersQuery(page);
  const { data: profile } = useProfileQuery();

  useOrderStatusSocket({
    onStatusChange: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.myOrders(page) });
    },
  });

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
            {t("back")}
          </button>

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                {t("orders_eyebrow")}
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {t("order_history")}
              </h1>
            </div>
            {profile && fmtBalance !== null && (
              <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700 ring-1 ring-amber-200">
                <Star className="size-4 fill-amber-500 text-amber-500" />
                {fmtBalance} {t("points_unit")}
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
              aria-label={t("previous_page")}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm text-foreground/70">
              {t("page_simple_indicator", { page: data.page, total: data.totalPages })}
            </span>
            <Button
              isIconOnly
              variant="outline"
              isDisabled={page >= data.totalPages}
              onPress={() => setPage((p) => p + 1)}
              className="size-9 rounded-full"
              aria-label={t("next_page")}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
