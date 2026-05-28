import type { Metadata } from "next";

import { TableFormClient } from "../components/TableFormClient";

export const metadata: Metadata = {
  title: "Thêm bàn — UjCha Admin",
  description: "Tạo bàn mới và mã QR",
};

export default function TableNewPage() {
  return <TableFormClient mode="create" />;
}
