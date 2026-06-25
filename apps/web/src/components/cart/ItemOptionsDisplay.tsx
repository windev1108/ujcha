import type { ApiCartItem } from "@/services/cart/types";
import { normalizeOptionGroups, formatOptionLabel } from "@/lib/product-options";
import { useLocale } from "next-intl";
import { getDisplayName, getValueLabel } from "@/lib/product-name";
import { StickyNote } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

type Props = {
  item: Pick<ApiCartItem, "product" | "selectedOptions" | "toppings" | "note">;
};

export function ItemOptionsDisplay({ item }: Props) {
  const locale = useLocale();
  const groups = normalizeOptionGroups(item.product.optionGroups);

  const optionPills = groups
    .map((g) => {
      const val = item.selectedOptions[g.name] ?? item.selectedOptions[g.id];
      if (!val) return null;
      const v = g.values.find((vv) => vv.label === val);
      return {
        key: val,
        groupName: getDisplayName(g, locale),
        label: v ? getValueLabel(v, locale) : val,
        delta: v?.priceDelta ?? 0,
      };
    })
    .filter(Boolean) as { key: string; groupName: string; label: string; delta: number }[];

  const toppingPills = (item.toppings ?? []).map((t) => ({
    name: getDisplayName(t.topping, locale),
    price: parseFloat(t.topping.price),
  }));

  const note = item.note?.trim();

  if (optionPills.length === 0 && toppingPills.length === 0 && !note) return null;

  return (
    <div className="mt-1.5 space-y-1.5">
      {(optionPills.length > 0 || toppingPills.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {optionPills.map((p) => (
            <span
              key={p.key}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                p.delta > 0
                  ? "bg-kun-mint/20 text-kun-products-forest"
                  : "bg-surface-secondary text-foreground/70"
              }`}
            >
              {formatOptionLabel(p.groupName, p.label, locale)}
              {p.delta > 0 && (
                <span className="text-[10px] text-kun-products-forest/60">+{fmt(p.delta)}</span>
              )}
            </span>
          ))}
          {toppingPills.map((t) => (
            <span
              key={t.name}
              className="inline-flex items-center gap-1 rounded-full bg-kun-mint/20 px-2.5 py-0.5 text-[11px] font-medium text-kun-products-forest"
            >
              + {t.name}
              <span className="text-[10px] text-kun-products-forest/60">+{fmt(t.price)}</span>
            </span>
          ))}
        </div>
      )}
      {note && (
        <p className="flex items-center gap-1 text-[11px] text-muted italic">
          <StickyNote className="size-3 shrink-0 text-muted/70" />
          {note}
        </p>
      )}
    </div>
  );
}
