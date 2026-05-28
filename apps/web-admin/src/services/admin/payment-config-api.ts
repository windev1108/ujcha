import { api } from "@/config/server";
import type { PaymentConfig, UpdatePaymentConfigBody } from "./types";

export async function fetchPaymentConfig(): Promise<PaymentConfig> {
  const { data } = await api.get<PaymentConfig>("/admin/payment-config");
  return data;
}

export async function updatePaymentConfig(
  body: UpdatePaymentConfigBody,
): Promise<PaymentConfig> {
  const { data } = await api.patch<PaymentConfig>("/admin/payment-config", body);
  return data;
}
