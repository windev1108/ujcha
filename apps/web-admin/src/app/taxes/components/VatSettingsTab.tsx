"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Check, Trash2, Pencil } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  Label,
  Table,
  Text,
} from "@heroui/react";
import type { AxiosError } from "axios";

import {
  adminFieldStack,
  adminInputClass,
  adminLabelClass,
} from "@/lib/admin-form-classes";
import { OrderDateRangePicker } from "@/app/orders/components/OrderDateRangePicker";
import { adminKeys } from "@/services/admin/keys";
import {
  createVatConfig,
  deleteVatConfig,
  fetchVatConfigs,
  updateVatConfig,
} from "@/services/admin/taxes-api";
import type {
  CreateVatConfigBody,
  UpdateVatConfigBody,
  VatConfig,
} from "@/services/admin/types";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCDate().toString().padStart(2, "0")}/${(d.getUTCMonth() + 1).toString().padStart(2, "0")}/${d.getUTCFullYear()}`;
}

type FormState = {
  label: string;
  vatPercent: string;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  label: "",
  vatPercent: "10",
  effectiveFrom: new Date().toISOString().split("T")[0] ?? "",
  effectiveTo: "",
  isActive: false,
};

function VatForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof FormState, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const invalid = !form.label.trim() || !form.vatPercent || !form.effectiveFrom;

  return (
    <Card className="rounded-2xl border border-blue-200/60 bg-blue-50/30 shadow-sm">
      <CardContent className="flex flex-col gap-5 p-5">
        <Text className="text-sm font-semibold text-foreground">
          {initial.label ? "Chỉnh sửa cấu hình VAT" : "Thêm cấu hình VAT mới"}
        </Text>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={adminFieldStack}>
            <Label className={adminLabelClass}>Tên cấu hình</Label>
            <Input
              aria-label="Tên cấu hình VAT"
              placeholder='Ví dụ: VAT 10% – 2024'
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
              className={adminInputClass}
            />
          </div>
          <div className={adminFieldStack}>
            <Label className={adminLabelClass}>Tỷ lệ VAT (%)</Label>
            <Input
              aria-label="Tỷ lệ VAT"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.vatPercent}
              onChange={(e) => set("vatPercent", e.target.value)}
              className={adminInputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <OrderDateRangePicker
              label="Khoảng hiệu lực"
              from={form.effectiveFrom}
              to={form.effectiveTo || form.effectiveFrom}
              onRangeChange={(f, t) => {
                set("effectiveFrom", f);
                set("effectiveTo", t === f ? "" : t);
              }}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm select-none">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => set("isActive", e.target.checked)}
            className="size-4 rounded accent-[#1a3c34]"
          />
          <span className="font-medium text-foreground/80">
            Kích hoạt ngay (deactivate các cấu hình khác)
          </span>
        </label>

        {form.isActive && (
          <Card className="rounded-xl border border-amber-200/80 bg-amber-50">
            <CardContent className="px-4 py-3">
              <Text className="text-xs text-amber-800">
                Khi kích hoạt, <strong>tất cả đơn hàng mới</strong> sẽ áp dụng thuế suất này.
                Đơn cũ giữ nguyên giá trị đã lưu.
              </Text>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 border-t border-black/5 pt-4">
          <Button
            className="rounded-xl bg-[#1a3c34] px-5 font-semibold text-white"
            onPress={() => onSave(form)}
            isDisabled={invalid || saving}
          >
            {saving ? "Đang lưu…" : "Lưu cấu hình"}
          </Button>
          <Button variant="ghost" className="rounded-xl" onPress={onCancel} isDisabled={saving}>
            Huỷ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function VatSettingsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<VatConfig | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: configs, isLoading } = useQuery({
    queryKey: adminKeys.vatConfigs,
    queryFn: fetchVatConfigs,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: adminKeys.vatConfigs });

  const createMut = useMutation({
    mutationFn: (body: CreateVatConfigBody) => createVatConfig(body),
    onSuccess: () => { invalidate(); setShowForm(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateVatConfigBody }) =>
      updateVatConfig(id, body),
    onSuccess: () => { invalidate(); setEditTarget(null); },
  });

  const deleteMut = useMutation({
    mutationFn: deleteVatConfig,
    onSuccess: () => { invalidate(); setDeleteConfirm(null); },
  });

  function handleSave(f: FormState) {
    const body: CreateVatConfigBody = {
      label: f.label.trim(),
      vatPercent: parseFloat(f.vatPercent),
      effectiveFrom: f.effectiveFrom,
      ...(f.effectiveTo ? { effectiveTo: f.effectiveTo } : {}),
      isActive: f.isActive,
    };
    if (editTarget) {
      updateMut.mutate({ id: editTarget.id, body });
    } else {
      createMut.mutate(body);
    }
  }

  const mutError = (createMut.error ?? updateMut.error ?? deleteMut.error) as AxiosError<{ message?: string }> | null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Cấu hình thuế GTGT (VAT)</p>
          <Text className="mt-0.5 text-xs text-foreground/50">
            Phiên bản VAT theo giai đoạn. Chỉ một cấu hình kích hoạt tại một thời điểm.
          </Text>
        </div>
        {!showForm && !editTarget && (
          <Button
            className="shrink-0 rounded-full bg-[#1a3c34] px-4 font-semibold text-white shadow-md shadow-[#1a3c34]/20"
            onPress={() => setShowForm(true)}
          >
            <Plus className="size-4" />
            Thêm cấu hình
          </Button>
        )}
      </div>

      {mutError && (
        <Card className="rounded-2xl border border-red-200/80 bg-red-50">
          <CardContent className="px-4 py-3">
            <Text className="text-sm text-red-700">
              {(mutError.response?.data as { message?: string })?.message ?? "Có lỗi xảy ra."}
            </Text>
          </CardContent>
        </Card>
      )}

      {showForm && !editTarget && (
        <VatForm
          initial={emptyForm}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
          saving={createMut.isPending}
        />
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <Card className="rounded-2xl border border-black/6">
          <CardContent className="p-5">
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-black/5" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && configs?.length === 0 && (
        <Card className="rounded-2xl border border-dashed border-black/12">
          <CardContent className="py-12 text-center">
            <Text className="text-sm text-foreground/40">
              Chưa có cấu hình VAT nào. Thêm để áp dụng thuế cho đơn hàng mới.
            </Text>
          </CardContent>
        </Card>
      )}

      {/* Config table */}
      {!isLoading && configs && configs.length > 0 && (
        <Card className="overflow-hidden rounded-2xl border border-black/6 shadow-sm">
          <Table.Root aria-label="Danh sách cấu hình VAT">
            <Table.ScrollContainer>
              <Table.Content>
                <Table.Header>
                  <Table.Column isRowHeader className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Tên cấu hình
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    VAT %
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Hiệu lực từ
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Hiệu lực đến
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Đơn hàng
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Trạng thái
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Thao tác
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {configs.map((cfg) =>
                    editTarget?.id === cfg.id ? (
                      <Table.Row key={cfg.id}>
                        <Table.Cell colSpan={7} className="p-4">
                          <VatForm
                            initial={{
                              label: cfg.label,
                              vatPercent: parseFloat(cfg.vatPercent).toFixed(2),
                              effectiveFrom: cfg.effectiveFrom.split("T")[0] ?? cfg.effectiveFrom,
                              effectiveTo: cfg.effectiveTo ? (cfg.effectiveTo.split("T")[0] ?? "") : "",
                              isActive: cfg.isActive,
                            }}
                            onSave={handleSave}
                            onCancel={() => setEditTarget(null)}
                            saving={updateMut.isPending}
                          />
                        </Table.Cell>
                      </Table.Row>
                    ) : (
                      <Table.Row key={cfg.id}>
                        <Table.Cell className="px-5 py-3 font-semibold text-[#1a3c34]">
                          {cfg.label}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 font-mono text-sm font-bold tabular-nums text-foreground">
                          {parseFloat(cfg.vatPercent).toFixed(2)}%
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-sm text-foreground/70">
                          {fmtDate(cfg.effectiveFrom)}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-sm text-foreground/55">
                          {cfg.effectiveTo ? fmtDate(cfg.effectiveTo) : "—"}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 tabular-nums text-sm text-foreground/60">
                          {cfg._count.orders}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3">
                          {cfg.isActive ? (
                            <Chip size="sm" variant="soft" className="border-0 bg-emerald-500/15 font-bold uppercase tracking-wide text-emerald-900">
                              Đang dùng
                            </Chip>
                          ) : (
                            <Chip size="sm" variant="soft" className="border-0 bg-black/6 font-bold uppercase tracking-wide text-foreground/50">
                              Tắt
                            </Chip>
                          )}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {!cfg.isActive && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-lg text-emerald-700 hover:bg-emerald-50"
                                onPress={() => updateMut.mutate({ id: cfg.id, body: { isActive: true } })}
                                isDisabled={updateMut.isPending}
                              >
                                <Check className="size-3.5" />
                                {updateMut.isPending && updateMut.variables?.id === cfg.id
                                  ? "Đang lưu…"
                                  : "Kích hoạt"}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-lg text-foreground/50"
                              onPress={() => setEditTarget(cfg)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            {deleteConfirm === cfg.id ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-lg text-red-700 hover:bg-red-50"
                                  onPress={() => deleteMut.mutate(cfg.id)}
                                  isDisabled={deleteMut.isPending}
                                >
                                  {deleteMut.isPending ? "Xoá…" : "Xác nhận"}
                                </Button>
                                <Button size="sm" variant="ghost" className="rounded-lg" onPress={() => setDeleteConfirm(null)}>
                                  Huỷ
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-lg text-red-400 hover:bg-red-50 hover:text-red-700"
                                onPress={() => setDeleteConfirm(cfg.id)}
                                isDisabled={cfg.isActive || cfg._count.orders > 0}
                                aria-label="Xoá cấu hình"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    )
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table.Root>
        </Card>
      )}
    </div>
  );
}
