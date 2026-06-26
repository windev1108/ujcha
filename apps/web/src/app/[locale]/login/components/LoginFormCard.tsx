"use client";

import { Link } from "@heroui/react";
import { Check, Eye, EyeOff, Lock, Phone } from "lucide-react";
import { useState, useEffect } from "react";
import { Logo } from "@/components/common/Logo";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { useLocalizedHref } from "@/i18n/use-localized-href";
import { useLoginMutation } from "@/services/auth/hooks";
import { useTranslations } from "next-intl";

function axiosErrorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err.response?.data?.message ?? err.message ?? fallback;
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 11;
}

export function LoginFormCard() {
  const t = useTranslations();
  const { route } = useLocalizedHref();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const login = useLoginMutation();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ujcha_saved_credentials");
      if (!raw) return;
      const { phone: savedPhone, password: savedPassword } = JSON.parse(raw);
      setPhone(savedPhone ?? "");
      setPassword(savedPassword ?? "");
      setRememberMe(true);
    } catch {
      // corrupted entry — ignore
    }
  }, []);

  const phoneEmpty = !phone.trim();
  const phoneInvalid = !phoneEmpty && !isValidPhone(phone);
  const passwordEmpty = !password;

  const phoneError =
    (submitted && phoneEmpty) ? t("error_phone_required") :
      (phoneTouched && phoneInvalid) ? t("error_phone_invalid") :
        null;
  const passwordError = submitted && passwordEmpty ? t("error_password_required") : null;

  const canSubmit = !phoneEmpty && isValidPhone(phone) && !passwordEmpty;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!canSubmit) return;
    login.mutate({ phone: phone.trim(), password }, {
      onSuccess: () => {
        if (rememberMe) {
          localStorage.setItem("ujcha_saved_credentials", JSON.stringify({ phone: phone.trim(), password }));
        } else {
          localStorage.removeItem("ujcha_saved_credentials");
        }
      },
    });
  };

  return (
    <AuthSplitLayout>
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size="md" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-[#1a3c34]">{t("login")}</h2>
        <p className="text-sm text-foreground/50">{t("login_welcome")}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>

        {/* Phone */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-foreground/60">{t("phone_number")}</label>
          <div className="relative">
            <Phone
              className={`pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 transition-colors ${phoneError ? "text-red-400" : "text-foreground/35"}`}
              aria-hidden
            />
            <input
              type="tel"
              inputMode="tel"
              placeholder={t("phone_placeholder")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setPhoneTouched(true)}
              autoComplete="tel"
              autoFocus
              aria-invalid={!!phoneError}
              aria-describedby={phoneError ? "phone-error" : undefined}
              className={`h-11 w-full rounded-xl border-0 bg-black/[0.04] pl-10 pr-4 text-sm ring-1 transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 ${phoneError
                ? "ring-red-300 focus:ring-red-400"
                : "ring-black/[0.08] focus:ring-[#1a3c34]/40"
                }`}
            />
          </div>
          {phoneError && (
            <p id="phone-error" role="alert" className="flex items-center gap-1 text-xs text-red-500">
              {phoneError}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-foreground/60">{t("password")}</label>
            <Link
              href={route("FORGOT_PASSWORD")}
              className="text-xs font-medium text-[#1a3c34] underline-offset-2 hover:underline"
            >
              {t("forgot_password")}
            </Link>
          </div>
          <div className="relative">
            <Lock
              className={`pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 transition-colors ${passwordError ? "text-red-400" : "text-foreground/35"}`}
              aria-hidden
            />
            <input
              type={showPwd ? "text" : "password"}
              placeholder={t("password_placeholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={undefined}
              autoComplete="current-password"
              aria-invalid={!!passwordError}
              aria-describedby={passwordError ? "password-error" : undefined}
              className={`h-11 w-full rounded-xl border-0 bg-black/[0.04] pl-10 pr-11 text-sm ring-1 transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 ${passwordError
                ? "ring-red-300 focus:ring-red-400"
                : "ring-black/[0.08] focus:ring-[#1a3c34]/40"
                }`}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/35 transition hover:text-foreground/60"
              tabIndex={-1}
              aria-label={showPwd ? t("hide_password") : t("show_password")}
            >
              {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {passwordError && (
            <p id="password-error" role="alert" className="text-xs text-red-500">
              {passwordError}
            </p>
          )}
        </div>

        {/* Remember me */}
        <label className="flex cursor-pointer select-none items-center gap-2.5">
          <div
            onClick={() => setRememberMe((v) => !v)}
            className={`flex size-4.5 items-center justify-center rounded border transition ${
              rememberMe
                ? "border-[#1a3c34] bg-[#1a3c34]"
                : "border-black/20 bg-white"
            }`}
          >
            {rememberMe && <Check className="size-3 stroke-[3] text-white" />}
          </div>
          <span
            onClick={() => setRememberMe((v) => !v)}
            className="text-sm text-foreground/60"
          >
            {t("remember_me")}
          </span>
        </label>

        {/* API error */}
        {login.isError && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            {axiosErrorMessage(login.error, t("generic_error"))}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={login.isPending}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-[#1a3c34] text-sm font-semibold text-white transition hover:bg-[#2d4a43] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {login.isPending ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {t("logging_in")}
            </span>
          ) : (
            t("login")
          )}
        </button>

        {/* Register link */}
        <p className="text-center text-sm text-foreground/50">
          {t("no_account")}{" "}
          <Link href={route("REGISTER")} className="font-semibold text-[#1a3c34] underline-offset-2 hover:underline">
            {t("register_now")}
          </Link>
        </p>
      </form>

      {/* Footer */}
      <div className="mt-10 border-t border-black/6 pt-6 text-center">
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
