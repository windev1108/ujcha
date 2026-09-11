import { FlaskConical, Sparkle } from 'lucide-react'
import type { ResolvedRecipe } from '../types/common'

function formatQty(n: number): string {
    if (!Number.isFinite(n)) return '—'
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

export function RecipeChecklist({
    recipe,
    quantity,
    sizeLabel,
}: {
    recipe: ResolvedRecipe | undefined
    quantity: number
    /** Nhãn size/biến thể hiển thị ở tiêu đề, vd "Size L" */
    sizeLabel?: string
}) {
    if (!recipe || !recipe.matched) {
        return (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] italic text-gray-400">
                <FlaskConical className="size-3 shrink-0" />
                Chưa import công thức cho món này
            </div>
        )
    }

    const rows = [
        ...(recipe.items ?? []).map((i) => ({ ...i, isTopping: false as const })),
        ...(recipe.toppingItems ?? []).map((t) => ({
            id: t.id,
            ingredientId: t.ingredientId,
            ingredientName: `${t.ingredientName} (${t.toppingName})`,
            unit: t.unit,
            quantity: t.quantity,
            isTopping: true as const,
        })),
    ]

    if (rows.length === 0) {
        return (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] italic text-gray-400">
                <FlaskConical className="size-3 shrink-0" />
                Chưa cấu hình định lượng cho biến thể này
            </div>
        )
    }

    return (
        <div className="mt-2 overflow-hidden rounded-xl border border-teal-100 bg-teal-50/50">
            <div className="flex items-center gap-1.5 bg-teal-100/50 px-3 py-1.5">
                <FlaskConical className="size-3 shrink-0 text-teal-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                    Công thức pha chế{sizeLabel ? ` · ${sizeLabel}` : ''}
                </span>
            </div>
            <div className="space-y-1 px-3 py-2">
                {rows.map((row) => {
                    const perUnit = Number(row.quantity)
                    const total = perUnit * quantity
                    return (
                        <div key={row.id} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-gray-700">
                                {row.isTopping && <Sparkle className="size-3 shrink-0 text-emerald-500" />}
                                {row.ingredientName}
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums text-gray-800">
                                {formatQty(perUnit)} {row.unit}
                                {quantity > 1 && (
                                    <span className="ml-1 text-[10px] font-normal text-gray-400">
                                        (×{quantity} = {formatQty(total)} {row.unit})
                                    </span>
                                )}
                            </span>
                        </div>
                    )
                })}
            </div>
            {recipe.recipeNote && (
                <div className="border-t border-teal-100 px-3 py-1.5 text-[11px] italic text-teal-700">
                    Ghi chú: {recipe.recipeNote}
                </div>
            )}
        </div>
    )
}