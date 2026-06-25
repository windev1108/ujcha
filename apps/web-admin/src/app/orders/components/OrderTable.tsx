"use client";

import {
  Avatar,
  Button,
  Chip,
  Table,
} from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import {
  Bike,
  CheckSquare2,
  Eye,
  FileText,
  MoreVertical,
  PencilIcon,
  ShoppingBag,
  Square,
  Trash2,
  UserPlus,
  Users,
  UtensilsCrossed,
} from "lucide-react";

import { formatVnd } from "@/lib/product-display";
import type { AdminOrder } from "@/services/admin/types";

import {
  canAssignShipper,
  customerDisplayName,
  customerInitials,
  formatOrderRef,
  formatOrderTime,
  formatOrderTimeFull,
  formatTimeHm,
  orderStatusChipClass,
  orderStatusLabel,
  serviceTypeLabel,
  tableLabel,
} from "./order-display";

type Props = {
  items: AdminOrder[];
  isLoading?: boolean;
  onViewDetail: (order: AdminOrder) => void;
  onViewInvoice?: (order: AdminOrder) => void;
  onAssignShipper: (order: AdminOrder) => void;
  onEdit: (order: AdminOrder) => void;
  onDelete: (order: AdminOrder) => void;
  busyOrderId?: string | null;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
};

function ServiceCell({ order }: { order: AdminOrder }) {
  if (order.type === "delivery") {
    return (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-[#1a3c34]">
          <Bike className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{serviceTypeLabel("delivery")}</p>
          {order.shipper ? (
            <p className="truncate text-xs text-foreground/50">
              Shipper: {order.shipper.name}
            </p>
          ) : null}
        </div>
      </div>
    );
  }
  if (order.type === "table") {
    const t = tableLabel(order);
    return (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-950">
          <UtensilsCrossed className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {t ? `Bàn ${t}` : serviceTypeLabel("table")}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-violet-50 text-violet-900">
        <ShoppingBag className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{serviceTypeLabel("pickup")}</p>
        {order.pickupTime ? (
          <p className="text-xs text-foreground/50">
            {formatTimeHm(order.pickupTime)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function OrderRowDropdown({
  order,
  onViewInvoice,
  onEdit,
  onDelete,
}: {
  order: AdminOrder;
  onViewInvoice?: (o: AdminOrder) => void;
  onEdit: (o: AdminOrder) => void;
  onDelete: (o: AdminOrder) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const pick = (action: () => void) => {
    setOpen(false);
    // defer so the popup unmounts before a modal mounts
    requestAnimationFrame(action);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Thêm thao tác"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="inline-flex size-8 items-center justify-center rounded-lg text-foreground/60 outline-none transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-black/20"
      >
        <MoreVertical className="size-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[176px] overflow-hidden rounded-xl border border-black/8 bg-white py-1 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)]"
        >
          {onViewInvoice && (
            <button
              role="menuitem"
              type="button"
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-foreground hover:bg-black/[0.04]"
              onClick={() => pick(() => onViewInvoice(order))}
            >
              <FileText className="size-3.5 shrink-0 text-foreground/45" aria-hidden />
              Xem hóa đơn
            </button>
          )}
          <button
            role="menuitem"
            type="button"
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-foreground hover:bg-black/[0.04]"
            onClick={() => pick(() => onEdit(order))}
          >
            <PencilIcon className="size-3.5 shrink-0 text-foreground/45" aria-hidden />
            Cập nhật đơn
          </button>
          <div className="my-1 border-t border-black/6" />
          <button
            role="menuitem"
            type="button"
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            onClick={() => pick(() => onDelete(order))}
          >
            <Trash2 className="size-3.5 shrink-0 text-foreground/45" aria-hidden />
            Xóa đơn
          </button>
        </div>
      )}
    </div>
  );
}

export function OrderTable({
  items,
  isLoading,
  onViewDetail,
  onViewInvoice,
  onAssignShipper,
  onEdit,
  onDelete,
  busyOrderId,
  selectedIds,
  onSelectionChange,
}: Props) {
  const allSelected = items.length > 0 && items.every((o) => selectedIds.has(o.id));
  const someSelected = !allSelected && items.some((o) => selectedIds.has(o.id));

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selectedIds);
      items.forEach((o) => next.delete(o.id));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedIds);
      items.forEach((o) => next.add(o.id));
      onSelectionChange(next);
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  const columns = (
    <Table.Header>
      <Table.Column
        isRowHeader
        textValue="Chọn"
        className="w-10 px-3 py-3"
      >
        <button
          aria-label={allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
          onClick={toggleAll}
          className="flex items-center text-foreground/40 hover:text-foreground/70"
        >
          {allSelected ? (
            <CheckSquare2 className="size-4 text-[#1a3c34]" />
          ) : someSelected ? (
            <CheckSquare2 className="size-4 text-foreground/40" />
          ) : (
            <Square className="size-4" />
          )}
        </button>
      </Table.Column>
      <Table.Column
        isRowHeader
        textValue="Mã đơn"
        className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45"
      >
        Mã đơn
      </Table.Column>
      <Table.Column className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
        Khách
      </Table.Column>
      <Table.Column className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
        Nguồn
      </Table.Column>
      <Table.Column className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
        Dịch vụ
      </Table.Column>
      <Table.Column className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
        Tổng
      </Table.Column>
      <Table.Column className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
        Trạng thái
      </Table.Column>
      <Table.Column className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
        Giờ tạo
      </Table.Column>
      <Table.Column className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
        Thao tác
      </Table.Column>
    </Table.Header>
  );

  if (isLoading) {
    return (
      <CardTableShell>
        <Table.Root className="min-w-[1080px]" aria-hidden>
          <Table.ScrollContainer>
            <Table.Content>
              {columns}
              <Table.Body>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Table.Row key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <Table.Cell key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded-md bg-black/5" />
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table.Root>
      </CardTableShell>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/15 bg-white p-12 text-center text-sm text-foreground/50">
        Không có đơn phù hợp bộ lọc.
      </div>
    );
  }
  return (
    <CardTableShell>
      <Table.Root className="min-w-[1080px]" aria-label="Danh sách đơn hàng">
        <Table.ScrollContainer>
          <Table.Content>
            {columns}
            <Table.Body>
              {items.map((order) => {
                const busy = busyOrderId === order.id;
                const showAssign = canAssignShipper(order);
                const checked = selectedIds.has(order.id);
                return (
                  <Table.Row
                    key={order.id}
                    id={order.id}
                    className={checked ? "bg-[#1a3c34]/[0.03]" : undefined}
                  >
                    <Table.Cell className="w-10 px-3 py-3 align-middle">
                      <button
                        aria-label={checked ? "Bỏ chọn đơn" : "Chọn đơn"}
                        onClick={() => toggleOne(order.id)}
                        className="flex items-center text-foreground/40 hover:text-foreground/70"
                      >
                        {checked ? (
                          <CheckSquare2 className="size-4 text-[#1a3c34]" />
                        ) : (
                          <Square className="size-4" />
                        )}
                      </button>
                    </Table.Cell>

                    <Table.Cell
                      className="px-4 py-3 align-middle"
                      textValue={formatOrderRef(order)}
                    >
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={() => onViewDetail(order)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            onViewDetail(order);
                        }}
                        className="cursor-pointer font-mono text-sm font-bold text-[#1a3c34] underline-offset-2 hover:underline"
                      >
                        {formatOrderRef(order)}
                      </span>
                    </Table.Cell>

                    <Table.Cell className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <Avatar size="sm" className="shrink-0" {...({} as any)}>
                          <Avatar.Fallback className="text-[10px] font-bold" {...({} as any)}>
                            <>
                              {customerInitials(order)}
                            </>
                          </Avatar.Fallback>
                        </Avatar >
                        <span className="truncate text-sm font-medium">
                          {customerDisplayName(order)}
                        </span>
                      </div>
                    </Table.Cell>

                    <Table.Cell className="px-4 py-3 align-middle">
                      {order.groupOrder ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200">
                          <Users className="size-3" aria-hidden />
                          Đơn nhóm
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-semibold text-foreground/55">
                          Đơn thường
                        </span>
                      )}
                    </Table.Cell>

                    <Table.Cell className="px-4 py-3 align-middle">
                      <ServiceCell order={order} />
                    </Table.Cell>

                    <Table.Cell className="px-4 py-3 align-middle font-medium tabular-nums">
                      {formatVnd(
                        Number(order.totalAmount)
                        - Number(order.discountAmount)
                        - Number(order.pointDiscountAmount)
                        + (order.type === "delivery" ? Number(order.shippingFee) : 0)
                      )}
                    </Table.Cell>

                    <Table.Cell className="px-4 py-3 align-middle">
                      <Chip
                        size="sm"
                        variant="soft"
                        className={`border-0 font-bold uppercase tracking-wide ${orderStatusChipClass(order.status)}`}
                      >
                        <Chip.Label>{orderStatusLabel(order.status)}</Chip.Label>
                      </Chip>
                    </Table.Cell>

                    <Table.Cell className="px-4 py-3 align-middle text-sm text-foreground/70">
                      <span title={formatOrderTimeFull(order.createdAt)} className="cursor-default">
                        {formatOrderTime(order.createdAt)}
                      </span>
                    </Table.Cell>

                    <Table.Cell className="px-4 py-3 text-right align-middle">
                      <div className="inline-flex items-center justify-end gap-1">
                        {showAssign ? (
                          <Button
                            size="sm"
                            className="rounded-lg bg-[#1a3c34] px-2 font-semibold text-white"
                            onPress={() => onAssignShipper(order)}
                            isDisabled={busy}
                            aria-label="Gán shipper"
                          >
                            <UserPlus className="mr-1 size-3.5" />
                            Shipper
                          </Button>
                        ) : null}

                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          aria-label="Chi tiết"
                          onPress={() => onViewDetail(order)}
                        >
                          <Eye className="size-4" />
                        </Button>

                        <OrderRowDropdown
                          order={order}
                          onViewInvoice={onViewInvoice}
                          onEdit={onEdit}
                          onDelete={onDelete}
                        />
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table.Root>
    </CardTableShell>
  );
}

function CardTableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-black/6 bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
      {children}
    </div>
  );
}
