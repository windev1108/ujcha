import { RequireSuperAdmin } from "@/components/common/RequireSuperAdmin";
import { AdminDashboardLayout } from "@/components/layout/AdminDashboardLayout";
import type { ReactNode } from "react";

export default function HrmLayout({ children }: { children: ReactNode }) {
  return (
    <AdminDashboardLayout>
      <RequireSuperAdmin>
        <>
          {children}
        </>
      </RequireSuperAdmin>
    </AdminDashboardLayout>
  )
}
