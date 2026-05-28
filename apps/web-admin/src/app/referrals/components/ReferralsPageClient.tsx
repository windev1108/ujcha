"use client";

import { Button, Input } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { Search, Share2, Trophy, Users, Zap } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuthStore } from "@/store/auth-store";
import { adminKeys } from "@/services/admin/keys";
import {
  fetchReferralDashboard,
  fetchReferralUsers,
} from "@/services/admin/referral-api";

import { ReferralGrowthChart } from "./ReferralGrowthChart";
import { ReferralMetricCards } from "./ReferralMetricCards";
import { ReferralMilestoneSection } from "./ReferralMilestoneSection";
import { ReferralProgramSettingsTab } from "./ReferralProgramSettingsTab";
import { ReferralRewardsTab } from "./ReferralRewardsTab";
import { ReferralTopFive } from "./ReferralTopFive";
import { ReferralUsersTableSection } from "./ReferralUsersTableSection";

export type ReferralTabId = "overview" | "list" | "rewards" | "settings";

function parseTab(raw: string | null): ReferralTabId {
  if (raw === "list" || raw === "rewards" || raw === "settings") return raw;
  return "overview";
}

const LIST_PAGE_SIZE = 10;
const OVERVIEW_USER_ROWS = 4;

const TAB_META: Record<
  ReferralTabId,
  { label: string; icon: React.ElementType; superOnly?: boolean }
> = {
  overview: { label: "Tổng quan", icon: Zap },
  list: { label: "Người giới thiệu", icon: Users },
  rewards: { label: "Phần thưởng", icon: Trophy },
  settings: { label: "Cài đặt", icon: Share2, superOnly: true },
};

export function ReferralsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = useAuthStore((s) => s.admin?.role);
  const isSuper = role === "super_admin";

  const [tab, setTabState] = useState<ReferralTabId>("overview");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [listPage, setListPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setTabState(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  const setTab = (next: ReferralTabId) => {
    setTabState(next);
    const p = new URLSearchParams(searchParams.toString());
    if (next === "overview") {
      p.delete("tab");
    } else {
      p.set("tab", next);
    }
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    setListPage(1);
  }, [debouncedSearch, tab]);

  const dashboardQuery = useQuery({
    queryKey: adminKeys.referralDashboard,
    queryFn: fetchReferralDashboard,
    enabled: tab === "overview",
  });

  const usersQuery = useQuery({
    queryKey: adminKeys.referralUsers({
      q: debouncedSearch,
      page: tab === "list" ? listPage : 1,
      pageSize: tab === "list" ? LIST_PAGE_SIZE : OVERVIEW_USER_ROWS,
    }),
    queryFn: () =>
      fetchReferralUsers({
        q: debouncedSearch || undefined,
        page: tab === "list" ? listPage : 1,
        pageSize: tab === "list" ? LIST_PAGE_SIZE : OVERVIEW_USER_ROWS,
      }),
    enabled: tab === "overview" || tab === "list",
  });

  const allTabs = (
    Object.keys(TAB_META) as ReferralTabId[]
  ).filter((id) => !TAB_META[id].superOnly || isSuper);

  const usersData = usersQuery.data;

  return (
    <div className="flex flex-col gap-8 pb-24">
      {/* ── Page header ────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-2xl border border-[#1a3c34]/10 bg-gradient-to-br from-[#1a3c34] to-[#2d4a43] px-6 py-6 shadow-[0_12px_40px_-16px_rgba(26,60,52,0.4)]">
        <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-white/[0.04]" aria-hidden />
        <div className="pointer-events-none absolute -bottom-12 right-16 size-32 rounded-full bg-white/[0.03]" aria-hidden />

        <div className="relative flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/50">
            Affiliate Program
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Quản lý Referral
          </h1>
          <p className="max-w-lg text-sm text-white/60">
            Theo dõi lượt giới thiệu, mốc thưởng, điểm UjCha và chuyển đổi trong chương trình affiliate.
          </p>
        </div>
      </header>

      {dashboardQuery.isError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Không tải được dữ liệu tổng quan. Kiểm tra kết nối API và quyền đăng nhập.
        </p>
      ) : null}

      {/* ── Tab bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 border-b border-black/[0.07] pb-1">
        {allTabs.map((id) => {
          const meta = TAB_META[id];
          const Icon = meta.icon;
          const active = tab === id;
          return (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={active ? "primary" : "ghost"}
              className={
                active
                  ? "gap-1.5 rounded-full bg-[#1a3c34] font-semibold text-white"
                  : "gap-1.5 rounded-full text-foreground/65 hover:text-foreground"
              }
              onPress={() => setTab(id)}
            >
              <Icon className="size-3.5" aria-hidden />
              {meta.label}
            </Button>
          );
        })}
      </div>

      {/* ── Overview ───────────────────────────────────────────────────── */}
      {tab === "overview" ? (
        <>
          <ReferralMetricCards
            data={dashboardQuery.data}
            isLoading={dashboardQuery.isLoading}
          />

          <ReferralMilestoneSection
            data={dashboardQuery.data}
            isLoading={dashboardQuery.isLoading}
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ReferralTopFive
              data={dashboardQuery.data}
              isLoading={dashboardQuery.isLoading}
            />
            <ReferralGrowthChart
              data={dashboardQuery.data}
              isLoading={dashboardQuery.isLoading}
            />
          </div>

          <ReferralUsersTableSection
            title="Người dùng gần nhất"
            description="Theo thời gian đăng ký — tìm kiếm bằng ô trên"
            items={usersData?.items ?? []}
            total={usersData?.total ?? 0}
            page={1}
            pageSize={OVERVIEW_USER_ROWS}
            totalPages={usersData?.totalPages ?? 1}
            isLoading={usersQuery.isLoading}
            onPageChange={() => { }}
            hidePagination
          />
        </>
      ) : null}

      {/* ── List ───────────────────────────────────────────────────────── */}
      {tab === "list" ? (
        <div className="flex flex-col gap-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground/35" aria-hidden />
            <Input
              aria-label="Tìm kiếm người giới thiệu"
              placeholder="Tìm theo tên, email, SĐT, mã…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-full border border-black/[0.1] bg-white pl-10 pr-4 text-sm focus:ring-[#1a3c34]/30"
            />
          </div>
          <ReferralUsersTableSection
            title="Danh sách người giới thiệu"
            description="Tất cả tài khoản có mã giới thiệu"
            items={usersData?.items ?? []}
            total={usersData?.total ?? 0}
            page={listPage}
            pageSize={LIST_PAGE_SIZE}
            totalPages={usersData?.totalPages ?? 1}
            isLoading={usersQuery.isLoading}
            onPageChange={setListPage}
          />
        </div>
      ) : null}

      {/* ── Rewards ────────────────────────────────────────────────────── */}
      {tab === "rewards" ? <ReferralRewardsTab /> : null}

      {/* ── Settings ───────────────────────────────────────────────────── */}
      {tab === "settings" && isSuper ? <ReferralProgramSettingsTab /> : null}
      {tab === "settings" && !isSuper ? (
        <p className="text-sm text-foreground/50">
          Chọn tab khác hoặc đăng nhập Super Admin để xem cấu hình.
        </p>
      ) : null}
    </div>
  );
}
