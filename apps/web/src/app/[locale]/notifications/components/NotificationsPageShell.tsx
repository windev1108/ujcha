"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Bell,
  BellOff,
  CheckCheck,
  CreditCard,
  Gift,
  Newspaper,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/hooks";
import { ROUTES } from "@/lib/routes";
import {
  useNotificationsQuery,
  useMarkReadMutation,
  useMarkAllReadMutation,
} from "@/services/notification/hooks";
import { useNotificationStore } from "@/store/notification-store";
import type { AppNotification } from "@/services/notification/api";

// ─── helpers ──────────────────────────────────────────────────────────────────

type TFn = (key: string, values?: Record<string, unknown>) => string;

const TYPE_ICON_META: Record<string, { bg: string; icon: React.ReactNode }> = {
  order:     { bg: "bg-kun-primary/[0.08]", icon: <ShoppingBag className="size-4.5 text-kun-primary" /> },
  payment:   { bg: "bg-green-50",           icon: <CreditCard  className="size-4.5 text-green-600" /> },
  reward:    { bg: "bg-amber-50",            icon: <Gift        className="size-4.5 text-amber-500" /> },
  loyalty:   { bg: "bg-amber-50",            icon: <Star        className="size-4.5 fill-amber-400 text-amber-400" /> },
  promotion: { bg: "bg-caramel/[0.08]",     icon: <Tag         className="size-4.5 text-caramel" /> },
  news:      { bg: "bg-sky-50",             icon: <Newspaper   className="size-4.5 text-sky-500" /> },
};

const TYPE_LABEL_KEY: Record<string, string> = {
  order:     "notif_type_order",
  payment:   "notif_type_payment",
  reward:    "notif_type_reward",
  loyalty:   "notif_type_loyalty",
  promotion: "notif_type_promotion",
  news:      "notif_type_news",
};

function resolveNotif(n: AppNotification, t: TFn): { title: string; content: string } {
  const key = n.data?.notifKey as string | undefined;
  if (!key) return { title: n.title, content: n.content };
  const params = n.data as Record<string, unknown>;
  return {
    title: t(`notif_${key}_title`, params),
    content: t(`notif_${key}_content`, params),
  };
}

function getTypeMeta(type: string, t: TFn) {
  const base = TYPE_ICON_META[type] ?? { bg: "bg-surface-card", icon: <Bell className="size-4.5 text-foreground/40" /> };
  return { ...base, label: t(TYPE_LABEL_KEY[type] ?? "notifications") };
}

function timeAgo(dateStr: string, t: TFn, locale: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return t("notif_just_now");
  if (m < 60) return t("notif_minutes_ago", { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("notif_hours_ago", { h });
  const d = Math.floor(h / 24);
  if (d < 7) return t("notif_days_ago", { d });
  return new Date(dateStr).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function resolveHref(n: AppNotification): string | null {
  if (n.type === "order" || n.type === "payment") {
    const orderId = n.data?.orderId as string | undefined;
    return orderId ? ROUTES.ORDERS : ROUTES.ORDERS;
  }
  if (n.type === "reward") return ROUTES.REWARDS;
  return null;
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function SkeletonItem() {
  return (
    <div className="flex items-start gap-4 rounded-3xl border border-black/[0.05] bg-white p-4">
      <div className="size-10 shrink-0 animate-pulse rounded-2xl bg-surface-card" />
      <div className="flex-1 space-y-2 py-0.5">
        <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-surface-card" />
        <div className="h-3 w-full animate-pulse rounded-full bg-surface-card" />
        <div className="h-3 w-1/3 animate-pulse rounded-full bg-surface-card" />
      </div>
    </div>
  );
}

// ─── empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  const t = useTranslations();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 py-20 text-center"
    >
      <div className="flex size-16 items-center justify-center rounded-3xl bg-surface-card">
        <BellOff className="size-7 text-foreground/25" />
      </div>
      <div>
        <p className="font-semibold text-foreground/60">
          {filtered ? t("notif_empty_unread_title") : t("notif_empty_title")}
        </p>
        <p className="mt-1 text-sm text-foreground/40">
          {filtered ? t("notif_empty_unread_desc") : t("notif_empty_all_desc")}
        </p>
      </div>
    </motion.div>
  );
}

// ─── notification card ────────────────────────────────────────────────────────

function NotificationCard({
  n,
  index,
  onRead,
}: {
  n: AppNotification;
  index: number;
  onRead: (id: string) => void;
}) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const meta = getTypeMeta(n.type, t as TFn);
  const href = resolveHref(n);
  const { title, content } = resolveNotif(n, t as TFn);

  function handleClick() {
    if (!n.isRead) onRead(n.id);
    if (href) router.push(href);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <button
        type="button"
        onClick={handleClick}
        className={`group w-full text-left transition-all ${
          n.isRead ? "" : "hover:brightness-[0.98]"
        }`}
      >
        <div
          className={`relative flex items-start gap-4 rounded-3xl border p-4 transition-colors ${
            n.isRead
              ? "border-black/[0.05] bg-white hover:border-black/[0.08]"
              : "border-kun-primary/[0.12] bg-white shadow-[0_2px_12px_-4px_rgba(26,60,52,0.08)] hover:shadow-[0_4px_16px_-4px_rgba(26,60,52,0.12)]"
          }`}
        >
          {/* Unread accent bar */}
          {!n.isRead && (
            <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full bg-kun-primary" />
          )}

          {/* Icon */}
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${meta.bg}`}
          >
            {meta.icon}
          </div>

          {/* Body */}
          <div className="min-w-0 flex-1 pr-2">
            <div className="flex items-start justify-between gap-2">
              <p
                className={`text-sm leading-snug ${
                  n.isRead
                    ? "font-medium text-foreground/70"
                    : "font-semibold text-foreground"
                }`}
              >
                {title}
              </p>
              {!n.isRead && (
                <div className="mt-1 size-2 shrink-0 rounded-full bg-kun-primary" />
              )}
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted">
              {content}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-surface-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/50">
                {meta.label}
              </span>
              <span className="text-[11px] text-foreground/35">
                {timeAgo(n.createdAt, t as TFn, locale)}
              </span>
            </div>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

// ─── filter tabs ──────────────────────────────────────────────────────────────

type Filter = "all" | "unread";

function FilterTab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-kun-primary text-white"
          : "bg-surface-card text-foreground/60 hover:bg-surface-tertiary hover:text-foreground"
      }`}
    >
      {label}
      {typeof count === "number" && count > 0 && (
        <span
          className={`flex min-w-[18px] items-center justify-center rounded-full px-1 py-px text-[10px] font-bold leading-none ${
            active ? "bg-white/25 text-white" : "bg-kun-primary/10 text-kun-primary"
          }`}
        >
          {Math.min(count, 99)}
        </span>
      )}
    </button>
  );
}

// ─── page shell ───────────────────────────────────────────────────────────────

export function NotificationsPageShell() {
  const router = useRouter();
  const t = useTranslations();
  const { isLoggedIn, isHydrated } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: notifications = [], isLoading } = useNotificationsQuery(
    isLoggedIn && isHydrated,
  );
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markRead = useMarkReadMutation();
  const markAllRead = useMarkAllReadMutation();

  const filtered =
    filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

  const serverUnread = notifications.filter((n) => !n.isRead).length;
  const displayUnread = Math.max(unreadCount, serverUnread);

  function handleMarkRead(id: string) {
    markRead.mutate(id);
    useNotificationStore.getState().setUnreadCount(Math.max(0, displayUnread - 1));
  }

  function handleMarkAll() {
    markAllRead.mutate(undefined, {
      onSuccess: () => useNotificationStore.getState().setUnreadCount(0),
    });
  }

  // Guest gate
  if (isHydrated && !isLoggedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-soft px-4">
        <div className="flex size-16 items-center justify-center rounded-3xl bg-white shadow-sm">
          <Bell className="size-7 text-kun-primary" />
        </div>
        <p className="text-center font-semibold text-foreground/60">
          {t("notif_login_prompt")}
        </p>
        <button
          type="button"
          onClick={() => router.push(ROUTES.LOGIN)}
          className="rounded-full bg-kun-primary px-6 py-2.5 text-sm font-semibold text-white"
        >
          {t("login")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-soft pb-20 pt-6 sm:pt-8">
      <div className="container mx-auto max-w-2xl px-4 sm:px-6">

        {/* Back */}
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-5 flex items-center gap-1.5 text-sm text-foreground/50 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("back")}
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mb-7"
        >
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            {t("notif_eyebrow")}
          </p>
          <div className="flex items-end justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("notifications")}
            </h1>
            {displayUnread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3.5 py-1.5 text-xs font-semibold text-foreground/60 transition-colors hover:border-kun-primary/20 hover:bg-kun-primary/[0.04] hover:text-kun-primary"
              >
                <CheckCheck className="size-3.5" />
                {t("notif_mark_all_read")}
              </button>
            )}
          </div>
        </motion.div>

        {/* Stats banner — shown when there are unread */}
        <AnimatePresence>
          {!isLoading && displayUnread > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.22 }}
              className="mb-5 flex items-center gap-3 rounded-2xl border border-kun-primary/[0.15] bg-kun-primary/[0.04] px-4 py-3"
            >
              <div className="flex size-8 items-center justify-center rounded-xl bg-kun-primary/[0.1]">
                <Sparkles className="size-4 text-kun-primary" />
              </div>
              <p className="text-sm text-foreground/70">
                {t("notif_unread_banner", { count: displayUnread })}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter tabs */}
        <div className="mb-5 flex items-center gap-2">
          <FilterTab
            active={filter === "all"}
            label={t("notif_filter_all")}
            count={notifications.length}
            onClick={() => setFilter("all")}
          />
          <FilterTab
            active={filter === "unread"}
            label={t("notif_filter_unread")}
            count={displayUnread}
            onClick={() => setFilter("unread")}
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonItem key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filtered={filter === "unread"} />
        ) : (
          <div className="space-y-3">
            {filtered.map((n, i) => (
              <NotificationCard
                key={n.id}
                n={n}
                index={i}
                onRead={handleMarkRead}
              />
            ))}

            {notifications.length >= 20 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="pt-2 text-center text-xs text-foreground/35"
              >
                {t("notif_limit_hint")}
              </motion.p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
