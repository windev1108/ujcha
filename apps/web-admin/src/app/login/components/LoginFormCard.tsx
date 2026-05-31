"use client";

import { useState } from "react";
import { Card, CardContent } from "@heroui/react";

import { useAdminPhoneAuthMutation } from "@/services/auth/hooks";
import { KunLogo } from "@/components/common/kun-logo";

export function LoginFormCard() {
  const { mutate, isPending, error } = useAdminPhoneAuthMutation();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const errorMessage =
    error instanceof Error
      ? (error as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Đăng nhập thất bại, kiểm tra lại thông tin."
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password) return;
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
              placeholder="0901234567"
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
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              className="h-11 w-full rounded-full border border-black/10 bg-[#f9f9f9] px-4 text-sm text-foreground placeholder:text-zinc-400 focus:border-[#1a3c34] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c34]/20 disabled:opacity-50"
            />
          </div>

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
