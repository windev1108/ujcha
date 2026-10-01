"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { ChatBubble } from "./ChatBubble";
import { useChatDockStore, TRACK_TTL_MS, type TrackedOrder } from "@/store/chat-dock-store";
import { fetchOrderChatMessages, sendOrderChatMessage } from "@/services/chat/api";
import type { ChatMessage } from "@/services/chat/api";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { chatAvatarText } from "@/lib/utils";
import { fetchOrderDetail } from "@/services/order/api";

const checkedIds = new Set<string>(); // module-level: mỗi đơn chỉ kiểm tra 1 lần / phiên

function isNotFound(err: unknown) {
    const s = (err as { response?: { status?: number } })?.response?.status;
    return s === 404 || s === 410;
}


function useIncoming() {
    const t = useTranslations();
    const pushToast = useChatDockStore((s) => s.pushToast);
    return (order: Pick<TrackedOrder, "id" | "paymentCode">, msg: ChatMessage) => {
        const preview =
            msg.type === "image" ? t("chat_preview_image")
                : msg.type === "sticker" ? t("chat_preview_sticker")
                    : msg.content;
        pushToast({
            orderId: order.id,
            paymentCode: order.paymentCode,
            title: msg.displayName || t("chat_title"),
            avatar: msg.avatar ?? null,
            preview,
        });
    };
}

function ToastStack() {
    const t = useTranslations();
    const toasts = useChatDockStore((s) => s.toasts);
    const openChat = useChatDockStore((s) => s.openChat);
    const dismiss = useChatDockStore((s) => s.dismissToast);

    return (
        <div className="pointer-events-none fixed right-4 top-20 z-[60] flex w-[min(92vw,320px)] flex-col gap-2">
            <AnimatePresence initial={false}>
                {toasts.map((n) => (
                    <motion.div
                        key={n.orderId}
                        layout
                        initial={{ opacity: 0, x: 40, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 40, scale: 0.96 }}
                        transition={{ type: "spring", damping: 26, stiffness: 340 }}
                        className="pointer-events-auto relative cursor-pointer rounded-2xl border border-black/6 bg-white p-3 pr-8 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)]"
                        onClick={() => openChat(n.orderId)}
                    >
                        <button
                            type="button"
                            aria-label="close"
                            onClick={(e) => { e.stopPropagation(); dismiss(n.orderId); }}
                            className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full text-foreground/40 hover:bg-black/6"
                        >
                            <X className="size-3" />
                        </button>
                        <div className="flex items-start gap-2.5">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1a3c34] text-white">
                                <MessageCircle className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">
                                    {t("chat_toast_order_label", { code: n.paymentCode })}
                                </p>
                                <p className="truncate text-sm font-bold text-foreground">{n.title}</p>
                                <p className="line-clamp-2 text-xs text-foreground/60">{n.preview}</p>
                                {n.count > 1 && (
                                    <p className="mt-1 text-[11px] font-semibold text-[#1a3c34]">
                                        {t("chat_toast_more", { count: n.count })}
                                    </p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

export function GlobalChatDock() {
    const pathname = usePathname();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const orders = useChatDockStore((s) => s.orders);
    const openId = useChatDockStore((s) => s.openId);
    const setOpenId = useChatDockStore((s) => s.setOpenId);
    const unregister = useChatDockStore((s) => s.unregister);
    const hiddenIds = useChatDockStore((s) => s.hiddenIds);
    const hide = useChatDockStore((s) => s.hide);
    const show = useChatDockStore((s) => s.show);
    const incoming = useIncoming();
    useEffect(() => {
        if (!mounted) return;
        orders.forEach(async (o) => {
            if (checkedIds.has(o.id)) return;
            checkedIds.add(o.id);
            try {
                const d = await fetchOrderDetail(o.paymentCode);
                if (d.status === "completed" || d.status === "cancelled") unregister(o.id);
            } catch (err) {
                if (isNotFound(err)) unregister(o.id);
                else checkedIds.delete(o.id); // lỗi mạng: cho phép kiểm tra lại lần sau
            }
        });
    }, [mounted, orders, unregister]);
    if (!mounted) return null;
    const onGroupPage = pathname.startsWith("/group-order");

    if (!mounted) return null;

    const now = Date.now();
    const alive = orders
        .filter((o) => now - o.addedAt < TRACK_TTL_MS)
        .sort((a, b) => b.addedAt - a.addedAt);
    if (alive.length === 0) return null;

    // Trang đơn nhóm đã có ChatBubble riêng ở vị trí dưới cùng → đẩy các bubble đơn lên 1 nấc
    const baseIndex = onGroupPage ? 1 : 0;
    const visible = alive.filter((o) => !hiddenIds.includes(o.id));

    return (
        <>
            <ToastStack />
            {alive.map((o, i) => {
                const detailPath = ROUTES.ORDER_DETAIL(o.paymentCode);
                const isOnDetail = pathname.replace(/\/$/, "") === detailPath;
                const isHidden = hiddenIds.includes(o.id);
                const visIdx = visible.findIndex((v) => v.id === o.id);
                return (
                    <ChatBubble
                        key={o.id}
                        kind="order"
                        roomId={o.id}
                        enabled
                        stackIndex={Math.max(visIdx, 0) + baseIndex}
                        hidden={isHidden}
                        label={o.paymentCode}
                        avatarText={chatAvatarText(o.paymentCode)}
                        open={openId === o.id}
                        onHide={() => hide(o.id)}
                        onOpenChange={(v) => setOpenId(v ? o.id : null)}
                        onIncoming={(msg) => { show(o.id); incoming(o, msg); }}
                        onViewOrder={isOnDetail ? undefined : () => router.push(detailPath)}
                        fetchMessages={(opts) => fetchOrderChatMessages(o.paymentCode, opts)}
                        sendMessage={(content, type) => sendOrderChatMessage(o.paymentCode, content, type)}
                        onGone={() => unregister(o.id)}

                    />
                );
            })}
        </>
    );
}