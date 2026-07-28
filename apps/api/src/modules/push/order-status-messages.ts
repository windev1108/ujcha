import { OrderStatus } from '@prisma/client';

export const ORDER_STATUS_PUSH_MESSAGES: Partial<
    Record<OrderStatus, { title: string; body: (code: string) => string }>
> = {
    [OrderStatus.confirmed]: {
        title: 'Đơn hàng đã được xác nhận',
        body: (c) => `Đơn #${c} đã xác nhận và đang được chuẩn bị.`,
    },
    [OrderStatus.preparing]: {
        title: 'Đơn đang được pha chế',
        body: (c) => `Đơn #${c} đang được pha chế, vui lòng chờ một chút!`,
    },
    [OrderStatus.ready]: {
        title: 'Đơn hàng đã sẵn sàng',
        body: (c) => `Đơn #${c} đã sẵn sàng. Đến lấy hoặc chờ giao nhé!`,
    },
    [OrderStatus.delivering]: {
        title: 'Đơn đang trên đường giao',
        body: (c) => `Đơn #${c} đang trên đường đến bạn.`,
    },
    [OrderStatus.arrived]: {
        title: 'Shipper đã đến nơi',
        body: (c) => `Đơn #${c} đã đến địa chỉ giao hàng.`,
    },
    [OrderStatus.completed]: {
        title: 'Đơn hàng hoàn thành',
        body: (c) => `Đơn #${c} đã hoàn thành. Cảm ơn bạn đã sử dụng UjCha!`,
    },
    [OrderStatus.cancelled]: {
        title: 'Đơn hàng đã bị hủy',
        body: (c) => `Đơn #${c} đã bị hủy.`,
    },
};
