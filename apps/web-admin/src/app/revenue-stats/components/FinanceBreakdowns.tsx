import { formatVnd } from "@/lib/product-display";
import type { FinanceSplitRow, FinanceSummary } from "@/services/admin/types";
import { Empty, Panel, Skeleton } from "@/components/common/FinanceModule";

export function SplitCard({
    eyebrow, rows, labels,
}: { eyebrow: string; rows?: FinanceSplitRow[]; labels?: Record<string, string> }) {
    const total = (rows ?? []).reduce((s, r) => s + r.totalCollected, 0);
    return (
        <Panel eyebrow={eyebrow}>
            {!rows ? <Skeleton h={100} /> : rows.length === 0 ? (
                <Empty h={80}>Chưa có dữ liệu.</Empty>
            ) : (
                <div className="flex flex-col gap-3">
                    {rows.map((r) => {
                        const pct = total > 0 ? (r.totalCollected / total) * 100 : 0;
                        return (
                            <div key={r.key} className="flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="truncate font-semibold text-foreground/75">{labels?.[r.key] ?? r.key}</span>
                                    <span className="shrink-0 tabular-nums text-foreground/60">
                                        {formatVnd(r.totalCollected)} · {r.orders} đơn
                                    </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.05]">
                                    <div className="h-full rounded-full bg-[#5a8f7a]" style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Panel>
    );
}

export function RevenueStructure({ s }: { s?: FinanceSummary }) {
    const rows = s && [
        ["Doanh thu hàng", formatVnd(s.goodsRevenue), ""],
        ["Giảm giá đơn (voucher, nhóm, POS)", `− ${formatVnd(s.orderDiscount)}`, "text-red-600"],
        ["Giảm bằng điểm", `− ${formatVnd(s.pointDiscount)}`, "text-red-600"],
        ["Phí ship", `+ ${formatVnd(s.shippingFee)}`, ""],
    ] as const;

    return (
        <Panel eyebrow="Cơ cấu thu" hint="Từ doanh thu hàng đến tiền khách thực trả">
            {!s || !rows ? <Skeleton h={160} /> : (
                <div className="flex flex-col gap-2 text-sm">
                    {rows.map(([label, val, cls]) => (
                        <div key={label} className="flex items-center justify-between gap-2">
                            <span className="text-foreground/60">{label}</span>
                            <span className={`font-semibold tabular-nums ${cls || "text-foreground/80"}`}>{val}</span>
                        </div>
                    ))}
                    <div className="mt-1 flex items-center justify-between border-t border-black/[0.06] pt-2">
                        <span className="font-semibold text-foreground/80">Tổng thu</span>
                        <span className="font-bold tabular-nums text-[#1a3c34]">{formatVnd(s.totalCollected)}</span>
                    </div>
                    <p className="text-[11px] text-foreground/45">
                        Tỉ lệ giảm giá {s.discountRatePercent}% · VAT đã gồm trong giá {formatVnd(s.vatIncluded)}
                    </p>
                    {Math.abs(s.reconcileDiff) > 0 && (
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800 ring-1 ring-amber-200/80">
                            Lệch đối soát {formatVnd(s.reconcileDiff)} giữa Σ finalAmount và (hàng − giảm giá − điểm + ship). Nên kiểm tra các đơn nhập tay / đơn ngoài.
                        </p>
                    )}
                </div>
            )}
        </Panel>
    );
}