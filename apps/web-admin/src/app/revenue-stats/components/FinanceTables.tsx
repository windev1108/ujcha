"use client";

import { useMemo, useState } from "react";

import { formatVnd } from "@/lib/product-display";
import type { FinanceCategoryRow, FinanceProductRow, FinanceStats } from "@/services/admin/types";
import { Empty, Panel, Segmented, Skeleton } from "@/components/common/FinanceModule";

type SortKey = "goodsRevenue" | "quantitySold" | "grossProfit" | "marginPercent";

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`whitespace-nowrap px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-foreground/45 ${right ? "text-right" : "text-left"}`}>
    {children}
  </th>
);
const Td = ({ children, cls = "" }: { children: React.ReactNode; cls?: string }) => (
  <td className={`px-2 py-2.5 text-right text-xs tabular-nums ${cls}`}>{children}</td>
);

function ProfitCells({ r }: { r: FinanceProductRow | FinanceCategoryRow }) {
  return (
    <>
      <Td cls="text-foreground/60">{formatVnd(r.cogs)}</Td>
      <Td cls={r.grossProfit < 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>{formatVnd(r.grossProfit)}</Td>
      <Td cls="text-foreground/70">{r.marginPercent != null ? `${r.marginPercent}%` : "—"}</Td>
      <Td cls={r.costCoveragePercent < 80 ? "font-semibold text-amber-700" : "text-foreground/60"}>{r.costCoveragePercent}%</Td>
    </>
  );
}

export function ProductsTable({ products }: { products?: FinanceProductRow[] }) {
  const [sort, setSort] = useState<SortKey>("goodsRevenue");
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => {
    const list = [...(products ?? [])].sort((a, b) => (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity));
    return expanded ? list : list.slice(0, 10);
  }, [products, sort, expanded]);

  return (
    <Panel
      eyebrow="Sản phẩm"
      hint={sort === "grossProfit" || sort === "marginPercent" ? "Lợi nhuận/biên chỉ tính phần đã có giá vốn — xem cột phủ giá vốn" : "Top theo doanh thu hàng"}
      right={
        <Segmented value={sort} onChange={setSort} options={[
          ["goodsRevenue", "Doanh thu"], ["quantitySold", "Số lượng"], ["grossProfit", "Lợi nhuận"], ["marginPercent", "Biên"],
        ]} />
      }
    >
      {!products ? <Skeleton h={240} /> : products.length === 0 ? <Empty>Chưa có dữ liệu.</Empty> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-black/[0.06]">
                  <Th>Món</Th><Th right>SL</Th><Th right>Doanh thu</Th><Th right>Giá vốn</Th>
                  <Th right>Lợi nhuận</Th><Th right>Biên</Th><Th right>Phủ giá vốn</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {rows.map((p) => (
                  <tr key={p.productId}>
                    <td className="max-w-[220px] px-2 py-2.5">
                      <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                      <p className="text-[11px] text-foreground/45">{p.categoryName}</p>
                    </td>
                    <Td cls="font-bold text-[#1a3c34]">{p.quantitySold}</Td>
                    <Td cls="text-foreground/70">{formatVnd(p.goodsRevenue)}</Td>
                    <ProfitCells r={p} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {products.length > 10 && (
            <button type="button" onClick={() => setExpanded((v) => !v)}
              className="self-center text-xs font-semibold text-[#5a8f7a] hover:text-[#1a3c34]">
              {expanded ? "Thu gọn" : `Xem thêm (${products.length - 10})`}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}

export function CategoriesTable({ categories }: { categories?: FinanceCategoryRow[] }) {
  return (
    <Panel eyebrow="Danh mục" hint="Sắp xếp theo doanh thu hàng">
      {!categories ? <Skeleton h={160} /> : categories.length === 0 ? <Empty>Chưa có dữ liệu.</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px]">
            <thead>
              <tr className="border-b border-black/[0.06]">
                <Th>Danh mục</Th><Th right>SL</Th><Th right>Doanh thu</Th><Th right>Giá vốn</Th>
                <Th right>Lợi nhuận</Th><Th right>Biên</Th><Th right>Phủ giá vốn</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05]">
              {categories.map((c) => (
                <tr key={c.categoryId}>
                  <td className="px-2 py-2.5 text-sm font-semibold text-foreground">{c.categoryName}</td>
                  <Td cls="font-bold text-[#1a3c34]">{c.quantitySold}</Td>
                  <Td cls="text-foreground/70">{formatVnd(c.goodsRevenue)}</Td>
                  <ProfitCells r={c} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function LowPerformers({ rows }: { rows?: FinanceProductRow[] }) {
  return (
    <Panel eyebrow="Bán chậm nhất" hint="Cân nhắc khuyến mãi, đổi công thức hoặc ngừng bán">
      {!rows ? <Skeleton h={160} /> : rows.length === 0 ? <Empty h={120}>Chưa có dữ liệu.</Empty> : (
        <div className="flex flex-col divide-y divide-black/[0.05]">
          {rows.map((p) => (
            <div key={p.productId} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                <p className="text-[11px] text-foreground/45">{p.categoryName}</p>
              </div>
              <div className="flex shrink-0 gap-4 text-right">
                <div>
                  <p className="text-sm font-bold tabular-nums text-[#1a3c34]">{p.quantitySold}</p>
                  <p className="text-[10px] text-foreground/45">món</p>
                </div>
                <div>
                  <p className="text-sm font-bold tabular-nums text-foreground/70">{formatVnd(p.goodsRevenue)}</p>
                  <p className="text-[10px] text-foreground/45">doanh thu</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function UncostedIngredients({ rows }: { rows?: FinanceStats["uncostedIngredients"] }) {
  if (rows && rows.length === 0) return null; // đủ giá vốn → ẩn thẻ
  return (
    <Panel eyebrow="Nguyên liệu thiếu giá vốn" hint="Bổ sung giá vốn các nguyên liệu này để tăng độ phủ lợi nhuận">
      {!rows ? <Skeleton h={120} /> : (
        <div className="flex flex-col divide-y divide-black/[0.05]">
          {rows.map((m) => (
            <div key={m.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="truncate font-semibold text-foreground">{m.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-foreground/60">
                {m.quantity.toLocaleString("vi-VN")} món ảnh hưởng · {formatVnd(m.revenue)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}