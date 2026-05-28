import { MEDIA } from "@/lib/media";

export type ProductTagKind = "best-seller" | "limited" | "new";

export interface ProductItem {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  image: string;
  tag?: ProductTagKind;
  tagLabel?: string;
}

export const PRODUCT_CATEGORIES = [
  { id: "matcha", label: "Matcha" },
  { id: "coffee", label: "Coffee" },
  { id: "tea", label: "Tea" },
  { id: "accessories", label: "Accessories" },
] as const;

export const COLLECTION_FILTERS = [
  { id: "all", label: "Tất cả sản phẩm" },
  { id: "ceremonial", label: "Ceremonial Matcha" },
  { id: "coffee", label: "Coffee nguyên chất" },
  { id: "tea", label: "Trà lá loại" },
  { id: "accessories", label: "Dụng cụ handmade" },
] as const;

/** Hàng 1: 2 thẻ nhỏ + 1 featured (ảnh riêng) */
export const ROW_ONE_PRODUCTS: [ProductItem, ProductItem] = [
  {
    id: "ceremonial-matcha",
    title: "Ceremonial Matcha",
    subtitle: "ORIGIN: UJI, JAPAN",
    price: "$48.00",
    image: MEDIA.product1,
    tag: "best-seller",
    tagLabel: "BEST SELLER",
  },
  {
    id: "heirloom-roast",
    title: "Heirloom Roast",
    subtitle: "ORIGIN: ETHIOPIA",
    price: "$32.00",
    image: MEDIA.product2,
  },
];

export const FEATURED_RITUAL = {
  id: "ritual-set",
  title: "The Ritual Set",
  eyebrow: "ESSENTIAL CRAFT",
  image: MEDIA.hero,
  href: "/san-pham",
} as const;

export const ROW_TWO_PRODUCTS: ProductItem[] = [
  {
    id: "spring-harvest",
    title: "Spring Harvest",
    subtitle: "VARIETY: SENCHA",
    price: "$54.00",
    image: MEDIA.product3,
    tag: "limited",
    tagLabel: "LIMITED RELEASE",
  },
  {
    id: "glass-pour-over",
    title: "Glass Pour Over",
    subtitle: "MATERIAL: BOROSILICATE",
    price: "$65.00",
    image: MEDIA.product4,
  },
  {
    id: "ceramic-vessel",
    title: "Ceramic Vessel",
    subtitle: "COLLECTION: SHIRO",
    price: "$28.00",
    image: MEDIA.categoryMatcha,
  },
  {
    id: "cold-brew-packs",
    title: "Cold Brew Packs",
    subtitle: "CONVENIENCE RITUAL",
    price: "$24.00",
    image: MEDIA.categoryCoffee,
    tag: "new",
    tagLabel: "NEW",
  },
];
