import type { Metadata } from "next";

import { ProductEditorClient } from "../components/ProductEditorClient";

export const metadata: Metadata = {
  title: "Thêm sản phẩm — UjCha Admin",
  description: "Tạo sản phẩm mới",
};

export default function ProductNewPage() {
  return <ProductEditorClient mode="create" />;
}
