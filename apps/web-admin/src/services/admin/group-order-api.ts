import { api } from "@/config/server";

export interface GroupDiscountTier {
  minParticipants: number;
  discountPercent: number;
}

export interface GroupOrderConfig {
  id: string;
  isEnabled: boolean;
  expiryMinutes: number;
  discountTiers: GroupDiscountTier[];
  limitParticipants: number;
}

export async function fetchGroupOrderConfig(): Promise<GroupOrderConfig> {
  const { data } = await api.get<GroupOrderConfig>("/admin/group-orders/config");
  return data;
}

export async function updateGroupOrderConfig(
  body: Partial<Pick<GroupOrderConfig, "isEnabled" | "expiryMinutes" | "discountTiers" | "limitParticipants">>,
): Promise<GroupOrderConfig> {
  const { data } = await api.put<GroupOrderConfig>("/admin/group-orders/config", body);
  return data;
}

export type GroupOrderStatus = "collecting" | "locked" | "completed" | "cancelled";

export interface ActiveGroupOrder {
  id: string;
  token: string;
  status: GroupOrderStatus;
  paymentMode: "split" | "host_pays";
  paymentType: string;
  type: string;
  expiresAt: string;
  createdAt: string;
  participantCount: number;
  hostName: string | null;
}

export interface GroupOrderListParams {
  status?: GroupOrderStatus;
  paymentMode?: "split" | "host_pays";
  type?: "delivery" | "pickup" | "table";
  paymentType?: "cash" | "bank_transfer";
  search?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedGroupOrders {
  data: ActiveGroupOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchActiveGroupOrders(
  params: GroupOrderListParams = {},
): Promise<PaginatedGroupOrders> {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ""),
  );
  const { data } = await api.get<PaginatedGroupOrders>("/admin/group-orders", {
    params: clean,
  });
  return data;
}

// ── Detail ──────────────────────────────────────────────────────────────────

export interface GroupOrderParticipantItem {
  id: string;
  productId: string;
  product: { id: string; name: string; nameTranslation?: Record<string, string> | null; imageUrls: string[]; price: string } | null;
  quantity: number;
  unitPrice: number;
  selectedOptions: Record<string, string>;
  toppings: Array<{ toppingId: string; name: string; price: number }> | null;
  note?: string | null;
}

export interface GroupOrderParticipant {
  id: string;
  userId: string | null;
  name: string;
  avatar: string | null;
  isHost: boolean;
  isReady: boolean;
  paymentStatus: string;
  paymentType: string | null;
  paidAt: string | null;
  joinedAt: string;
  subtotal: number;
  items: GroupOrderParticipantItem[];
}

export interface GroupOrderDetail {
  id: string;
  token: string;
  status: string;
  paymentMode: string;
  paymentType: string;
  type: string;
  shippingFee: number;
  shippingFeeMode: string;
  note: string | null;
  expiresAt: string;
  createdAt: string;
  address: { id: string; fullAddress: string } | null;
  table: { id: string; name: string; area: string } | null;
  order: { id: string; paymentCode: string; status: string } | null;
  participants: GroupOrderParticipant[];
}

export async function fetchAdminGroupOrderDetail(token: string): Promise<GroupOrderDetail> {
  const { data } = await api.get<GroupOrderDetail>(`/admin/group-orders/${token}`);
  return data;
}

export async function adminUpdateGroupOrderStatus(token: string, status: string): Promise<GroupOrderDetail> {
  const { data } = await api.patch<GroupOrderDetail>(`/admin/group-orders/${token}/status`, { status });
  return data;
}

export async function adminDeleteGroupOrder(token: string): Promise<void> {
  await api.delete(`/admin/group-orders/${token}`);
}
