import type { Metadata } from "next";

import { CategoriesPageClient } from "./components/CategoriesPageClient";

export const metadata: Metadata = {
  title: "Danh mục — UjCha Admin",
  description: "Quản lý danh mục sản phẩm",
};

export default function CategoriesPage() {
  return <CategoriesPageClient />;
}
