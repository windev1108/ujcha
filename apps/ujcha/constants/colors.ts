export const COLORS = {
  primary: '#1a3c34',
  primaryHover: '#2d4a43',
  primaryActive: '#163129',
  primaryDisabled: '#a8c4bc',
  sage: '#5a8f7a',
  sageLt: '#99d6b3',
  caramel: '#c9a227',
  danger: '#c45c5c',
  ink: '#1a1a1a',
  muted: '#717171',
  canvas: '#ffffff',
  surfaceSoft: '#f7f7f7',
  surfaceCard: '#ededed',
  surfaceTertiary: '#e4e4e4',
} as const

export const ORDER_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending:    { bg: '#fffbeb', text: '#b45309', label: 'Chờ xác nhận' },
  confirmed:  { bg: '#eff6ff', text: '#1d4ed8', label: 'Đã xác nhận' },
  preparing:  { bg: '#faf5ff', text: '#7e22ce', label: 'Đang pha chế' },
  ready:      { bg: '#f0fdfa', text: '#0f766e', label: 'Sẵn sàng' },
  delivering: { bg: '#f0f9ff', text: '#0369a1', label: 'Đang giao' },
  picked_up:  { bg: '#f0f9ff', text: '#0369a1', label: 'Đã lấy hàng' },
  arrived:    { bg: '#f0f9ff', text: '#0369a1', label: 'Đã đến' },
  completed:  { bg: '#f0fdf4', text: '#15803d', label: 'Hoàn thành' },
  cancelled:  { bg: '#fef2f2', text: '#dc2626', label: 'Đã huỷ' },
}
