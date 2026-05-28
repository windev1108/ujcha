"use client";

import { Button } from "@heroui/react";
import { Coins } from "lucide-react";
import { useState } from "react";

import { useAuthStore } from "@/store/auth-store";

import { PointCampaignsTab } from "./PointCampaignsTab";
import { PointConfigTab } from "./PointConfigTab";
import { PointRewardsTab } from "./PointRewardsTab";
import { PointTransactionsTab } from "./PointTransactionsTab";
import { PointUsersTab } from "./PointUsersTab";

export type PointsTabId = "config" | "campaigns" | "rewards" | "users" | "history";

export function PointsPageClient() {
  const role = useAuthStore((s) => s.admin?.role);
  const isSuper = role === "super_admin";

  const [tab, setTab] = useState<PointsTabId>(
    isSuper ? "config" : "history",
  );

  const tabs: { id: PointsTabId; label: string; superOnly?: boolean }[] = [
    { id: "config", label: "Cấu hình", superOnly: true },
    { id: "campaigns", label: "Campaign", superOnly: true },
    { id: "rewards", label: "Đổi điểm", superOnly: true },
    { id: "users", label: "Người dùng" },
    { id: "history", label: "Lịch sử giao dịch" },
  ];

  const visibleTabs = tabs.filter((t) => !t.superOnly || isSuper);

  return (
    <div className="flex flex-col gap-8 pb-24">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
              Khách hàng thân thiết
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
              Quản lý UjCha Point
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-foreground/55">
              Điểm tích từ đơn hoàn thành (thành viên đã xác minh); dùng để đổi
              voucher giảm giá — cấu hình tỷ lệ tích và danh mục đổi điểm.
            </p>
          </div>
        </div>
      </header>

      {!isSuper ? (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Bạn đang xem với quyền <strong>Staff</strong>: chỉ tra cứu người dùng
          và lịch sử giao dịch. Chỉnh cấu hình &amp; campaign cần{" "}
          <strong>Super Admin</strong>.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-black/8 pb-1">
        {visibleTabs.map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={tab === t.id ? "primary" : "ghost"}
            className={
              tab === t.id
                ? "rounded-full bg-[#1a3c34] font-semibold text-white"
                : "rounded-full text-foreground/75"
            }
            onPress={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "config" && isSuper ? <PointConfigTab onGoCampaigns={() => setTab("campaigns")} onGoUsers={() => setTab("users")} onGoHistory={() => setTab("history")} /> : null}
      {tab === "campaigns" && isSuper ? <PointCampaignsTab /> : null}
      {tab === "rewards" && isSuper ? <PointRewardsTab /> : null}
      {tab === "users" ? <PointUsersTab /> : null}
      {tab === "history" ? <PointTransactionsTab /> : null}
    </div>
  );
}
