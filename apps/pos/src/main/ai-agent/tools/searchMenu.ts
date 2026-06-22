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

function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = i
    for (let j = 1; j <= b.length; j++) {
      const cur = a[i - 1] === b[j - 1] ? dp[j - 1] : 1 + Math.min(dp[j - 1], dp[j], prev)
      dp[j - 1] = prev
      prev = cur
    }
    dp[b.length] = prev
  }
  return dp[b.length]
}

function scoreItem(item: AiMenuItem, tokens: string[]): number {
  const name = normalize(item.name)
  const nameWords = name.split(/\s+/)
  const full = normalize(`${item.name} ${item.category}`)
  let s = 0
  for (const tok of tokens) {
    if (name === tok) { s += tok.length * 6; continue }         // exact name match
    if (nameWords.includes(tok)) { s += tok.length * 4; continue }  // exact word in name
    if (name.includes(tok)) { s += tok.length * 2; continue }   // substring in name
    if (full.includes(tok)) { s += tok.length; continue }        // substring in category
    if (nameWords.some((w) => w.startsWith(tok))) { s += tok.length; continue }
    // fuzzy: allow 1 edit for tokens longer than 4 chars
    if (tok.length > 4 && nameWords.some((w) => editDistance(w, tok) <= 1)) s += tok.length - 1
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
