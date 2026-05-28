import type { Metadata } from "next";

import { TableFormClient } from "../../components/TableFormClient";

export const metadata: Metadata = {
  title: "Sửa bàn — UjCha Admin",
  description: "Chỉnh sửa thông tin bàn",
};

export default async function TableEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TableFormClient mode="edit" tableId={id} />;
}
