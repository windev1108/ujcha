import { AdminDashboardLayout } from "@/components/layout/AdminDashboardLayout";
import type { ReactNode } from "react";

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return <AdminDashboardLayout>{children}</AdminDashboardLayout>;
}
