import type { AiMenuItem, AiCartItem } from '../types'

export interface AddToCartInput {
  menu_id: string
  qty: number
  options?: Record<string, string>
  topping_ids?: string[]
  note?: string
}

export function resolveCartItems(
  inputs: AddToCartInput[],
  menuItems: AiMenuItem[],
  toppings: { id: string; name: string; price: number }[],
): AiCartItem[] {
  const results: AiCartItem[] = []

  for (const input of inputs) {
    if (!input.menu_id || !input.qty || input.qty <= 0) continue

    const product = menuItems.find((m) => m.id === input.menu_id)
    if (!product) continue

    const rawOptions: Record<string, string> = input.options ?? {}
    const cleanOptions: Record<string, string> = {}
    const optionDetails: AiCartItem['optionDetails'] = []
    let optionDelta = 0

    for (const group of product.options) {
      const chosen = rawOptions[group.name]
      if (!chosen) continue
      // Exact match first; then strip trailing price annotations like "(+5.000đ)" or "[+5.000đ]" added by AI
      let valueObj = group.values.find((v) => v.label === chosen)
      if (!valueObj) {
        const stripped = chosen
          .replace(/\s*\([^)]*\)\s*$/, '')
          .replace(/\s*\[[^\]]*\]\s*$/, '')
          .trim()
        valueObj = group.values.find(
          (v) => v.label.toLowerCase() === stripped.toLowerCase(),
        )
      }
      if (valueObj) {
        cleanOptions[group.name] = valueObj.label
        optionDetails.push({ group: group.name, label: valueObj.label, priceDelta: valueObj.priceDelta })
        optionDelta += valueObj.priceDelta
      }
    }

    const extras = (input.topping_ids ?? [])
      .map((id) => toppings.find((t) => t.id === id))
      .filter((t): t is { id: string; name: string; price: number } => !!t)

    results.push({
      productId: product.id,
      name: product.name,
      basePrice: product.price,
      imageUrl: product.imageUrl ?? null,
      quantity: input.qty,
      options: cleanOptions,
      optionDetails,
      optionDelta,
      extras,
      note: input.note ?? '',
    })
  }

  return results
}

export const addToCartToolDef = {
  name: 'add_to_cart' as const,
  description: 'Thêm món vào giỏ hàng POS sau khi xác nhận đầy đủ tuỳ chọn với khách.',
  input_schema: {
    type: 'object' as const,
    properties: {
      items: {
        type: 'array',
        description: 'Danh sách món thêm vào giỏ',
        items: {
          type: 'object',
          properties: {
            menu_id: { type: 'string', description: 'ID sản phẩm (lấy từ kết quả search_menu)' },
            qty: { type: 'number', description: 'Số lượng (≥ 1)' },
            options: {
              type: 'object',
              description: 'Các tuỳ chọn đã xác nhận, ví dụ: {"Size": "L", "Đường": "50%"}',
              additionalProperties: { type: 'string' },
            },
            topping_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Danh sách ID topping (nếu có)',
            },
            note: { type: 'string', description: 'Ghi chú thêm cho món' },
          },
          required: ['menu_id', 'qty'],
        },
      },
    },
    required: ['items'],
  },
}
