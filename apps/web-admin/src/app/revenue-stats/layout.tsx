import type { ReactNode } from "react";

import { AdminDashboardLayout } from "@/components/layout/AdminDashboardLayout";

export default function CategoriesLayout({ children }: { children: ReactNode }) {
  return (
    <AdminDashboardLayout>{children}</AdminDashboardLayout>
  );
}
