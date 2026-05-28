"use client";

import { Plus } from "lucide-react";
import NextLink from "next/link";

import { ROUTES } from "@/lib/routes";

export function DashboardFab() {
  return (
    <div className="pointer-events-none fixed bottom-8 right-8 z-50">
      <NextLink
        href={ROUTES.ORDER_NEW}
        aria-label="Tạo đơn mới"
        className="pointer-events-auto inline-flex size-14 items-center justify-center rounded-full bg-[#1a3c34] text-white shadow-lg shadow-[#1a3c34]/25 transition-colors hover:bg-[#14532d]"
      >
        <Plus className="size-6" />
      </NextLink>
    </div>
  );
}
