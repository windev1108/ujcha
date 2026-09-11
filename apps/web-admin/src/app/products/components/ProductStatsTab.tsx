"use client";

import { Card, CardContent } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatVnd } from "@/lib/product-display";
import { fetchAdminProductStats } from "@/services/admin/products-api";

const forest = "#1a3c34";
const grid = "rgba(0,0,0,0.06)";
const palette = ["#1a3c34", "#5a8f7a", "#d97706", "#dc2626", "#2563eb", "#7c3aed", "#0891b2", "#be185d"];

type RangeKey = "7" | "30" | "90";

function rangeToFrom(range: RangeKey): string {
  const days = Number.parseInt(range, 10);
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function ProductStatsTab() {
  const [range, setRange] = useState<RangeKey>("30");
  const [metric, setMetric] = useState<"revenue" | "quantity">("revenue");
  const from = useMemo(() => rangeToFrom(range), [range]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "products", "stats", range],
    queryFn: () => fetchAdminProductStats({ from, limit: 10 }),
  });

  const topList = metric === "revenue" ? data?.topByRevenue : data?.topByQuantity;
  const chartData = (topList ?? []).map((p) => ({
    name: p.name.length > 18 ? `${p.name.slice(0, 18)}…` : p.name,
    fullName: p.name,
    value: metric === "revenue" ? p.revenue : p.quantitySold,
  }));
  const categoryData = (data?.categoryBreakdown ?? []).map((c, i) => ({
    name: c.categoryName,
    value: c.revenue,
    color: palette[i % palette.length],
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/50">
          Thống kê bán hàng theo sản phẩm — dùng để cân đối kho, giá và khuyến mãi.
        </p>
        <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-black/10 bg-white p-1 shadow-sm">
          {(["7", "30", "90"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${range === r ? "bg-[#1a3c34] text-white shadow-sm" : "text-foreground/50 hover:text-foreground/80"}`}
            >
              {r} ngày
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            { label: "Doanh thu", value: data ? formatVnd(data.overview.totalRevenue) : null, accent: "text-[#1a3c34]" },
            { label: "Số món đã bán", value: data ? data.overview.totalQuantitySold.toLocaleString("vi-VN") : null, accent: "text-emerald-700" },
            { label: "Đơn hàng", value: data ? data.overview.totalOrders.toLocaleString("vi-VN") : null, accent: "text-blue-700" },
            { label: "TB / đơn", value: data ? formatVnd(data.overview.avgOrderValue) : null, accent: "text-amber-700" },
          ] as const
        ).map((s) => (
          <div key={s.label} className="flex flex-col gap-1 rounded-2xl border border-black/8 bg-white p-4">
            <span className={`text-lg font-bold tabular-nums sm:text-xl ${s.accent}`}>
              {isLoading || s.value === null ? (
                <span className="inline-block h-6 w-16 animate-pulse rounded-lg bg-black/8" />
              ) : (
                s.value
              )}
            </span>
            <span className="text-[11px] font-semibold text-foreground/55">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
          <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
                  Sản phẩm bán chạy
                </p>
                <p className="mt-1 text-sm text-foreground/60">
                  Top 10 theo {metric === "revenue" ? "doanh thu" : "số lượng"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-black/10 bg-white p-1 shadow-sm">
                {(
                  [
                    ["revenue", "Doanh thu"],
                    ["quantity", "Số lượng"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMetric(k)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${metric === k ? "bg-[#1a3c34] text-white" : "text-foreground/50 hover:text-foreground/80"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="h-[320px] animate-pulse rounded-xl bg-black/[0.04]" />
            ) : chartData.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-sm text-foreground/40">
                Chưa có đơn hàng đã thanh toán trong khoảng thời gian này.
              </div>
            ) : (
              <div className="h-[320px] w-full min-h-[320px]">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={grid} horizontal={false} />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                      tickFormatter={(v) => {
                        if (metric === "quantity") return String(v);
                        const n = Number(v);
                        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
                        if (n >= 1000) return `${Math.round(n / 1000)}k`;
                        return String(n);
                      }}
                    />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={140} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                    <Tooltip
                      cursor={{ fill: "rgba(0,0,0,0.03)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload as { fullName: string; value: number };
                        return (
                          <div style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", background: "#fff", padding: "10px 14px", boxShadow: "0 12px 40px -20px rgba(0,0,0,0.2)" }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: "#1a3c34" }}>{d.fullName}</p>
                            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                              {metric === "revenue" ? formatVnd(d.value) : `${d.value} món`}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14} fill={forest} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
          <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
                Doanh thu theo danh mục
              </p>
              <p className="mt-1 text-sm text-foreground/60">Tỉ trọng đóng góp doanh thu</p>
            </div>

            {isLoading ? (
              <div className="h-[240px] animate-pulse rounded-xl bg-black/[0.04]" />
            ) : categoryData.length === 0 ? (
              <div className="flex h-[160px] items-center justify-center text-sm text-foreground/40">Chưa có dữ liệu.</div>
            ) : (
              <>
                <div className="h-[200px] w-full min-h-[200px]">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                        {categoryData.map((c, i) => (
                          <Cell key={i} fill={c.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0]?.payload as { name: string; value: number };
                          return (
                            <div style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", background: "#fff", padding: "10px 14px", boxShadow: "0 12px 40px -20px rgba(0,0,0,0.2)" }}>
                              <p style={{ fontSize: 12, fontWeight: 700, color: "#1a3c34" }}>{d.name}</p>
                              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{formatVnd(d.value)}</p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-1.5">
                  {categoryData.map((c) => (
                    <div key={c.name} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5 text-foreground/70">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} />
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-foreground/70">{formatVnd(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
        <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">Bán chậm nhất</p>
            <p className="mt-1 text-sm text-foreground/60">
              Cân nhắc khuyến mãi, đổi công thức hoặc ngừng bán các món này.
            </p>
          </div>
          {isLoading ? (
            <div className="h-[160px] animate-pulse rounded-xl bg-black/[0.04]" />
          ) : !data || data.lowPerformers.length === 0 ? (
            <div className="flex h-[120px] items-center justify-center text-sm text-foreground/40">Chưa có dữ liệu.</div>
          ) : (
            <div className="flex flex-col divide-y divide-black/[0.05]">
              {data.lowPerformers.map((p) => (
                <div key={p.productId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                    <p className="text-[11px] text-foreground/45">{p.categoryName}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-right">
                    <div>
                      <p className="text-sm font-bold tabular-nums text-[#1a3c34]">{p.quantitySold}</p>
                      <p className="text-[10px] text-foreground/45">món</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold tabular-nums text-foreground/70">{formatVnd(p.revenue)}</p>
                      <p className="text-[10px] text-foreground/45">doanh thu</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}