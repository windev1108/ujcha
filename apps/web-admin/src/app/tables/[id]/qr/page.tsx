import type { Metadata } from "next";

import { TableQrClient } from "../../components/TableQrClient";

export const metadata: Metadata = {
  title: "Mã QR bàn — UjCha Admin",
  description: "Xem và tải mã QR đặt món tại bàn",
};

export default async function TableQrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TableQrClient tableId={id} />;
}
