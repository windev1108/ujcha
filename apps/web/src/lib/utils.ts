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