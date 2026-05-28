"use client";

import { Link } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Gift,
  Lock,
  Phone,
  Tag,
  UserRound,
} from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/common/Logo";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { OtpBoxInput } from "@/components/auth/OtpBoxInput";
import { useLocalizedHref } from "@/i18n/use-localized-href";
import { useSendOtpMutation, useRegisterMutation } from "@/services/auth/hooks";
import { REF_CODE_KEY } from "@/components/common/RefCodeCapture";

function axiosErrorMessage(e: unknown): string {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err.response?.data?.message ?? err.message ?? "Có lỗi xảy ra.";
}

function RefCodeRow() {
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
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#1a3c34]/70">
            Mã giới thiệu
          </p>
          <p className="font-mono text-sm font-bold text-[#1a3c34] truncate">{refCode}</p>
        </div>
        <button
          type="button"
          onClick={() => setShow(true)}
          className="shrink-0 text-xs text-foreground/40 hover:text-foreground/60 transition"
        >
          Đổi
        </button>
      </div>
    );
  }

  if (show) {
    return (
      <div className="relative">
        <Tag className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/35" aria-hidden />
        <input
          placeholder="Mã giới thiệu (tùy chọn)"
          value={refCode}
          onChange={(e) => handleChange(e.target.value)}
          className="h-11 w-full rounded-xl border-0 bg-black/[0.04] pl-10 pr-10 text-sm ring-1 ring-black/[0.08] transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c34]/40"
          maxLength={32}
          autoFocus
        />
        <button
          type="button"
          onClick={() => setShow(false)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-foreground/40 hover:text-foreground/60"
        >
          Ẩn
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShow(true)}
      className="flex items-center gap-1.5 text-xs text-foreground/40 hover:text-[#1a3c34] transition"
    >
      <Tag className="size-3.5" />
      Có mã giới thiệu?
    </button>
  );
}

type Step = "info" | "otp";

const STEP_LABELS = ["Thông tin", "Xác minh"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`flex size-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${i < current
                ? "bg-[#1a3c34] text-white"
                : i === current
                  ? "bg-[#1a3c34] text-white ring-2 ring-[#1a3c34]/20 ring-offset-2"
                  : "bg-black/[0.07] text-foreground/40"
                }`}
            >
              {i < current ? <CheckCircle2 className="size-3.5" /> : i + 1}
            </div>
            <span
              className={`text-xs font-medium transition-colors ${i <= current ? "text-[#1a3c34]" : "text-foreground/40"
                }`}
            >
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
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
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return { seconds, label: `${mm}:${ss}`, start };
}

function RegisterContent() {
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

  const pwdMismatch = confirmPwd.length > 0 && password !== confirmPwd;
  const step1Valid =
    name.trim().length >= 2 &&
    phone.trim().length >= 9 &&
    password.length >= 6 &&
    password === confirmPwd;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
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
          <motion.form
            key="info"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSendOtp}
            className="space-y-4"
          >
            {/* Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground/60">Họ và tên</label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/35" aria-hidden />
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  autoFocus
                  maxLength={64}
                  className="h-11 w-full rounded-xl border-0 bg-black/[0.04] pl-10 pr-4 text-sm ring-1 ring-black/[0.08] transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c34]/40"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground/60">Số điện thoại</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/35" aria-hidden />
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="0912 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  className="h-11 w-full rounded-xl border-0 bg-black/[0.04] pl-10 pr-4 text-sm ring-1 ring-black/[0.08] transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c34]/40"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground/60">Mật khẩu</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/35" aria-hidden />
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="Tối thiểu 6 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-11 w-full rounded-xl border-0 bg-black/[0.04] pl-10 pr-11 text-sm ring-1 ring-black/[0.08] transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c34]/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/35 hover:text-foreground/60 transition"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <PasswordStrengthMeter password={password} />
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground/60">Nhập lại mật khẩu</label>
              <input
                type={showPwd ? "text" : "password"}
                placeholder="Nhập lại mật khẩu"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                autoComplete="new-password"
                className={`h-11 w-full rounded-xl border-0 bg-black/[0.04] px-4 text-sm ring-1 transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 ${pwdMismatch
                  ? "ring-red-300 focus:ring-red-400"
                  : "ring-black/[0.08] focus:ring-[#1a3c34]/40"
                  }`}
              />
              {pwdMismatch && (
                <p className="text-xs text-red-500">Mật khẩu không khớp.</p>
              )}
            </div>

            {/* Ref code */}
            <Suspense fallback={null}>
              <RefCodeRow />
            </Suspense>

            {sendOtp.isError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                {axiosErrorMessage(sendOtp.error)}
              </div>
            )}

            <button
              type="submit"
              disabled={!step1Valid || sendOtp.isPending}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#1a3c34] text-sm font-semibold text-white transition hover:bg-[#2d4a43] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendOtp.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Đang gửi OTP…
                </span>
              ) : (
                "Tiếp theo — Xác minh SĐT"
              )}
            </button>

            <p className="text-center text-xs text-foreground/40 leading-relaxed">
              Bằng cách tiếp tục, bạn đồng ý với{" "}
              <Link href={route("TERMS")} className="underline underline-offset-2 hover:text-foreground/60 transition-colors">
                Điều khoản
              </Link>{" "}
              và{" "}
              <Link href={route("PRIVACY")} className="underline underline-offset-2 hover:text-foreground/60 transition-colors">
                Chính sách bảo mật
              </Link>{" "}
              của UjCha.
            </p>

            <p className="text-center text-sm text-foreground/50">
              Đã có tài khoản?{" "}
              <Link href={route("LOGIN")} className="font-semibold text-[#1a3c34] underline-offset-2 hover:underline">
                Đăng nhập
              </Link>
            </p>
          </motion.form>
        ) : (
          <motion.form
            key="otp"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleRegister}
            className="space-y-5"
          >
            <div className="rounded-xl bg-[#f3f4f6] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                Mã OTP đã gửi đến
              </p>
              <p className="mt-0.5 font-semibold text-foreground">{phone}</p>
            </div>

            <div className="space-y-3">
              <label className="block text-center text-xs font-semibold text-foreground/60">
                Nhập mã xác minh (6 chữ số)
              </label>
              <OtpBoxInput value={otp} onChange={setOtp} autoFocus />
            </div>

            {register.isError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                {axiosErrorMessage(register.error)}
              </div>
            )}

            <button
              type="submit"
              disabled={otp.replace(/\s/g, "").length < 6 || register.isPending}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#1a3c34] text-sm font-semibold text-white transition hover:bg-[#2d4a43] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {register.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Đang tạo tài khoản…
                </span>
              ) : (
                "Xác nhận & Hoàn tất đăng ký"
              )}
            </button>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => { setStep("info"); setOtp(""); sendOtp.reset(); }}
                className="flex items-center gap-1.5 text-foreground/50 hover:text-foreground transition"
              >
                <ArrowLeft className="size-3.5" />
                Quay lại
              </button>
              {countdown.seconds > 0 ? (
                <span className="tabular-nums text-foreground/40">
                  Gửi lại sau {countdown.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => { sendOtp.mutate(phone.trim()); countdown.start(); }}
                  disabled={sendOtp.isPending}
                  className="font-medium text-[#1a3c34] hover:underline underline-offset-2 disabled:opacity-50 transition"
                >
                  Gửi lại OTP
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
  const { route } = useLocalizedHref();

  return (
    <AuthSplitLayout>
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size="md" />
      </div>

      <div className="mb-8 space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-[#1a3c34]">
          Tạo tài khoản
        </h2>
        <p className="text-sm text-foreground/50">
          Chỉ mất 1 phút để bắt đầu trải nghiệm.
        </p>
      </div>

      <Suspense fallback={null}>
        <RegisterContent />
      </Suspense>

      <div className="mt-8 border-t border-black/6 pt-6 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-foreground/35">
          <Link href={route("TERMS")} className="hover:text-foreground/60 transition">Điều khoản</Link>
          <span aria-hidden>·</span>
          <Link href={route("PRIVACY")} className="hover:text-foreground/60 transition">Bảo mật</Link>
          <span aria-hidden>·</span>
          <span>KUN © 2026</span>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
