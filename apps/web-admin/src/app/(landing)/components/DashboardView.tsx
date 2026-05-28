"use client";

import { useQuery } from "@tanstack/react-query";

import { adminKeys } from "@/services/admin/keys";
import { fetchAdminOverview } from "@/services/admin/overview-api";

import { DashboardMetricCards } from "./DashboardMetricCards";
import { OrderTypeDonutChart } from "./OrderTypeDonutChart";
import { RecentOrdersTable } from "./RecentOrdersTable";
import { RevenueLineChart } from "./RevenueLineChart";

export function DashboardView() {
  const q = useQuery({
    queryKey: adminKeys.overview,
    queryFn: fetchAdminOverview,
  });

  const data = q.data;

  return (
    <div className="flex flex-col gap-8 pb-24">
      <header className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#5a8f7a]">
          Vận hành &amp; hiệu suất
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
          Tổng quan
        </h1>
        <p className="text-sm text-foreground/55">
          Số liệu 7 ngày gần nhất so với 7 ngày trước (UTC). Biểu đồ doanh thu theo
          ngày chỉ tính đơn đã thanh toán.
        </p>
      </header>

      {q.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
          Không tải được dữ liệu tổng quan. Thử tải lại trang.
        </div>
      ) : null}

      <DashboardMetricCards data={data} isLoading={q.isLoading} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueLineChart data={data} isLoading={q.isLoading} />
        </div>
        <div className="lg:col-span-1">
          <OrderTypeDonutChart data={data} isLoading={q.isLoading} />
        </div>
      </div>

      <RecentOrdersTable data={data} isLoading={q.isLoading} />

      {/* <DashboardFab /> */}
    </div>
  );
}
