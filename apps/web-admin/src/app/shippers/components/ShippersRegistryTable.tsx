"use client";

import {
  Avatar,
  Button,
  Card,
  CardContent,
  Chip,
  Switch,
  Table,
  Text,
} from "@heroui/react";
import { Pencil } from "lucide-react";

import type { AdminShipper } from "@/services/admin/types";

import { shipperNameInitials, shipperShortId } from "./shipper-display";

type Props = {
  shippers: AdminShipper[];
  isLoading?: boolean;
  busyToggleId?: string | null;
  onToggleActive: (id: string, next: boolean) => void;
  onAssign: (s: AdminShipper) => void;
  onEdit: (s: AdminShipper) => void;
};

export function ShippersRegistryTable({
  shippers,
  isLoading,
  busyToggleId,
  onToggleActive,
  onAssign,
  onEdit,
}: Props) {
  if (isLoading) {
    return (
      <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
        <Table.Root className="min-w-[960px]" aria-hidden>
          <Table.ScrollContainer>
            <Table.Content>
              <Table.Header>
                <Table.Column
                  isRowHeader
                  textValue="Shipper"
                  className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45"
                >
                  Shipper
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Liên hệ
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Nhận đơn
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Trạng thái
                </Table.Column>
                <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Thao tác
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Table.Row key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <Table.Cell key={j} className="px-5 py-4">
                        <div className="h-4 animate-pulse rounded-md bg-black/5" />
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table.Root>
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
      <CardContent className="border-b border-black/6 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#1a3c34]">Danh sách shipper</p>
          <Text className="text-xs text-foreground/45">
            {shippers.length} người
          </Text>
        </div>
      </CardContent>
      <Table.Root className="min-w-[960px]" aria-label="Danh sách shipper">
        <Table.ScrollContainer>
          <Table.Content>
            <Table.Header>
              <Table.Column
                isRowHeader
                textValue="Shipper"
                className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45"
              >
                Shipper
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Liên hệ
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Nhận đơn
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Trạng thái
              </Table.Column>
              <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Thao tác
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {shippers.length === 0 ? (
                <Table.Row>
                  <Table.Cell className="px-5 py-12 text-center" colSpan={5}>
                    <p className="text-sm text-foreground/50">
                      Không có shipper nào khớp bộ lọc. Thử đổi tìm kiếm hoặc thêm
                      shipper mới.
                    </p>
                  </Table.Cell>
                </Table.Row>
              ) : null}
              {shippers.map((s) => {
                const busy = busyToggleId === s.id;
                const deliveries = s.completedDeliveryCount ?? 0;
                return (
                  <Table.Row key={s.id} id={s.id}>
                    <Table.Cell className="px-5 py-4 align-middle">
                      <div className="flex items-center gap-3">
                        {s.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.imageUrl}
                            alt={s.name}
                            className="size-9 shrink-0 rounded-xl object-cover ring-1 ring-black/8"
                          />
                        ) : (
                          <Avatar size="sm" className="shrink-0" {...({} as any)}>
                            <Avatar.Fallback className="text-[10px] font-bold" {...({} as any)}>
                              {shipperNameInitials(s.name)}
                            </Avatar.Fallback>
                          </Avatar>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-foreground">
                            {s.name}
                          </p>
                          <p className="text-[11px] text-foreground/45">
                            ID: #{shipperShortId(s.id)}
                          </p>
                          <p className="text-[11px] text-foreground/40">
                            {deliveries.toLocaleString("vi-VN")} đơn hoàn thành
                          </p>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="px-5 py-4 align-middle">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {s.phone?.trim() || "—"}
                        </p>
                        <p className="text-xs text-foreground/45">Số điện thoại</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="px-5 py-4 align-middle">
                      <Switch
                        size="sm"
                        isSelected={s.isActive}
                        isDisabled={busy}
                        onChange={(v) => onToggleActive(s.id, v)}
                      >
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch>
                    </Table.Cell>
                    <Table.Cell className="px-5 py-4 align-middle">
                      <Chip
                        size="sm"
                        variant="soft"
                        className={
                          s.isActive
                            ? "border-0 bg-emerald-100 font-bold uppercase tracking-wide text-emerald-900"
                            : "border-0 bg-zinc-100 font-bold uppercase tracking-wide text-zinc-600"
                        }
                      >
                        <Chip.Label className="inline-flex items-center gap-1.5">
                          <span
                            className={`size-1.5 rounded-full ${s.isActive ? "bg-emerald-500" : "bg-zinc-400"}`}
                          />
                          {s.isActive ? "Sẵn sàng" : "Tắt"}
                        </Chip.Label>
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="px-5 py-4 text-right align-middle">
                      <div className="inline-flex flex-wrap justify-end gap-1">
                        <Button
                          size="sm"
                          className="rounded-full bg-[#1a3c34] px-3 font-semibold text-white disabled:bg-zinc-200 disabled:text-zinc-500"
                          onPress={() => onAssign(s)}
                          isDisabled={!s.isActive}
                        >
                          Gán đơn
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          className="rounded-xl"
                          aria-label="Sửa shipper"
                          onPress={() => onEdit(s)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table.Root>
    </Card>
  );
}
