/** Ảnh trong `public/images` — tên file có khoảng trắng được encode an toàn cho URL. */

function imageFile(name: string) {
  return `/images/${encodeURIComponent(name)}`;
}

export const MEDIA = {
  hero: "/images/background.png",
  promo: imageFile("Image (3).png"),
  categoryMatcha: imageFile("Image (1).png"),
  categoryCoffee: imageFile("Image (2).png"),
  categoryTea: imageFile("Image (3).png"),
  product1: imageFile("Image (1).png"),
  product2: imageFile("Image (2).png"),
  product3: imageFile("Image (3).png"),
  product4: imageFile("Image (4).png"),
} as const;
