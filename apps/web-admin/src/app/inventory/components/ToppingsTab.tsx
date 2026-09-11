"use client";

import { Card, CardContent, Input, Switch } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageX, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { adminKeys } from "@/services/admin/keys";
import {
  fetchAdminToppings,
  setAdminToppingOutOfStock,
} from "@/services/admin/toppings-api";

export function ToppingsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: toppings = [], isLoading } = useQuery({
    queryKey: adminKeys.toppings,
    queryFn: fetchAdminToppings,
  });

  const toggleMut = useMutation({
    mutationFn: (p: { name: string; isOutOfStock: boolean }) =>
      setAdminToppingOutOfStock(p.name, p.isOutOfStock),
    // Optimistic update — bật/tắt phản hồi ngay, không đợi network
    onMutate: async (p) => {
      await queryClient.cancelQueries({ queryKey: adminKeys.toppings });
      const prev = queryClient.getQueryData(adminKeys.toppings);
      queryClient.setQueryData(adminKeys.toppings, (old: any) =>
        (old ?? []).map((t: any) =>
          t.name === p.name ? { ...t, isOutOfStock: p.isOutOfStock } : t,
        ),
      );
      return { prev };
    },
    onError: (_err, _p, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(adminKeys.toppings, ctx.prev);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: adminKeys.toppings }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return toppings;
    return toppings.filter((t) => t.name.toLowerCase().includes(q));
  }, [toppings, search]);

  const outOfStockCount = toppings.filter((t) => t.isOutOfStock).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-[#1a3c34]">Topping hết hàng (toàn shop)</h2>
        <p className="text-sm text-foreground/50">
          Bật &quot;Hết hàng&quot; cho 1 tên topping — mọi sản phẩm có topping trùng tên sẽ tự ẩn
          topping đó trên app khách, không cần vào từng sản phẩm để tắt.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1 max-w-sm">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground/35"
            aria-hidden
          />
          <Input
            aria-label="Tìm topping"
            placeholder="Tìm theo tên topping…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-full border border-black/10 bg-white pl-10 pr-4 text-sm shadow-sm"
          />
        </div>
        {outOfStockCount > 0 && (
          <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-600/15">
            {outOfStockCount} topping đang hết hàng
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col divide-y divide-black/6 overflow-hidden rounded-2xl border border-black/6 bg-white">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3.5">
              <div className="h-4 w-40 animate-pulse rounded-lg bg-black/[0.06]" />
              <div className="h-5 w-9 animate-pulse rounded-full bg-black/[0.06]" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-[#fafafa] py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#f0f6f4]">
            <PackageX className="size-6 text-[#5a8f7a]" />
          </div>
          <p className="text-base font-semibold text-foreground">
            {toppings.length === 0 ? "Chưa có topping nào" : "Không tìm thấy topping nào"}
          </p>
          <p className="mt-1 text-sm text-foreground/50">
            {toppings.length === 0
              ? "Topping được lấy từ danh sách topping của tất cả sản phẩm."
              : "Thử từ khoá khác."}
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden rounded-2xl border border-black/6 shadow-sm">
          <CardContent className="flex flex-col divide-y divide-black/6 p-0">
            {filtered.map((t) => (
              <div
                key={t.nameKey}
                className={`flex items-center justify-between gap-4 px-5 py-3.5 transition-colors ${
                  t.isOutOfStock ? "bg-amber-50/50" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      t.isOutOfStock
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {t.isOutOfStock ? "Hết hàng" : "Còn hàng"}
                  </span>
                  <Switch
                    isSelected={t.isOutOfStock}
                    onChange={(v) => toggleMut.mutate({ name: t.name, isOutOfStock: v })}
                    isDisabled={toggleMut.isPending}
                    aria-label={`Đánh dấu ${t.name} hết hàng`}
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}