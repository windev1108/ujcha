"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { ExternalLink, GripVertical, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button, Input, Label } from "@heroui/react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { adminFieldStack, adminLabelClass } from "@/lib/admin-form-classes";
import {
  fetchDeliveryPlatforms,
  createDeliveryPlatform,
  updateDeliveryPlatform,
  deleteDeliveryPlatform,
  type DeliveryPlatform,
  type DisplayMode,
} from "@/services/admin/store-api";

function axiosMsg(e: unknown) {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const m = err.response?.data?.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.join(", ");
  return (err as Error).message || "Có lỗi xảy ra.";
}

const PLATFORMS_KEY = ["admin", "store", "platforms"];

type FormState = {
  name: string;
  link: string;
  thumbnailUrl: string;
  sortOrder: string;
  isActive: boolean;
  displayMode: DisplayMode;
  logoWidth: string;
  logoHeight: string;
};
const EMPTY_FORM: FormState = {
  name: "",
  link: "",
  thumbnailUrl: "",
  sortOrder: "0",
  isActive: true,
  displayMode: "logo_and_text",
  logoWidth: "28",
  logoHeight: "28",
};

export function DeliveryPlatformsTab() {
  const qc = useQueryClient();
  const { showAlert, confirm } = useAppDialog();

  const { data: platforms = [], isLoading } = useQuery({
    queryKey: PLATFORMS_KEY,
    queryFn: fetchDeliveryPlatforms,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const invalidate = () => qc.invalidateQueries({ queryKey: PLATFORMS_KEY });

  const createMut = useMutation({
    mutationFn: () =>
      createDeliveryPlatform({
        name: form.name.trim(),
        link: form.link.trim(),
        thumbnailUrl: form.thumbnailUrl.trim(),
        sortOrder: parseInt(form.sortOrder, 10) || 0,
        isActive: form.isActive,
        displayMode: form.displayMode,
        logoWidth: parseInt(form.logoWidth, 10) || 28,
        logoHeight: parseInt(form.logoHeight, 10) || 28,
      }),
    onSuccess: async () => {
      await invalidate();
      setShowAddForm(false);
      setForm(EMPTY_FORM);
    },
    onError: (e) => void showAlert(axiosMsg(e), "Lỗi"),
  });

  const updateMut = useMutation({
    mutationFn: (id: string) =>
      updateDeliveryPlatform(id, {
        name: form.name.trim(),
        link: form.link.trim(),
        thumbnailUrl: form.thumbnailUrl.trim(),
        sortOrder: parseInt(form.sortOrder, 10) || 0,
        isActive: form.isActive,
        displayMode: form.displayMode,
        logoWidth: parseInt(form.logoWidth, 10) || 28,
        logoHeight: parseInt(form.logoHeight, 10) || 28,
      }),
    onSuccess: async () => {
      await invalidate();
      setEditingId(null);
    },
    onError: (e) => void showAlert(axiosMsg(e), "Lỗi"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteDeliveryPlatform,
    onSuccess: () => invalidate(),
    onError: (e) => void showAlert(axiosMsg(e), "Lỗi"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateDeliveryPlatform(id, { isActive }),
    onSuccess: () => invalidate(),
    onError: (e) => void showAlert(axiosMsg(e), "Lỗi"),
  });

  function openEdit(p: DeliveryPlatform) {
    setEditingId(p.id);
    setShowAddForm(false);
    setForm({
      name: p.name,
      link: p.link,
      thumbnailUrl: p.thumbnailUrl,
      sortOrder: String(p.sortOrder),
      isActive: p.isActive,
      displayMode: p.displayMode,
      logoWidth: String(p.logoWidth),
      logoHeight: String(p.logoHeight),
    });
  }

  function openAdd() {
    setEditingId(null);
    setShowAddForm(true);
    setForm(EMPTY_FORM);
  }

  function cancelForm() {
    setEditingId(null);
    setShowAddForm(false);
    setForm(EMPTY_FORM);
  }

  const handleDelete = async (p: DeliveryPlatform) => {
    const ok = await confirm({ title: "Xác nhận xóa", description: `Xóa nền tảng "${p.name}"?`, tone: "danger" });
    if (ok) deleteMut.mutate(p.id);
  };

  const PlatformForm = (
    <div className="rounded-2xl border border-black/10 bg-[#fafafa] p-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={adminFieldStack}>
          <Label className={adminLabelClass}>Tên nền tảng</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="VD: ShopeeFood"
          />
        </div>
        <div className={adminFieldStack}>
          <Label className={adminLabelClass}>Thứ tự hiển thị</Label>
          <Input
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            placeholder="0"
          />
        </div>
        <div className={adminFieldStack}>
          <Label className={adminLabelClass}>Đường dẫn (link)</Label>
          <Input
            value={form.link}
            onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
            placeholder="https://shopeefood.vn/cua-hang/..."
          />
        </div>
        <div className={adminFieldStack}>
          <Label className={adminLabelClass}>URL thumbnail/logo</Label>
          <Input
            value={form.thumbnailUrl}
            onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
            placeholder="https://..."
          />
        </div>
      </div>
      {/* Display options */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={adminFieldStack}>
          <Label className={adminLabelClass}>Kiểu hiển thị</Label>
          <div className="flex gap-2">
            {(["logo_and_text", "logo_only"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setForm((f) => ({ ...f, displayMode: mode }))}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${form.displayMode === mode
                  ? "border-[#1a3c34] bg-[#1a3c34]/8 text-[#1a3c34]"
                  : "border-black/10 bg-white text-foreground/55 hover:bg-black/4"
                  }`}
              >
                {mode === "logo_and_text" ? "Logo + Tên" : "Chỉ logo"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className={adminFieldStack}>
            <Label className={adminLabelClass}>Rộng (px)</Label>
            <Input
              type="number"
              min={8}
              max={200}
              value={form.logoWidth}
              onChange={(e) => setForm((f) => ({ ...f, logoWidth: e.target.value }))}
              placeholder="28"
            />
          </div>
          <div className={adminFieldStack}>
            <Label className={adminLabelClass}>Cao (px)</Label>
            <Input
              type="number"
              min={8}
              max={200}
              value={form.logoHeight}
              onChange={(e) => setForm((f) => ({ ...f, logoHeight: e.target.value }))}
              placeholder="28"
            />
          </div>
        </div>
      </div>

      {form.thumbnailUrl && (
        <div className="flex items-center gap-3">
          <img
            src={form.thumbnailUrl}
            alt="preview"
            style={{
              width: parseInt(form.logoWidth, 10) || 28,
              height: parseInt(form.logoHeight, 10) || 28,
            }}
            className="rounded-lg object-contain border border-black/10 bg-white"
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-foreground/50">
              Preview · {form.logoWidth || 28} × {form.logoHeight || 28} px
            </span>
            {form.displayMode === "logo_and_text" && form.name && (
              <span className="text-sm text-foreground/65">{form.name}</span>
            )}
          </div>
        </div>
      )}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          className="rounded"
        />
        Hiển thị (kích hoạt)
      </label>
      <div className="flex gap-2">
        <Button
          className="rounded-xl bg-[#1a3c34] font-semibold text-white"
          onPress={() =>
            editingId ? updateMut.mutate(editingId) : createMut.mutate()
          }
          isDisabled={
            !form.name.trim() ||
            !form.link.trim() ||
            !form.thumbnailUrl.trim() ||
            createMut.isPending ||
            updateMut.isPending
          }
        >
          <Save className="mr-2 size-4" />
          {editingId ? "Lưu thay đổi" : "Thêm nền tảng"}
        </Button>
        <Button variant="outline" className="rounded-xl border-black/15" onPress={cancelForm}>
          <X className="mr-1 size-4" />
          Hủy
        </Button>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#1a3c34]/8">
            <ExternalLink className="size-5 text-[#1a3c34]" />
          </span>
          <div>
            <p className="font-semibold text-foreground">Nền tảng giao đồ ăn đối tác</p>
            <p className="text-xs text-foreground/55">
              ShopeeFood, GrabFood, … — hiển thị ở footer trang web khách hàng.
            </p>
          </div>
        </div>
        {!showAddForm && !editingId && (
          <Button
            className="rounded-xl bg-[#1a3c34] font-semibold text-white"
            onPress={openAdd}
          >
            <Plus className="mr-2 size-4" />
            Thêm
          </Button>
        )}
      </div>

      {showAddForm && PlatformForm}

      {isLoading ? (
        <div className="py-8 text-center text-sm text-foreground/40">Đang tải…</div>
      ) : platforms.length === 0 && !showAddForm ? (
        <div className="py-8 text-center text-sm text-foreground/40">
          Chưa có nền tảng nào. Nhấn <strong>Thêm</strong> để bắt đầu.
        </div>
      ) : (
        <ul className="divide-y divide-black/5">
          {platforms.map((p) => (
            <li key={p.id}>
              {editingId === p.id ? (
                <div className="py-4">{PlatformForm}</div>
              ) : (
                <div className="flex items-center gap-4 py-3">
                  <GripVertical className="size-4 shrink-0 text-foreground/25" />
                  <img
                    src={p.thumbnailUrl}
                    alt={p.name}
                    width={p.logoWidth}
                    height={p.logoHeight}
                    style={{ width: p.logoWidth, height: p.logoHeight }}
                    className="shrink-0 rounded-lg object-contain border border-black/10 bg-white"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {p.name}
                      {!p.isActive && (
                        <span className="ml-2 text-xs font-normal text-foreground/40">(ẩn)</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-foreground/35 font-medium uppercase tracking-wide">
                        {p.displayMode === "logo_only" ? "Chỉ logo" : "Logo + Tên"}
                        {" · "}
                        {p.logoWidth}×{p.logoHeight}px
                      </span>
                    </div>
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-xs text-foreground/50 hover:text-[#1a3c34]"
                    >
                      {p.link}
                    </a>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleMut.mutate({ id: p.id, isActive: !p.isActive })}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${p.isActive
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-black/5 text-foreground/40 hover:bg-black/10"
                        }`}
                    >
                      {p.isActive ? "Hiện" : "Ẩn"}
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="rounded-lg p-1.5 text-foreground/40 hover:bg-black/5 hover:text-foreground"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="rounded-lg p-1.5 text-foreground/40 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
