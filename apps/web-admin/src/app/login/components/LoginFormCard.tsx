"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAdminPhoneAuthMutation } from "@/services/auth/hooks";
import { useAuthStore } from "@/store/auth-store";
import { KunLogo } from "@/components/common/kun-logo";

const REMEMBER_KEY = "admin_remembered_creds";

export function LoginFormCard() {
  const { mutate, isPending, error } = useAdminPhoneAuthMutation();
  const { accessToken, hydrated } = useAuthStore();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  // If already authenticated, skip the login page
  useEffect(() => {
    if (hydrated && accessToken) {
      router.replace("/");
    }
  }, [hydrated, accessToken, router]);

  // Load saved credentials on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { phone?: string; password?: string };
        setPhone(saved.phone ?? "");
        setPassword(saved.password ?? "");
        setRemember(true);
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  const errorMessage =
    error instanceof Error
      ? (error as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Đăng nhập thất bại, kiểm tra lại thông tin."
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password) return;
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ phone: phone.trim(), password }));
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
    mutate({ phone: phone.trim(), password });
  };

  return (
    <Card className="w-full max-w-[min(100%,28rem)] overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_20px_50px_-28px_rgba(0,0,0,0.18)] sm:max-w-md">
      <CardContent className="px-6 py-8 sm:px-10 sm:py-10 md:px-12 md:py-12">
        <div className="flex flex-col items-center text-center">
          <KunLogo size="lg" />
          <p className="mt-4 text-sm text-zinc-500">
            Đăng nhập quản trị bằng số điện thoại và mật khẩu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Số điện thoại
            </label>
            <input
              type="tel"
              autoComplete="username"
              placeholder="Số điện thoại của bạn"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isPending}
              className="h-11 w-full rounded-full border border-black/10 bg-[#f9f9f9] px-4 text-sm text-foreground placeholder:text-zinc-400 focus:border-[#1a3c34] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c34]/20 disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Mật khẩu của bạn"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                className="h-11 w-full rounded-full border border-black/10 bg-[#f9f9f9] px-4 pr-11 text-sm text-foreground placeholder:text-zinc-400 focus:border-[#1a3c34] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c34]/20 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-600"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label className="flex cursor-pointer items-center gap-2.5 self-start">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="peer sr-only"
              />
              <div className="flex size-4.5 items-center justify-center rounded border border-black/15 bg-[#f9f9f9] transition-colors peer-checked:border-[#1a3c34] peer-checked:bg-[#1a3c34]">
                {remember && (
                  <svg viewBox="0 0 10 8" fill="none" className="size-2.5">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-xs font-medium text-zinc-500">Lưu mật khẩu</span>
          </label>

          {errorMessage && (
            <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || !phone.trim() || !password}
            className="mt-1 h-11 w-full rounded-full bg-[#1a3c34] text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {isPending ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>

        <footer className="mt-10 border-t border-black/6 pt-8 text-center">
          <p className="text-[10px] leading-relaxed text-zinc-500 sm:text-[11px]">
            UjCha Admin © {new Date().getFullYear()} All rights reserved.
          </p>
        </footer>
      </CardContent>
    </Card>
  );
}
