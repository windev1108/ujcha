"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import Image from "next/image";
import {
  Camera, Check, CheckCircle2, Coins, Copy, ImageOff, Link2,
  LogOut, Mail, Pencil, Phone, X,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { useAuthStore } from "@/store/auth-store";
import { useProfileQuery, useUpdateProfileMutation, useUploadAvatarMutation } from "@/services/profile/hooks";

function formatPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return "Chưa cập nhật";
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("84")) return `+84 ${d.slice(2, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (phone.startsWith("0")) return `+84 ${phone.slice(1, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`;
  return phone;
}

function CopyButton({ text, label = "Sao chép" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1 text-xs font-medium text-kun-primary hover:opacity-70 transition"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Đã sao chép" : label}
    </button>
  );
}

function compressImage(file: File, size = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function axiosErrorMessage(e: unknown): string {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err.response?.data?.message ?? err.message ?? "Có lỗi xảy ra.";
}

export function ProfilePageShell() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const { data: profile } = useProfileQuery();
  const updateMutation = useUpdateProfileMutation();
  const uploadAvatarMutation = useUploadAvatarMutation();

  const displayUser = profile ?? user;
  const name = displayUser?.name?.trim() || "Khách";
  const email = displayUser?.email ?? null;
  const phone = displayUser?.phone ?? null;
  const avatarUrl = displayUser?.avatar ?? null;
  const referralCode = displayUser?.referralCode ?? "";
  const pointBalance = profile?.pointBalance ?? 0;
  const emailMarketingEnabled = profile?.emailMarketingEnabled ?? false;

  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  const [referralUrl, setReferralUrl] = useState("");
  useEffect(() => {
    if (referralCode) setReferralUrl(`${window.location.origin}/register?ref=${referralCode}`);
  }, [referralCode]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarPreviewUrl(URL.createObjectURL(file));
    setPendingFile(file);
    e.target.value = "";
  };

  const cancelAvatarPreview = () => {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarPreviewUrl(null);
    setPendingFile(null);
    setAvatarError(null);
  };

  const submitAvatar = useCallback(async () => {
    if (!pendingFile) return;
    setAvatarError(null);
    try {
      const base64 = await compressImage(pendingFile);
      await uploadAvatarMutation.mutateAsync(base64);
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
      setAvatarPreviewUrl(null);
      setPendingFile(null);
    } catch (e) {
      setAvatarError(axiosErrorMessage(e));
    }
  }, [pendingFile, avatarPreviewUrl, uploadAvatarMutation]);

  const startEditName = () => {
    setNameInput(name);
    setEditingName(true);
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const submitName = useCallback(async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === name) { setEditingName(false); return; }
    await updateMutation.mutateAsync({ name: trimmed });
    setEditingName(false);
  }, [nameInput, name, updateMutation]);

  const startEditEmail = () => {
    setEmailInput(email ?? "");
    setEditingEmail(true);
    setTimeout(() => emailRef.current?.focus(), 50);
  };

  const submitEmail = useCallback(async () => {
    const trimmed = emailInput.trim();
    if (trimmed === (email ?? "")) { setEditingEmail(false); return; }
    await updateMutation.mutateAsync({ email: trimmed || null });
    setEditingEmail(false);
  }, [emailInput, email, updateMutation]);

  const toggleMarketing = () => {
    updateMutation.mutate({ emailMarketingEnabled: !emailMarketingEnabled });
  };

  const handleLogout = useCallback(() => {
    clearSession();
    router.push(ROUTES.HOME);
  }, [clearSession, router]);

  const displayAvatarSrc = avatarPreviewUrl ?? avatarUrl;
  const isUploading = uploadAvatarMutation.isPending;

  return (
    <div className="min-h-screen">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a3c34] via-[#1e4438] to-[#112a21] px-5 pb-20 pt-16 sm:pb-24 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute -bottom-16 left-1/4 size-96 rounded-full bg-[#99d6b3]/[0.06] blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <motion.div
          className="relative mx-auto flex max-w-sm flex-col items-center text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Avatar */}
          <div className="relative">
            <div className="relative size-24 overflow-hidden rounded-full bg-white/10 shadow-xl ring-4 ring-white/25 sm:size-28">
              {displayAvatarSrc ? (
                <Image
                  src={displayAvatarSrc}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="112px"
                  unoptimized
                />
              ) : (
                <div className="flex size-full items-center justify-center text-3xl font-bold text-white">
                  {name.charAt(0).toUpperCase()}
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="size-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                </div>
              )}
            </div>
            {!pendingFile && (
              <button
                type="button"
                onClick={() => avatarFileRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 flex size-8 cursor-pointer items-center justify-center rounded-full bg-white/20 text-white ring-2 ring-white/30 backdrop-blur-sm transition hover:bg-white/30 disabled:opacity-50"
              >
                <Camera className="size-3.5" />
              </button>
            )}
            <input
              ref={avatarFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarSelect}
            />
          </div>

          {/* Avatar preview actions */}
          {pendingFile && (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void submitAvatar()}
                disabled={isUploading}
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-kun-primary transition hover:opacity-90 disabled:opacity-50"
              >
                {isUploading ? (
                  <span className="size-3.5 animate-spin rounded-full border-2 border-kun-primary/30 border-t-kun-primary" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                Lưu ảnh
              </button>
              <button
                type="button"
                onClick={cancelAvatarPreview}
                disabled={isUploading}
                className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/20 disabled:opacity-50"
              >
                <ImageOff className="size-3.5" />
                Huỷ
              </button>
            </div>
          )}

          {avatarError && (
            <p className="mt-2 text-xs text-red-300">{avatarError}</p>
          )}

          {/* Editable name */}
          {editingName ? (
            <div className="mt-5 flex items-center gap-2">
              <input
                ref={nameRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="h-10 rounded-full border border-white/30 bg-white/10 px-4 text-center text-lg font-semibold text-white outline-none ring-2 ring-white/20 placeholder:text-white/40 focus:ring-white/40"
                maxLength={100}
              />
              <button
                type="button"
                onClick={() => void submitName()}
                disabled={updateMutation.isPending}
                className="flex size-9 items-center justify-center rounded-full bg-white text-kun-primary transition hover:opacity-80 disabled:opacity-50"
              >
                <Check className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="flex size-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 transition hover:bg-white/20"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEditName}
              className="group mt-5 flex items-center gap-1.5"
            >
              <span className="text-xl font-bold text-white sm:text-2xl">{name}</span>
              <Pencil className="size-3.5 text-white/40 opacity-0 transition group-hover:opacity-100" />
            </button>
          )}

          {/* Points badge */}
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-white/80">
            <Coins className="size-3.5 text-[#99d6b3]" />
            {pointBalance.toLocaleString("vi-VN")} điểm UjCha
          </div>
        </motion.div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" className="w-full" aria-hidden>
            <path d="M0 40 C360 0 1080 0 1440 40 L1440 40 L0 40Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ── Content ── */}
      <div className="bg-white px-5 pb-16">
        <motion.div
          className="mx-auto max-w-sm space-y-6 pt-8"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          {/* Contact info */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Thông tin liên hệ
            </p>
            <div className="divide-y divide-black/[0.05] rounded-3xl border border-black/[0.06] bg-white">
              {/* Phone — read-only */}
              <div className="flex items-center gap-3 px-5 py-4">
                <Phone className="size-4 shrink-0 text-kun-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                    Số điện thoại
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {phone ? formatPhone(phone) : (
                      <span className="text-muted">Chưa cập nhật</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Email — editable */}
              <div className="flex items-start gap-3 px-5 py-4">
                <Mail className="mt-1 size-4 shrink-0 text-kun-primary" />
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Email</p>
                    {editingEmail ? (
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          ref={emailRef}
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="email@example.com"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void submitEmail();
                            if (e.key === "Escape") setEditingEmail(false);
                          }}
                          className="h-8 w-full rounded-full border border-kun-primary/40 bg-white px-3 text-sm font-medium text-foreground outline-none ring-2 ring-kun-primary/15 focus:ring-kun-primary/30"
                          maxLength={200}
                        />
                        <button
                          type="button"
                          onClick={() => void submitEmail()}
                          disabled={updateMutation.isPending}
                          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-kun-primary text-white hover:opacity-80 disabled:opacity-50"
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingEmail(false)}
                          className="flex size-7 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-foreground/60 hover:bg-surface-card"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={startEditEmail}
                        className="group flex items-center gap-1.5 text-left"
                      >
                        <p className="text-sm font-medium text-foreground">
                          {email ?? <span className="text-muted">Thêm email</span>}
                        </p>
                        <Pencil className="size-3 text-muted opacity-0 transition group-hover:opacity-100" />
                      </button>
                    )}
                  </div>

                  {email && (
                    <div className="flex items-center justify-between rounded-2xl bg-surface-soft px-3 py-2.5">
                      <div>
                        <p className="text-xs font-semibold text-foreground">Nhận ưu đãi qua email</p>
                        <p className="text-[11px] text-muted">Khuyến mãi và chương trình đặc biệt</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={emailMarketingEnabled}
                        onClick={toggleMarketing}
                        disabled={updateMutation.isPending}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${emailMarketingEnabled ? "bg-kun-primary" : "bg-surface-tertiary"
                          }`}
                      >
                        <span
                          className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform ${emailMarketingEnabled ? "translate-x-[22px]" : "translate-x-[2px]"
                            }`}
                        />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Referral code */}
          {referralCode && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                Mã giới thiệu
              </p>
              <div className="space-y-3 rounded-3xl border border-black/[0.06] bg-white px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                      Mã của bạn
                    </p>
                    <p className="mt-0.5 font-mono text-lg font-bold tracking-widest text-kun-primary">
                      {referralCode}
                    </p>
                  </div>
                  <CopyButton text={referralCode} />
                </div>
                {referralUrl && (
                  <div className="flex items-center justify-between border-t border-black/5 pt-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link2 className="size-3.5 shrink-0 text-muted" />
                      <p className="truncate text-xs text-muted">Link đăng ký cho bạn bè</p>
                    </div>
                    <CopyButton text={referralUrl} label="Copy link" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Logout */}
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-full border border-red-100 bg-white px-6 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50"
            >
              <LogOut className="size-4" />
              Đăng xuất
            </button>
          </div>

          <p className="text-center text-[10px] text-muted/60">
            v{process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0"}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
