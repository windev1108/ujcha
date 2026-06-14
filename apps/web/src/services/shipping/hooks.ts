"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchShippingEstimate, fetchPublicShippingConfig } from "./api";

export function useShippingEstimateQuery(
  lat: number | null,
  lng: number | null,
  amount: number,
) {
  return useQuery({
    queryKey: ["shipping", "estimate", lat, lng, amount],
    queryFn: () => fetchShippingEstimate(lat!, lng!, amount),
    enabled: lat !== null && lng !== null && lat !== 0 && lng !== 0,
    staleTime: 60_000,
  });
}

export function usePublicShippingConfigQuery() {
  return useQuery({
    queryKey: ["shipping", "config"],
    queryFn: fetchPublicShippingConfig,
    staleTime: 5 * 60_000,
  });
}
