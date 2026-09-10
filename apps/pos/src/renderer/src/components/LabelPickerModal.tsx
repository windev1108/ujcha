import { useState } from 'react'
import { X, Tag, CheckCircle2, Circle } from 'lucide-react'

export interface LabelPickerItem {
  id: string
  name: string
  quantity: number
  optionsSummary: string
  hasOptions: boolean
}

export function LabelPickerModal({
  items,
  initiallySelectedIds,
  onConfirm,
  onClose,
}: {
  items: LabelPickerItem[]
  initiallySelectedIds: Set<string>
  onConfirm: (selectedIds: Set<string>) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initiallySelectedIds))

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(prev => prev.size === items.length ? new Set() : new Set(items.map(i => i.id)))
  }

  const totalLabels = items
    .filter(i => selected.has(i.id))
    .reduce((s, i) => s + i.quantity, 0)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex w-full sm:max-w-md flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="size-4 text-brand" />
            <p className="text-sm font-bold text-gray-900">Chọn tem cần in</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 py-2 shrink-0">
          <button onClick={toggleAll} className="text-xs font-semibold text-brand hover:underline">
            {selected.size === items.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-1.5">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Không có món nào để in tem</p>
          ) : items.map(item => {
            const isSelected = selected.has(item.id)
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${isSelected ? 'border-brand/40 bg-brand/5' : 'border-gray-100 hover:bg-gray-50'
                  }`}
              >
                {isSelected
                  ? <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-brand" />
                  : <Circle className="size-4 shrink-0 mt-0.5 text-gray-300" />
                }
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                    <span className="shrink-0 text-[10px] font-bold text-gray-400">×{item.quantity}</span>
                  </div>
                  {item.optionsSummary && (
                    <p className="text-[11px] text-gray-400 mt-0.5">{item.optionsSummary}</p>
                  )}
                  {!item.hasOptions && (
                    <p className="text-[10px] text-amber-600 mt-0.5">Không có tuỳ chọn — có thể không cần tem</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <div className="border-t border-gray-100 px-5 py-3.5 shrink-0">
          <button
            onClick={() => onConfirm(selected)}
            disabled={selected.size === 0}
            className="flex w-full items-center justify-center gap-2 h-11 rounded-xl bg-brand text-sm font-bold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <Tag className="size-4" />
            In {totalLabels} tem
          </button>
        </div>
      </div>
    </div>
  )
}