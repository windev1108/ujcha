export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + 'đ'
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}
