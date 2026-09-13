// @/components/common/StoreClosedDialog.tsx
"use client";

import { AnimatePresence, motion } from "motion/react";
import { Ban, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useStoreStatusQuery } from "@/services/store/hooks";
import { minutesToHHmm } from "@/lib/utils";

interface StoreClosedDialogProps {
    open: boolean;
    code: string | null;
    onClose: () => void;
}

export function StoreClosedDialog({ open, code, onClose }: StoreClosedDialogProps) {
    const t = useTranslations();
    const { data } = useStoreStatusQuery();
    const isClosedHours = code === "STORE_CLOSED_HOURS"

    const message = isClosedHours ?
        t("store_closed_hours_default", {
            open: minutesToHHmm(data?.openMinutes ?? 0),
            close: minutesToHHmm(data?.closeMinutes ?? 0),
        })
        : t("store_closed_manual_default")

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 12 }}
                        transition={{ type: "spring", damping: 24, stiffness: 320 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm rounded-3xl border border-black/6 bg-white p-7 text-center shadow-[0_12px_48px_-12px_rgba(0,0,0,0.25)]"
                    >
                        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200">
                            {isClosedHours ? (
                                <Clock className="size-8 text-red-500" />
                            ) : (
                                <Ban className="size-8 text-red-500" />
                            )}
                        </div>

                        <h3 className="text-lg font-bold text-foreground">
                            {t("store_closed_title")}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-foreground/60 whitespace-pre-line">
                            {message}
                        </p>

                        <button
                            type="button"
                            onClick={onClose}
                            className="mt-6 w-full rounded-full bg-red-500 px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                        >
                            {t("store_closed_ok")}
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}