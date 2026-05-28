"use client";

import { Link } from "@heroui/react";
import { Eye, EyeOff, Lock, Phone } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/common/Logo";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { useLocalizedHref } from "@/i18n/use-localized-href";
import { useLoginMutation } from "@/services/auth/hooks";

function axiosErrorMessage(e: unknown): string {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err.response?.data?.message ?? err.message ?? "Có lỗi xảy ra.";
}

export function LoginFormCard() {
  const { route } = useLocalizedHref();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const login = useLoginMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password) return;
    login.mutate({ phone: phone.trim(), password });
  };

  return (
    <AuthSplitLayout>
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size="md" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-[#1a3c34]">
          Đăng nhập
        </h2>
        <p className="text-sm text-foreground/50">
          Chào mừng trở lại! Nhập thông tin để tiếp tục.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {/* Phone */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-foreground/60">
            Số điện thoại
          </label>
          <div className="relative">
            <Phone
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/35"
              aria-hidden
            />
            <input
              type="tel"
              inputMode="tel"
              placeholder="0912 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              autoFocus
              className="h-11 w-full rounded-xl border-0 bg-black/[0.04] pl-10 pr-4 text-sm ring-1 ring-black/[0.08] transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c34]/40"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-foreground/60">
              Mật khẩu
            </label>
            <Link
              href={route("FORGOT_PASSWORD")}
              className="text-xs font-medium text-[#1a3c34] underline-offset-2 hover:underline"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/35"
              aria-hidden
            />
            <input
              type={showPwd ? "text" : "password"}
              placeholder="Mật khẩu của bạn"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-11 w-full rounded-xl border-0 bg-black/[0.04] pl-10 pr-11 text-sm ring-1 ring-black/[0.08] transition placeholder:text-foreground/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c34]/40"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/35 hover:text-foreground/60 transition"
              tabIndex={-1}
              aria-label={showPwd ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {/* Error */}
        {login.isError && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            {axiosErrorMessage(login.error)}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!phone.trim() || !password || login.isPending}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-[#1a3c34] text-sm font-semibold text-white transition hover:bg-[#2d4a43] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {login.isPending ? (
            <span className="flex items-center gap-2">
              <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Đang đăng nhập…
            </span>
          ) : (
            "Đăng nhập"
          )}
        </button>

        {/* Register link */}
        <p className="text-center text-sm text-foreground/50">
          Chưa có tài khoản?{" "}
          <Link
            href={route("REGISTER")}
            className="font-semibold text-[#1a3c34] underline-offset-2 hover:underline"
          >
            Đăng ký ngay
          </Link>
        </p>
      </form>

      {/* Footer */}
      <div className="mt-10 border-t border-black/6 pt-6 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-foreground/35">
          <Link href={route("TERMS")} className="hover:text-foreground/60 transition">
            Điều khoản
          </Link>
          <span aria-hidden>·</span>
          <Link href={route("PRIVACY")} className="hover:text-foreground/60 transition">
            Bảo mật
          </Link>
          <span aria-hidden>·</span>
          <span>KUN © 2026</span>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
