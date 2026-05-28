import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Content, Part } from '@google/generative-ai'
import { buildSystemPrompt } from './prompts/systemPrompt'
import { resolveCartItems } from './tools/addToCart'
import type { AgentRunParams } from './types'

const confirmOrderDecl = {
  name: 'confirm_order',
  description: 'Xác nhận và hoàn tất đơn hàng sau khi khách chọn hình thức thanh toán.',
  parameters: {
    type: 'OBJECT',
    properties: {
      payment_method: {
        type: 'STRING',
        description: '"cash" cho tiền mặt, "transfer" cho chuyển khoản',
      },
    },
    required: ['payment_method'],
  },
}

const addToCartDecl = {
  name: 'add_to_cart',
  description: 'Thêm món vào giỏ hàng sau khi đã xác nhận đầy đủ tuỳ chọn với khách.',
  parameters: {
    type: 'OBJECT',
    properties: {
      items: {
        type: 'ARRAY',
        description: 'Danh sách món cần thêm',
        items: {
          type: 'OBJECT',
          properties: {
            menu_id: { type: 'STRING', description: 'ID sản phẩm từ menu' },
            qty: { type: 'NUMBER', description: 'Số lượng (≥ 1)' },
            options: {
              type: 'OBJECT',
              description: 'Tuỳ chọn đã xác nhận, ví dụ: {"Size": "L", "Đường": "50%"}',
            },
            topping_ids: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'ID các topping (nếu có)',
            },
            note: { type: 'STRING', description: 'Ghi chú món' },
          },
          required: ['menu_id', 'qty'],
        },
      },
    },
    required: ['items'],
  },
}

const updateCartItemDecl = {
  name: 'update_cart_item',
  description: 'Cập nhật số lượng món đã có trong giỏ hàng. Dùng new_qty=0 để xoá món khỏi giỏ.',
  parameters: {
    type: 'OBJECT',
    properties: {
      cart_position: { type: 'NUMBER', description: 'Vị trí món trong giỏ hàng (bắt đầu từ 1, theo danh sách "Giỏ hàng hiện tại" trong tin nhắn)' },
      new_qty: { type: 'NUMBER', description: 'Số lượng mới (0 = xoá khỏi giỏ)' },
    },
    required: ['cart_position', 'new_qty'],
  },
}

const geminiSessions = new Map<string, Content[]>()

export function clearGeminiSession(sessionId: string) {
  geminiSessions.delete(sessionId)
}

export async function runAgentTurnGemini(
  params: AgentRunParams,
  menu: import('./types').AiMenuItem[],
  toppingCache: { id: string; name: string; price: number }[],
): Promise<void> {
  const { sessionId, userMessage, apiKey, aiName, onChunk, onAddToCart, onUpdateCartItem, onCheckout, onDone, onError } = params

  try {
    const genai = new GoogleGenerativeAI(apiKey)
    const model = genai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: buildSystemPrompt(menu, toppingCache, aiName),
      tools: [{ functionDeclarations: [confirmOrderDecl, addToCartDecl, updateCartItemDecl] }],
      generationConfig: { maxOutputTokens: 512 },
    })

    if (!geminiSessions.has(sessionId)) geminiSessions.set(sessionId, [])
    const history = geminiSessions.get(sessionId)!

    history.push({ role: 'user', parts: [{ text: userMessage }] })

    while (true) {
      const result = await model.generateContentStream({ contents: history })

      for await (const chunk of result.stream) {
        const text = chunk.text()
        if (text) onChunk(text)
      }

      const response = await result.response
      const candidate = response.candidates?.[0]
      if (!candidate?.content?.parts?.length) { onDone(); break }

      const responseParts: Part[] = candidate.content.parts
      history.push({ role: 'model', parts: responseParts })

      const fnCalls = responseParts.filter((p) => p.functionCall)
      if (fnCalls.length === 0) { onDone(); break }

      const fnResponses: Part[] = []
      let didCheckout = false
      for (const part of fnCalls) {
        const { name, args } = part.functionCall!
        let output: string
        try {
          if (name === 'confirm_order') {
            if (!didCheckout) {
              const { payment_method } = args as { payment_method?: string }
              const pm = payment_method === 'transfer' ? 'transfer' : 'cash'
              didCheckout = true
              onCheckout(pm)
              output = JSON.stringify({ success: true, payment_method: pm })
            } else {
              output = JSON.stringify({ success: false, error: 'Order already confirmed.' })
            }
          } else if (name === 'add_to_cart') {
            const { items } = args as { items: Parameters<typeof resolveCartItems>[0] }
            const cartItems = resolveCartItems(items ?? [], menu, toppingCache)
            if (cartItems.length > 0) {
              onAddToCart(cartItems)
              output = JSON.stringify({ success: true, added: cartItems.length, items: cartItems.map((i) => `${i.quantity}× ${i.name}`) })
            } else {
              output = JSON.stringify({ success: false, error: 'Không tìm thấy sản phẩm.' })
            }
          } else if (name === 'update_cart_item') {
            const { cart_position, new_qty } = args as { cart_position?: number; new_qty?: number }
            if (cart_position == null || new_qty == null) {
              output = JSON.stringify({ success: false, error: 'Thiếu cart_position hoặc new_qty.' })
            } else {
              onUpdateCartItem(Math.round(cart_position), Math.round(new_qty))
              output = JSON.stringify({ success: true, cart_position, new_qty })
            }
          } else {
            output = JSON.stringify({ error: `Unknown tool: ${name}` })
          }
        } catch (e) {
          output = JSON.stringify({ error: String(e) })
        }
        fnResponses.push({ functionResponse: { name, response: { output } } })
      }

      history.push({ role: 'user', parts: fnResponses })
      if (didCheckout) { onDone(); break }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Gemini Agent] error:', msg)
    onError(msg)
  }
}
