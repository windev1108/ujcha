"use client";

import React from "react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Switch,
  TextArea,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  Coins,
  Gift,
  Pencil,
  Plus,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  adminFieldStackLoose,
  adminInputClass,
  adminLabelClass,
} from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import {
  createPointReward,
  deletePointReward,
  fetchPointRewardCatalogAdmin,
  updatePointReward,
} from "@/services/admin/points-api";
import { fetchAdminVouchers } from "@/services/admin/vouchers-api";
import type { PointRewardCatalogItem } from "@/services/admin/types";

function axiosMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const d = err.response?.data;
  if (d && typeof d === "object") {
    const m = d.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  return (err as Error).message || "Có lỗi xảy ra.";
}

function formatVnd(s: string | number) {
  const n = typeof s === "string" ? parseFloat(s) : s;
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

type FormState = {
  name: string;
  description: string;
  pointCost: string;
  voucherId: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  pointCost: "",
  voucherId: "",
  imageUrl: "",
  isActive: true,
  sortOrder: "0",
};

function RewardForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof FormState, v: string | boolean) =>
    setForm((p) => ({ ...p, [k]: v }));

  const vouchersQuery = useQuery({
    queryKey: adminKeys.vouchers,
    queryFn: fetchAdminVouchers,
    staleTime: 60_000,
  });

  const vouchers = vouchersQuery.data ?? [];
  const activeVouchers = vouchers.filter((v) => v.isActive);

  const selectedVoucher = vouchers.find((v) => v.id === form.voucherId);

  return (
    <div className="space-y-4 rounded-2xl border border-kun-primary/20 bg-[#f0faf6] p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`col-span-2 ${adminFieldStackLoose}`}>
          <Label className={adminLabelClass}>Tên phần thưởng *</Label>
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className={adminInputClass}
            placeholder="Ví dụ: Voucher giảm 30k"
          />
        </div>

        <div className={`col-span-2 ${adminFieldStackLoose}`}>
          <Label className={adminLabelClass}>Mô tả</Label>
          <TextArea
            value={form.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set("description", e.target.value)}
            className={adminInputClass}
            rows={2}
            placeholder="Mô tả ngắn hiển thị cho khách..."
          />
        </div>

        <div className={adminFieldStackLoose}>
          <Label className={adminLabelClass}>Số điểm cần đổi *</Label>
          <Input
            type="number"
            min={1}
            value={form.pointCost}
            onChange={(e) => set("pointCost", e.target.value)}
            className={adminInputClass}
            placeholder="100"
          />
        </div>

        <div className={adminFieldStackLoose}>
          <Label className={adminLabelClass}>Thứ tự hiển thị</Label>
          <Input
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(e) => set("sortOrder", e.target.value)}
            className={adminInputClass}
          />
        </div>

        <div className={`col-span-2 ${adminFieldStackLoose}`}>
          <Label className={adminLabelClass}>Voucher cấp cho khách *</Label>
          <select
            value={form.voucherId}
            onChange={(e) => set("voucherId", e.target.value)}
            className={`${adminInputClass} w-full`}
          >
            <option value="">-- Chọn voucher --</option>
            {activeVouchers.map((v) => (
              <option key={v.id} value={v.id}>
                [{v.code}] {v.name} —{" "}
                {v.discountType === "percent"
                  ? `Giảm ${v.discountValue}%`
                  : `Giảm ${formatVnd(v.discountValue)}`}
              </option>
            ))}
          </select>
          {selectedVoucher && (
            <p className="mt-1 text-xs text-foreground/50">
              Đơn tối thiểu: {formatVnd(selectedVoucher.minOrderAmount)}
              {selectedVoucher.endsAt
                ? ` · HSD: ${new Date(selectedVoucher.endsAt).toLocaleDateString("vi-VN")}`
                : ""}
            </p>
          )}
        </div>

        <div className={`col-span-2 ${adminFieldStackLoose}`}>
          <Label className={adminLabelClass}>URL hình ảnh (tuỳ chọn)</Label>
          <Input
            value={form.imageUrl}
            onChange={(e) => set("imageUrl", e.target.value)}
            className={adminInputClass}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-black/8 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-medium">Hiển thị cho khách</p>
          <p className="text-xs text-foreground/50">Tắt để tạm ẩn mà không xóa.</p>
        </div>
        <Switch
          isSelected={form.isActive}
          onChange={(v) => set("isActive", v)}
          className="shrink-0"
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </div>

      <div className="flex justify-end gap-2 border-t border-black/6 pt-3">
        <Button variant="ghost" onPress={onCancel}>
          Hủy
        </Button>
        <Button
          className="bg-[#1a3c34] font-semibold text-white"
          onPress={() => onSave(form)}
          isDisabled={isSaving}
        >
          {isSaving ? "Đang lưu…" : "Lưu phần thưởng"}
        </Button>
      </div>
    </div>
  );
}

function RewardRow({
  item,
  onEdit,
  onDelete,
}: {
  item: PointRewardCatalogItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const v = item.voucher;
  const discountLabel =
    v.discountType === "percent"
      ? `Giảm ${v.discountValue}%`
      : `Giảm ${formatVnd(v.discountValue)}`;

  return (
    <div
      className={`flex items-start gap-4 rounded-2xl border bg-white p-4 transition ${
        item.isActive ? "border-black/6" : "border-black/4 opacity-55"
      }`}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#1a3c34]/8">
        <Gift className="size-5 text-[#1a3c34]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-[#1a1a1a]">{item.name}</p>
          {!item.isActive && (
            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Ẩn
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 text-xs text-foreground/55 line-clamp-1">{item.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/50">
          <span className="flex items-center gap-1">
            <Coins className="size-3.5 text-[#c9a227]" />
            <span className="font-semibold tabular-nums text-[#1a1a1a]">
              {item.pointCost.toLocaleString("vi-VN")} điểm
            </span>
          </span>
          <span className="flex items-center gap-1">
            <Ticket className="size-3.5 text-[#5a8f7a]" />
            <span>[{v.code}]</span>
          </span>
          <span className="font-medium text-[#1a3c34]">{discountLabel}</span>
          {Number(v.minOrderAmount) > 0 && (
            <span>Đơn tối thiểu {formatVnd(v.minOrderAmount)}</span>
          )}
          {v.endsAt && (
            <span>HSD: {new Date(v.endsAt).toLocaleDateString("vi-VN")}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-xl p-2 text-foreground/40 hover:bg-black/5 hover:text-foreground transition"
          title="Sửa"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-xl p-2 text-red-400 hover:bg-red-50 hover:text-red-600 transition"
          title="Xóa"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function PointRewardsTab() {
  const qc = useQueryClient();
  const { showAlert, confirm } = useAppDialog();

  const rewardsQuery = useQuery({
    queryKey: adminKeys.pointRewards,
    queryFn: fetchPointRewardCatalogAdmin,
  });

  const items = rewardsQuery.data ?? [];

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(EMPTY_FORM);

  const createMut = useMutation({
    mutationFn: (f: FormState) =>
      createPointReward({
        name: f.name,
        description: f.description || null,
        pointCost: parseInt(f.pointCost, 10),
        voucherId: f.voucherId,
        imageUrl: f.imageUrl || null,
        isActive: f.isActive,
        sortOrder: parseInt(f.sortOrder, 10) || 0,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.pointRewards });
      setShowForm(false);
      setFormState(EMPTY_FORM);
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: string; f: FormState }) =>
      updatePointReward(id, {
        name: f.name,
        description: f.description || null,
        pointCost: parseInt(f.pointCost, 10),
        voucherId: f.voucherId,
        imageUrl: f.imageUrl || null,
        isActive: f.isActive,
        sortOrder: parseInt(f.sortOrder, 10) || 0,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.pointRewards });
      setEditingId(null);
      setFormState(EMPTY_FORM);
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePointReward(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.pointRewards });
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  function handleEdit(item: PointRewardCatalogItem) {
    setEditingId(item.id);
    setFormState({
      name: item.name,
      description: item.description ?? "",
      pointCost: String(item.pointCost),
      voucherId: item.voucher.id,
      imageUrl: item.imageUrl ?? "",
      isActive: item.isActive,
      sortOrder: String(item.sortOrder),
    });
    setShowForm(false);
  }

  async function handleDelete(item: PointRewardCatalogItem) {
    const ok = await confirm({
      title: "Xác nhận xóa",
      description: `Xóa phần thưởng "${item.name}"? Hành động này không thể hoàn tác.`,
      confirmLabel: "Xóa",
      tone: "danger",
    });
    if (!ok) return;
    deleteMut.mutate(item.id);
  }

  function handleSave(f: FormState) {
    if (!f.name.trim()) { void showAlert("Vui lòng nhập tên phần thưởng."); return; }
    if (!f.pointCost || parseInt(f.pointCost, 10) < 1) { void showAlert("Số điểm phải ≥ 1."); return; }
    if (!f.voucherId) { void showAlert("Vui lòng chọn voucher."); return; }

    if (editingId) {
      updateMut.mutate({ id: editingId, f });
    } else {
      createMut.mutate(f);
    }
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-black/6 shadow-sm">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Danh mục đổi điểm
              </p>
              <p className="mt-1 text-sm text-foreground/55">
                Mỗi mục ánh xạ X điểm → một voucher giảm giá cụ thể cấp cho
                khách.
              </p>
            </div>
            <Button
              className="rounded-full bg-[#1a3c34] font-semibold text-white"
              onPress={() => {
                setEditingId(null);
                setFormState(EMPTY_FORM);
                setShowForm((p) => !p);
              }}
            >
              {showForm ? (
                <>
                  <X className="size-4" /> Đóng
                </>
              ) : (
                <>
                  <Plus className="size-4" /> Thêm phần thưởng
                </>
              )}
            </Button>
          </div>

          {showForm && !editingId && (
            <RewardForm
              initial={EMPTY_FORM}
              onSave={handleSave}
              onCancel={() => setShowForm(false)}
              isSaving={isSaving}
            />
          )}

          {rewardsQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-black/5" />
              ))}
            </div>
          ) : items.length === 0 && !showForm ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-[#1a3c34]/8">
                <Gift className="size-7 text-[#1a3c34]" />
              </div>
              <p className="text-sm text-foreground/55">
                Chưa có phần thưởng nào. Bấm{" "}
                <strong>Thêm phần thưởng</strong> để tạo mới.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id}>
                  <RewardRow
                    item={item}
                    onEdit={() => handleEdit(item)}
                    onDelete={() => void handleDelete(item)}
                  />
                  {editingId === item.id && (
                    <div className="mt-2">
                      <RewardForm
                        initial={formState}
                        onSave={handleSave}
                        onCancel={() => setEditingId(null)}
                        isSaving={isSaving}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-amber-200/80 bg-amber-50 shadow-sm">
        <CardContent className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Lưu ý vận hành
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            <li>
              • Voucher được chọn là <strong>template</strong> — mỗi khách đổi
              thành công sẽ nhận một bản sao riêng vào túi.
            </li>
            <li>
              • Nếu khách đã có voucher chưa dùng (cùng loại), hệ thống sẽ từ
              chối cho đến khi voucher đó được sử dụng.
            </li>
            <li>
              • Vô hiệu hóa phần thưởng sẽ ẩn nó khỏi trang đổi điểm của
              khách; điểm không bị ảnh hưởng.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
