"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { formatVnd } from "@/lib/product-display";
import { fetchAdminCustomerStats, fetchAdminFinanceStats } from "@/services/admin/finance-api"; // chỉnh lại path cho đúng file bạn đặt hàm này

import { CategoriesTable, LowPerformers, ProductsTable, UncostedIngredients } from "./FinanceTables";
import { RevenueStructure, SplitCard } from "./FinanceBreakdowns";
import { DailyTrendChart, HourlyChart } from "./FinanceTrendCharts";
import { DeltaBadge, KpiCard, Segmented } from "@/components/common/FinanceModule";
import { addDays, CHANNEL_LABEL, deltaPercent, diffDays, ORDER_TYPE_LABEL, PAYMENT_LABEL, UNCOSTED_REASON_LABEL, vnToday } from "@/lib/finance-utils";
import { CustomerInsights } from "./CustomerInsights";


type RangeKey = "7" | "30" | "90" | "custom";

export function FinanceStatsTab() {
  const [range, setRange] = useState<RangeKey>("30");
  const [customFrom, setCustomFrom] = useState(() => addDays(vnToday(), -29));
  const [customTo, setCustomTo] = useState(() => vnToday());

  const { from, to } = useMemo(() => {
    if (range === "custom") return { from: customFrom, to: customTo };
    const t = vnToday();
    return { from: addDays(t, -(Number(range) - 1)), to: t };
  }, [range, customFrom, customTo]);

  const rangeValid = !!from && !!to && from <= to && diffDays(from, to) <= 365;

  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: ["admin", "stats", "finance", from, to],
    queryFn: () => fetchAdminFinanceStats({ from, to }),
    enabled: rangeValid,
    placeholderData: keepPreviousData,
  });
  const { data: customerData } = useQuery({
    queryKey: ["admin", "stats", "customers", from, to],
    queryFn: () => fetchAdminCustomerStats({ from, to }),
    enabled: rangeValid,
    placeholderData: keepPreviousData,
  });
  const s = data?.summary;
  const p = data?.previous.summary;
  const d = (cur?: number, prev?: number) =>
    cur === undefined || prev === undefined ? null : deltaPercent(cur, prev);
  const marginDelta =
    s?.grossMarginPercent != null && p?.grossMarginPercent != null
      ? Math.round((s.grossMarginPercent - p.grossMarginPercent) * 10) / 10
      : null;
  const discountTotal = s ? s.orderDiscount + s.pointDiscount : 0;
  const prevDiscountTotal = p ? p.orderDiscount + p.pointDiscount : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Bộ lọc */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/50">
          {rangeValid ? `${from} → ${to}` : "Khoảng thời gian không hợp lệ (tối đa 366 ngày)."}
          {isFetching && <span className="ml-2 text-foreground/35">đang tải…</span>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {range === "custom" && (
            <div className="flex items-center gap-1.5 text-xs">
              <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 rounded-lg border border-black/10 bg-white px-2" />
              <span className="text-foreground/40">→</span>
              <input type="date" value={customTo} min={customFrom} max={vnToday()} onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 rounded-lg border border-black/10 bg-white px-2" />
            </div>
          )}
          <Segmented value={range} onChange={setRange}
            options={[["7", "7 ngày"], ["30", "30 ngày"], ["90", "90 ngày"], ["custom", "Tuỳ chọn"]]} />
        </div>
      </div>

      {isError && (
        <div className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          Không tải được thống kê.
          <button type="button" onClick={() => refetch()} className="font-semibold underline">Thử lại</button>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Tổng thu" value={s ? formatVnd(s.totalCollected) : null}
          delta={<DeltaBadge value={d(s?.totalCollected, p?.totalCollected)} />} />
        <KpiCard label="Doanh thu hàng (sau giảm giá)" value={s ? formatVnd(s.netGoodsRevenue) : null}
          delta={<DeltaBadge value={d(s?.netGoodsRevenue, p?.netGoodsRevenue)} />} />
        <KpiCard label="Số đơn" value={s ? s.orders.toLocaleString("vi-VN") : null} accent="text-foreground/80"
          delta={<DeltaBadge value={d(s?.orders, p?.orders)} />} />
        <KpiCard label="Giá trị TB / đơn" value={s ? formatVnd(s.avgOrderValue) : null} accent="text-foreground/80"
          delta={<DeltaBadge value={d(s?.avgOrderValue, p?.avgOrderValue)} />} />
        <KpiCard label="Giá vốn ước tính" value={s ? formatVnd(s.cogs) : null} accent="text-foreground/70"
          delta={<DeltaBadge value={d(s?.cogs, p?.cogs)} invert />} />
        <KpiCard label="Lợi nhuận gộp" value={s ? formatVnd(s.grossProfit) : null}
          accent={s && s.grossProfit < 0 ? "text-red-600" : "text-emerald-700"}
          delta={<DeltaBadge value={d(s?.grossProfit, p?.grossProfit)} />} />
        <KpiCard label="Biên lợi nhuận" value={s ? (s.grossMarginPercent != null ? `${s.grossMarginPercent}%` : "—") : null}
          delta={<DeltaBadge value={marginDelta} unit="pt" />} />
        <KpiCard label="Tổng giảm giá (đơn + điểm)" value={s ? formatVnd(discountTotal) : null} accent="text-amber-700"
          delta={<DeltaBadge value={d(discountTotal, prevDiscountTotal)} invert />} />
      </div>

      {/* Cảnh báo độ phủ giá vốn */}
      {s && s.goodsRevenue > 0 && s.costCoveragePercent < 100 && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 ring-1 ring-amber-200/80">
          Giá vốn và lợi nhuận mới tính được cho <b>{s.costCoveragePercent}%</b> doanh thu hàng
          {s.uncostedQuantity > 0 && (
            <>
              {" "}({s.uncostedQuantity.toLocaleString("vi-VN")} món chưa tính được:{" "}
              {Object.entries(s.uncostedReasons)
                .map(([k, n]) => `${UNCOSTED_REASON_LABEL[k] ?? k} ${n}`)
                .join(" · ")})
            </>
          )}
          . Giá vốn ước tính theo công thức và giá vốn hiện tại; lợi nhuận đã trừ giảm giá đơn và điểm (phân bổ theo tỉ lệ), chưa trừ phí ship.
        </div>
      )}

      <DailyTrendChart daily={data?.daily} />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <HourlyChart byHour={data?.byHour} />
        <RevenueStructure s={s} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SplitCard eyebrow="Theo kênh" rows={data?.byChannel} labels={CHANNEL_LABEL} />
        <SplitCard eyebrow="Theo loại đơn" rows={data?.byOrderType} labels={ORDER_TYPE_LABEL} />
        <SplitCard eyebrow="Theo thanh toán" rows={data?.byPaymentType} labels={PAYMENT_LABEL} />
      </div>

      <CustomerInsights data={customerData} />
      <ProductsTable products={data?.products} />
      <CategoriesTable categories={data?.categories} />

      <div className="grid gap-4 lg:grid-cols-2">
        <LowPerformers rows={data?.lowPerformers} />
        <UncostedIngredients rows={data?.uncostedIngredients} />
      </div>
    </div>
  );
}