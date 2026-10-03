"use client";

import { AdminCustomerStats } from "@/services/admin/types";
import dynamic from "next/dynamic";

const CustomerGeoMap = dynamic(() => import("./CustomerGeoMap"), {
  ssr: false, // Leaflet cần window
  loading: () => <div className="h-[420px] animate-pulse rounded-xl bg-black/5" />,
});

export function CustomerInsights({ data }: { data?: AdminCustomerStats }) {
  const r = data?.repeat;
  const g = data?.geo;
  const stat = (label: string, value: string, sub?: string) => (
    <div className="rounded-2xl border border-black/8 bg-white p-4">
      <p className="text-[11px] font-semibold text-foreground/55">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[#1a3c34]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-foreground/45">{sub}</p>}
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat(
          "Tỉ lệ khách đặt lại",
          r?.repeatRatePercent != null ? `${r.repeatRatePercent}%` : "—",
          r ? `${r.repeatedCustomers}/${r.cohortCustomers} khách có đơn đầu trong kỳ đã đặt thêm` : undefined,
        )}
        {stat("Khách trong kỳ", r ? r.customersInRange.toLocaleString("vi-VN") : "…")}
        {stat("Khách mới", r ? r.newCustomers.toLocaleString("vi-VN") : "…")}
        {stat("Khách quay lại", r ? r.returningCustomers.toLocaleString("vi-VN") : "…",
          r && r.anonymousOrders > 0 ? `${r.anonymousOrders} đơn không định danh (Grab/Shopee…) chưa tính` : undefined)}
      </div>

      <div className="rounded-2xl border border-black/8 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#1a3c34]">Vùng khách đặt hàng</h3>
          {g && (
            <span className="text-xs text-foreground/45">
              {g.geocodedOrders}/{g.totalOrders} đơn có toạ độ · ô ~{Math.round(g.cellSize * 111_000)}m
            </span>
          )}
        </div>
        {g && g.cells.length === 0 ? (
          <p className="py-10 text-center text-sm text-foreground/40">Chưa có đơn nào có toạ độ trong kỳ.</p>
        ) : (
          <CustomerGeoMap cells={g?.cells ?? []} />
        )}
      </div>
    </div>
  );
}