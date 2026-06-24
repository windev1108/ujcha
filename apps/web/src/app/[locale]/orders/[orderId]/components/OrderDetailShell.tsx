"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import Image from "next/image";
import {
  ArrowLeft, BadgeCheck, Ban, Box, CheckCircle2, Circle, Clock,
  CreditCard, ExternalLink, Info, Loader2, MapPin, MessageCircle, Package, Phone, Printer, QrCode, Star, Truck, Users, Utensils,
  Bike,
  UserPlus,
} from "lucide-react";
import { io } from "socket.io-client";
import { ShipperLiveMap } from "./ShipperLiveMap";
import { useRouter } from "@/i18n/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrderDetailQuery, orderKeys } from "@/services/order/hooks";
import { useOrderStatusSocket } from "@/hooks/useOrderStatusSocket";
import { ROUTES } from "@/lib/routes";
import { revealTransition, easeOutSmooth } from "@/app/[locale]/(landing)/components/RevealSection";
import type { OrderDetail, OrderStatus } from "@/services/order/api";
import { BankTransferQR } from "@/app/[locale]/checkout/components/BankTransferQR";
import { printReceipt, type ReceiptOrder } from "@/lib/order-receipt";
import { fetchGroupOrder, type GroupOrderParticipant, type GroupOrderState } from "@/services/group-order/api";
import { useTranslations, useLocale } from "next-intl";
import { getDisplayName } from "@/lib/product-name";
import { usePublicStoreLocationQuery } from "@/services/store/hooks";
import { usePublicPaymentConfigQuery } from "@/services/payment-config/hooks";
import { useAuthStore } from "@/store/auth-store";
import { env } from "@/config/env";

// ── formatters ────────────────────────────────────────────────────────────────

function fmtVnd(s: string | number) {
  const n = typeof s === "string" ? parseFloat(s) : s;
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}


function fmtDate(iso: string, locale: string) {
  const tag = locale === "vi" ? "vi-VN" : "en-US";
  return new Date(iso).toLocaleString(tag, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtStepTime(iso: string, locale: string) {
  const tag = locale === "vi" ? "vi-VN" : "en-US";
  return new Date(iso).toLocaleString(tag, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InfoPopup({ children, size = "md" }: { children: React.ReactNode; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 80);
  }, []);

  const openPopup = useCallback(() => {
    cancelClose();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setStyle({
      position: "fixed",
      bottom: `${window.innerHeight - rect.top + 8}px`,
      left: `${rect.left + rect.width / 2}px`,
      transform: "translateX(-50%)",
      zIndex: 9999,
    });
    setOpen(true);
  }, [cancelClose]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <span className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={openPopup}
        onMouseLeave={scheduleClose}
        onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openPopup(); }}
        className="flex items-center justify-center rounded-full p-0.5 transition-colors hover:bg-black/6"
        aria-label="Chi tiết"
      >
        <Info className={size === "sm" ? "size-3 text-foreground/30" : "size-3.5 text-foreground/35"} />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <span
          style={style}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className="w-52 space-y-1.5 rounded-xl border border-black/8 bg-white p-3 text-[11px] font-normal text-foreground shadow-xl"
        >
          {children}
        </span>,
        document.body,
      )}
    </span>
  );
}

function useCountdown(expiresAt: string | undefined) {
  const [remaining, setRemaining] = useState(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const left = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(left);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

function fmtCountdown(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STEP_TIMESTAMP_KEY: Partial<Record<OrderStatus, keyof OrderDetail>> = {
  pending: "createdAt",
  confirmed: "confirmedAt",
  preparing: "preparingAt",
  ready: "readyAt",
  delivering: "deliveringAt",
  picked_up: "pickedUpAt",
  arrived: "arrivedAt",
  completed: "completedAt",
  cancelled: "cancelledAt",
};

// ── status config ──────────────────────────────────────────────────────────────

const STATUS_STEPS_DELIVERY: OrderStatus[] = [
  "pending", "confirmed", "preparing", "ready", "delivering", "arrived", "completed",
];
const STATUS_STEPS_NO_DELIVERY: OrderStatus[] = [
  "pending", "confirmed", "preparing", "ready", "completed",
];

const STATUS_META: Record<OrderStatus, {
  icon: React.ElementType;
  color: string;
  bg: string;
  ring: string;
}> = {
  pending: { icon: Clock, color: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200" },
  confirmed: { icon: BadgeCheck, color: "text-blue-700", bg: "bg-blue-50", ring: "ring-blue-200" },
  preparing: { icon: Box, color: "text-purple-700", bg: "bg-purple-50", ring: "ring-purple-200" },
  ready: { icon: CheckCircle2, color: "text-teal-700", bg: "bg-teal-50", ring: "ring-teal-200" },
  delivering: { icon: Truck, color: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200" },
  picked_up: { icon: Truck, color: "text-orange-700", bg: "bg-orange-50", ring: "ring-orange-200" },
  arrived: { icon: MapPin, color: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200" },
  completed: { icon: CheckCircle2, color: "text-green-700", bg: "bg-green-50", ring: "ring-green-200" },
  cancelled: { icon: Ban, color: "text-red-600", bg: "bg-red-50", ring: "ring-red-200" },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function getOptions(raw: unknown): Record<string, string> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, string>;
  }
  return {};
}

type OptionDetail = { group: string; label: string; priceDelta?: number; nameTranslation?: Record<string, string> };
function getOptionDetails(raw: unknown): OptionDetail[] {
  if (Array.isArray(raw)) return raw as OptionDetail[];
  return [];
}

type ExtraItem = { name?: string; toppingId?: string; price?: string; nameTranslation?: Record<string, string> };
function getExtras(raw: unknown): ExtraItem[] {
  if (Array.isArray(raw)) return raw as ExtraItem[];
  return [];
}

function toReceiptOrder(order: OrderDetail, locale: string): ReceiptOrder {
  return {
    paymentCode: order.paymentCode,
    createdAt: order.createdAt,
    type: order.type,
    paymentType: order.paymentType,
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount,
    discountAmount: order.discountAmount,
    pointDiscountAmount: order.pointDiscountAmount,
    shippingFee: order.shippingFee,
    finalAmount: order.finalAmount,
    deliveryAddress: order.address?.fullAddress ?? null,
    tableName: order.table?.name ?? null,
    tableArea: order.table?.area ?? null,
    earnedPoints: order.earnedPoints,
    items: order.items.map((item) => ({
      quantity: item.quantity,
      price: item.price,
      productName: getDisplayName(item.product, locale),
      options: Object.fromEntries(
        getOptionDetails(item.optionDetailsJson).map((od) => [
          od.group,
          od.nameTranslation?.[locale] ?? od.label,
        ]),
      ),
      extras: getExtras(item.extrasJson).map((e) => ({
        name: e.nameTranslation?.[locale] ?? e.name ?? "",
        price: e.price ?? 0,
      })),
      note: item.note,
    })),
  };
}

// ── pill badges ───────────────────────────────────────────────────────────────

function OrderItemBadges({ optionDetails = [], extras, locale }: { optionDetails?: OptionDetail[]; extras: ExtraItem[]; locale: string }) {
  if (optionDetails.length === 0 && extras.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {optionDetails.map((od, i) => {
        const label = od.nameTranslation?.[locale] ?? od.label;
        return (
          <span
            key={i}
            className="inline-flex items-center rounded-full bg-surface-secondary px-2.5 py-0.5 text-[11px] font-medium text-foreground/70"
          >
            {label}
          </span>
        );
      })}
      {extras.map((e, i) => {
        const price = e.price ? parseFloat(e.price) : 0;
        const name = e.nameTranslation?.[locale] ?? e.name ?? "Topping";
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full bg-kun-mint/20 px-2.5 py-0.5 text-[11px] font-medium text-kun-products-forest"
          >
            + {name}
            {price > 0 && (
              <span className="text-[10px] text-kun-products-forest/60">+{fmtVnd(price)}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ── skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-surface-secondary" />
      <div className="h-36 animate-pulse rounded-3xl bg-surface-secondary" />
      <div className="h-52 animate-pulse rounded-3xl bg-surface-secondary" />
      <div className="h-40 animate-pulse rounded-3xl bg-surface-secondary" />
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function OrderDetailShell({ paymentCode }: { paymentCode: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations();
  const locale = useLocale();

  const STATUS_LABEL: Record<OrderStatus, string> = {
    pending: t("status_pending"),
    confirmed: t("status_confirmed"),
    preparing: t("status_preparing"),
    ready: t("status_ready"),
    delivering: t("status_delivering"),
    picked_up: t("picked_up"),
    arrived: t("arrived"),
    completed: t("status_completed"),
    cancelled: t("status_cancelled"),
  };

  const STATUS_DESC: Record<OrderStatus, string> = {
    pending: t("status_pending_desc"),
    confirmed: t("status_confirmed_desc"),
    preparing: t("status_preparing_desc"),
    ready: t("status_ready_desc"),
    delivering: t("status_delivering_desc"),
    picked_up: t("status_picked_up_desc"),
    arrived: t("status_arrived_desc"),
    completed: t("status_completed_desc"),
    cancelled: t("status_cancelled_desc"),
  };

  const { data: order, isLoading, isError } = useOrderDetailQuery(paymentCode);

  const isTerminal = order?.status === "completed" || order?.status === "cancelled";
  const isShipperActive = ["picked_up", "arrived", "delivering"].includes(order?.status ?? "");

  useOrderStatusSocket({
    onStatusChange: ({ orderId, status }) => {
      if (orderId === order?.id) {
        queryClient.invalidateQueries({ queryKey: orderKeys.detail(paymentCode) });
        if (status === 'completed') {
          queryClient.invalidateQueries({ queryKey: ['profile'] });
        }
      }
    },
    enabled: !isTerminal,
  });

  const handlePaid = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: orderKeys.detail(paymentCode) });
  }, [queryClient, paymentCode]);

  const handleExpired = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: orderKeys.detail(paymentCode) });
  }, [queryClient, paymentCode]);

  const PENDING_CALL_DELAY_MS = 3 * 60 * 1000;
  const [pendingTooLong, setPendingTooLong] = useState(() => {
    if (!order || order.status !== "pending") return false;
    return Date.now() - new Date(order.createdAt).getTime() > PENDING_CALL_DELAY_MS;
  });

  useEffect(() => {
    if (!order || order.status !== "pending" || pendingTooLong) return;
    const elapsed = Date.now() - new Date(order.createdAt).getTime();
    const remaining = PENDING_CALL_DELAY_MS - elapsed;
    if (remaining <= 0) { setPendingTooLong(true); return; }
    const timer = setTimeout(() => setPendingTooLong(true), remaining);
    return () => clearTimeout(timer);
  }, [order?.status, order?.createdAt, pendingTooLong]);

  const isGroupOrder = !!order?.isGroupOrder;
  const groupToken = order?.groupOrderToken ?? null;

  const { data: groupOrder } = useQuery<GroupOrderState>({
    queryKey: ["group-order", groupToken],
    queryFn: () => fetchGroupOrder(groupToken!),
    enabled: !!groupToken,
    staleTime: 60_000,
  });

  const { data: payConfig } = usePublicPaymentConfigQuery();
  const { data: storeLocation } = usePublicStoreLocationQuery();
  const accessToken = useAuthStore((s) => s.accessToken);
  const authUser = useAuthStore((s) => s.user);

  // Subscribe to group socket for realtime participant payment updates when
  // this is a group bank-transfer order awaiting payment
  const groupSocketRef = useRef<ReturnType<typeof io> | null>(null);
  useEffect(() => {
    if (!groupToken || !order || order.paymentType !== "bank_transfer" || order.paymentStatus !== "pending") return;

    const socket = io(`${env.API_URL}/group`, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    groupSocketRef.current = socket;
    socket.emit("join-room", { token: groupToken });
    socket.on("updated", (newState: GroupOrderState) => {
      queryClient.setQueryData(["group-order", groupToken], newState);
      if (newState.status === "completed") {
        queryClient.invalidateQueries({ queryKey: orderKeys.detail(paymentCode) });
      }
    });
    return () => {
      socket.disconnect();
      groupSocketRef.current = null;
    };
  }, [groupToken, order?.paymentType, order?.paymentStatus, queryClient, paymentCode]);

  // Detect if the current viewer is the group host — must be before early returns (Rules of Hooks)
  const isCurrentUserHost = useMemo(() => {
    if (!groupOrder || groupOrder.paymentMode !== "host_pays") return false;
    const host = groupOrder.participants.find((p) => p.isHost);
    if (!host) return false;
    if (authUser?.id && host.userId === authUser.id) return true;
    const storedId = typeof window !== "undefined"
      ? localStorage.getItem(`group_order_participant_${groupToken}`)
      : null;
    return storedId === host.id;
  }, [groupOrder, groupToken, authUser?.id]);

  // Identify the current viewer's participant — must be before early returns (Rules of Hooks)
  const myGroupParticipant: GroupOrderParticipant | null = useMemo(() => {
    if (
      !groupOrder || !order || !isGroupOrder ||
      order.paymentType !== "bank_transfer" ||
      order.paymentStatus !== "pending" ||
      order.status === "cancelled"
    ) return null;
    if (groupOrder.paymentMode === "host_pays") {
      return groupOrder.participants.find((p) => p.isHost) ?? null;
    }
    const storedId = typeof window !== "undefined"
      ? localStorage.getItem(`group_order_participant_${groupToken}`)
      : null;
    if (storedId) {
      const byId = groupOrder.participants.find((p) => p.id === storedId);
      if (byId) return byId;
    }
    if (authUser?.id) {
      return groupOrder.participants.find((p) => p.userId === authUser.id) ?? null;
    }
    return null;
  }, [groupOrder, order, isGroupOrder, groupToken, authUser?.id]);

  // Countdown: group bank_transfer expires same as regular orders (order.createdAt + expiry window).
  // order is not yet available here, so we pass the ISO string after computing it lazily.
  // The hook handles undefined by returning 0 immediately — value is replaced once order loads.
  const groupQrExpiresAt = order
    ? new Date(new Date(order.createdAt).getTime() + 15 * 60_000).toISOString()
    : undefined;
  const groupQrRemaining = useCountdown(groupQrExpiresAt);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-soft pb-16 pt-6 sm:pt-8">
        <div className="container mx-auto max-w-2xl px-4 sm:px-6">
          <Skeleton />
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-surface-soft px-4 text-center">
        <Package className="size-12 text-foreground/25" />
        <p className="font-semibold text-foreground">{t("order_not_found")}</p>
        <button
          type="button"
          onClick={() => router.push(ROUTES.ORDERS)}
          className="text-sm text-kun-products-forest hover:underline"
        >
          {t("back_to_order_history")}
        </button>
      </div>
    );
  }

  const statusMeta = STATUS_META[order.status];
  const StatusIcon = statusMeta.icon;
  const isCancelled = order.status === "cancelled";
  const STATUS_STEPS =
    order.type === "delivery" ? STATUS_STEPS_DELIVERY : STATUS_STEPS_NO_DELIVERY;
  const activeStepIdx = isCancelled ? -1 : STATUS_STEPS.indexOf(order.status);
  const isPendingBankTransfer =
    order.paymentType === "bank_transfer" &&
    order.paymentStatus === "pending" &&
    !isCancelled;

  const isGroupBankTransfer = isGroupOrder && isPendingBankTransfer;

  // Per-participant split amounts: subtract proportional discount, add equal shipping share
  const orderTotalItems = parseFloat(order.totalAmount);
  const orderDiscountAmt = parseFloat(order.discountAmount ?? '0');
  const orderShipping = parseFloat(order.shippingFee ?? '0');
  const splitParticipants = groupOrder?.participants.filter((p) => p.items.length > 0) ?? [];
  const splitN = splitParticipants.length;
  const discountFraction = orderTotalItems > 0 ? orderDiscountAmt / orderTotalItems : 0;
  const perParticipantShipping = splitN > 0 ? Math.round(orderShipping / splitN) : 0;
  const splitShippingFeeMode = groupOrder?.shippingFeeMode ?? 'split';
  function calcSplitAmount(subtotal: number, isParticipantHost = false) {
    const discountShare = Math.round(subtotal * discountFraction);
    const shippingShare = splitShippingFeeMode === 'host_pays'
      ? (isParticipantHost ? Math.round(orderShipping) : 0)
      : perParticipantShipping;
    return {
      total: Math.round(subtotal - discountShare + shippingShare),
      discountShare,
      shippingShare,
    };
  }

  const canExportInvoice =
    order.status === "completed" ||
    (order.paymentType === "bank_transfer" && order.paymentStatus === "paid");

  function handlePrint() {
    printReceipt(toReceiptOrder(order!, locale), locale);
  }

  return (
    <div className="min-h-screen bg-surface-soft pb-20 pt-6 sm:pt-8">
      <div className="container mx-auto max-w-2xl px-4 sm:px-6">

        {/* Back + Print */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={revealTransition}
          className="mb-5 flex items-center justify-between gap-3"
        >
          <button
            type="button"
            onClick={() => router.push(accessToken ? ROUTES.ORDERS : ROUTES.HOME)}
            className="flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            {accessToken ? t("order_history") : t("home")}
          </button>
          {canExportInvoice && (
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-foreground/65 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.08)] transition hover:bg-surface-soft hover:text-foreground"
            >
              <Printer className="size-3.5" />
              {t("print_invoice")}
            </button>
          )}
        </motion.div>

        {/* Guest account creation prompt */}
        {!accessToken && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...revealTransition, delay: 0.06 }}
            className="mb-4 overflow-hidden rounded-3xl border border-[#1a3c34]/15 bg-[#f0faf6] px-5 py-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1a3c34]/10">
                <UserPlus className="size-4 text-[#1a3c34]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1a3c34]">{t("guest_order_save_title")}</p>
                <p className="mt-0.5 text-xs text-[#1a3c34]/70">{t("guest_order_save_desc")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(ROUTES.REGISTER)}
                    className="rounded-full bg-[#1a3c34] px-4 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                  >
                    {t("guest_orders_register_cta")}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(ROUTES.LOGIN)}
                    className="rounded-full border border-[#1a3c34]/20 bg-white px-4 py-1.5 text-xs font-semibold text-[#1a3c34] transition hover:bg-[#1a3c34]/5"
                  >
                    {t("guest_orders_login_btn")}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="space-y-4">

          {/* ── Hero card ─────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...revealTransition, delay: 0.04 }}
            className="overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)]"
          >
            <div className={`h-1.5 w-full ${statusMeta.bg}`} />

            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                    {isGroupOrder ? t("group_order_badge") : t("order")}
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-foreground">
                    #{order.paymentCode}
                  </p>
                  <p className="mt-1 text-xs text-foreground/50">{fmtDate(order.createdAt, locale)}</p>
                </div>
                <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${statusMeta.bg} ${statusMeta.color} ${statusMeta.ring}`}>
                  <StatusIcon className="size-3.5" />
                  {STATUS_LABEL[order.status]}
                </div>
              </div>

              {/* Tags row */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-surface-secondary px-3 py-1 text-xs font-medium text-foreground/70">
                  {t(`type_${order.type}` as "type_delivery" | "type_pickup" | "type_table")}
                </span>
                <span className="rounded-full bg-surface-secondary px-3 py-1 text-xs font-medium text-foreground/70">
                  {t(order.paymentType as "cash" | "bank_transfer")}
                </span>
                {isGroupOrder && groupOrder?.paymentMode === "host_pays" && (
                  <span className="flex items-center gap-1 rounded-full bg-[#1a3c34]/8 px-3 py-1 text-xs font-semibold text-[#1a3c34]">
                    <CreditCard className="size-3" />
                    {t("group_badge_host_pays")}
                  </span>
                )}
                {isGroupOrder && groupOrder?.paymentMode === "split" && (
                  <span className="flex items-center gap-1 rounded-full bg-[#1a3c34]/8 px-3 py-1 text-xs font-semibold text-[#1a3c34]">
                    <Users className="size-3" />
                    {t("group_badge_split")}
                  </span>
                )}
                {isGroupOrder && !groupOrder && (
                  <span className="flex items-center gap-1 rounded-full bg-[#1a3c34]/8 px-3 py-1 text-xs font-semibold text-[#1a3c34]">
                    <Users className="size-3" />
                    {t("group_order_badge")}
                  </span>
                )}
                {order.shipper && (
                  <span className="flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                    <Bike className="size-3" />
                    {order.shipper.name}
                  </span>
                )}
              </div>

              {/* Earned points banner */}
              {order.earnedPoints > 0 && (
                accessToken ? (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                      <Star className="size-4 fill-amber-500 text-amber-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-amber-800">{t("earned_points_from_order")}</p>
                      <p className="text-[11px] text-amber-600/80">
                        {order.status === "completed"
                          ? t("points_already_added")
                          : t("points_will_be_added")}
                      </p>
                    </div>
                    <span className="shrink-0 text-lg font-bold tabular-nums text-amber-700">
                      +{order.earnedPoints}
                    </span>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl bg-green-50 px-4 py-3 ring-1 ring-green-200">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle2 className="size-4 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-green-800">{t("points_claimed_guest_title")}</p>
                      <p className="text-[11px] text-green-600/80">{t("points_claimed_guest_sub")}</p>
                    </div>
                  </div>
                )
              )}

              {/* Claim points CTA — guest only, completed+paid, no points yet, not a group order */}
              {order.earnedPoints === 0 &&
                !accessToken &&
                order.status === "completed" &&
                order.paymentStatus === "paid" &&
                !isGroupOrder && (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-[#f0faf6] px-4 py-3 ring-1 ring-[#1a3c34]/15">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1a3c34]/10">
                        <Star className="size-4 text-[#1a3c34]" />
                      </div>
                      <p className="text-xs font-semibold text-[#1a3c34]">{t("claim_points_hint")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(ROUTES.LOYALTY(order.paymentCode))}
                      className="shrink-0 rounded-full bg-[#1a3c34] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                    >
                      {t("claim_points_cta")}
                    </button>
                  </div>
                )}
            </div>
          </motion.div>

          {/* ── Status timeline ──────────────────────────────────── */}
          {!isCancelled && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...revealTransition, delay: 0.08 }}
              className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)] sm:p-6"
            >
              <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                {t("order_progress")}
              </p>

              <div className="flex flex-col sm:flex-row sm:items-start">
                {STATUS_STEPS.map((step, i) => {
                  const done = i <= activeStepIdx;
                  const active = i === activeStepIdx;
                  const StepIcon = STATUS_META[step].icon;
                  const isLast = i === STATUS_STEPS.length - 1;

                  return (
                    <Fragment key={step}>
                      <div className="flex gap-4 sm:flex-1 sm:flex-col sm:items-center sm:gap-1.5">
                        <div className="flex shrink-0 flex-col items-center">
                          <motion.div
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.06 + i * 0.05, duration: 0.3, ease: easeOutSmooth }}
                            className={`flex size-10 items-center justify-center rounded-full transition-all ${active
                              ? "bg-kun-products-forest text-white shadow-[0_0_0_4px_rgba(38,99,77,0.15)]"
                              : done
                                ? "bg-kun-mint/40 text-kun-products-forest"
                                : "bg-surface-secondary text-foreground/30"
                              }`}
                          >
                            {done ? (
                              active ? <StepIcon className="size-[18px]" /> : <CheckCircle2 className="size-[18px]" />
                            ) : (
                              <Circle className="size-4 opacity-40" />
                            )}
                          </motion.div>
                          {!isLast && (
                            <div className={`mt-1 w-0.5 flex-1 min-h-[28px] rounded-full sm:hidden ${i < activeStepIdx ? "bg-kun-mint/50" : "bg-surface-secondary"
                              }`} />
                          )}
                        </div>

                        <div className={`pt-1.5 sm:pt-0 sm:text-center ${isLast ? "" : "pb-6 sm:pb-0"}`}>
                          <p className={`text-sm font-semibold leading-tight sm:text-[11px] transition-colors ${active ? "text-kun-products-forest"
                            : done ? "text-foreground"
                              : "text-foreground/35"
                            }`}>
                            {STATUS_LABEL[step]}
                          </p>
                          {active && (
                            <p className="mt-0.5 text-xs text-foreground/55 sm:hidden">
                              {STATUS_DESC[step]}
                            </p>
                          )}
                          {done && (() => {
                            const tsKey = STEP_TIMESTAMP_KEY[step];
                            const ts = tsKey ? (order as unknown as Record<string, unknown>)[tsKey] as string | null : null;
                            if (!ts) return null;
                            return (
                              <p className="mt-0.5 text-[10px] tabular-nums text-foreground/40 sm:text-[9px]">
                                {fmtStepTime(ts, locale)}
                              </p>
                            );
                          })()}
                        </div>
                      </div>

                      {!isLast && (
                        <div className={`hidden sm:block h-0.5 min-w-3 flex-1 self-start mt-5 rounded-full ${i < activeStepIdx ? "bg-kun-mint/50" : "bg-surface-secondary"
                          }`} />
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Cancelled banner ─────────────────────────────────── */}
          {isCancelled && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...revealTransition, delay: 0.08 }}
              className="flex items-center gap-3 rounded-3xl border border-red-100 bg-red-50 px-5 py-4"
            >
              <Ban className="size-5 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-semibold text-red-700">{t("order_cancelled_title")}</p>
                <p className="mt-0.5 text-xs text-red-500/80">{t("order_cancelled_desc")}</p>
              </div>
            </motion.div>
          )}

          {/* ── Pending call-to-confirm hint ─────────────────────── */}
          {pendingTooLong && storeLocation?.phone && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...revealTransition, delay: 0.1 }}
              className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <Phone className="size-4 text-amber-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-800">{t("pending_too_long_title")}</p>
                <p className="mt-0.5 text-xs text-amber-700/80">{t("pending_too_long_desc")}</p>
                <a
                  href={`tel:${storeLocation.phone}`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <Phone className="size-3" />
                  {t("pending_too_long_call")} — {storeLocation.phone}
                </a>
              </div>
            </motion.div>
          )}

          {/* ── Shipper info ──────────────────────────────────────── */}
          {order.type === "delivery" && order.shipper && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...revealTransition, delay: 0.10 }}
              className="overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)]"
            >
              {/* Active delivery — gradient header */}
              {isShipperActive ? (
                <div className="bg-gradient-to-r from-[#1a3c34] to-[#26634d] px-5 py-4 sm:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Truck avatar */}
                      <div className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                        <Bike className="size-5 text-white" />
                        <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-sky-400 ring-2 ring-[#1a3c34]">
                          <span className="size-2 animate-ping rounded-full bg-white opacity-75" />
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                          {t("shipper_delivering")}
                        </p>
                        <p className="mt-0.5 font-semibold text-white">{order.shipper.name}</p>
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20">
                      <span className="size-1.5 animate-pulse rounded-full bg-sky-300" />
                      {STATUS_LABEL[order.status]}
                    </span>
                  </div>
                  {order.shipper.phone && (
                    <a
                      href={`tel:${order.shipper.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 ring-1 ring-white/15 transition-colors hover:bg-white/20"
                    >
                      <Phone className="size-3" />
                      {order.shipper.phone}
                    </a>
                  )}
                </div>
              ) : (
                /* Completed / other state — light header */
                <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
                  <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${order.status === "completed"
                    ? "bg-green-50 ring-1 ring-green-200"
                    : "bg-surface-soft ring-1 ring-black/8"
                    }`}>
                    <Bike className={`size-5 ${order.status === "completed" ? "text-green-600" : "text-foreground/40"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                      {t("shipper_delivering")}
                    </p>
                    <p className="mt-0.5 font-semibold text-foreground">{order.shipper.name}</p>
                    {order.shipper.phone ? (
                      <a
                        href={`tel:${order.shipper.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 inline-flex items-center gap-1 text-sm text-foreground/55 transition-colors hover:text-kun-products-forest"
                      >
                        <Phone className="size-3.5" />
                        {order.shipper.phone}
                      </a>
                    ) : (
                      <p className="mt-0.5 text-xs text-foreground/35">{t("no_phone_number")}</p>
                    )}
                  </div>
                  {order.status === "completed" && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 ring-1 ring-green-200">
                      <CheckCircle2 className="size-3.5" />
                      {t("delivered")}
                    </span>
                  )}
                </div>
              )}

              {/* Live map */}
              {isShipperActive && (
                <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                  <ShipperLiveMap
                    orderId={order.id}
                    destLat={order.address?.lat}
                    destLng={order.address?.lng}
                    orderStatus={order.status}
                  />
                </div>
              )}
            </motion.div>
          )}

          {/* ── Bank transfer QR (pending payment) ───────────────── */}
          {isPendingBankTransfer && !isGroupBankTransfer && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...revealTransition, delay: 0.16 }}
              className="space-y-4"
            >
              <BankTransferQR
                orderId={order.id}
                paymentCode={order.paymentCode}
                total={
                  parseFloat(order.totalAmount)
                  - parseFloat(order.discountAmount)
                  - parseFloat(order.pointDiscountAmount ?? '0')
                  + (order.type === 'delivery' ? parseFloat(order.shippingFee ?? '0') : 0)
                }
                createdAt={new Date(order.createdAt)}
                onPaid={handlePaid}
                onExpired={handleExpired}
              />
              {storeLocation?.phone && (
                <div className="flex items-start gap-3 rounded-3xl border border-[#1a3c34]/12 bg-[#f0faf6] px-5 py-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1a3c34]/10">
                    <MessageCircle className="size-4 text-[#1a3c34]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1a3c34]">{t("zalo_complaint_title")}</p>
                    <p className="mt-0.5 text-xs text-[#1a3c34]/70">{t("zalo_complaint_desc")}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <a
                        href={`https://zalo.me/${storeLocation.phone.replace(/^0/, "84")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#1a3c34] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                      >
                        <MessageCircle className="size-3" />
                        {t("zalo_contact_cta")}
                      </a>
                      <span className="font-mono text-xs text-foreground/50">#{order.paymentCode}</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Group bank transfer — per-participant QR ─────────── */}
          {isGroupBankTransfer && groupOrder && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...revealTransition, delay: 0.16 }}
              className="overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)]"
            >
              <div className="flex items-center gap-3 border-b border-black/6 px-5 py-4 sm:px-6">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1a3c34]/8">
                  <QrCode className="size-4 text-[#1a3c34]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                    {t("group_transfer_payment")}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {groupOrder.paymentMode === "host_pays"
                      ? t("group_host_pays_qr_title")
                      : t("group_split_transfer_title")}
                  </p>
                </div>
                {groupQrRemaining > 0 ? (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-600 ring-1 ring-amber-200">
                    <Clock className="size-3.5" />
                    {fmtCountdown(groupQrRemaining)}
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200">
                    <Clock className="size-3.5" />
                    {t("group_qr_expired")}
                  </span>
                )}
              </div>

              <div className="p-5 sm:p-6">
                {/* Member view when host is paying — no QR for them */}
                {groupOrder.paymentMode === "host_pays" && !isCurrentUserHost && (() => {
                  const host = groupOrder.participants.find((p) => p.isHost);
                  return (
                    <div className="flex flex-col items-center gap-4 py-4 text-center">
                      {host?.avatar ? (
                        <div className="relative size-14 overflow-hidden rounded-full ring-2 ring-[#1a3c34]/15">
                          <Image src={host.avatar} alt={host.name} fill className="object-cover" sizes="56px" />
                        </div>
                      ) : (
                        <div className="flex size-14 items-center justify-center rounded-full bg-[#1a3c34]/10 text-lg font-bold text-[#1a3c34]">
                          {host?.name?.[0] ?? "?"}
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          {t("group_host_paying_title", { name: host?.name ?? "" })}
                        </p>
                        <p className="text-xs text-foreground/50">{t("group_host_paying_desc")}</p>
                      </div>
                      <span className="flex items-center gap-2 rounded-full bg-[#1a3c34]/6 px-4 py-2 text-xs font-semibold text-[#1a3c34]">
                        <Loader2 className="size-3.5 animate-spin" />
                        {t("group_waiting_host_payment")}
                      </span>
                    </div>
                  );
                })()}

                {/* My QR code — shown only to the payer (host in host_pays, self in split) */}
                {myGroupParticipant?.paymentQrToken && (groupOrder.paymentMode === "split" || isCurrentUserHost) && (
                  <div className="mb-5 flex flex-col items-center gap-3">
                    {payConfig?.bankCode && payConfig?.accountNumber ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://qr.sepay.vn/img?${new URLSearchParams({
                          bank: payConfig.bankCode,
                          acc: payConfig.accountNumber,
                          template: "",
                          amount: String(
                            groupOrder.paymentMode === "host_pays"
                              ? Math.round(parseFloat(order.finalAmount))
                              : calcSplitAmount(myGroupParticipant.subtotal, myGroupParticipant.isHost).total,
                          ),
                          des: myGroupParticipant.paymentQrToken.replace(/-/g, "").slice(0, 12).toUpperCase(),
                        }).toString()}`}
                        alt="QR chuyển khoản"
                        className="h-48 w-48 rounded-2xl ring-1 ring-black/8"
                      />
                    ) : (
                      <div className="flex h-48 w-48 items-center justify-center rounded-2xl bg-surface-card ring-1 ring-black/8">
                        <QrCode className="size-12 text-foreground/25" />
                      </div>
                    )}
                    {payConfig && (
                      <div className="w-full space-y-1.5 rounded-2xl bg-[#f0faf6] px-4 py-3 text-xs">
                        {payConfig.bankCode && (
                          <div className="flex justify-between">
                            <span className="text-foreground/50">{t("group_bank")}</span>
                            <span className="font-semibold">{payConfig.bankCode}</span>
                          </div>
                        )}
                        {payConfig.accountNumber && (
                          <div className="flex justify-between">
                            <span className="text-foreground/50">{t("group_account_no")}</span>
                            <span className="font-mono font-semibold">{payConfig.accountNumber}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-foreground/50">{t("group_amount")}</span>
                          <span className="flex items-center gap-1 font-bold text-[#1a3c34]">
                            {groupOrder.paymentMode === "host_pays"
                              ? fmtVnd(parseFloat(order.finalAmount))
                              : (() => {
                                const { total, discountShare, shippingShare } = calcSplitAmount(myGroupParticipant.subtotal, myGroupParticipant.isHost);
                                return (
                                  <>
                                    {fmtVnd(total)}
                                    {(discountShare > 0 || shippingShare > 0) && (
                                      <InfoPopup>
                                        <span className="flex justify-between">
                                          <span className="text-foreground/60">{t("group_split_items")}</span>
                                          <span>{fmtVnd(myGroupParticipant.subtotal)}</span>
                                        </span>
                                        {discountShare > 0 && (
                                          <span className="flex justify-between">
                                            <span className="text-foreground/60">{t("group_split_discount")}</span>
                                            <span className="text-emerald-600">-{fmtVnd(discountShare)}</span>
                                          </span>
                                        )}
                                        {shippingShare > 0 && (
                                          <span className="flex justify-between">
                                            <span className="text-foreground/60">{t(splitShippingFeeMode === 'host_pays' ? "group_split_shipping_all" : "group_split_shipping")}</span>
                                            <span>+{fmtVnd(shippingShare)}</span>
                                          </span>
                                        )}
                                      </InfoPopup>
                                    )}
                                  </>
                                );
                              })()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-foreground/50">{t("group_transfer_note")}</span>
                          <span className="font-mono font-semibold">
                            {myGroupParticipant.paymentQrToken.replace(/-/g, "").slice(0, 12).toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Auto-cancel warning */}
                {groupQrRemaining > 0 && (
                  <p className="mt-3 text-center text-xs text-amber-600/80">
                    {t("bt_qr_auto_cancel_note")}
                  </p>
                )}

                {myGroupParticipant?.paymentQrToken && storeLocation?.phone && (
                  <div className="my-4 flex items-start gap-3 rounded-2xl border border-[#1a3c34]/12 bg-[#f0faf6] px-4 py-4">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1a3c34]/10">
                      <MessageCircle className="size-4 text-[#1a3c34]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#1a3c34]">{t("zalo_complaint_title")}</p>
                      <p className="mt-0.5 text-xs text-[#1a3c34]/70">{t("zalo_complaint_desc")}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-3">
                        <a
                          href={`https://zalo.me/${storeLocation.phone.replace(/^0/, "84")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#1a3c34] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                        >
                          <MessageCircle className="size-3" />
                          {t("zalo_contact_cta")}
                        </a>
                        <span className="font-mono text-xs text-foreground/50">#{order.paymentCode}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Split mode: all participants payment status */}
                {groupOrder.paymentMode === "split" && (() => {
                  const activeParts = groupOrder.participants.filter((p) => p.items.length > 0);
                  const paidCount = activeParts.filter((p) => p.paymentStatus === "paid").length;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                          {t("group_payment_status_members")}
                        </p>
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${paidCount === activeParts.length
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-[#1a3c34]/8 text-[#1a3c34]"
                          }`}>
                          {paidCount === activeParts.length && <CheckCircle2 className="size-3" />}
                          {paidCount}/{activeParts.length}
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {groupOrder.participants
                          .filter((p) => p.items.length > 0)
                          .map((p) => (
                            <li key={p.id} className="flex items-center gap-2.5">
                              {p.avatar ? (
                                <div className="relative size-7 shrink-0 overflow-hidden rounded-full ring-1 ring-black/8">
                                  <Image src={p.avatar} alt={p.name} fill className="object-cover" sizes="28px" />
                                </div>
                              ) : (
                                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1a3c34]/10 text-[11px] font-bold text-[#1a3c34]">
                                  {p.name[0]}
                                </div>
                              )}
                              <span className="flex-1 text-sm text-foreground">{p.name}</span>
                              <span className="flex items-center gap-1 text-sm font-medium tabular-nums text-foreground/60">
                                {(() => {
                                  const { total, discountShare, shippingShare } = calcSplitAmount(p.subtotal, p.isHost);
                                  return (
                                    <>
                                      {fmtVnd(total)}
                                      {(discountShare > 0 || shippingShare > 0) && (
                                        <InfoPopup size="sm">
                                          <span className="flex justify-between">
                                            <span className="text-foreground/60">{t("group_split_items")}</span>
                                            <span>{fmtVnd(p.subtotal)}</span>
                                          </span>
                                          {discountShare > 0 && (
                                            <span className="flex justify-between">
                                              <span className="text-foreground/60">{t("group_split_discount")}</span>
                                              <span className="text-emerald-600">-{fmtVnd(discountShare)}</span>
                                            </span>
                                          )}
                                          {shippingShare > 0 && (
                                            <span className="flex justify-between">
                                              <span className="text-foreground/60">{t(splitShippingFeeMode === 'host_pays' ? "group_split_shipping_all" : "group_split_shipping")}</span>
                                              <span>+{fmtVnd(shippingShare)}</span>
                                            </span>
                                          )}
                                        </InfoPopup>
                                      )}
                                    </>
                                  );
                                })()}
                              </span>
                              {p.paymentStatus === "paid" ? (
                                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                              ) : (
                                <span className="flex items-center gap-1 shrink-0">
                                  <span className="text-[10px] font-medium text-foreground/40">{t("group_unpaid_label")}</span>
                                  <Loader2 className="size-3.5 animate-spin text-[#1a3c34]/40" />
                                </span>
                              )}
                            </li>
                          ))}
                      </ul>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}

          {/* ── Items ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...revealTransition, delay: 0.14 }}
            className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)] sm:p-6"
          >
            {isGroupOrder && groupOrder ? (() => {
              const participantsWithItems = groupOrder.participants.filter((p) => p.items.length > 0);
              const totalItemCount = participantsWithItems.reduce((sum, p) => sum + p.items.length, 0);
              return (
                <>
                  <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                    {t("items_count", { count: totalItemCount })}
                  </p>
                  <div>
                    {participantsWithItems.map((participant, pIdx) => (
                      <div key={participant.id} className={pIdx > 0 ? "mt-6 border-t border-black/6 pt-6" : ""}>
                        <div className="mb-3 flex items-center gap-2">
                          {participant.avatar ? (
                            <div className="relative size-7 shrink-0 overflow-hidden rounded-full ring-1 ring-black/8">
                              <Image src={participant.avatar} alt={participant.name} fill className="object-cover" sizes="28px" />
                            </div>
                          ) : (
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1a3c34]/10 text-[11px] font-bold text-[#1a3c34]">
                              {participant.name[0]}
                            </div>
                          )}
                          <span className="text-sm font-semibold text-foreground">{participant.name}</span>
                          {participant.isHost && (
                            <span className="rounded-full bg-[#1a3c34]/8 px-2 py-0.5 text-[10px] font-semibold text-[#1a3c34]">
                              {t("group_host")}
                            </span>
                          )}
                        </div>

                        <ul className="space-y-3">
                          {participant.items.map((item, iIdx) => {
                            const imageUrl = item.product.imageUrls[0] ?? null;
                            const productName = getDisplayName(item.product, locale);
                            const optionDetails: OptionDetail[] = Object.entries(item.selectedOptions ?? {}).map(([group, label]) => ({ group, label }));
                            const extras: ExtraItem[] = (item.toppings ?? []).map((top) => ({
                              name: top.name,
                              toppingId: top.toppingId,
                              price: String(top.price),
                              nameTranslation: top.nameTranslation,
                            }));
                            const toppingTotal = item.toppings?.reduce((s, top) => s + top.price, 0) ?? 0;
                            const lineTotal = (item.unitPrice + toppingTotal) * item.quantity;

                            return (
                              <motion.li
                                key={item.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, ease: easeOutSmooth, delay: 0.05 * (pIdx * 3 + iIdx) }}
                                className="flex gap-3 border-b border-black/6 pb-3 last:border-b-0 last:pb-0"
                              >
                                <div className="relative size-14 shrink-0 sm:size-16">
                                  <div
                                    className="absolute inset-0 overflow-hidden rounded-xl ring-1 ring-black/6"
                                    style={{ backgroundColor: imageUrl ? undefined : "#1a3c34" }}
                                  >
                                    {imageUrl ? (
                                      <Image src={imageUrl} alt={productName} fill className="object-cover" sizes="64px" />
                                    ) : (
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="select-none text-xl font-black text-white/20">
                                          {productName.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <span className="absolute -bottom-1.5 -right-1.5 flex size-[18px] items-center justify-center rounded-full bg-kun-primary text-[9px] font-bold text-white ring-2 ring-white">
                                    {item.quantity}
                                  </span>
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="font-semibold leading-snug text-foreground">{productName}</p>
                                    <p className="shrink-0 text-sm font-bold tabular-nums text-kun-primary">
                                      {fmtVnd(lineTotal)}
                                    </p>
                                  </div>
                                  <OrderItemBadges optionDetails={optionDetails} extras={extras} locale={locale} />
                                  {item.note && (
                                    <p className="mt-1.5 text-xs italic text-foreground/45">&ldquo;{item.note}&rdquo;</p>
                                  )}
                                </div>
                              </motion.li>
                            );
                          })}
                        </ul>
                        <div className="mt-3 flex items-center justify-between rounded-xl bg-[#1a3c34]/5 px-3 py-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#1a3c34]/50">
                            {t("participant_subtotal")}
                          </span>
                          <span className="font-bold tabular-nums text-[#1a3c34]">
                            {fmtVnd(participant.subtotal)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })() : (
              <>
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  {t("items_count", { count: order.items.length })}
                </p>
                <ul className="space-y-4">
                  {order.items.map((item, idx) => {
                    const imageUrl = item.product.imageUrls[0] ?? null;
                    const productName = getDisplayName(item.product, locale);
                    const optionDetails = getOptionDetails(item.optionDetailsJson);
                    const extras = getExtras(item.extrasJson);
                    const lineTotal = parseFloat(item.price) * item.quantity;

                    return (
                      <motion.li
                        key={item.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: easeOutSmooth, delay: 0.05 * idx }}
                        className="flex gap-3 border-b border-black/6 pb-4 last:border-b-0 last:pb-0"
                      >
                        <div className="relative size-14 shrink-0 sm:size-16">
                          <div
                            className="absolute inset-0 overflow-hidden rounded-xl ring-1 ring-black/6"
                            style={{ backgroundColor: imageUrl ? undefined : "#1a3c34" }}
                          >
                            {imageUrl ? (
                              <Image src={imageUrl} alt={productName} fill className="object-cover" sizes="64px" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="select-none text-xl font-black text-white/20">
                                  {productName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <span className="absolute -bottom-1.5 -right-1.5 flex size-[18px] items-center justify-center rounded-full bg-kun-primary text-[9px] font-bold text-white ring-2 ring-white">
                            {item.quantity}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="mt-0.5 font-semibold leading-snug text-foreground">{productName}</p>
                            </div>
                            <p className="shrink-0 text-sm font-bold tabular-nums text-kun-primary">
                              {fmtVnd(lineTotal)}
                            </p>
                          </div>
                          <OrderItemBadges optionDetails={optionDetails} extras={extras} locale={locale} />
                          {item.note && (
                            <p className="mt-1.5 text-xs italic text-foreground/45">&ldquo;{item.note}&rdquo;</p>
                          )}
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>
              </>
            )}
          </motion.div>

          {/* ── Fulfillment info ─────────────────────────────────── */}
          {(order.address || order.table || order.pickupTime || order.guestDeliveryName || order.guestDeliveryPhone) && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...revealTransition, delay: 0.12 }}
              className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)] sm:p-6"
            >
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                {t("fulfillment_info")}
              </p>
              <div className="space-y-3">
                {(order.type === "delivery" || order.type === "pickup") && (order.guestDeliveryName || order.guestDeliveryPhone) && (
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-soft">
                      <Phone className="size-4 text-kun-products-forest" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {order.guestDeliveryName && (
                        <p className="text-sm font-medium text-foreground">{order.guestDeliveryName}</p>
                      )}
                      {order.guestDeliveryPhone && (
                        <a
                          href={`tel:${order.guestDeliveryPhone}`}
                          className="mt-0.5 inline-flex items-center gap-1 text-sm text-foreground/65 hover:text-kun-products-forest"
                        >
                          <Phone className="size-3.5" />
                          {order.guestDeliveryPhone}
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {order.address && (
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-soft">
                      <MapPin className="size-4 text-kun-products-forest" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{t("delivery_address_title")}</p>
                      <p className="mt-0.5 text-sm text-foreground/65">{order.address.fullAddress}</p>
                      {order.address.lat != null && order.address.lng != null && (
                        <a
                          href={`https://www.google.com/maps?q=${order.address.lat},${order.address.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-kun-products-forest hover:underline"
                        >
                          <ExternalLink className="size-3" />
                          {t("open_in_google_maps")}
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {order.table && (
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-soft">
                      <Utensils className="size-4 text-kun-products-forest" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{order.table.name}</p>
                      {order.table.area && (
                        <p className="mt-0.5 text-sm text-foreground/65">{t("table_area_label", { area: order.table.area })}</p>
                      )}
                    </div>
                  </div>
                )}
                {order.pickupTime && (
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-soft">
                      <Clock className="size-4 text-kun-products-forest" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t("pickup_time")}</p>
                      <p className="mt-0.5 text-sm text-foreground/65">{fmtDate(order.pickupTime, locale)}</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Payment summary ───────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...revealTransition, delay: 0.18 }}
            className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)] sm:p-6"
          >
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              {t("payment")}
            </p>

            <div className="space-y-2.5 text-sm">
              {(() => {
                const subtotal = parseFloat(order.totalAmount);
                const discount = parseFloat(order.discountAmount);
                const pointDiscount = parseFloat(order.pointDiscountAmount ?? '0');
                const shipping = order.type === 'delivery' ? parseFloat(order.shippingFee ?? '0') : 0;
                const total = subtotal - discount - pointDiscount + shipping;
                return (
                  <>
                    <div className="flex justify-between text-foreground/65">
                      <span>{t("temporarily_calculated")}</span>
                      <span className="tabular-nums font-medium text-foreground">{fmtVnd(subtotal)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-foreground/65">
                        <span>{t("discount")}</span>
                        <span className="tabular-nums font-medium text-kun-products-forest">-{fmtVnd(discount)}</span>
                      </div>
                    )}
                    {pointDiscount > 0 && (
                      <div className="flex justify-between text-foreground/65">
                        <span>{t("points_label")}</span>
                        <span className="tabular-nums font-medium text-kun-products-forest">-{fmtVnd(pointDiscount)}</span>
                      </div>
                    )}
                    {order.type === 'delivery' && (
                      <div className="flex justify-between text-foreground/65">
                        <span>{t("shipping_fee")}</span>
                        {shipping > 0 ? (
                          <span className="tabular-nums font-medium text-foreground">{fmtVnd(shipping)}</span>
                        ) : (
                          <span className="text-xs font-semibold uppercase text-kun-products-forest">{t("free")}</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-baseline justify-between border-t border-black/6 pt-3">
                      <span className="font-semibold text-foreground/70">{t("total")}</span>
                      <span className="text-xl font-bold tabular-nums text-kun-primary sm:text-2xl">
                        {fmtVnd(total)}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-surface-soft px-4 py-3">
              <CreditCard className="size-4 shrink-0 text-kun-products-forest" />
              <span className="text-sm text-foreground/70">{t(order.paymentType as "cash" | "bank_transfer")}</span>
              {order.paymentStatus === "paid" && (
                <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-green-600">
                  <CheckCircle2 className="size-3.5" />
                  {t("paid")}
                </span>
              )}
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
