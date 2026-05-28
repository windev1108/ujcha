import type { Metadata } from "next";

import { ProductEditorClient } from "../../components/ProductEditorClient";

export const metadata: Metadata = {
  title: "Sửa sản phẩm — UjCha Admin",
  description: "Chỉnh sửa sản phẩm",
};

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductEditorClient mode="edit" productId={id} />;
}
