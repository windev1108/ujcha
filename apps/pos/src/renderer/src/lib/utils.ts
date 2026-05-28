import { AdminOrder, CartItem, OrderItemExtraSnapshot } from "@/types/common";
import dayjs from "dayjs"

export const formatDate = (dateStr: string) => {
    return dayjs(dateStr).format('HH:mm DD/MM/YYYY')
}

export function formatVnd(amount: string | number): string {
    const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
    if (!Number.isFinite(n)) return "—";
    return `${new Intl.NumberFormat("vi-VN").format(Math.round(n))}₫`;
}

export function formatOrderRef(order: AdminOrder): string {
    const code = order.paymentCode?.trim();
    if (code) return `#${code}`;
    return `#${order.id.slice(0, 8).toUpperCase()}`;
}
export function parseExtras(raw: unknown): OrderItemExtraSnapshot[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter(
        (x): x is OrderItemExtraSnapshot =>
            x != null &&
            typeof x === "object" &&
            "name" in x &&
            typeof (x as OrderItemExtraSnapshot).name === "string",
    );
}


export function esc(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function cartItemKey(item: Omit<CartItem, 'cartId' | 'quantity'>): string {
    const optStr = Object.entries(item.options ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join('|')

    const extraStr = [...(item.extras ?? [])]
        .map(e => e.id)
        .sort()
        .join(',')

    return `${item.productId}__${optStr}__${extraStr}`
}

export function mergeCartItem(
    cart: CartItem[],
    newItem: Omit<CartItem, 'cartId'>
): CartItem[] {
    const key = cartItemKey(newItem)

    const existingIndex = cart.findIndex(
        (c) => cartItemKey(c) === key
    )

    if (existingIndex !== -1) {
        return cart.map((c, i) =>
            i === existingIndex
                ? { ...c, quantity: c.quantity + newItem.quantity }
                : c
        )
    }
    return [
        ...cart,
        { ...newItem, cartId: `${key}__${Date.now()}` },
    ]
}


export function fmt(n: string | number) { return Number(n).toLocaleString('vi-VN') + 'đ' }
