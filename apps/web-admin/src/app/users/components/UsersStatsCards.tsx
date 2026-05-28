"use client";

import { Card, CardContent } from "@heroui/react";
import { ShieldCheck, Users } from "lucide-react";

import type { AdminStats } from "@/services/admin/types";

export function UsersStatsCards({
  stats,
  tab,
  customerTotal,
}: {
  stats: AdminStats | undefined;
  tab: "staff" | "customers";
  customerTotal: number | undefined;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="overflow-hidden rounded-2xl border border-emerald-100 bg-[color-mix(in_oklab,#ecfdf5_80%,white)]">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#1a3c34]">
            <Users className="size-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
              Tổng nhân viên
            </p>
            <p className="mt-1 text-3xl font-bold text-[#1a3c34]">
              {stats?.total ?? "—"}
            </p>
            <p className="mt-0.5 text-sm text-foreground/55">
              <span className="font-semibold text-[#1a3c34]">
                {stats?.superAdminCount ?? 0}
              </span>{" "}
              Super Admin ·{" "}
              <span className="font-semibold text-[#3a7060]">
                {stats?.staffCount ?? 0}
              </span>{" "}
              Staff
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border border-black/6 bg-[#fafafa]">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,#1a3c34_85%,white)]">
            <ShieldCheck className="size-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45">
              Hoạt động hệ thống
            </p>
            <p className="mt-1 text-lg font-bold text-foreground">
              Hệ thống đang hoạt động ổn định
            </p>
            <p className="mt-0.5 text-sm text-foreground/55">
              {tab === "customers"
                ? `${customerTotal ?? 0} khách hàng đã đăng ký`
                : `Đang quản lý ${stats?.total ?? 0} tài khoản admin`}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
