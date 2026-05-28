import { api } from "@/config/server";

export interface LoyaltyOrderInfo {
  paymentCode: string;
  status: string;
  paymentStatus: string;
  finalAmount: string;
  type: string;
  createdAt: string;
  isEligible: boolean;
  alreadyClaimed: boolean;
  potentialPoints: number;
}

export interface LoyaltyUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  pointBalance: number;
}

export interface ClaimResult {
  points: number;
  userId: string;
}

export async function fetchLoyaltyOrder(paymentCode: string): Promise<LoyaltyOrderInfo> {
  const { data } = await api.get<LoyaltyOrderInfo>(`/loyalty/order/${encodeURIComponent(paymentCode)}`);
  return data;
}

export async function claimLoyaltyPoints(paymentCode: string, userId: string): Promise<ClaimResult> {
  const { data } = await api.post<ClaimResult>(`/loyalty/order/${encodeURIComponent(paymentCode)}/claim`, { userId });
  return data;
}

export async function searchLoyaltyUsers(q: string): Promise<LoyaltyUser[]> {
  const { data } = await api.get<LoyaltyUser[]>(`/loyalty/users/search`, { params: { q } });
  return data;
}
