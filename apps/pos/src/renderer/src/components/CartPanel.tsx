import { Minus, Plus, Trash2, ChevronDown, Utensils, CreditCard, Trash2Icon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePosStore } from '../store/pos-store'

function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }

export function CartPanel({ onCheckout }: { onCheckout: () => void }) {
  const cart = usePosStore((s) => s.cart)
  const tables = usePosStore((s) => s.tables)
  const selectedTableId = usePosStore((s) => s.selectedTableId)
  const removeFromCart = usePosStore((s) => s.removeFromCart)
  const updateQty = usePosStore((s) => s.updateQty)
  const updateNote = usePosStore((s) => s.updateNote)
  const setSelectedTable = usePosStore((s) => s.setSelectedTable)
  const cartTotal = usePosStore((s) => s.cartTotal)
  const [noteId, setNoteId] = useState<string | null>(null)

  const total = cartTotal()
  const selectedTable = tables.find((t) => t.id === selectedTableId)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eAPI = (window as any).electronAPI
    if (!eAPI) return

    if (cart.length === 0) {
      eAPI.customer.update({ type: 'idle' })
      return
    }

    eAPI.customer.update({
      type: 'cart',
      total: cartTotal(),
      items: cart.map((item) => {
        const extrasTotal = (item.extras ?? []).reduce((s, e) => s + (e.price ?? 0), 0)
        const unit = item.basePrice + item.optionDelta + extrasTotal
        return {
          name: item.name,
          quantity: item.quantity,
          price: unit * item.quantity,
          imageUrl: item.imageUrl ?? null,
          optionDetails: item.optionDetails ?? [],
          extras: item.extras ?? [],
          note: item.note || undefined,
        }
      }),
    })
  }, [cart])

  return (
    <div className="flex h-full w-[340px] shrink-0 flex-col border-l border-gray-100 bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Đơn hàng</p>
          {cart.length > 0 && (
            <button
              onClick={() => usePosStore.getState().clearCart()}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Xóa tất cả
            </button>
          )}
        </div>

        {/* Table selector */}
        <div className="mt-2 flex items-center gap-2">
          <Utensils className="size-4 shrink-0 text-gray-400" />
          <select
            value={selectedTableId ?? ''}
            onChange={(e) => setSelectedTable(e.target.value || null)}
            className="h-8 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm focus:outline-none"
          >
            <option value="">Mang về / Pickup</option>
            {tables.filter((t) => t.isActive).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {cart.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-300">
            <CreditCard className="size-10" />
            <p className="text-sm">Chưa có sản phẩm</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50 p-2">
            {cart.map((item) => {
              const extrasTotal = (item.extras ?? []).reduce((s, e) => s + (e.price ?? 0), 0)
              const unit = item.basePrice + item.optionDelta + extrasTotal
              return (
                <li key={item.cartId} className="py-3 px-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 leading-snug">{item.name}</p>
                      {item.optionDetails ? (
                        <p className="mt-0.5 text-xs font-semibold">
                          {item.optionDetails.map((o, i) => (
                            <span key={o.group}>
                              {i > 0 && ' · '}
                              {o.label}
                              {o.priceDelta > 0 && (
                                <span className="text-gray-700"> +{o.priceDelta.toLocaleString('vi-VN')}đ</span>
                              )}
                            </span>
                          ))}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-gray-400">
                          {Object.values(item.options).join(' · ')}
                        </p>
                      )}

                      {item.extras && item.extras.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5">
                          {item.extras.map(e => (
                            <span key={e.id} className="text-xs text-brand/80">
                              + {e.name}{e.price > 0 ? ` ${e.price.toLocaleString('vi-VN')}đ` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-1 text-sm font-bold text-brand">{fmt(unit * item.quantity)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button onClick={() => removeFromCart(item.cartId)} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="size-3.5" />
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(item.cartId, item.quantity - 1)}
                          className="flex size-6 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-brand hover:text-brand"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-7 text-center text-sm font-bold text-gray-800">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.cartId, item.quantity + 1)}
                          className="flex size-6 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-brand hover:text-brand"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Note toggle */}
                  <div className="mt-1.5">
                    {noteId === item.cartId ? (
                      <input
                        autoFocus
                        value={item.note}
                        onChange={(e) => updateNote(item.cartId, e.target.value)}
                        onBlur={() => setNoteId(null)}
                        placeholder="Ghi chú món…"
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-brand"
                      />
                    ) : (
                      <button
                        onClick={() => setNoteId(item.cartId)}
                        className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand"
                      >
                        <ChevronDown className="size-3" />
                        {item.note || 'Thêm ghi chú'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Footer / Total */}
      <div className="border-t border-gray-100 p-4 space-y-3">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Tạm tính ({cart.reduce((s, i) => s + i.quantity, 0)} món)</span>
          <span className="font-semibold text-gray-800">{fmt(total)}</span>
        </div>
        {selectedTable && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Bàn</span>
            <span className="font-semibold text-gray-800">{selectedTable.name}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-base font-bold text-gray-900">Tổng cộng</span>
          <span className="text-xl font-black text-brand">{fmt(total)}</span>
        </div>

        <button
          onClick={onCheckout}
          disabled={cart.length === 0}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-bold text-white shadow-md shadow-brand/30 transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CreditCard className="size-5" />
          Thanh toán
        </button>
      </div>
    </div>
  )
}
