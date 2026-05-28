import type { Metadata } from "next";

import { TaxesClient } from "./components/TaxesClient";

export const metadata: Metadata = {
  title: "Quản lý thuế — UjCha Admin",
  description: "Báo cáo thuế GTGT, cấu hình VAT và xuất dữ liệu kế toán",
};

export default function TaxesPage() {
  return <TaxesClient />;
}
