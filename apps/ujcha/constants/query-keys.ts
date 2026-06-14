export const QK = {
  me: ['me'] as const,
  cart: ['cart'] as const,
  products: (params?: Record<string, string>) => ['products', params] as const,
  product: (slug: string) => ['product', slug] as const,
  categories: ['categories'] as const,
  orders: (page: number) => ['orders', page] as const,
  order: (id: string) => ['order', id] as const,
  notifications: ['notifications'] as const,
  unreadCount: ['notifications', 'unread'] as const,
  addresses: ['addresses'] as const,
  vouchers: ['vouchers'] as const,
  profile: ['profile'] as const,
  pointRewards: ['point-rewards'] as const,
  referralStats: ['referral', 'stats'] as const,
  referralLeaderboard: ['referral', 'leaderboard'] as const,
  shippingEstimate: (lat: number, lng: number, amount: number) =>
    ['shipping', lat, lng, amount] as const,
}
