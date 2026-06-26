"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, CardContent, Table, Text } from "@heroui/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { adminKeys } from "@/services/admin/keys";
import { fetchTaxReports, fetchTaxOverview } from "@/services/admin/taxes-api";
import { formatVnd } from "@/lib/product-display";
import { OrderDateRangePicker } from "@/app/orders/components/OrderDateRangePicker";
import { DatePresetPills, SourceFilterPills } from "./TaxQuickFilters";

function monthsAgoStr(n: number) {
  const d = new Date(Date.now() + 7 * 3600_000);
  d.setUTCMonth(d.getUTCMonth() - n);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function todayStr() {
  const d = new Date(Date.now() + 7 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function TaxReportsTab() {
  const [from, setFrom] = useState(() => monthsAgoStr(1));
  const [to, setTo] = useState(todayStr);
  const [groupBy, setGroupBy] = useState<"day" | "month">("day");
  const [type, setType] = useState("");

  const { data: rows, isLoading: rowsLoading } = useQuery({
    queryKey: adminKeys.taxReports(from, to, groupBy, type),
    queryFn: () => fetchTaxReports({ from, to, groupBy, type: type || undefined }),
  });

  const { data: overview } = useQuery({
    queryKey: adminKeys.taxOverview(from, to, type),
    queryFn: () => fetchTaxOverview({ from, to, type: type || undefined }),
  });

  const totalRevenue = rows?.reduce((s, r) => s + r.revenue, 0) ?? 0;
  const totalVat = rows?.reduce((s, r) => s + r.vatAmount, 0) ?? 0;
  const totalOrders = rows?.reduce((s, r) => s + r.orderCount, 0) ?? 0;

  function fmtPeriod(p: string) {
    const parts = p.split("-");
    if (groupBy === "month") return `${parts[1]}/${parts[0]}`;
    return `${parts[2]}/${parts[1]}`;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <Card className="rounded-2xl border border-black/6 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Khoảng thời gian
              </span>
              <DatePresetPills from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Nguồn đơn
              </span>
              <SourceFilterPills value={type} onChange={setType} />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-80">
              <OrderDateRangePicker
                label="Tuỳ chỉnh khoảng ngày"
                from={from}
                to={to}
                onRangeChange={(f, t) => { setFrom(f); setTo(t); }}
                className="w-full"
              />
            </div>
            <div className="flex overflow-hidden rounded-full border border-black/10 bg-white text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <Button
                size="sm"
                variant={groupBy === "day" ? "primary" : "ghost"}
                className={groupBy === "day" ? "rounded-full bg-[#1a3c34] font-semibold text-white" : "rounded-full text-foreground/60"}
                onPress={() => setGroupBy("day")}
              >
                Theo ngày
              </Button>
              <Button
                size="sm"
                variant={groupBy === "month" ? "primary" : "ghost"}
                className={groupBy === "month" ? "rounded-full bg-[#1a3c34] font-semibold text-white" : "rounded-full text-foreground/60"}
                onPress={() => setGroupBy("month")}
              >
                Theo tháng
              </Button>
            </div>
            {rowsLoading && (
              <Text className="text-xs italic text-foreground/40">Đang tải…</Text>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Tổng đơn hàng", value: rowsLoading ? "—" : String(totalOrders), color: "text-foreground" },
          { label: "Doanh thu (paid)", value: rowsLoading ? "—" : formatVnd(totalRevenue), color: "text-emerald-700" },
          { label: "Thuế GTGT", value: rowsLoading ? "—" : formatVnd(totalVat), color: "text-blue-700" },
        ].map((s) => (
          <Card key={s.label} className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="p-4">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">{s.label}</Text>
              <p className={`mt-1 text-lg font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bar chart */}
      {rows && rows.length > 0 && (
        <>
          <Card className="rounded-2xl border border-black/6 bg-[#f9fafb] shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <Text className="mb-4 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Doanh thu & Thuế GTGT theo kỳ
              </Text>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={rows.map((r) => ({
                    period: fmtPeriod(r.period),
                    revenue: r.revenue,
                    vat: r.vatAmount,
                  }))}
                  margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11, fill: "rgba(0,0,0,0.45)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "rgba(0,0,0,0.45)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}tr` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(v)}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatVnd(Number(value ?? 0)),
                      name === "revenue" ? "Doanh thu" : "Thuế GTGT",
                    ]}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid rgba(0,0,0,0.08)",
                      fontSize: "12px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    }}
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  />
                  <Legend
                    formatter={(value) => value === "revenue" ? "Doanh thu" : "Thuế GTGT"}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  />
                  <Bar dataKey="revenue" fill="#059669" radius={[4, 4, 0, 0]} name="revenue" />
                  <Bar dataKey="vat" fill="#2563eb" radius={[4, 4, 0, 0]} name="vat" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Data table */}
          <Card className="overflow-hidden rounded-2xl border border-black/6 shadow-sm">
            <Table.Root aria-label="Báo cáo thuế theo kỳ">
              <Table.ScrollContainer>
                <Table.Content>
                  <Table.Header>
                    <Table.Column isRowHeader className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Kỳ
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Đơn hàng
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Doanh thu (paid)
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Thuế GTGT
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Tỷ lệ VAT
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {rows.map((r) => {
                      const vatPct = r.revenue > 0 ? (r.vatAmount / r.revenue) * 100 : 0;
                      return (
                        <Table.Row key={r.period}>
                          <Table.Cell className="px-5 py-3 font-medium tabular-nums">
                            {fmtPeriod(r.period)}
                          </Table.Cell>
                          <Table.Cell className="px-5 py-3 text-right tabular-nums text-foreground/70">
                            {r.orderCount}
                          </Table.Cell>
                          <Table.Cell className="px-5 py-3 text-right font-medium tabular-nums">
                            {formatVnd(r.revenue)}
                          </Table.Cell>
                          <Table.Cell className="px-5 py-3 text-right font-medium tabular-nums text-blue-700">
                            {r.vatAmount > 0 ? formatVnd(r.vatAmount) : <span className="text-foreground/25">—</span>}
                          </Table.Cell>
                          <Table.Cell className="px-5 py-3 text-right tabular-nums text-foreground/55">
                            {vatPct > 0 ? `${vatPct.toFixed(2)}%` : <span className="text-foreground/25">—</span>}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
              {/* Footer totals */}
              <CardContent className="border-t-2 border-black/10 bg-[#f9fafb] px-5 py-3">
                <div className="grid grid-cols-5 text-xs font-semibold">
                  <span className="text-foreground/50 uppercase tracking-wide">Tổng kỳ</span>
                  <span className="text-right tabular-nums">{totalOrders}</span>
                  <span className="text-right tabular-nums">{formatVnd(totalRevenue)}</span>
                  <span className="text-right tabular-nums text-blue-700">{formatVnd(totalVat)}</span>
                  <span className="text-right tabular-nums text-foreground/55">
                    {totalRevenue > 0 ? `${((totalVat / totalRevenue) * 100).toFixed(2)}%` : "—"}
                  </span>
                </div>
              </CardContent>
            </Table.Root>
          </Card>
        </>
      )}

      {rows && rows.length === 0 && !rowsLoading && (
        <Card className="rounded-2xl border border-dashed border-black/12">
          <CardContent className="py-12 text-center">
            <Text className="text-sm text-foreground/40">
              Không có dữ liệu trong khoảng thời gian này.
            </Text>
          </CardContent>
        </Card>
      )}

      {/* Reconciliation */}
      {overview && (
        <Card className={`rounded-2xl border shadow-sm ${Math.abs(overview.reconciliationDiff) < 1 ? "border-emerald-200/80 bg-emerald-50/40" : "border-amber-200/80 bg-amber-50/40"}`}>
          <CardContent className="p-5">
            <Text className="mb-3 text-sm font-semibold text-foreground">Đối soát doanh thu</Text>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="rounded-xl border border-black/6 bg-white">
                <CardContent className="p-3">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Doanh thu đơn paid
                  </Text>
                  <p className="mt-1 font-bold tabular-nums">{formatVnd(overview.totalRevenue)}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border border-black/6 bg-white">
                <CardContent className="p-3">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Thanh toán ghi nhận
                  </Text>
                  <p className="mt-1 font-bold tabular-nums">{formatVnd(overview.paymentsTotal)}</p>
                </CardContent>
              </Card>
              <Card className={`rounded-xl border ${Math.abs(overview.reconciliationDiff) < 1 ? "border-emerald-200/80 bg-emerald-50" : "border-amber-200/80 bg-amber-50"}`}>
                <CardContent className="p-3">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Chênh lệch
                  </Text>
                  <p className={`mt-1 font-bold tabular-nums ${Math.abs(overview.reconciliationDiff) < 1 ? "text-emerald-700" : "text-amber-700"}`}>
                    {overview.reconciliationDiff >= 0 ? "+" : ""}
                    {formatVnd(overview.reconciliationDiff)}
                  </p>
                </CardContent>
              </Card>
            </div>
            {Math.abs(overview.reconciliationDiff) >= 1 && (
              <Text className="mt-3 text-xs text-amber-700">
                Có chênh lệch — kiểm tra các đơn hàng chưa có giao dịch thanh toán ghi nhận hoặc giao dịch chưa khớp mã đơn.
              </Text>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
