import type { ReactNode } from "react";
import { AdminDashboardLayout } from "@/components/layout/AdminDashboardLayout";

export default function Layout({ children }: { children: ReactNode }) {
  return <AdminDashboardLayout>{children}</AdminDashboardLayout>;
}
