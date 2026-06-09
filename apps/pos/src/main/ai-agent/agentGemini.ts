import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Content, Part, GenerateContentStreamResult } from '@google/generative-ai'
import { buildSystemPrompt } from './prompts/systemPrompt'
import { resolveCartItems } from './tools/addToCart'
import type { AgentRunParams } from './types'

// Models tried in order when primary is overloaded
const MODEL_CASCADE = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'] as const

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('503') || msg.includes('429') || msg.includes('overloaded') || msg.includes('RESOURCE_EXHAUSTED')
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function generateWithFallback(
  genai: GoogleGenerativeAI,
  contents: Content[],
  systemInstruction: string,
  tools: Parameters<ReturnType<GoogleGenerativeAI['getGenerativeModel']>['generateContentStream']>[0]['tools'],
  generationConfig: Record<string, unknown>,
): Promise<{ result: GenerateContentStreamResult; model: string }> {
  for (let mi = 0; mi < MODEL_CASCADE.length; mi++) {
    const modelName = MODEL_CASCADE[mi]
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const m = genai.getGenerativeModel({ model: modelName, systemInstruction, tools, generationConfig })
        const result = await m.generateContentStream({ contents })
        if (mi > 0) console.warn(`[Gemini] Using fallback model: ${modelName}`)
        return { result, model: modelName }
      } catch (err) {
        if (!isTransientError(err)) throw err
        if (attempt < 2) {
          console.warn(`[Gemini] ${modelName} overloaded (attempt ${attempt + 1}), retrying in ${2 ** attempt}s…`)
          await sleep(1000 * 2 ** attempt)
        } else if (mi < MODEL_CASCADE.length - 1) {
          console.warn(`[Gemini] ${modelName} exhausted, falling back to ${MODEL_CASCADE[mi + 1]}`)
        } else {
          throw new Error(`[Gemini] All models unavailable: ${err instanceof Error ? err.message : err}`)
        }
      }
    }
  }
  throw new Error('[Gemini] All models unavailable')
}

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
    const systemInstruction = buildSystemPrompt(menu, toppingCache, aiName)
    const tools = [{ functionDeclarations: [confirmOrderDecl, addToCartDecl, updateCartItemDecl] }]
    const generationConfig = { maxOutputTokens: 512 }

    if (!geminiSessions.has(sessionId)) geminiSessions.set(sessionId, [])
    const history = geminiSessions.get(sessionId)!

    history.push({ role: 'user', parts: [{ text: userMessage }] })

    while (true) {
      const { result } = await generateWithFallback(genai, history, systemInstruction, tools, generationConfig)

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
