import { api } from "@/config/server";

import type {
  AdminOrder,
  AdminOrderListResponse,
  AdminOrderStats,
  AdminOrderStatus,
  AdminOrderType,
  AdminPaymentStatus,
  AdminPaymentType,
} from "./types";

export async function fetchAdminOrders(params?: {
  type?: AdminOrderType;
  status?: AdminOrderStatus;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  /** Chỉ đơn giao hàng chưa gán shipper (backend). */
  unassignedShipper?: boolean;
  /** true = đơn nhóm; false = đơn thường; undefined = tất cả */
  isGroupOrder?: boolean;
}): Promise<AdminOrderListResponse> {
  const { data } = await api.get<AdminOrderListResponse>("/admin/orders", {
    params: {
      ...(params?.type ? { type: params.type } : {}),
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.q?.trim() ? { q: params.q.trim() } : {}),
      ...(params?.from ? { from: params.from } : {}),
      ...(params?.to ? { to: params.to } : {}),
      ...(params?.unassignedShipper === true ? { unassignedShipper: true } : {}),
      ...(params?.isGroupOrder !== undefined ? { isGroupOrder: params.isGroupOrder } : {}),
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
    },
  });
  return data;
}

export async function fetchAdminOrderStats(params?: {
  from?: string;
  to?: string;
}): Promise<AdminOrderStats> {
  const { data } = await api.get<AdminOrderStats>("/admin/orders/stats", {
    params: {
      ...(params?.from ? { from: params.from } : {}),
      ...(params?.to ? { to: params.to } : {}),
    },
  });
  return data;
}

export async function fetchAdminOrder(id: string): Promise<AdminOrder> {
  const { data } = await api.get<AdminOrder>(`/admin/orders/${id}`);
  return data;
}

export async function updateAdminOrderStatus(
  id: string,
  body: { status?: AdminOrderStatus; paymentStatus?: AdminPaymentStatus },
): Promise<AdminOrder> {
  const { data } = await api.patch<AdminOrder>(
    `/admin/orders/${id}/status`,
    body,
  );
  return data;
}

export async function assignOrderShipper(
  orderId: string,
  shipperId: string,
): Promise<AdminOrder> {
  const { data } = await api.patch<AdminOrder>(
    `/admin/orders/${orderId}/assign-shipper`,
    { shipperId },
  );
  return data;
}

export type CreateAdminOrderItemBody = {
  productId: string;
  quantity: number;
  /** Đơn giá (đã gồm topping) — phải khớp tính từ server */
  price: number;
  extras?: Array<{ toppingId: string }>;
  options?: Record<string, string>;
  note?: string;
};

export type CreateAdminOrderBody = {
  /** Bỏ qua = không gắn tài khoản (khách lẻ / giao không đăng ký). */
  userId?: string;
  type: AdminOrderType;
  addressId?: string;
  /** Giao hàng không tài khoản — bắt buộc nếu không có userId+addressId. */
  guestDeliveryAddress?: string;
  guestDeliveryPhone?: string;
  guestDeliveryName?: string;
  tableId?: string;
  pickupTime?: string;
  items: CreateAdminOrderItemBody[];
  discountAmount?: number;
  /** POS: đã thu tiền hay chưa khi tạo đơn */
  paymentStatus?: AdminPaymentStatus;
  paymentType?: AdminPaymentType;
  /** Số điểm khách dùng để giảm giá (chỉ khi có userId và điểm đủ). */
  pointToUse?: number;
};

export async function createAdminOrder(
  body: CreateAdminOrderBody,
): Promise<AdminOrder> {
  const { data } = await api.post<AdminOrder>("/admin/orders", body);
  return data;
}

export async function deleteAdminOrder(id: string): Promise<void> {
  await api.delete(`/admin/orders/${id}`);
}

export async function markGroupParticipantPaid(
  orderId: string,
  participantId: string,
): Promise<AdminOrder> {
  const { data } = await api.patch<AdminOrder>(
    `/admin/orders/${orderId}/group-participants/${participantId}/payment`,
  );
  return data;
}

export async function bulkUpdateAdminOrderStatus(
  orderIds: string[],
  status: AdminOrderStatus,
): Promise<{ updated: number }> {
  const { data } = await api.patch<{ updated: number }>(
    "/admin/orders/bulk-status",
    { orderIds, status },
  );
  return data;
}
