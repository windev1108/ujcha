"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, CheckCircle2, Clock, Loader2, MessageSquare, Send, Star, User,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";
import { useAuthStore } from "@/store/auth-store";
import { submitFeedback } from "@/services/feedback/api";
import Image from "next/image";
import type { AxiosError } from "axios";

const STORAGE_KEY = "kun-feedback-submitted";

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function hasSubmittedToday(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === todayKey();
  } catch {
    return false;
  }
}

function markSubmittedToday() {
  try {
    localStorage.setItem(STORAGE_KEY, todayKey());
  } catch {
    // ignore
  }
}

function AuthUserBadge({ name, email, phone, avatar }: {
  name: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
}) {
  const t = useTranslations();
  const initial = name.charAt(0).toUpperCase();
  const sub = email ?? phone ?? null;
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-kun-primary/15 bg-kun-primary/5 px-4 py-3">
      <div className="relative size-9 shrink-0 overflow-hidden rounded-full bg-kun-primary/15">
        {avatar ? (
          <Image src={avatar} alt="" fill className="object-cover" sizes="36px" unoptimized />
        ) : (
          <div className="flex size-full items-center justify-center text-sm font-bold text-kun-primary">
            {initial}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{name}</p>
        {sub && <p className="text-xs text-foreground/50 truncate">{sub}</p>}
      </div>
      <span className="shrink-0 rounded-full bg-kun-primary/10 px-2 py-0.5 text-[10px] font-semibold text-kun-primary">
        {t("logged_in")}
      </span>
    </div>
  );
}

function AlreadySubmitted() {
  const t = useTranslations();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-3xl border border-black/6 bg-white p-8 text-center shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)]"
    >
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-50">
        <Clock className="size-7 text-amber-500" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">{t("already_submitted")}</h2>
      <p className="mt-1 text-sm text-foreground/55">
        {t("already_submitted_desc")}
      </p>
    </motion.div>
  );
}

export default function FeedbackPage() {
  const t = useTranslations();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoggedIn = !!user;

  const RATING_LABELS = ["", t("very_bad_rating"), t("bad_rating"), t("average_rating"), t("good_rating"), t("excellent_rating")];

  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAlreadySubmitted(hasSubmittedToday());
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitFeedback({
        name: user?.name ?? undefined,
        email: user?.email ?? undefined,
        phone: user?.phone ?? undefined,
        content: content.trim(),
        rating: rating > 0 ? rating : undefined,
      });
      markSubmittedToday();
      setSubmitted(true);
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      const msg = (err as AxiosError<{ message?: string }>)?.response?.data?.message;
      if (status === 429) {
        setAlreadySubmitted(true);
        markSubmittedToday();
      } else {
        setError(typeof msg === "string" ? msg : "Gửi phản hồi thất bại. Vui lòng thử lại.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-soft pb-16 pt-6 sm:pt-8">
      <div className="container mx-auto max-w-xl px-4 sm:px-6">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={revealTransition}
          className="mb-6"
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            {t("back")}
          </button>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-kun-primary/10">
              <MessageSquare className="size-5 text-kun-primary" />
            </div>
            <div>
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                {t("feedback")}
              </p>
              <h1 className="text-2xl font-bold text-foreground">{t("feedback")}</h1>
              <p className="text-sm text-foreground/50">
                {t("feedback_desc")}
              </p>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {alreadySubmitted ? (
            <AlreadySubmitted key="already" />
          ) : submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="rounded-3xl border border-black/6 bg-white p-8 text-center shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)]"
            >
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-kun-primary/10">
                <CheckCircle2 className="size-7 text-kun-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">{t("thank_you")}</h2>
              <p className="mt-1 text-sm text-foreground/55">
                {t("feedback_received")}
              </p>
              <button
                type="button"
                onClick={() => router.back()}
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-6 py-2.5 text-sm font-medium text-foreground hover:bg-surface-card transition"
              >
                {t("back_home")}
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onSubmit={(e) => void handleSubmit(e)}
              className="space-y-4"
            >
              {/* Identity badge */}
              {isLoggedIn ? (
                <AuthUserBadge
                  name={user.name ?? "Khách"}
                  email={user.email}
                  phone={user.phone}
                  avatar={user.avatar}
                />
              ) : (
                <div className="flex items-center gap-2 rounded-2xl border border-black/8 bg-white px-4 py-2.5">
                  <User className="size-4 shrink-0 text-foreground/30" />
                  <p className="text-sm text-foreground/45">{t("anonymous_feedback")}</p>
                </div>
              )}

              {/* Star rating */}
              <div className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
                <p className="mb-3 text-sm font-semibold text-foreground">
                  {t("rate_experience")}
                  <span className="ml-1.5 text-xs font-normal text-foreground/40">{t("optional")}</span>
                </p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star === rating ? 0 : star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="transition-transform hover:scale-110 active:scale-95"
                      aria-label={`${star} ${t("stars")}`}
                    >
                      <Star
                        className={`size-8 transition-colors ${
                          star <= (hoveredRating || rating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-foreground/20"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {(hoveredRating > 0 || rating > 0) && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-xs font-medium text-foreground/60"
                  >
                    {RATING_LABELS[hoveredRating || rating]}
                  </motion.p>
                )}
              </div>

              {/* Content */}
              <div className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
                <label htmlFor="fb-content" className="mb-3 block text-sm font-semibold text-foreground">
                  {t("feedback_content")} <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="fb-content"
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t("feedback_placeholder")}
                  maxLength={2000}
                  className="w-full resize-none rounded-2xl border border-black/[0.1] bg-transparent px-3.5 py-3 text-sm text-foreground placeholder:text-foreground/35 outline-none focus:border-kun-primary/50 focus:ring-2 focus:ring-kun-primary/15 transition-all"
                />
                <p className="mt-1 text-right text-[10px] text-muted">{content.length}/2000</p>
              </div>

              {error && (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!content.trim() || submitting}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-kun-primary text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("sending")}
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    {t("send_feedback")}
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
