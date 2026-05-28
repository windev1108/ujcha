import { MEDIA } from "@/lib/media";

export type CartLine = {
  id: string;
  tagline: string;
  name: string;
  /** USD, 2 decimals implied in UI */
  unitPrice: number;
  image: string;
};

export const INITIAL_CART_LINES: CartLine[] = [
  {
    id: "ceremonial-matcha",
    tagline: "UJI GRADE",
    name: "Ceremonial Matcha",
    unitPrice: 42,
    image: MEDIA.product1,
  },
  {
    id: "bamboo-whisk",
    tagline: "TOOL",
    name: "Traditional Bamboo Whisk",
    unitPrice: 28,
    image: MEDIA.product2,
  },
  {
    id: "chawan-bowl",
    tagline: "CERAMIC",
    name: "Artisan Chawan Bowl",
    unitPrice: 125,
    image: MEDIA.product3,
  },
];

export function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}
