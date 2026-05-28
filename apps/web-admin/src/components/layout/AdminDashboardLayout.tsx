"use client";

import type { ReactNode } from "react";

import { useOverlayState } from "@heroui/react";

import { AdminSidebar } from "./AdminSidebar";
import { AdminTopNavbar } from "./AdminTopNavbar";

/** Desktop: sidebar `w-64` — bù padding trái; mobile: full width (menu trong drawer). */
const SIDEBAR_WIDTH_CLASS = "pl-0 lg:pl-64";

export function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const mobileNav = useOverlayState();

  return (
    <div className="relative flex min-h-screen bg-[#f9fafb] text-foreground">
      <AdminSidebar mobileNav={mobileNav} />
      <div className={`flex min-w-0 flex-1 flex-col ${SIDEBAR_WIDTH_CLASS}`}>
        <AdminTopNavbar mobileNav={mobileNav} />
        <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
