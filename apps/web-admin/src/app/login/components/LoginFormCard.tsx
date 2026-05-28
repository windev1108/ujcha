"use client";

import { Card, CardContent } from "@heroui/react";

import { GoogleSignInButton } from "./GoogleSignInButton";
import { KunLogo } from "@/components/common/kun-logo";

export function LoginFormCard() {
  return (
    <Card className="w-full max-w-[min(100%,28rem)] overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_20px_50px_-28px_rgba(0,0,0,0.18)] sm:max-w-md">
      <CardContent className="px-6 py-8 sm:px-10 sm:py-10 md:px-12 md:py-12">
        <div className="flex flex-col items-center text-center">
          <KunLogo size="lg" />
          <p className="mt-4 text-sm text-zinc-500">
            Đăng nhập quản trị bằng tài khoản Google được cấp quyền.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          <GoogleSignInButton />
        </div>

        <footer className="mt-10 border-t border-black/6 pt-8 text-center">
          <p className="text-[10px] leading-relaxed text-zinc-500 sm:text-[11px]">
            UjCha Admin © {new Date().getFullYear()} All rights reserved.
          </p>
        </footer>
      </CardContent>
    </Card>
  );
}
