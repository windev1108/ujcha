import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TrackedOrder = { id: string; paymentCode: string; addedAt: number };
export type ChatToast = {
    orderId: string;
    paymentCode: string;
    title: string;
    preview: string;
    avatar: string | null;
    count: number;
    at: number;
};

export const TRACK_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TOASTS = 3;

interface ChatDockState {
    orders: TrackedOrder[];
    openId: string | null;
    toasts: ChatToast[];
    hiddenIds: string[];
    hide: (id: string) => void;
    show: (id: string) => void;
    register: (o: { id: string; paymentCode: string }) => void;
    unregister: (id: string) => void;
    openChat: (id: string) => void;
    setOpenId: (id: string | null) => void;
    pushToast: (t: Omit<ChatToast, "count" | "at">) => void;
    dismissToast: (orderId: string) => void;
}

export const useChatDockStore = create<ChatDockState>()(
    persist(
        (set) => ({
            orders: [],
            openId: null,
            open: false,
            toasts: [],
            hiddenIds: [],

            hide: (id) =>
                set((s) => ({
                    hiddenIds: s.hiddenIds.includes(id) ? s.hiddenIds : [...s.hiddenIds, id],
                    openId: s.openId === id ? null : s.openId,
                    toasts: s.toasts.filter((t) => t.orderId !== id),
                })),

            show: (id) =>
                set((s) => ({ hiddenIds: s.hiddenIds.filter((x) => x !== id) })),
            register: ({ id, paymentCode }) =>
                set((s) => {
                    const now = Date.now();
                    const alive = s.orders.filter((o) => now - o.addedAt < TRACK_TTL_MS);
                    if (alive.some((o) => o.id === id)) return { orders: alive };
                    return { orders: [...alive, { id, paymentCode, addedAt: now }] };
                }),
            unregister: (id) =>
                set((s) => ({
                    orders: s.orders.filter((o) => o.id !== id),
                    toasts: s.toasts.filter((t) => t.orderId !== id),
                    openId: s.openId === id ? null : s.openId,
                })),

            openChat: (id) =>
                set((s) => ({
                    openId: id,
                    hiddenIds: s.hiddenIds.filter((x) => x !== id),
                    toasts: s.toasts.filter((t) => t.orderId !== id),
                })),

            setOpenId: (id) =>
                set((s) => ({
                    openId: id,
                    toasts: id ? s.toasts.filter((t) => t.orderId !== id) : s.toasts,
                })),
            pushToast: (t) =>
                set((s) => {
                    const prev = s.toasts.find((x) => x.orderId === t.orderId);
                    const next: ChatToast = { ...t, count: (prev?.count ?? 0) + 1, at: Date.now() };
                    return {
                        toasts: [next, ...s.toasts.filter((x) => x.orderId !== t.orderId)].slice(0, MAX_TOASTS),
                    };
                }),

            dismissToast: (orderId) =>
                set((s) => ({ toasts: s.toasts.filter((t) => t.orderId !== orderId) })),
        }),
        {
            name: "chat-dock-orders",
            partialize: (s) => ({ orders: s.orders }), // chỉ persist danh sách đơn
        },
    ),
);