"use client";

import { Button, Card, CardContent, Switch, Table, Text } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { adminKeys } from "@/services/admin/keys";
import {
  fetchPointCampaigns,
  togglePointCampaign,
} from "@/services/admin/points-api";
import type { PointCampaignSerialized } from "@/services/admin/types";

import { PointCampaignModal } from "./PointCampaignModal";

function axiosMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const d = err.response?.data;
  if (d && typeof d === "object") {
    const m = d.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  return err.message || "Có lỗi xảy ra.";
}

function fmtRange(c: PointCampaignSerialized) {
  const a = new Date(c.startAt);
  const b = new Date(c.endAt);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "—";
  const opt: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };
  return `${a.toLocaleDateString("vi-VN", opt)} – ${b.toLocaleDateString("vi-VN", opt)}`;
}

export function PointCampaignsTab() {
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();
  const [modalOpen, setModalOpen] = useState(false);
  const [edit, setEdit] = useState<PointCampaignSerialized | null>(null);

  const q = useQuery({
    queryKey: adminKeys.pointCampaigns,
    queryFn: fetchPointCampaigns,
  });

  const toggleMut = useMutation({
    mutationFn: togglePointCampaign,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.pointCampaigns });
      await qc.invalidateQueries({ queryKey: adminKeys.pointConfig });
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const rows = q.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
            Chiến dịch
          </p>
          <h2 className="mt-1 text-lg font-bold text-[#1a3c34]">
            Campaign tích điểm
          </h2>
          <p className="mt-1 text-sm text-foreground/55">
            Khi có campaign trong khung giờ, % tích có thể ghi đè cấu hình gốc.
          </p>
        </div>
        <Button
          className="rounded-full bg-[#1a3c34] font-semibold text-white"
          onPress={() => {
            setEdit(null);
            setModalOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" />
          Tạo campaign
        </Button>
      </div>

      <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 border-b border-black/6 px-5 py-4">
          <Text className="text-sm font-semibold text-[#1a3c34]">
            Danh sách campaign
          </Text>
          <Text className="text-xs text-foreground/45">
            {rows.length} mục
            {q.isLoading ? " · Đang tải…" : ""}
          </Text>
        </CardContent>
        <Table.Root className="min-w-[720px]" aria-label="Campaign">
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
                  % tích
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Thời gian
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Bật
                </Table.Column>
                <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Thao tác
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {q.isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <Table.Row key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <Table.Cell key={j} className="px-5 py-4">
                            <div className="h-4 animate-pulse rounded-md bg-black/5" />
                          </Table.Cell>
                        ))}
                      </Table.Row>
                    ))
                  : rows.map((c) => (
                      <Table.Row key={c.id}>
                        <Table.Cell className="px-5 py-3 font-semibold text-[#1a3c34]">
                          {c.name}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 tabular-nums text-sm">
                          +{Number.parseFloat(c.earnPercent).toFixed(1)}%
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-sm text-foreground/75">
                          {fmtRange(c)}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3">
                          <Switch
                            isSelected={c.isActive}
                            onChange={(next) => {
                              if (next !== c.isActive) toggleMut.mutate(c.id);
                            }}
                            isDisabled={toggleMut.isPending}
                          >
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                          </Switch>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-right">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            aria-label="Sửa"
                            onPress={() => {
                              setEdit(c);
                              setModalOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table.Root>
        {!q.isLoading && rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-foreground/45">
            Chưa có campaign — tạo mới để tăng % tích trong đợt.
          </p>
        ) : null}
      </Card>

      <PointCampaignModal
        campaign={edit}
        isOpen={modalOpen}
        onOpenChange={(o) => {
          setModalOpen(o);
          if (!o) setEdit(null);
        }}
      />
    </div>
  );
}
