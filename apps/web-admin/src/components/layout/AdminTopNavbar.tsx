"use client";

import { Bell, Menu, Settings } from "lucide-react";

import { Button, type UseOverlayStateReturn } from "@heroui/react";

export function AdminTopNavbar({
  mobileNav,
}: {
  mobileNav: UseOverlayStateReturn;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b border-black/[0.06] bg-white/90 px-4 backdrop-blur-md lg:px-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 items-center justify-between gap-4">
        <Button
          type="button"
          isIconOnly
          variant="ghost"
          className="shrink-0 rounded-full text-foreground/70 lg:hidden"
          aria-label="Mở menu điều hướng"
          aria-expanded={mobileNav.isOpen}
          aria-controls="admin-mobile-drawer"
          onPress={() => mobileNav.open()}
        >
          <Menu className="size-5" aria-hidden />
        </Button>

        {/* <div className="relative min-w-0 max-w-2xl flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground/40"
            aria-hidden
          />
          <Input
            aria-label="Tìm kiếm"
            placeholder="Search analytics…"
            className="min-h-10 w-full rounded-full border-0 bg-[#f3f4f6] py-2 pl-11 pr-4 text-sm ring-1 ring-black/[0.06] placeholder:text-foreground/45"
          />
        </div> */}
        <div></div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-black/[0.04] hover:text-foreground"
            aria-label="Thông báo"
          >
            <Bell className="size-5" />
          </button>
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-black/[0.04] hover:text-foreground"
            aria-label="Cài đặt"
          >
            <Settings className="size-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
