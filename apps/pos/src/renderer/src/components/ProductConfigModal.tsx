import { useEffect, useState } from 'react'
import { X, Plus, Minus, Check } from 'lucide-react'
import type { Product, CartItem } from '../types/common'


function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }

type Props = {
    product: Product | null
    onClose: () => void
    onConfirm: (item: Omit<CartItem, 'cartId'>) => void
}

export function ProductConfigModal({ product, onClose, onConfirm }: Props) {
    const [options, setOptions] = useState<Record<string, string>>({})
    const [selectedToppingIds, setSelectedToppingIds] = useState<string[]>([])
    const [note, setNote] = useState('')
    const [quantity, setQuantity] = useState(1)

    useEffect(() => {
        if (!product) return
        setNote('')
        setQuantity(1)
        setSelectedToppingIds([])
        // Auto-select first (free) option per group
        const next: Record<string, string> = {}
        for (const g of product.optionGroups) {
            const free = g.values.find((v) => v.priceDelta === 0) ?? g.values[0]
            if (free) next[g.name] = free.label
        }
        setOptions(next)
    }, [product])

    if (!product) return null

    const base = parseFloat(product.price)
    const hasDiscount = product.discountPercent > 0
    const discountedBase = product.finalPrice ?? base

    const optionDelta = product.optionGroups.reduce((sum, g) => {
        const selected = g.values.find((v) => v.label === options[g.name])
        return sum + (selected?.priceDelta ?? 0)
    }, 0)

    const availableToppings = (product.toppings ?? []).filter(t => t.isActive !== false)
    const toppingDelta = selectedToppingIds.reduce((sum, id) => {
        const t = availableToppings.find(t => t.id === id)
        return sum + (t ? t.price : 0)
    }, 0)

    const unitPrice = discountedBase + optionDelta + toppingDelta

    const toggleTopping = (id: string) => {
        setSelectedToppingIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const handleConfirm = () => {
        // Validate all groups selected
        for (const g of product.optionGroups) {
            if (!options[g.name]) return
        }
        onConfirm({
            productId: product.id,
            name: product.name,
            basePrice: discountedBase,
            imageUrl: product.imageUrls[0] ?? null,
            quantity,
            options,
            optionDetails: product.optionGroups.map(g => {
                const selected = g.values.find(v => v.label === options[g.name])
                return {
                    group: g.name,
                    label: selected?.label ?? '',
                    priceDelta: selected?.priceDelta ?? 0,
                }
            }),
            optionDelta: optionDelta,
            note,
            extras: selectedToppingIds.map(id => {
                const t = availableToppings.find(t => t.id === id)
                return { id, name: t?.name ?? id, price: t?.price ?? 0 }
            }),
        })
        onClose()
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
                    <div className="min-w-0 pr-3">
                        <h2 className="text-base font-bold text-gray-900 leading-snug">{product.name}</h2>
                        <div className="mt-1 flex items-center gap-2">
                            <p className="text-sm font-bold text-brand">{fmt(discountedBase)}</p>
                            {hasDiscount && (
                                <>
                                    <p className="text-xs text-gray-400 line-through">{fmt(base)}</p>
                                    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">-{product.discountPercent}%</span>
                                </>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 flex size-8 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    {/* Option groups */}
                    {product.optionGroups.map((g) => (
                        <div key={g.id} className="space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{g.name}</p>
                            <div className="flex flex-wrap gap-2">
                                {g.values.map((v) => {
                                    const selected = options[g.name] === v.label
                                    return (
                                        <button
                                            key={v.label}
                                            onClick={() => setOptions((o) => ({ ...o, [g.name]: v.label }))}
                                            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${selected
                                                ? 'border-brand bg-brand text-white shadow-sm'
                                                : 'border-gray-200 bg-white text-gray-700 hover:border-brand/50 hover:text-brand'
                                                }`}
                                        >
                                            {selected && <Check className="size-3 shrink-0" />}
                                            <span>{v.label}</span>
                                            {v.priceDelta > 0 && (
                                                <span className={`text-xs ${selected ? 'text-white/80' : 'text-gray-400'}`}>
                                                    +{fmt(v.priceDelta)}
                                                </span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Toppings */}
                    {availableToppings.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Topping</p>
                            <div className="flex flex-wrap gap-2">
                                {availableToppings.map((t) => {
                                    const selected = selectedToppingIds.includes(t.id)
                                    const price = Number(t.price)
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => toggleTopping(t.id)}
                                            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${selected
                                                ? 'border-brand bg-brand text-white shadow-sm'
                                                : 'border-gray-200 bg-white text-gray-700 hover:border-brand/50 hover:text-brand'
                                                }`}
                                        >
                                            {selected && <Check className="size-3 shrink-0" />}
                                            <span>{t.name}</span>
                                            {price > 0 && (
                                                <span className={`text-xs ${selected ? 'text-white/80' : 'text-gray-400'}`}>
                                                    +{fmt(price)}
                                                </span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Note */}
                    <div className="space-y-1.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Ghi chú</p>
                        <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Ít đá, không đường, không ống hút…"
                            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm placeholder:text-gray-300 focus:border-brand focus:outline-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                    {/* Price breakdown */}
                    {(optionDelta > 0 || toppingDelta > 0) && (
                        <div className="space-y-1">
                            {optionDelta > 0 && (
                                <div className="flex items-center justify-between text-xs text-gray-400">
                                    <span>Giá món + tuỳ chọn</span>
                                    <span className="font-medium text-gray-600">{fmt(discountedBase)} + {fmt(optionDelta)}</span>
                                </div>
                            )}
                            {toppingDelta > 0 && (
                                <div className="flex items-center justify-between text-xs text-gray-400">
                                    <span>Topping ({selectedToppingIds.length} món)</span>
                                    <span className="font-medium text-gray-600">+{fmt(toppingDelta)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        {/* Quantity */}
                        <div className="flex items-center gap-1 rounded-xl border border-gray-200 p-1">
                            <button
                                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                className="flex size-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                                disabled={quantity <= 1}
                            >
                                <Minus className="size-3.5" />
                            </button>
                            <span className="w-8 text-center text-sm font-bold text-gray-800">{quantity}</span>
                            <button
                                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                                className="flex size-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
                            >
                                <Plus className="size-3.5" />
                            </button>
                        </div>

                        {/* Confirm */}
                        <button
                            onClick={handleConfirm}
                            className="flex flex-1 items-center justify-between rounded-xl bg-brand px-4 py-2.5 font-bold text-white shadow-sm shadow-brand/30 hover:bg-brand/90 active:scale-[0.98]"
                        >
                            <span>Thêm vào giỏ</span>
                            <span className="tabular-nums">{fmt(unitPrice * quantity)}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}