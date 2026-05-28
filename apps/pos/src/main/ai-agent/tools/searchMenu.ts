import type { AiMenuItem } from '../types'

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

function tokenize(s: string): string[] {
  return normalize(s).split(/\s+/).filter((t) => t.length >= 2)
}

function scoreItem(item: AiMenuItem, tokens: string[]): number {
  const text = normalize(`${item.name} ${item.category}`)
  let s = 0
  for (const tok of tokens) {
    if (text.includes(tok)) s += tok.length * 2
    else if (text.split(/\s+/).some((w) => w.startsWith(tok))) s += tok.length
  }
  return s
}

export function searchMenuItems(query: string, items: AiMenuItem[], topK = 5): AiMenuItem[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return items.filter((i) => i.isAvailable && !i.isSoldOut).slice(0, topK)

  const scored = items
    .map((item) => ({ item, score: scoreItem(item, tokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  if (scored.length > 0) return scored.map((x) => x.item)
  // fallback: return all available items sorted by name similarity
  return items.filter((i) => i.isAvailable && !i.isSoldOut).slice(0, topK)
}

export const searchMenuToolDef = {
  name: 'search_menu' as const,
  description:
    'Tìm kiếm món trong menu POS. Luôn gọi trước khi xác nhận hoặc thêm bất kỳ món nào.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Từ khoá, ví dụ: "trà sữa", "cà phê đen", "matcha"',
      },
    },
    required: ['query'],
  },
}
