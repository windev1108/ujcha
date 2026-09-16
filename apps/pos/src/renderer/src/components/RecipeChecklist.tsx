import { FlaskConical, NotepadText, Sparkle } from 'lucide-react'
import type { ResolvedRecipe } from '../types/common'

function formatQty(n: number): string {
    if (!Number.isFinite(n)) return '—'
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

/// Gom toàn bộ điều kiện đã khớp trong các dòng recipe thành 1 chuỗi hiển thị header,
/// vd: "Trà Lài · Size L · Đường 70%". Khử trùng theo group (ưu tiên giá trị xuất hiện trước).
function buildVariantLabel(items: { conditions: { group: string; value: string }[] }[] | undefined): string | null {
    if (!items || items.length === 0) return null
    const byGroup = new Map<string, string>()
    for (const item of items) {
        for (const c of item.conditions ?? []) {
            if (!byGroup.has(c.group)) byGroup.set(c.group, c.value)
        }
    }
    if (byGroup.size === 0) return null
    return [...byGroup.values()].join(' · ')
}

export function RecipeChecklist({
    recipe,
    quantity,
    sizeLabel,
}: {
    recipe: ResolvedRecipe | undefined
    quantity: number
    /** Fallback khi recipe chưa có items nào mang conditions (hiếm khi cần) */
    sizeLabel?: string
}) {
    if (!recipe || !recipe.matched) {
        return (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm italic text-gray-400">
                <FlaskConical className="size-3.5 shrink-0" />
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
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm italic text-gray-400">
                <FlaskConical className="size-3.5 shrink-0" />
                Chưa cấu hình định lượng cho biến thể này
            </div>
        )
    }

    const variantLabel = buildVariantLabel(recipe.items) ?? sizeLabel

    return (
        <div className="mt-2 overflow-hidden rounded-xl border border-teal-100 bg-teal-50/50">
            <div className="flex items-center gap-2 bg-teal-100/50 px-3.5 py-2">
                <FlaskConical className="size-3.5 shrink-0 text-teal-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
                    Công thức{variantLabel ? ` · ${variantLabel}` : ''}
                </span>
            </div>
            <div className="space-y-1.5 px-3.5 py-2.5">
                {rows.map((row) => {
                    const perUnit = Number(row.quantity)
                    const total = perUnit * quantity
                    return (
                        <div key={row.id} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5 text-gray-700">
                                {row.isTopping && <Sparkle className="size-3.5 shrink-0 text-emerald-500" />}
                                {row.ingredientName}
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums text-gray-800">
                                {formatQty(perUnit)} {row.unit}
                                {quantity > 1 && (
                                    <span className="ml-1 text-xs font-normal text-gray-400">
                                        (×{quantity} = {formatQty(total)} {row.unit})
                                    </span>
                                )}
                            </span>
                        </div>
                    )
                })}
            </div>
            {recipe.recipeNote && (
                <div className="flex items-center gap-2 border-t border-teal-100 px-3.5 py-2 italic text-teal-700">
                    <NotepadText className='size-5' />
                    <span className='text-sm whitespace-pre-line'>{recipe.recipeNote}</span>
                </div>
            )}
        </div>
    )
}