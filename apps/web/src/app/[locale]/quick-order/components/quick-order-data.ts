import { MEDIA } from "@/lib/media";

export type CategoryId = "matcha" | "coffee" | "tea" | "food" | "seasonal";

export const QUICK_ORDER_CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "matcha", label: "Matcha" },
  { id: "coffee", label: "Cà phê" },
  { id: "tea", label: "Trà" },
  { id: "food", label: "Đồ ăn" },
  { id: "seasonal", label: "Theo mùa" },
];

export type QuickProduct = {
  id: string;
  categoryId: CategoryId;
  name: string;
  description: string;
  price: number;
  image: string;
  badge?: "best-seller" | "new";
};

export const QUICK_ORDER_PRODUCTS: QuickProduct[] = [
  {
    id: "ceremonial-matcha-latte",
    categoryId: "matcha",
    name: "Matcha Latte Nghi lễ",
    description: "Matcha xay đá Uji, kem tươi và lớp bọt mịn.",
    price: 65000,
    image: MEDIA.product1,
    badge: "best-seller",
  },
  {
    id: "strawberry-cloud-matcha",
    categoryId: "matcha",
    name: "Matcha Dâu Tây Sữa",
    description: "Sốt dâu tươi, matcha và sữa — vị ngọt thanh.",
    price: 75000,
    image: MEDIA.product4,
  },
  {
    id: "usucha-light",
    categoryId: "matcha",
    name: "Usucha Nhẹ",
    description: "Pha trực tiếp, vị matcha sạch và hậu ngọt.",
    price: 52000,
    image: MEDIA.categoryMatcha,
  },
  {
    id: "iced-matcha-yuzu",
    categoryId: "matcha",
    name: "Matcha Yuzu Đá",
    description: "Matcha lạnh, mùi yuzu thơm, sảng khoái.",
    price: 58000,
    image: MEDIA.product3,
  },
  {
    id: "cold-brew-reserve",
    categoryId: "coffee",
    name: "Cold Brew Reserve",
    description: "Ủ lạnh 18 giờ, vị socola đen và caramel nhẹ.",
    price: 55000,
    image: MEDIA.product2,
  },
  {
    id: "flat-white",
    categoryId: "coffee",
    name: "Flat White",
    description: "Espresso đôi, sữa microfoam mịn như lụa.",
    price: 48000,
    image: MEDIA.categoryCoffee,
  },
  {
    id: "americano-ice",
    categoryId: "coffee",
    name: "Americano Đá",
    description: "Espresso kéo nước, đậm và cân bằng.",
    price: 38000,
    image: MEDIA.product2,
  },
  {
    id: "cortado",
    categoryId: "coffee",
    name: "Cortado",
    description: "Espresso cân sữa nóng, cốc nhỏ gọn.",
    price: 45000,
    image: MEDIA.product4,
  },
  {
    id: "jasmine-green",
    categoryId: "tea",
    name: "Trà Xanh Lài",
    description: "Lài hữu cơ, hậu vị ngọt dịu.",
    price: 45000,
    image: MEDIA.categoryTea,
  },
  {
    id: "oolong-milk-cap",
    categoryId: "tea",
    name: "Ô Long Kem Muối",
    description: "Ô long Alishan, kem cheese mặn ngọt.",
    price: 62000,
    image: MEDIA.product3,
  },
  {
    id: "cold-jasmine",
    categoryId: "tea",
    name: "Trà Lài Lạnh",
    description: "Ủ lạnh 8 giờ, thanh và thơm hoa.",
    price: 48000,
    image: MEDIA.promo,
  },
  {
    id: "matcha-basque",
    categoryId: "food",
    name: "Bánh Matcha Basque",
    description: "Kiểu Basque, béo và đậm đất nướng.",
    price: 85000,
    image: MEDIA.product3,
    badge: "new",
  },
  {
    id: "pain-au-chocolat",
    categoryId: "food",
    name: "Pain au Chocolat",
    description: "Bơ Pháp AOP, socola đen 70%.",
    price: 42000,
    image: MEDIA.categoryTea,
  },
  {
    id: "butter-croissant",
    categoryId: "food",
    name: "Croissant Bơ",
    description: "Nhiều lớp giòn tan, bơ có vị hạt dẻ.",
    price: 35000,
    image: MEDIA.product1,
  },
  {
    id: "canele-bordeaux",
    categoryId: "food",
    name: "Canelé Bordeaux",
    description: "Vỏ caramel giòn, ruột mềm rượu rum.",
    price: 55000,
    image: MEDIA.product2,
  },
  {
    id: "sakura-latte",
    categoryId: "seasonal",
    name: "Latte Hoa Anh Đào",
    description: "Hương hoa anh đào, sữa và espresso nhẹ.",
    price: 72000,
    image: MEDIA.product4,
  },
  {
    id: "yuzu-sparkling-tea",
    categoryId: "seasonal",
    name: "Trà Yuzu Sủi",
    description: "Trà xanh, yuzu Nhật và soda.",
    price: 55000,
    image: MEDIA.categoryMatcha,
  },
  {
    id: "pumpkin-spice-latte",
    categoryId: "seasonal",
    name: "Latte Bí & Quế",
    description: "Bí rừng, quế và espresso — theo mùa.",
    price: 68000,
    image: MEDIA.hero,
  },
];

export function formatVnd(amount: number) {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}
