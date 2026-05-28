import { OrderStatus, QuickDate } from "@/types/common"

export const STATUS_LABEL: Record<OrderStatus, string> = {
    completed: 'Hoàn thành', pending: 'Chờ xử lý',
    preparing: 'Đang làm', ready: 'Sẵn sàng', cancelled: 'Đã huỷ',
}
export const STATUS_COLOR: Record<OrderStatus, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    preparing: 'bg-blue-100 text-blue-700 border-blue-200',
    ready: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    cancelled: 'bg-red-100 text-red-600 border-red-200',
    completed: 'bg-teal-100 text-teal-700 border-teal-200',
}
export const STATUS_DOT: Record<OrderStatus, string> = {
    pending: 'bg-amber-400', preparing: 'bg-blue-500',
    ready: 'bg-emerald-500', cancelled: 'bg-red-500', completed: 'bg-teal-500',
}

// GrabFood delivery status
export const GRAB_STATUS_LABEL: Record<string, string> = {
    COMPLETED: 'Hoàn thành', PLACED: 'Mới đặt', ACCEPTED: 'Đã nhận',
    ORDER_EXECUTING: 'Đang giao',
    ORDER_IN_PREPARE: 'Đang chuẩn bị', DRIVER_ALLOCATED: 'Tài xế đến', DELIVERED: 'Đã giao',
    CANCELLED: 'Đã hủy', CANCELED: 'Đã hủy', FAILED: 'Thất bại',
}
export const GRAB_STATUS_COLOR: Record<string, string> = {
    COMPLETED: 'bg-teal-100 text-teal-700 border-teal-200',
    PLACED: 'bg-amber-100 text-amber-700 border-amber-200',
    ACCEPTED: 'bg-blue-100 text-blue-700 border-blue-200',
    PREPARING: 'bg-blue-100 text-blue-700 border-blue-200',
    ORDER_IN_PREPARE: 'bg-blue-100 text-blue-700 border-blue-200',
    DRIVER_ALLOCATED: 'bg-purple-100 text-purple-700 border-purple-200',
    DELIVERED: 'bg-teal-100 text-teal-700 border-teal-200',
    CANCELLED: 'bg-red-100 text-red-600 border-red-200',
    CANCELED: 'bg-red-100 text-red-600 border-red-200',
    FAILED: 'bg-red-100 text-red-600 border-red-200',
    ORDER_EXECUTING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}
export const GRAB_STATUS_DOT: Record<string, string> = {
    COMPLETED: 'bg-teal-500', PLACED: 'bg-amber-400', ACCEPTED: 'bg-blue-500',
    PREPARING: 'bg-blue-500', DRIVER_ALLOCATED: 'bg-purple-500',
    DELIVERED: 'bg-teal-500', CANCELLED: 'bg-red-500', CANCELED: 'bg-red-500', FAILED: 'bg-red-500',
    ORDER_EXECUTING: 'bg-yellow-500',
    ORDER_IN_PREPARE: 'bg-blue-500',
}

export const QUICK_DATES: { key: QuickDate; label: string }[] = [
    { key: 'today', label: 'Hôm nay' },
    { key: 'week', label: 'Tuần này' },
    { key: 'all', label: 'Tất cả' },
]