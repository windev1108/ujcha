import type { Metadata } from "next";
import { ShippersPageClient } from "./components/ShippersPageClient";


export const metadata: Metadata = {
  title: "Shippers — UjCha Admin",
  description: "Quản lý đội ngũ giao hàng",
};

export default function ShippersPage() {
  return <ShippersPageClient />;
}
