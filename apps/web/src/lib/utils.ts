import { DeliveryForm } from "@/app/[locale]/checkout/components/checkout-types";
import { ClassValue } from "class-variance-authority/types";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const capitalizeFirstLetter = (text: string) => {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function applyProductDiscount(basePrice: number, discountPercent: number): number {
    if (!discountPercent) return basePrice;
    return Math.floor(basePrice * (1 - discountPercent / 100) / 1000) * 1000;
}

// Đặt gần nơi bạn quản lý state deliveryForm/type ở trang checkout cha
export function canSubmitOrder(params: {
    type: "delivery" | "pickup" | "table";
    deliveryForm: DeliveryForm;
    selectedAddressId: string | null;
    showNewForm: boolean; // selectedAddressId === "__new__" || savedAddresses.length === 0
}): boolean {
    const { type, deliveryForm, selectedAddressId, showNewForm } = params;

    if (type === "delivery") {
        if (showNewForm) {
            // Địa chỉ mới nhập tay → bắt buộc phải có lat/lng (đã chọn từ autocomplete/map/GPS)
            return (
                !!deliveryForm.fullAddress.trim() &&
                deliveryForm.lat != null &&
                deliveryForm.lng != null &&
                !!deliveryForm.name.trim() &&
                !!deliveryForm.phone.trim()
            );
        }
        // Chọn địa chỉ đã lưu sẵn → chỉ cần có selectedAddressId
        return !!selectedAddressId;
    }

    // pickup / table: tuỳ logic hiện có của bạn, giữ nguyên
    return true;
}

export function formatSoldCount(n: number) {
    if (n >= 1000) {
        return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}k`;
    }
    return String(n);
}

export function extractErrorCode(err: unknown): string | null {
    return (
        (err as { response?: { data?: { code?: string } } })?.response?.data?.code ?? null
    );
}

export function extractErrorMessage(err: unknown): string | null {
    const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg)) return msg.join(", ");
    return null;
}

export function isStoreClosedErrorCode(code: string | null): code is "STORE_CLOSED_HOURS" | "STORE_CLOSED_MANUAL" {
    return code === "STORE_CLOSED_HOURS" || code === "STORE_CLOSED_MANUAL";
}