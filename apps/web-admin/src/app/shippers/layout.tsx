import type { ReactNode } from "react";

import { AdminDashboardLayout } from "@/components/layout/AdminDashboardLayout";

export default function ShippersLayout({ children }: { children: ReactNode }) {
  return <AdminDashboardLayout>{children}</AdminDashboardLayout>;
}
