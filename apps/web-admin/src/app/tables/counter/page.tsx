import type { Metadata } from "next";
import { TableCounterClient } from "../components/TableCounterClient";

export const metadata: Metadata = {
  title: "Quầy QR đặt món — UjCha Admin",
  description: "Hiển thị mã QR tại quầy để khách quét đặt món tại bàn",
};

export default function TableCounterPage() {
  return <TableCounterClient />;
}
