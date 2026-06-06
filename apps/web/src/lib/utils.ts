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