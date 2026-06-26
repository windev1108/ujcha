import type { Metadata } from "next";
import { Suspense } from "react";

import { ProductsPageClient } from "./components/ProductsPageClient";

export const metadata: Metadata = {
  title: "Sản phẩm — UjCha Admin",
  description: "Quản lý sản phẩm, SKU và tồn kho",
};

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsPageClient />
    </Suspense>
  );
}
