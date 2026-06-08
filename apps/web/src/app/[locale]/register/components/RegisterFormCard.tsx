"use client";

import { Link } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Gift, Lock, Phone, Tag, UserRound } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/common/Logo";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { OtpBoxInput } from "@/components/auth/OtpBoxInput";
import { useLocalizedHref } from "@/i18n/use-localized-href";
import { useSendOtpMutation, useRegisterMutation } from "@/services/auth/hooks";
import { REF_CODE_KEY } from "@/components/common/RefCodeCapture";
import { useTranslations } from "next-intl";

function axiosErrorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err.response?.data?.message ?? err.message ?? fallback;
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 11;
}

function RefCodeRow() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const [refCode, setRefCode] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    const code = searchParams.get("ref") ?? sessionStorage.getItem(REF_CODE_KEY) ?? "";
    if (code) {
      setRefCode(code.toUpperCase());
      sessionStorage.setItem(REF_CODE_KEY, code.toUpperCase());
    }
  }, [searchParams]);

  const handleChange = (val: string) => {
    const upper = val.toUpperCase();
    setRefCode(upper);
    if (upper) sessionStorage.setItem(REF_CODE_KEY, upper);
    else sessionStorage.removeItem(REF_CODE_KEY);
  };

  if (refCode && !show) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-[#1a3c34]/6 px-3.5 py-2.5">
        <Gift className="size-4 shrink-0 text-[#1a3c34]" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#1a3c34]/70">{t("ref_code_label")}</p>
          <p className="truncate font-mono text-sm font-bold text-[#1a3c34]">{refCode}</p>
        </div>
        <button type="button" onClick={() => setShow(true)}
          className="shrink-0 text-xs text-foreground/40 transition hover:text-foreground/60">
          {t("change")}
        </button>
      </div>
    );
  }

  if (show) {
    return (
      <div className="relative">
        <Tag className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/35" aria-hidden />
        <input
          placeholder={t("ref_code_optional")}
          value={refCode}
          onChange={(e) => handleChange(e.target.value)}
          className="h-11 w-full rounded-xl border-0 bg-black/[0.04] pl-10 pr-10 text-sm ring-1 ring-black/[0.08] transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c34]/40"
          maxLength={32}
          autoFocus
        />
        <button type="button" onClick={() => setShow(false)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-foreground/40 hover:text-foreground/60">
          {t("hide")}
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setShow(true)}
      className="flex items-center gap-1.5 text-xs text-foreground/40 transition hover:text-[#1a3c34]">
      <Tag className="size-3.5" />
      {t("have_ref_code")}
    </button>
  );
}

type Step = "info" | "otp";

function StepIndicator({ current }: { current: number }) {
  const t = useTranslations();
  const labels = [t("step_info"), t("step_verify")];
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

function RegisterContent() {
  const t = useTranslations();
  const { route } = useLocalizedHref();
  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [otp, setOtp] = useState("");
  const countdown = useOtpCountdown();

  const sendOtp = useSendOtpMutation();
  const register = useRegisterMutation();

  const [touched, setTouched] = useState({ name: false, phone: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const touch = (field: keyof typeof touched) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const nameEmpty = name.trim().length === 0;
  const phoneEmpty = !phone.trim();
  const passwordEmpty = password.length === 0;
  const pwdMismatch = confirmPwd.length > 0 && password !== confirmPwd;
  const step1Valid = !nameEmpty && name.trim().length >= 2 && isValidPhone(phone) && !passwordEmpty && password.length >= 6 && !pwdMismatch;

  const nameError =
    (submitted && nameEmpty) ? t("error_name_required") :
      ((submitted || touched.name) && !nameEmpty && name.trim().length < 2) ? t("error_name_min") :
        null;
  const phoneError =
    (submitted && phoneEmpty) ? t("error_phone_required") :
      ((submitted || touched.phone) && !phoneEmpty && !isValidPhone(phone)) ? t("error_phone_invalid") :
        null;
  const passwordError =
    (submitted && passwordEmpty) ? t("error_password_required") :
      ((submitted || touched.password) && !passwordEmpty && password.length < 6) ? t("error_password_min") :
        null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!step1Valid) return;
    await sendOtp.mutateAsync(phone.trim());
    countdown.start();
    setStep("otp");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.replace(/\s/g, "").length < 6) return;
    register.mutate({ phone: phone.trim(), name: name.trim(), password, code: otp.replace(/\s/g, "") });
  };

  return (
    <>
      <StepIndicator current={step === "info" ? 0 : 1} />

      <AnimatePresence mode="wait" initial={false}>
        {step === "info" ? (
          <motion.form key="info" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }} onSubmit={handleSendOtp} className="space-y-4">

            {/* Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground/60">{t("full_name")}</label>
              <div className="relative">
                <UserRound className={`pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 transition-colors ${nameError ? "text-red-400" : "text-foreground/35"}`} aria-hidden />
                <input type="text" placeholder="Nguyễn Văn A" value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => touch("name")}
                  autoComplete="name" autoFocus maxLength={64}
                  aria-invalid={!!nameError}
                  className={`h-11 w-full rounded-xl border-0 bg-black/[0.04] pl-10 pr-4 text-sm ring-1 transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 ${nameError ? "ring-red-300 focus:ring-red-400" : "ring-black/[0.08] focus:ring-[#1a3c34]/40"}`}
                />
              </div>
              {nameError && <p role="alert" className="text-xs text-red-500">{nameError}</p>}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground/60">{t("phone_number")}</label>
              <div className="relative">
                <Phone className={`pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 transition-colors ${phoneError ? "text-red-400" : "text-foreground/35"}`} aria-hidden />
                <input type="tel" inputMode="tel" placeholder={t('phone_placeholder')} value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => touch("phone")}
                  autoComplete="tel"
                  aria-invalid={!!phoneError}
                  className={`h-11 w-full rounded-xl border-0 bg-black/[0.04] pl-10 pr-4 text-sm ring-1 transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 ${phoneError ? "ring-red-300 focus:ring-red-400" : "ring-black/[0.08] focus:ring-[#1a3c34]/40"}`}
                />
              </div>
              {phoneError && <p role="alert" className="text-xs text-red-500">{phoneError}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground/60">{t("password")}</label>
              <div className="relative">
                <Lock className={`pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 transition-colors ${passwordError ? "text-red-400" : "text-foreground/35"}`} aria-hidden />
                <input type={showPwd ? "text" : "password"} placeholder={t("min_6_chars")} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => touch("password")}
                  autoComplete="new-password"
                  aria-invalid={!!passwordError}
                  className={`h-11 w-full rounded-xl border-0 bg-black/[0.04] pl-10 pr-11 text-sm ring-1 transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 ${passwordError ? "ring-red-300 focus:ring-red-400" : "ring-black/[0.08] focus:ring-[#1a3c34]/40"}`}
                />
                <button type="button" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/35 transition hover:text-foreground/60">
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {passwordError
                ? <p role="alert" className="text-xs text-red-500">{passwordError}</p>
                : <PasswordStrengthMeter password={password} />
              }
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground/60">{t("confirm_password")}</label>
              <input type={showPwd ? "text" : "password"} placeholder={t("confirm_password")} value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)} autoComplete="new-password"
                className={`h-11 w-full rounded-xl border-0 bg-black/[0.04] px-4 text-sm ring-1 transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 ${pwdMismatch ? "ring-red-300 focus:ring-red-400" : "ring-black/[0.08] focus:ring-[#1a3c34]/40"
                  }`}
              />
              {pwdMismatch && <p className="text-xs text-red-500">{t("password_mismatch")}</p>}
            </div>

            {/* Ref code */}
            <Suspense fallback={null}><RefCodeRow /></Suspense>

            {sendOtp.isError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                {axiosErrorMessage(sendOtp.error, t("generic_error"))}
              </div>
            )}

            <button type="submit" disabled={!step1Valid || sendOtp.isPending}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#1a3c34] text-sm font-semibold text-white transition hover:bg-[#2d4a43] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
              {sendOtp.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {t("sending_otp")}
                </span>
              ) : t("next_verify_phone")}
            </button>

            <p className="text-center text-xs leading-relaxed text-foreground/40">
              {t("agree_prefix")}{" "}
              <Link href={route("TERMS")} className="underline underline-offset-2 transition-colors hover:text-foreground/60">{t("terms")}</Link>
              {" "}{/* and */}và{" "}
              <Link href={route("PRIVACY")} className="underline underline-offset-2 transition-colors hover:text-foreground/60">{t("privacy_policy")}</Link>{" "}
              {t("agree_suffix")}
            </p>

            <p className="text-center text-sm text-foreground/50">
              {t("have_account")}{" "}
              <Link href={route("LOGIN")} className="font-semibold text-[#1a3c34] underline-offset-2 hover:underline">{t("login")}</Link>
            </p>
          </motion.form>
        ) : (
          <motion.form key="otp" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }} onSubmit={handleRegister} className="space-y-5">

            <div className="rounded-xl bg-[#f3f4f6] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/45">{t("otp_sent_to")}</p>
              <p className="mt-0.5 font-semibold text-foreground">{phone}</p>
            </div>

            <div className="space-y-3">
              <label className="block text-center text-xs font-semibold text-foreground/60">{t("enter_otp_label")}</label>
              <OtpBoxInput value={otp} onChange={setOtp} autoFocus />
            </div>

            {register.isError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                {axiosErrorMessage(register.error, t("generic_error"))}
              </div>
            )}

            <button type="submit" disabled={otp.replace(/\s/g, "").length < 6 || register.isPending}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#1a3c34] text-sm font-semibold text-white transition hover:bg-[#2d4a43] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
              {register.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {t("creating_account")}
                </span>
              ) : t("confirm_and_complete_register")}
            </button>

            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { setStep("info"); setOtp(""); sendOtp.reset(); }}
                className="flex items-center gap-1.5 text-foreground/50 transition hover:text-foreground">
                <ArrowLeft className="size-3.5" /> {t("back")}
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

export function RegisterFormCard() {
  const t = useTranslations();
  const { route } = useLocalizedHref();

  return (
    <AuthSplitLayout>
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size="md" />
      </div>

      <div className="mb-8 space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-[#1a3c34]">{t("create_account")}</h2>
        <p className="text-sm text-foreground/50">{t("register_welcome")}</p>
      </div>

      <Suspense fallback={null}><RegisterContent /></Suspense>

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
