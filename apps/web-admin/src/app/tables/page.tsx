import type { Metadata } from "next";

import { TablesPageClient } from "./components/TablesPageClient";

export const metadata: Metadata = {
  title: "Quản lý bàn — UjCha Admin",
  description: "Sơ đồ bàn, QR và KPI",
};

export default function TablesPage() {
  return <TablesPageClient />;
}
