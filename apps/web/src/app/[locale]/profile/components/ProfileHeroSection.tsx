"use client";

import { Button } from "@heroui/react";
import { Mail, Pencil, Phone } from "lucide-react";
import Image from "next/image";
import { motion } from "motion/react";

import { easeOutSmooth, revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";
import type { AuthUser } from "@/services/auth/types";

type Props = {
  user: AuthUser | null;
  onEditPress?: () => void;
  onAvatarEditPress?: () => void;
};

function displayPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("84")) {
    return `+84 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (phone.startsWith("0")) {
    return `+84 ${phone.slice(1, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`;
  }
  return phone;
}

export function ProfileHeroSection({
  user,
  onEditPress,
  onAvatarEditPress,
}: Props) {
  const name = user?.name?.trim() || "Khách";
  const email = user?.email?.trim() || "—";
  const phone = displayPhone(user?.phone);
  const avatarUrl = user?.avatar;

  return (
    <motion.div
      className="flex flex-col items-center text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...revealTransition, ease: easeOutSmooth }}
    >
      <div className="relative">
        <div className="relative size-28 overflow-hidden rounded-full bg-surface-card ring-4 ring-white shadow-lg sm:size-32">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={128}
              height={128}
              className="size-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-kun-filter-pill-bg text-3xl font-semibold text-foreground/80">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onAvatarEditPress}
          className="absolute bottom-0 right-0 flex size-9 items-center justify-center rounded-full bg-kun-sage text-white shadow-md ring-2 ring-white transition-transform hover:scale-105 active:scale-95"
          aria-label="Đổi ảnh đại diện"
        >
          <Pencil className="size-4" strokeWidth={2} />
        </button>
      </div>

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {name}
      </h1>

      <div className="mt-3 flex flex-col items-center gap-1.5 text-sm text-muted">
        <span className="inline-flex items-center gap-2">
          <Phone className="size-4 shrink-0 opacity-70" aria-hidden />
          {phone}
        </span>
        <span className="inline-flex items-center gap-2">
          <Mail className="size-4 shrink-0 opacity-70" aria-hidden />
          {email}
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-6 min-w-[12rem] rounded-full border-border font-medium"
        onPress={onEditPress}
      >
        Chỉnh sửa thông tin
      </Button>
    </motion.div>
  );
}
