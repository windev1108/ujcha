"use client";

import type { PlatformRevenueSummary } from "@/services/admin/types";

const PLATFORM_STYLE: Record<string, { bg: string; border: string; badge: string; label: string; emptyDot: string }> = {
  grab:   { bg: "bg-green-50",  border: "border-green-200",  badge: "bg-green-100 text-green-800",   label: "GrabFood",    emptyDot: "bg-green-400" },
  shopee: { bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-800", label: "ShopeeFood",  emptyDot: "bg-orange-400" },
};

const KNOWN_PLATFORMS = ["grab", "shopee"];

function fmt(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function groupByPlatform(rows: PlatformRevenueSummary[]) {
  const map = new Map<string, PlatformRevenueSummary[]>();
  for (const r of rows) {
    if (!map.has(r.platform)) map.set(r.platform, []);
    map.get(r.platform)!.push(r);
  }
  return map;
}

type Props = { rows: PlatformRevenueSummary[]; isLoading?: boolean };

export function PlatformRevenueCard({ rows, isLoading }: Props) {
  const byPlatform = groupByPlatform(rows);

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-bold text-[#1a3c34]">Doanh thu đối tác</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          7 ngày gần nhất
        </span>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {KNOWN_PLATFORMS.map((p) => (
            <div key={p} className="h-24 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {KNOWN_PLATFORMS.map((platform) => {
            const style = PLATFORM_STYLE[platform]!;
            const items = byPlatform.get(platform) ?? [];
            const hasData = items.length > 0;

            const totalRevenue  = items.reduce((s, r) => s + r.revenue, 0);
            const totalEarnings = items.reduce((s, r) => s + r.totalEarnings, 0);
            const totalDone     = items.reduce((s, r) => s + r.completedOrders, 0);
            const totalCancel   = items.reduce((s, r) => s + r.cancelledOrders, 0);
            const lastSync      = items[0]?.syncedAt;

            return (
              <div
                key={platform}
                className={`rounded-xl border p-4 ${style.bg} ${style.border}`}
              >
                {/* Platform badge + last sync */}
                <div className="mb-3 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black tracking-wide ${style.badge}`}>
                    <span className={`size-1.5 rounded-full ${style.emptyDot}`} />
                    {style.label}
                  </span>
                  {hasData ? (
                    <span className="text-[11px] text-gray-400">
                      {items.length} ngày &middot; sync {lastSync ? new Date(lastSync).toLocaleDateString("vi-VN") : ""}
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-400 italic">Chưa có dữ liệu</span>
                  )}
                </div>

                {hasData ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Stat label="Doanh thu" value={fmt(totalRevenue)} />
                      <Stat label="Thu nhập shop" value={fmt(totalEarnings)} />
                      <Stat label="Hoàn thành" value={String(totalDone)} unit="đơn" />
                      <Stat label="Đã hủy" value={String(totalCancel)} unit="đơn" dimmed />
                    </div>

                    {items.length > 1 && (
                      <div className="mt-3 divide-y divide-black/[0.04] rounded-lg bg-white/70 px-3 py-1">
                        {items.slice(0, 7).map((r) => (
                          <div key={r.id} className="flex items-center justify-between py-1.5 text-xs">
                            <span className="text-gray-500 tabular-nums">{r.date}</span>
                            <span className="font-semibold text-gray-800 tabular-nums">{fmt(r.revenue)}</span>
                            <span className="text-gray-400 tabular-nums">{r.completedOrders} đơn</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Mở POS → tab <span className="font-semibold text-gray-600">Đơn đối tác</span> →{" "}
                    <span className="font-semibold text-gray-600">{style.label}</span> → nhấn{" "}
                    <span className="font-semibold text-gray-600">Sync doanh thu</span> để đồng bộ.
                    Tự động sync lúc 23:50 hàng ngày.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, unit, dimmed }: { label: string; value: string; unit?: string; dimmed?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`mt-0.5 text-sm font-black tabular-nums ${dimmed ? "text-gray-400" : "text-[#1a3c34]"}`}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-medium text-gray-400">{unit}</span>}
      </p>
    </div>
  );
}
