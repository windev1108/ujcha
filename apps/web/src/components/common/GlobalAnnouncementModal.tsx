"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Info, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAnnouncementQuery, useStoreStatusQuery } from "@/services/store/hooks";
import { AnnouncementFrequency, AnnouncementType, STORE_SESSION_PREFIX, STORE_STATUS_DISMISSED_EVENT } from "@/services/store/types";

const STORAGE_KEY = "ujcha_announcement_seen";

const TYPE_META: Record<AnnouncementType,
    { Icon: React.ElementType; wrap: string; icon: string; btn: string }
> = {
    info: { Icon: Info, wrap: "bg-sky-50 ring-sky-200", icon: "text-sky-500", btn: "bg-[#1a3c34]" },
    feature: { Icon: Sparkles, wrap: "bg-emerald-50 ring-emerald-200", icon: "text-emerald-600", btn: "bg-[#1a3c34]" },
    warning: { Icon: AlertTriangle, wrap: "bg-amber-50 ring-amber-200", icon: "text-amber-500", btn: "bg-amber-500" },
};

function getStorage(freq: AnnouncementFrequency) {
    return freq === "once" ? window.localStorage : window.sessionStorage;
}
function readSeen(freq: AnnouncementFrequency) {
    try {
        return getStorage(freq).getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}
function writeSeen(freq: AnnouncementFrequency, version: number) {
    try {
        getStorage(freq).setItem(STORAGE_KEY, String(version));
    } catch {
        /* storage bị chặn (private mode) → chỉ đóng trong phiên render hiện tại */
    }
}

export function GlobalAnnouncementModal() {
    const t = useTranslations();
    const router = useRouter();
    const { data: announcement } = useAnnouncementQuery();
    const { data: store, isLoading: storeLoading } = useStoreStatusQuery();

    const [storeBlocking, setStoreBlocking] = useState(true);
    const [open, setOpen] = useState(false);
    const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
    // Chờ StoreStatusModal (nếu đang hiện) đóng xong rồi mới hiện thông báo
    useEffect(() => {
        if (storeLoading) return;
        const blocked =
            !!store &&
            store.effectiveStatus !== "opening" &&
            !sessionStorage.getItem(`${STORE_SESSION_PREFIX}_${store.effectiveStatus}_${store.updatedAt}`);
        setStoreBlocking(blocked);
        if (!blocked) return;
        const onDone = () => setStoreBlocking(false);
        window.addEventListener(STORE_STATUS_DISMISSED_EVENT, onDone);
        return () => window.removeEventListener(STORE_STATUS_DISMISSED_EVENT, onDone);
    }, [store, storeLoading]);

    useEffect(() => {
        if (!announcement || storeBlocking) return;
        setOpen(readSeen(announcement.frequency) !== String(announcement.version));
    }, [announcement, storeBlocking]);

    if (!announcement) return null;

    const meta = TYPE_META[announcement.type] ?? TYPE_META.info;
    const hasCta = !!announcement.ctaLabel && !!announcement.ctaUrl;
    const showImage = !!announcement.imageUrl && announcement.imageUrl !== failedImageUrl;
    const dismiss = () => {
        writeSeen(announcement.frequency, announcement.version);
        setOpen(false);
    };

    const handleCta = () => {
        const url = announcement.ctaUrl;
        dismiss();
        if (!url) return;
        if (/^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
        else router.push(url);
    };

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
                        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-black/6 bg-white p-7 text-center shadow-[0_12px_48px_-12px_rgba(0,0,0,0.25)]"
                    >
                        <button
                            type="button"
                            onClick={dismiss}
                            aria-label={t("announcement_close")}
                            className={`absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-full transition ${showImage
                                ? "bg-black/35 text-white hover:bg-black/55"
                                : "text-foreground/35 hover:bg-black/6 hover:text-foreground"
                                }`}
                        >
                            <X className="size-4" />
                        </button>

                        {showImage ? (
                            <div className="-mx-7 -mt-7 mb-5 aspect-[16/9] bg-surface-card">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={announcement.imageUrl!}
                                    alt={announcement.title}
                                    onError={() => setFailedImageUrl(announcement.imageUrl)}
                                    className="size-full object-cover"
                                />
                            </div>
                        ) : (
                            <div className={`mx-auto mb-4 flex size-16 items-center justify-center rounded-full ring-1 ${meta.wrap}`}>
                                <meta.Icon className={`size-8 ${meta.icon}`} />
                            </div>
                        )}

                        {announcement.title && (
                            <h3 className="text-lg font-bold text-foreground">{announcement.title}</h3>
                        )}
                        {announcement.content && (
                            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/60">
                                {announcement.content}
                            </p>
                        )}

                        <div className="mt-6 flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={hasCta ? handleCta : dismiss}
                                className={`w-full rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 ${meta.btn}`}
                            >
                                {hasCta ? announcement.ctaLabel : t("announcement_ok")}
                            </button>
                            {hasCta && (
                                <button
                                    type="button"
                                    onClick={dismiss}
                                    className="w-full rounded-full px-6 py-2.5 text-sm font-medium text-foreground/50 transition hover:bg-black/5 hover:text-foreground"
                                >
                                    {t("announcement_close")}
                                </button>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}