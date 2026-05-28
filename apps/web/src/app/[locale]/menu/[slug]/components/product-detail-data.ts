import { MEDIA } from "@/lib/media";

export type RitualItem = {
  id: string;
  title: string;
  description: string;
  price: string;
  image: string;
};

export type ProductDetail = {
  id: string;
  badge: string;
  name: string;
  price: string;
  description: string;
  images: string[];
  sugarMarks: number[];
  iceOptions: string[];
  toppings: string[];
  ritualItems: RitualItem[];
};

const ritualItems: RitualItem[] = [
  {
    id: "traditional-bamboo-whisk",
    title: "Traditional Bamboo Whisk",
    description: "80-prong handcrafted chasen for perfect froth.",
    price: "$24.00",
    image: MEDIA.product4,
  },
  {
    id: "ceramic-sifter",
    title: "Ceramic Sifter",
    description: "Fine mesh stainless steel for smooth clump-free tea.",
    price: "$18.00",
    image: MEDIA.product1,
  },
];

export const PRODUCT_DETAIL_MOCK: ProductDetail = {
  id: "ceremonial-matcha-uji-grade",
  badge: "LIMITED RELEASE",
  name: "Ceremonial Matcha - Uji Grade",
  price: "$48.00",
  description:
    "Experience the pure essence of Uji, Japan. A vibrant, stone-ground powder with a creamy texture and deep umami finish.",
  images: [MEDIA.product3, MEDIA.product1, MEDIA.product2, MEDIA.product4],
  sugarMarks: [0, 25, 50, 75, 100],
  iceOptions: ["Không đá", "Ít đá", "Bình thường", "Nhiều đá"],
  toppings: ["Trân châu đen", "Kem trứng", "Sương sáo"],
  ritualItems,
};
