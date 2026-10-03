import { api } from "@/config/server";
import type { AdminCustomerStats, FinanceStats } from "./types";

export async function fetchAdminFinanceStats(params: {
    from: string;
    to: string;
}): Promise<FinanceStats> {
    const { data } = await api.get<FinanceStats>("/admin/stats/finance", { params });
    return data;
}


export async function fetchAdminCustomerStats(p: { from: string; to: string; cell?: number }) {
    const { data } = await api.get<AdminCustomerStats>("/admin/stats/customers", { params: p });
    return data;
}