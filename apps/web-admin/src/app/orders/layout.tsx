import type { ReactNode } from "react";

import { AdminDashboardLayout } from "@/components/layout/AdminDashboardLayout";

export default function OrdersLayout({ children }: { children: ReactNode }) {
  return <AdminDashboardLayout>{children}</AdminDashboardLayout>;
}
