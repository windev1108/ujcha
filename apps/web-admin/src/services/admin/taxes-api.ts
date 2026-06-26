import { api } from "@/config/server";
import type {
  CreateVatConfigBody,
  TaxOverview,
  TaxReportRow,
  TaxTransaction,
  TaxTransactionListResponse,
  UpdateVatConfigBody,
  VatConfig,
} from "./types";

export async function fetchTaxOverview(params?: {
  from?: string;
  to?: string;
  type?: string;
}): Promise<TaxOverview> {
  const { data } = await api.get<TaxOverview>("/admin/tax/overview", {
    params: {
      ...(params?.from ? { from: params.from } : {}),
      ...(params?.to ? { to: params.to } : {}),
      ...(params?.type ? { type: params.type } : {}),
    },
  });
  return data;
}

export async function fetchTaxTransactions(params?: {
  from?: string;
  to?: string;
  q?: string;
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}): Promise<TaxTransactionListResponse> {
  const { data } = await api.get<TaxTransactionListResponse>(
    "/admin/tax/transactions",
    {
      params: {
        ...(params?.from ? { from: params.from } : {}),
        ...(params?.to ? { to: params.to } : {}),
        ...(params?.q?.trim() ? { q: params.q.trim() } : {}),
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.type ? { type: params.type } : {}),
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
      },
    },
  );
  return data;
}

export async function fetchTaxReports(params?: {
  from?: string;
  to?: string;
  groupBy?: "day" | "month";
  type?: string;
}): Promise<TaxReportRow[]> {
  const { data } = await api.get<TaxReportRow[]>("/admin/tax/reports", {
    params: {
      ...(params?.from ? { from: params.from } : {}),
      ...(params?.to ? { to: params.to } : {}),
      groupBy: params?.groupBy ?? "day",
      ...(params?.type ? { type: params.type } : {}),
    },
  });
  return data;
}

export async function fetchVatConfigs(): Promise<VatConfig[]> {
  const { data } = await api.get<VatConfig[]>("/admin/tax/vat-configs");
  return data;
}

export async function createVatConfig(body: CreateVatConfigBody): Promise<VatConfig> {
  const { data } = await api.post<VatConfig>("/admin/tax/vat-configs", body);
  return data;
}

export async function updateVatConfig(
  id: string,
  body: UpdateVatConfigBody,
): Promise<VatConfig> {
  const { data } = await api.patch<VatConfig>(
    `/admin/tax/vat-configs/${id}`,
    body,
  );
  return data;
}

export async function deleteVatConfig(id: string): Promise<void> {
  await api.delete(`/admin/tax/vat-configs/${id}`);
}

export async function downloadTaxExportCsv(params?: {
  from?: string;
  to?: string;
}): Promise<void> {
  const { data, headers } = await api.get("/admin/tax/export", {
    params: {
      ...(params?.from ? { from: params.from } : {}),
      ...(params?.to ? { to: params.to } : {}),
    },
    responseType: "blob",
  });

  const blob = new Blob([data as BlobPart], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const disposition = headers["content-disposition"] as string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/);
  a.href = url;
  a.download = match?.[1] ?? `tax-export-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
