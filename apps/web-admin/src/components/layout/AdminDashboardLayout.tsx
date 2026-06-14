"use client";

import type { ReactNode } from "react";

import { useOverlayState } from "@heroui/react";

import { AdminSidebar } from "./AdminSidebar";
import { AdminTopNavbar } from "./AdminTopNavbar";
import { useAuthStore } from "@/store/auth-store";

/** Desktop: sidebar `w-64` — bù padding trái; mobile: full width (menu trong drawer). */
const SIDEBAR_WIDTH_CLASS = "pl-0 lg:pl-64";

function SidebarSkeleton() {
  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 shrink-0 flex-col border-r border-black/6 bg-white px-4 py-6 lg:flex">
      <div className="mb-8 h-10 w-40 animate-pulse rounded-xl bg-surface-card" />
      <div className="flex flex-1 flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-2xl bg-surface-card"
            style={{ opacity: 1 - i * 0.08 }}
          />
        ))}
      </div>
      <div className="mt-4 h-14 animate-pulse rounded-2xl bg-surface-card" />
    </aside>
  );
}

function ContentSkeleton() {
  return (
    <div className="space-y-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-surface-card" />
      <div className="h-4 w-72 animate-pulse rounded-lg bg-surface-card" />
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-3xl bg-surface-card" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-3xl bg-surface-card" />
    </div>
  );
}

export function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const mobileNav = useOverlayState();
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) {
    return (
      <div className="relative flex min-h-screen bg-[#f9fafb] text-foreground">
        <SidebarSkeleton />
        <div className={`flex min-w-0 flex-1 flex-col ${SIDEBAR_WIDTH_CLASS}`}>
          <div className="h-14 shrink-0 border-b border-black/6 bg-white" />
          <div className="flex-1">
            <div className="mx-auto w-full max-w-[1600px]">
              <ContentSkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

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
