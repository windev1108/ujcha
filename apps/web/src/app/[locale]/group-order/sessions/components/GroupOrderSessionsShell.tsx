"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Clock, ArrowRight, ChevronLeft, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { fetchMyGroupOrderSessions, type MyGroupOrderSession } from "@/services/group-order/api";
import { ROUTES } from "@/lib/routes";

const STATUS_COLOR: Record<string, string> = {
  collecting: "text-emerald-700 bg-emerald-50 ring-emerald-200",
  locked: "text-blue-700 bg-blue-50 ring-blue-200",
  ordered: "text-purple-700 bg-purple-50 ring-purple-200",
  completed: "text-green-700 bg-green-50 ring-green-200",
  cancelled: "text-red-600 bg-red-50 ring-red-200",
};

function TimeLeft({ expiresAt }: { expiresAt: string }) {
  const t = useTranslations();

  const fmt = useCallback(() => {
    const msLeft = new Date(expiresAt).getTime() - Date.now();
    if (msLeft <= 0) return t("sessions_expired");
    const mins = Math.ceil(msLeft / 60_000);
    let timeStr: string;
    if (mins < 60) {
      timeStr = `${mins}ph`;
    } else {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      timeStr = m > 0 ? `${h}h ${m}ph` : `${h}h`;
    }
    return t("sessions_time_left", { time: timeStr });
  }, [expiresAt, t]);

  const [label, setLabel] = useState(fmt);
  useEffect(() => {
    const id = setInterval(() => setLabel(fmt()), 30_000);
    return () => clearInterval(id);
  }, [fmt]);

  return <span>{label}</span>;
}

export function GroupOrderSessionsShell() {
  const t = useTranslations();
  const router = useRouter();
  const [sessions, setSessions] = useState<MyGroupOrderSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchMyGroupOrderSessions();
      setSessions(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const typeLabel = (type: string) => {
    if (type === "pickup") return t("sessions_type_pickup");
    if (type === "delivery") return t("sessions_type_delivery");
    if (type === "table") return t("sessions_type_table");
    return type;
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "collecting": return t("sessions_status_collecting");
      case "locked": return t("sessions_status_locked");
      case "ordered": return t("sessions_status_ordered");
      case "completed": return t("sessions_status_completed");
      case "cancelled": return t("sessions_status_cancelled");
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-surface-soft pb-16 pt-6 sm:pt-8">
      <div className="container mx-auto max-w-2xl px-4 sm:px-6">
        {/* Back */}
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 flex cursor-pointer items-center gap-1.5 text-sm font-medium text-foreground/55 transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {t("back")}
        </button>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{t("sessions_page_eyebrow")}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{t("sessions_page_title")}</h1>
            <p className="mt-1 text-sm text-foreground/55">{t("sessions_page_subtitle")}</p>
          </div>
          {!loading && (
            <button
              type="button"
              onClick={() => void load()}
              className="mt-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground/35 transition-colors hover:bg-surface-card hover:text-foreground/60"
              aria-label={t("sessions_reload")}
            >
              <RefreshCw className="size-4" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-surface-card" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-sm text-foreground/55">{t("sessions_load_error")}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 flex cursor-pointer items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-foreground/65 transition hover:bg-surface-soft"
            >
              <RefreshCw className="size-3.5" /> {t("sessions_retry")}
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center py-20 text-center"
          >
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-[#1a3c34]/8">
              <Users className="size-8 text-[#1a3c34]" />
            </div>
            <p className="text-base font-semibold text-foreground">{t("sessions_empty_title")}</p>
            <p className="mt-1.5 text-sm text-foreground/55">{t("sessions_empty_desc")}</p>
            <button
              type="button"
              onClick={() => router.push(ROUTES.GROUP_ORDERS)}
              className="mt-6 flex cursor-pointer items-center gap-2 rounded-full bg-[#1a3c34] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {t("sessions_create_new")}
            </button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((s, i) => (
              <motion.button
                key={s.token}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: i * 0.07 }}
                onClick={() => router.push(ROUTES.GROUP_ORDER(s.token))}
                className="group flex w-full cursor-pointer items-center gap-4 rounded-3xl border border-black/6 bg-white p-5 text-left shadow-[0_4px_20px_-8px_rgba(0,0,0,0.10)] transition hover:shadow-xl"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#1a3c34]/8">
                  <Users className="size-5 text-[#1a3c34]" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {typeLabel(s.type)}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${STATUS_COLOR[s.status] ?? "text-muted bg-surface-card ring-black/10"}`}
                    >
                      {statusLabel(s.status)}
                    </span>
                    <span className="text-[11px] text-foreground/40">
                      {t("group_n_members", { count: s.participantCount })}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted">
                    <Clock className="size-3 shrink-0" />
                    <TimeLeft expiresAt={s.expiresAt} />
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-foreground/35">#{s.token}</p>
                </div>

                <ArrowRight className="size-4 shrink-0 text-foreground/25 transition-transform group-hover:translate-x-0.5" />
              </motion.button>
            ))}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: sessions.length * 0.07 + 0.1 }}
              className="flex items-center gap-2 rounded-2xl border border-dashed border-black/10 px-4 py-3"
            >
              <Users className="size-4 shrink-0 text-foreground/30" />
              <p className="text-xs text-foreground/45">{t("sessions_complete_first_hint")}</p>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
