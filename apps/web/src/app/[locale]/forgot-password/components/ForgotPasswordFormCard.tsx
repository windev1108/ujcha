"use client";

import { Link } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Phone } from "lucide-react";
import { useState, useEffect } from "react";
import { Logo } from "@/components/common/Logo";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { OtpBoxInput } from "@/components/auth/OtpBoxInput";
import { useLocalizedHref } from "@/i18n/use-localized-href";
import { useSendOtpMutation, useResetPasswordMutation } from "@/services/auth/hooks";
import { useTranslations } from "next-intl";

function resolveApiError(e: unknown, t: (key: string) => string, fallback: string): string {
  const err = e as { response?: { data?: { message?: string; code?: string } }; message?: string };
  const code = err.response?.data?.code;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (code) return t(code as any);
  return err.response?.data?.message ?? err.message ?? fallback;
}

const OTP_SECONDS = 120;

function useOtpCountdown() {
  const [seconds, setSeconds] = useState(0);
  const start = () => setSeconds(OTP_SECONDS);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return { seconds, label: `${mm}:${ss}`, start };
}

type Step = "phone" | "otp" | "success";

function StepIndicator({ current }: { current: number }) {
  const t = useTranslations();
  const labels = [t("step_enter_phone"), t("step_reset_password")];
  return (
    <div className="mb-6 flex items-center gap-2">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className={`flex size-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${i < current ? "bg-[#1a3c34] text-white"
              : i === current ? "bg-[#1a3c34] text-white ring-2 ring-[#1a3c34]/20 ring-offset-2"
                : "bg-black/[0.07] text-foreground/40"
              }`}>
              {i < current ? <CheckCircle2 className="size-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium transition-colors ${i <= current ? "text-[#1a3c34]" : "text-foreground/40"}`}>
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div className={`h-px w-8 transition-colors ${i < current ? "bg-[#1a3c34]" : "bg-black/[0.1]"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function ForgotPasswordContent() {
  const t = useTranslations();
  const { route } = useLocalizedHref();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const countdown = useOtpCountdown();

  const sendOtp = useSendOtpMutation('reset');
  const resetPassword = useResetPasswordMutation();

  const pwdMismatch = confirmPwd.length > 0 && newPassword !== confirmPwd;
  const otpReady = otp.replace(/\s/g, "").length === 6;
  const step2Valid = otpReady && newPassword.length >= 6 && newPassword === confirmPwd;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    try {
      await sendOtp.mutateAsync(phone.trim());
      countdown.start();
      setStep("otp");
    } catch {
      // error displayed via sendOtp.isError
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!step2Valid) return;
    try {
      await resetPassword.mutateAsync({ phone: phone.trim(), code: otp.replace(/\s/g, ""), newPassword });
      setStep("success");
    } catch {
      // error displayed via resetPassword.isError
    }
  };

  if (step === "success") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }} className="flex flex-col items-center gap-5 py-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="size-8 text-emerald-500" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-bold text-foreground">{t("reset_success")}</p>
          <p className="text-sm text-foreground/50">{t("reset_success_desc")}</p>
        </div>
        <Link href={route("LOGIN")}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-[#1a3c34] text-sm font-semibold text-white transition hover:bg-[#2d4a43]">
          {t("back_to_login")}
        </Link>
      </motion.div>
    );
  }

  return (
    <>
      <StepIndicator current={step === "phone" ? 0 : 1} />

      <AnimatePresence mode="wait" initial={false}>
        {step === "phone" ? (
          <motion.form key="phone" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}
            onSubmit={handleSendOtp} className="space-y-4">

            <p className="text-sm leading-relaxed text-foreground/55">{t("forgot_password_desc")}</p>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground/60">{t("phone_number")}</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/35" aria-hidden />
                <input type="tel" inputMode="tel" placeholder={t("phone_placeholder")} value={phone}
                  onChange={(e) => setPhone(e.target.value)} autoFocus autoComplete="tel"
                  className="h-11 w-full rounded-xl border-0 bg-black/[0.04] pl-10 pr-4 text-sm ring-1 ring-black/[0.08] transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c34]/40"
                />
              </div>
            </div>

            {sendOtp.isError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                {resolveApiError(sendOtp.error, t, t("generic_error"))}
              </div>
            )}

            <button type="submit" disabled={!phone.trim() || sendOtp.isPending}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#1a3c34] text-sm font-semibold text-white transition hover:bg-[#2d4a43] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
              {sendOtp.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {t("sending_otp")}
                </span>
              ) : t("send_otp")}
            </button>

            <p className="text-center text-sm text-foreground/50">
              {t("remember_password")}{" "}
              <Link href={route("LOGIN")} className="font-semibold text-[#1a3c34] underline-offset-2 hover:underline">{t("login")}</Link>
            </p>
          </motion.form>
        ) : (
          <motion.form key="otp" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}
            onSubmit={handleReset} className="space-y-4">

            <div className="rounded-xl bg-[#f3f4f6] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/45">{t("otp_sent_to")}</p>
              <p className="mt-0.5 font-semibold text-foreground">{phone}</p>
            </div>

            <div className="space-y-2">
              <label className="block text-center text-xs font-semibold text-foreground/60">{t("otp_label")}</label>
              <OtpBoxInput value={otp} onChange={setOtp} autoFocus />
            </div>

            {/* New password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground/60">{t("new_password")}</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/35" aria-hidden />
                <input type={showPwd ? "text" : "password"} placeholder={t("min_6_chars")} value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password"
                  className="h-11 w-full rounded-xl border-0 bg-black/[0.04] pl-10 pr-11 text-sm ring-1 ring-black/[0.08] transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c34]/40"
                />
                <button type="button" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/35 transition hover:text-foreground/60">
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <PasswordStrengthMeter password={newPassword} />
            </div>

            {/* Confirm new password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground/60">{t("confirm_new_password")}</label>
              <input type={showPwd ? "text" : "password"} placeholder={t("confirm_password")} value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)} autoComplete="new-password"
                className={`h-11 w-full rounded-xl border-0 bg-black/[0.04] px-4 text-sm ring-1 transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 ${pwdMismatch ? "ring-red-300 focus:ring-red-400" : "ring-black/[0.08] focus:ring-[#1a3c34]/40"
                  }`}
              />
              {pwdMismatch && <p className="text-xs text-red-500">{t("password_mismatch")}</p>}
            </div>

            {resetPassword.isError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                {resolveApiError(resetPassword.error, t, t("generic_error"))}
              </div>
            )}

            <button type="submit" disabled={!step2Valid || resetPassword.isPending}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#1a3c34] text-sm font-semibold text-white transition hover:bg-[#2d4a43] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
              {resetPassword.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {t("updating")}
                </span>
              ) : t("reset_password")}
            </button>

            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { setStep("phone"); setOtp(""); sendOtp.reset(); }}
                className="flex items-center gap-1.5 text-foreground/50 transition hover:text-foreground">
                <ArrowLeft className="size-3.5" /> {t("change_phone")}
              </button>
              {countdown.seconds > 0 ? (
                <span className="tabular-nums text-foreground/40">{t("resend_otp_after", { label: countdown.label })}</span>
              ) : (
                <button type="button" onClick={() => { sendOtp.mutate(phone.trim()); countdown.start(); }}
                  disabled={sendOtp.isPending}
                  className="font-medium text-[#1a3c34] underline-offset-2 transition hover:underline disabled:opacity-50">
                  {t("resend_otp")}
                </button>
              )}
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </>
  );
}

export function ForgotPasswordFormCard() {
  const t = useTranslations();
  const { route } = useLocalizedHref();

  return (
    <AuthSplitLayout>
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size="md" />
      </div>

      <div className="mb-8 space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-[#1a3c34]">{t("forgot_password")}</h2>
        <p className="text-sm text-foreground/50">{t("forgot_password_subtitle")}</p>
      </div>

      <ForgotPasswordContent />

      <div className="mt-8 border-t border-black/6 pt-6 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-foreground/35">
          <Link href={route("TERMS")} className="transition hover:text-foreground/60">{t("terms")}</Link>
          <span aria-hidden>·</span>
          <Link href={route("PRIVACY")} className="transition hover:text-foreground/60">{t("privacy")}</Link>
          <span aria-hidden>·</span>
          <span>{`Ujcha © ${new Date().getFullYear()}`}</span>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
