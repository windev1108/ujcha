"use client";

import { Button, Card, CardContent, Input, Label, Table, Text } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import {
  adminFieldStack,
  adminInputClass,
  adminLabelClass,
} from "@/lib/admin-form-classes";
import { searchAdminUsers } from "@/services/admin/users-api";
import type { AdminUserSearchRow } from "@/services/admin/types";
import { useAuthStore } from "@/store/auth-store";

import { PointAdjustModal } from "./PointAdjustModal";

export function PointUsersTab() {
  const isSuper = useAuthStore((s) => s.admin?.role === "super_admin");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [adjustUser, setAdjustUser] = useState<AdminUserSearchRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q), 320);
    return () => window.clearTimeout(t);
  }, [q]);

  const searchQ = useQuery({
    queryKey: ["admin", "users", "search", debounced] as const,
    queryFn: () => searchAdminUsers(debounced),
    enabled: debounced.trim().length >= 1,
  });

  const rows = searchQ.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
          Khách hàng
        </p>
        <h2 className="mt-1 text-lg font-bold text-[#1a3c34]">
          Tìm &amp; điều chỉnh số dư
        </h2>
        <p className="mt-1 text-sm text-foreground/55">
          Gõ tên, SĐT hoặc email — hiển thị số dư điểm (member).
        </p>
      </div>

      <Card className="rounded-2xl border border-black/6 shadow-sm">
        <CardContent className="p-5">
          <div className={`max-w-xl ${adminFieldStack}`}>
            <Label className={adminLabelClass}>Tìm khách</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/35" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tối thiểu 1 ký tự…"
                className={`${adminInputClass} bg-[#f9fafb] pl-10`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-sm">
        <Table.Root className="min-w-[640px]" aria-label="Kết quả">
          <Table.ScrollContainer>
            <Table.Content>
              <Table.Header>
                <Table.Column
                  isRowHeader
                  textValue="Tên"
                  className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45"
                >
                  Tên
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Liên hệ
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Số dư điểm
                </Table.Column>
                <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Thao tác
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {debounced.trim().length < 1 ? (
                  <Table.Row>
                    <Table.Cell className="px-5 py-10 text-center text-sm text-foreground/45">
                      Nhập từ khoá để tìm.
                    </Table.Cell>
                    <Table.Cell className="hidden sm:table-cell" />
                    <Table.Cell className="hidden sm:table-cell" />
                    <Table.Cell className="hidden sm:table-cell" />
                  </Table.Row>
                ) : searchQ.isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Table.Row key={i}>
                      {Array.from({ length: 4 }).map((__, j) => (
                        <Table.Cell key={j} className="px-5 py-4">
                          <div className="h-4 animate-pulse rounded-md bg-black/5" />
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))
                ) : rows.length === 0 ? (
                  <Table.Row>
                    <Table.Cell className="px-5 py-10 text-center text-sm text-foreground/45">
                      Không có kết quả.
                    </Table.Cell>
                    <Table.Cell className="hidden sm:table-cell" />
                    <Table.Cell className="hidden sm:table-cell" />
                    <Table.Cell className="hidden sm:table-cell" />
                  </Table.Row>
                ) : (
                  rows.map((u) => (
                    <Table.Row key={u.id}>
                      <Table.Cell className="px-5 py-3 font-medium text-[#1a3c34]">
                        {u.name ?? "—"}
                      </Table.Cell>
                      <Table.Cell className="px-5 py-3 text-sm text-foreground/75">
                        {u.phone ?? u.email ?? "—"}
                      </Table.Cell>
                      <Table.Cell className="px-5 py-3 tabular-nums text-sm font-semibold">
                        {u.pointBalance ?? 0}
                      </Table.Cell>
                      <Table.Cell className="px-5 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-lg"
                          isDisabled={!isSuper}
                          onPress={() => setAdjustUser(u)}
                        >
                          <SlidersHorizontal className="mr-1 size-4" />
                          Điều chỉnh
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table.Root>
        {!isSuper ? (
          <Text className="border-t border-black/6 px-5 py-3 text-xs text-foreground/50">
            Chỉ Super Admin mới chỉnh điểm thủ công.
          </Text>
        ) : null}
      </Card>

      <PointAdjustModal
        user={adjustUser}
        isOpen={adjustUser != null}
        onOpenChange={(o) => {
          if (!o) setAdjustUser(null);
        }}
      />
    </div>
  );
}
