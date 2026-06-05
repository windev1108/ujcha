"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, BellOff, CheckCheck, ShoppingBag, CreditCard, Gift, Newspaper, Star, Tag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  useNotificationsQuery,
  useMarkReadMutation,
  useMarkAllReadMutation,
  useUnreadCountQuery,
  useDeleteNotificationMutation,
  useDeleteAllNotificationsMutation,
} from "@/services/notification/hooks";
import type { AppNotification } from "@/services/notification/api";
import { useNotificationStore } from "@/store/notification-store";
import { useNotificationSocket } from "@/hooks/useNotificationSocket";
import { useAuthStore } from "@/store/auth-store";
import { useAuth } from "@/hooks";
import { ROUTES } from "@/lib/routes";

function resolveNotif(n: AppNotification, t: TFn): { title: string; content: string } {
  const key = n.data?.notifKey as string | undefined;
  if (!key) return { title: n.title, content: n.content };
  const params = n.data as Record<string, unknown>;
  return {
    title: t(`notif_${key}_title`, params),
    content: t(`notif_${key}_content`, params),
  };
}

function typeIcon(type: string) {
  if (type === "payment") return <CreditCard className="size-4 text-green-600" />;
  if (type === "reward") return <Gift className="size-4 text-amber-500" />;
  if (type === "loyalty") return <Star className="size-4 fill-amber-400 text-amber-400" />;
  if (type === "promotion") return <Tag className="size-4 text-caramel" />;
  if (type === "news") return <Newspaper className="size-4 text-sky-500" />;
  return <ShoppingBag className="size-4 text-kun-primary" />;
}

type TFn = (key: string, values?: Record<string, unknown>) => string;

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
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function NotificationItem({
  n,
  onRead,
  onDelete,
}: {
  n: AppNotification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const itemRef = useRef<HTMLDivElement>(null);
  const onReadRef = useRef(onRead);
  useEffect(() => { onReadRef.current = onRead; });
  const orderId = n.data?.orderId as string | undefined;
  const { title, content } = resolveNotif(n, t as TFn);

  useEffect(() => {
    if (n.isRead) return;
    const el = itemRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onReadRef.current(n.id);
          observer.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  // onRead excluded — kept in onReadRef to avoid re-creating the observer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n.id, n.isRead]);

  function handleClick() {
    if (!n.isRead) onRead(n.id);
    if (orderId) router.push(ROUTES.ORDERS);
  }

  return (
    <div
      ref={itemRef}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
      className={`group relative flex cursor-pointer items-start gap-3 rounded-2xl px-4 py-3 transition-colors ${
        n.isRead ? "bg-transparent" : "bg-kun-primary/[0.04]"
      } hover:bg-black/[0.04]`}
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-card">
        {typeIcon(n.type)}
      </div>
      <div className="min-w-0 flex-1 pr-5">
        <p className={`text-sm ${n.isRead ? "font-medium text-foreground/70" : "font-semibold text-foreground"}`}>
          {title}
        </p>
        <p className="mt-0.5 text-xs text-muted line-clamp-2">{content}</p>
        <p className="mt-1 text-[11px] text-foreground/35">{timeAgo(n.createdAt, t as TFn, locale)}</p>
      </div>
      {!n.isRead && (
        <div className="absolute right-4 top-3.5 size-2 shrink-0 rounded-full bg-kun-primary group-hover:hidden" />
      )}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
        className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full text-foreground/30 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-card hover:text-foreground/60"
        aria-label={t("notif_delete_label")}
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

function ToastBody({ n, t }: { n: AppNotification; t: TFn }) {
  const { title, content } = resolveNotif(n, t);
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted line-clamp-2">{content}</p>
    </div>
  );
}

export function NotificationToast() {
  const { latest, clearLatest } = useNotificationStore();
  const t = useTranslations();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!latest) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(clearLatest, 300);
    }, 4000);
    return () => clearTimeout(t);
  }, [latest, clearLatest]);

  return (
    <AnimatePresence>
      {visible && latest && (
        <motion.div
          key={latest.id}
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ type: "spring", damping: 24, stiffness: 300 }}
          className="fixed right-4 top-20 z-[200] flex w-80 items-start gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3.5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)]"
        >
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-card">
            {typeIcon(latest.type)}
          </div>
          <ToastBody n={latest} t={t as TFn} />
          <button
            type="button"
            onClick={() => { setVisible(false); setTimeout(clearLatest, 300); }}
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-foreground/40 hover:bg-surface-card"
          >
            <X className="size-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function NotificationBell() {
  const t = useTranslations();
  const { isLoggedIn, isHydrated } = useAuth();
  const accessToken = useAuthStore((s) => s.accessToken);

  // Wire realtime socket
  useNotificationSocket(accessToken);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: unreadCountData } = useUnreadCountQuery(isLoggedIn && isHydrated);
  const unreadCount = useNotificationStore((s) => s.unreadCount) || unreadCountData || 0;
  const { data: notifications = [], isLoading } = useNotificationsQuery(open && isLoggedIn);

  const markRead = useMarkReadMutation();
  const markAllRead = useMarkAllReadMutation();
  const deleteOne = useDeleteNotificationMutation();
  const deleteAll = useDeleteAllNotificationsMutation();

  // Sync server unread count into store on first load
  useEffect(() => {
    if (unreadCountData !== undefined) {
      useNotificationStore.getState().setUnreadCount(unreadCountData);
    }
  }, [unreadCountData]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handleMarkRead = useCallback((id: string) => {
    markRead.mutate(id);
    useNotificationStore.getState().setUnreadCount(
      Math.max(0, useNotificationStore.getState().unreadCount - 1),
    );
  }, [markRead.mutate]);

  const handleDelete = useCallback((id: string) => {
    deleteOne.mutate(id);
  }, [deleteOne]);

  // Guest (or pre-hydration) — bell visible but links to login
  if (!isLoggedIn) {
    return (
      <Link
        href={ROUTES.LOGIN}
        aria-label={t("notif_login_prompt")}
        className="relative flex size-8 items-center justify-center rounded-full text-foreground/75 transition-colors hover:bg-black/[0.05] hover:text-foreground"
      >
        <Bell className="size-[18px]" />
      </Link>
    );
  }

  function handleOpen() {
    setOpen((v) => !v);
  }

  function handleMarkAll() {
    markAllRead.mutate(undefined, {
      onSuccess: () => useNotificationStore.getState().setUnreadCount(0),
    });
    setOpen(false);
  }

  const displayCount = Math.min(unreadCount, 99);

  return (
    <div ref={ref} className="relative">
      {/* Bell trigger */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t("notifications")}
        className="relative flex size-8 items-center justify-center rounded-full text-foreground/75 transition-colors hover:bg-black/[0.05] hover:text-foreground"
      >
        <Bell className="size-[18px]" />
        {displayCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-kun-primary px-1 py-px text-[10px] font-bold leading-none text-white">
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            className="absolute right-0 top-10 z-50 w-80 rounded-2xl border border-black/[0.06] bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.18)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
              <p className="text-sm font-semibold text-foreground">{t("notifications")}</p>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAll}
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-kun-primary transition-colors hover:bg-kun-primary/[0.08]"
                  >
                    <CheckCheck className="size-3.5" />
                    {t("notif_mark_all_read")}
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { deleteAll.mutate(undefined); setOpen(false); }}
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-foreground/40 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="size-3.5" />
                    {t("notif_delete_all")}
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="max-h-[380px] overflow-y-auto overscroll-contain py-1.5">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="size-5 animate-spin rounded-full border-2 border-kun-primary/20 border-t-kun-primary" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <BellOff className="size-8 text-foreground/20" />
                  <p className="text-sm text-muted">{t("notif_empty_title")}</p>
                </div>
              ) : (
                <div className="px-1.5">
                  {notifications.map((n) => (
                    <NotificationItem
                      key={n.id}
                      n={n}
                      onRead={handleMarkRead}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-black/[0.06] px-4 py-2.5">
              <Link
                href={ROUTES.NOTIFICATIONS}
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium text-kun-primary transition-colors hover:bg-kun-primary/[0.06]"
              >
                {t("notif_view_all")}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
