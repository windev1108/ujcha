"use client";

import { AnimatePresence, motion } from "motion/react";
import { LogOut, MonitorSmartphone, ShieldCheck, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSessionsQuery, useRevokeSessionMutation } from "@/services/auth/hooks";
import { Button } from "@heroui/react";

type Props = {
    open: boolean;
    onClose: () => void;
};

function formatRelativeTime(iso: string, locale: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return locale === "vi" ? "Vừa xong" : "Just now";
    if (minutes < 60) return locale === "vi" ? `${minutes} phút trước` : `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return locale === "vi" ? `${hours} giờ trước` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return locale === "vi" ? `${days} ngày trước` : `${days}d ago`;
}

export function DeviceSessionsSheet({ open, onClose }: Props) {
    const t = useTranslations();
    const { data, isLoading } = useSessionsQuery();
    const revokeMutation = useRevokeSessionMutation();
    const locale = useLocale()

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl"
                        initial={{ y: 40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 40, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-5 flex items-start justify-between">
                            <div className="flex items-start gap-3">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-kun-primary/10 text-kun-primary">
                                    <ShieldCheck className="size-4" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-foreground">{t("logged_in_devices")}</h2>
                                    <p className="mt-0.5 text-xs text-muted">{t("logged_in_devices_subtitle")}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-soft"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <span className="size-5 animate-spin rounded-full border-2 border-kun-primary/30 border-t-kun-primary" />
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {data?.sessions.map((s) => (
                                    <div
                                        key={s.id}
                                        className="flex items-center gap-3 rounded-2xl border border-black/[0.06] px-4 py-3.5"
                                    >
                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-soft text-foreground/70">
                                            <MonitorSmartphone className="size-4" />
                                        </div>
                                        <div className="min-w-0 flex-1 flex flex-col gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <p className="truncate text-sm font-semibold text-foreground">{s.deviceName}</p>
                                                {s.isCurrent && (
                                                    <span className="shrink-0 rounded-full bg-kun-primary/10 px-2 py-0.5 text-[10px] font-semibold text-kun-primary">
                                                        {t("this_device")}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-xs text-muted whitespace-pre-line">
                                                {s.ipAddress ? `${s.ipAddress} · ` : ""}
                                                {formatRelativeTime(s.lastActiveAt, locale)}
                                            </p>
                                            {!s.isCurrent && (
                                                <Button
                                                    variant="danger-soft"
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => revokeMutation.mutate(s.id)}
                                                    isDisabled={revokeMutation.isPending}
                                                >
                                                    <LogOut className="size-3.5" />
                                                    {t("revoke")}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {data?.sessions.length === 0 && (
                                    <p className="py-6 text-center text-sm text-muted">{t("no_devices_found")}</p>
                                )}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}