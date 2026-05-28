"use client";

import { Card, CardContent, Input } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { adminKeys } from "@/services/admin/keys";
import { fetchCustomers } from "@/services/admin/admin-management-api";

import { CustomersTable } from "./CustomersTable";

const PAGE_SIZE = 10;

function usePaginationWindow(current: number, totalPages: number, max = 5) {
  return useMemo(() => {
    if (totalPages <= 0) return [];
    const half = Math.floor(max / 2);
    let start = Math.max(1, current - half);
    const end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [current, totalPages, max]);
}

export function UsersPageClient() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 320);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const customersQuery = useQuery({
    queryKey: adminKeys.customers({
      q: debouncedSearch || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    queryFn: () =>
      fetchCustomers({
        q: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const totalPages = customersQuery.data?.totalPages ?? 1;
  const pageWindow = usePaginationWindow(page, totalPages, 5);

  return (
    <div className="flex flex-col gap-8 pb-16">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
          Quản trị hệ thống
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
          Khách hàng
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground/55">
          Danh sách thành viên UjCha đã đăng ký.
        </p>
      </header>

      <Card className="rounded-2xl border border-black/6 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="relative w-full max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground/40"
              aria-hidden
            />
            <Input
              aria-label="Tìm kiếm khách hàng"
              placeholder="Tìm theo tên, số điện thoại…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border-0 bg-[#f3f4f6] py-2 pl-10 pr-4 text-sm ring-1 ring-black/6"
            />
          </div>
        </CardContent>
      </Card>

      <CustomersTable
        customers={customersQuery.data}
        isLoading={customersQuery.isLoading}
        page={page}
        totalPages={totalPages}
        pageWindow={pageWindow}
        onPageChange={setPage}
      />
    </div>
  );
}
