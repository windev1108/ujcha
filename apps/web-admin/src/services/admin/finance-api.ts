import { api } from "@/config/server";
import type { FinanceStats } from "./types";

export async function fetchAdminFinanceStats(params: {
    from: string;
    to: string;
}): Promise<FinanceStats> {
    const { data } = await api.get<FinanceStats>("/admin/stats/finance", { params });
    return data;
}
