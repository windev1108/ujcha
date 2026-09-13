import { Minus, Plus, Trash2, ChevronDown, Utensils, CreditCard } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePosStore } from '../store/pos-store'
import {
  Select, Label, ListBox,
  Button, TextField, Input,
  Separator, ScrollShadow, Chip,
  NumberField,
} from '@heroui/react'

function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }

const PICKUP_KEY = '__pickup__'

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
  const totalQty = cart.reduce((s, i) => s + i.quantity, 0)

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
    <div className="flex h-full w-[300px] shrink-0 flex-col border-l border-gray-100 bg-white">
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Đơn hàng</p>
          {cart.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 min-w-0 px-2 text-xs text-red-400 hover:text-red-600"
              onPress={() => usePosStore.getState().clearCart()}
            >
              Xóa tất cả
            </Button>
          )}
        </div>

        {/* Table selector */}
        <Select
          className="mt-3 w-full"
          variant="secondary"
          value={selectedTableId ?? PICKUP_KEY}
          onChange={(key) => setSelectedTable(key === PICKUP_KEY ? null : (key as string))}
        >
          <Select.Trigger>
            <Utensils className="size-4 shrink-0 text-gray-400" />
            <Select.Value className="ml-2" />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={PICKUP_KEY} textValue="Mang về / Pickup">
                Mang về / Pickup
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {tables.filter((t) => t.isActive).map((t) => (
                <ListBox.Item key={t.id} id={t.id} textValue={`Bàn ${t.name}`}>
                  {`Bàn ${t.name}`}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <Separator />

      {/* Items */}
      <ScrollShadow className="flex-1" hideScrollBar={false}>
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
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.extras.map(e => (
                            <Chip key={e.id} variant="secondary" className="h-5 px-1.5 text-[11px]">
                              + {e.name}{e.price > 0 ? ` ${e.price.toLocaleString('vi-VN')}đ` : ''}
                            </Chip>
                          ))}
                        </div>
                      )}
                      <p className="mt-1.5 text-sm font-bold text-brand">{fmt(unit * item.quantity)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        className="size-6 min-w-0 text-gray-300 hover:text-red-500"
                        onPress={() => removeFromCart(item.cartId)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                      <NumberField
                        value={item.quantity}
                        onChange={(v) => updateQty(item.cartId, v)}
                        minValue={0}
                        className="w-fit"
                      >
                        <NumberField.Group className="h-7 items-center gap-1">
                          <NumberField.DecrementButton className="size-6 min-w-0 shrink-0">
                            <Minus className="size-3" />
                          </NumberField.DecrementButton>
                          <NumberField.Input className="w-5 shrink-0 border-0 bg-transparent p-0 text-center text-sm font-bold leading-none outline-none" />
                          <NumberField.IncrementButton className="size-6 min-w-0 shrink-0">
                            <Plus className="size-3" />
                          </NumberField.IncrementButton>
                        </NumberField.Group>
                      </NumberField>
                    </div>
                  </div>

                  {/* Note toggle */}
                  <div className="mt-1.5">
                    {noteId === item.cartId ? (
                      <TextField
                        value={item.note}
                        onChange={(v) => updateNote(item.cartId, v)}
                        className="w-full"
                      >
                        <Input
                          autoFocus
                          placeholder="Ghi chú món…"
                          onBlur={() => setNoteId(null)}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-brand"
                        />
                      </TextField>
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
      </ScrollShadow>

      {/* Footer / Total */}
      <Separator />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Tạm tính ({totalQty} món)</span>
          <span className="font-semibold text-gray-800">{fmt(total)}</span>
        </div>
        {selectedTable && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Bàn</span>
            <Chip variant="secondary">{selectedTable.name}</Chip>
          </div>
        )}
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-gray-900">Tổng cộng</span>
          <span className="text-xl font-black text-brand">{fmt(total)}</span>
        </div>

        <Button
          onPress={onCheckout}
          isDisabled={cart.length === 0}
          variant="primary"
          size="lg"
          className="w-full font-bold shadow-md shadow-brand/30 bg-brand !rounded-xl"
        >
          <CreditCard className="size-5" />
          Thanh toán
        </Button>
      </div>
    </div>
  )
}