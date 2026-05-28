import type { Metadata } from "next";

import { DashboardView } from "./components/DashboardView";

export const metadata: Metadata = {
  title: "Tổng quan — UjCha Admin",
  description: "Doanh thu, đơn hàng và điểm UjCha",
};

export default function AdminDashboardPage() {
  return <DashboardView />;
}
