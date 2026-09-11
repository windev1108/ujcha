// @/components/common/StoreStatusModal.tsx
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Ban, X } from "lucide-react";
import { useStoreStatusQuery } from "@/services/store/hooks";
import { useTranslations } from "next-intl";

const SESSION_PREFIX = "ujcha_store_status_seen";

export function StoreStatusModal() {
    const { data } = useStoreStatusQuery();
    const [open, setOpen] = useState(false);
    const t = useTranslations()

    // Mỗi khi status/reason đổi (updatedAt đổi) → hiện lại modal, kể cả đã dismiss trước đó trong session
    useEffect(() => {
        if (!data || typeof window === "undefined") return;
        if (data.effectiveStatus === "opening") {
            setOpen(false);
            return;
        }
        const key = `${SESSION_PREFIX}_${data.effectiveStatus}_${data.updatedAt}`;
        if (sessionStorage.getItem(key)) return;
        setOpen(true);
    }, [data]);

    if (!data || data.effectiveStatus === "opening") return null;

    const isClosed = data.effectiveStatus === "closed";

    function dismiss() {
        if (data) {
            sessionStorage.setItem(
                `${SESSION_PREFIX}_${data.effectiveStatus}_${data.updatedAt}`,
                "1",
            );
        }
        setOpen(false);
    }

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
                    onClick={dismiss}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 12 }}
                        transition={{ type: "spring", damping: 24, stiffness: 320 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-sm rounded-3xl border border-black/6 bg-white p-7 text-center shadow-[0_12px_48px_-12px_rgba(0,0,0,0.25)]"
                    >
                        <button
                            type="button"
                            onClick={dismiss}
                            className="absolute right-4 top-4 flex size-7 items-center justify-center rounded-full text-foreground/35 transition hover:bg-black/6 hover:text-foreground"
                        >
                            <X className="size-4" />
                        </button>

                        <div
                            className={`mx-auto mb-4 flex size-16 items-center justify-center rounded-full ring-1 ${isClosed ? "bg-red-50 ring-red-200" : "bg-amber-50 ring-amber-200"
                                }`}
                        >
                            {isClosed ? (
                                <Ban className="size-8 text-red-500" />
                            ) : (
                                <AlertTriangle className="size-8 text-amber-500" />
                            )}
                        </div>

                        <h3 className="text-lg font-bold text-foreground">
                            {isClosed ? t("store_closed_title") : t("store_busy_tile")}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-foreground/60">
                            {data.statusReason?.trim() ||
                                (isClosed
                                    ? t("store_closed_manual_default")
                                    : t("store_busy_manual_default"))}
                        </p>

                        <button
                            type="button"
                            onClick={dismiss}
                            className={`mt-6 w-full rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 ${isClosed ? "bg-red-500" : "bg-[#1a3c34]"
                                }`}
                        >
                            {isClosed ? t("store_closed_ok") : t("store_continue_ok")}
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}