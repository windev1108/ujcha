import { api } from "@/config/server";
import type { PricingConfig, PricingRecomputeResult } from "./types";

export const pricingConfigKey = ["admin", "pricing", "config"] as const;

export async function fetchPricingConfig(): Promise<PricingConfig> {
    const { data } = await api.get<PricingConfig>("/admin/pricing/config");
    return data;
}
export async function updatePricingConfig(
    body: Partial<PricingConfig>,
): Promise<PricingConfig & { recomputed: PricingRecomputeResult }> {
    const { data } = await api.patch("/admin/pricing/config", body);
    return data;
}
export async function recomputePricing(): Promise<PricingRecomputeResult> {
    const { data } = await api.post<PricingRecomputeResult>("/admin/pricing/recompute");
    return data;
}