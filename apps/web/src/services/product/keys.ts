export const productKeys = {
  all: ['products'] as const,
  bestSellers: (limit?: string) =>
    [...productKeys.all, 'best-sellers', limit ?? 'all'] as const,
  list: (filter?: string) =>
    [...productKeys.all, 'list', filter ?? 'all'] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
}
