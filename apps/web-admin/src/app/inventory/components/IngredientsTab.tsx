"use client";

import {
    Button,
    Card,
    CardContent,
    Input,
    Switch,
    TextArea,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Boxes, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { adminInputClass } from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import {
    adjustAdminIngredientStock,
    createAdminIngredient,
    deleteAdminIngredient,
    fetchAdminIngredients,
    updateAdminIngredient,
    type CreateIngredientBody,
} from "@/services/admin/ingredients-api";
import type { Ingredient } from "@/services/admin/types";

function isLowStock(ing: Ingredient): boolean {
    if (!ing.lowStockThreshold) return false;
    return Number.parseFloat(ing.stockQty) <= Number.parseFloat(ing.lowStockThreshold);
}

const emptyForm: CreateIngredientBody = { name: "", unit: "", stockQty: 0, lowStockThreshold: undefined, note: "" };

export function IngredientsTab() {
    const queryClient = useQueryClient();
    const { confirm } = useAppDialog();

    const [search, setSearch] = useState("");
    const [showAddForm, setShowAddForm] = useState(false);
    const [form, setForm] = useState<CreateIngredientBody>(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<CreateIngredientBody>(emptyForm);
    const [stockDraftId, setStockDraftId] = useState<string | null>(null);
    const [stockDraft, setStockDraft] = useState<{ changeQty: string; note: string }>({ changeQty: "", note: "" });
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const invalidate = () => void queryClient.invalidateQueries({ queryKey: adminKeys.ingredients });

    const { data: ingredients = [], isLoading } = useQuery({
        queryKey: adminKeys.ingredients,
        queryFn: () => fetchAdminIngredients(),
    });

    const createMut = useMutation({
        mutationFn: createAdminIngredient,
        onSuccess: () => {
            invalidate();
            setForm(emptyForm);
            setShowAddForm(false);
        },
    });

    const updateMut = useMutation({
        mutationFn: (p: { id: string; body: CreateIngredientBody }) =>
            updateAdminIngredient(p.id, p.body),
        onSuccess: () => {
            invalidate();
            setEditingId(null);
        },
    });

    const toggleActiveMut = useMutation({
        mutationFn: (p: { id: string; isActive: boolean }) =>
            updateAdminIngredient(p.id, { isActive: p.isActive }),
        onSuccess: invalidate,
    });

    const adjustStockMut = useMutation({
        mutationFn: (p: { id: string; changeQty: number; note?: string }) =>
            adjustAdminIngredientStock(p.id, p.changeQty, p.note),
        onSuccess: () => {
            invalidate();
            setStockDraftId(null);
            setStockDraft({ changeQty: "", note: "" });
        },
    });

    const deleteMut = useMutation({
        mutationFn: deleteAdminIngredient,
        onMutate: (id) => setDeletingId(id),
        onSuccess: invalidate,
        onSettled: () => setDeletingId(null),
    });

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return ingredients;
        return ingredients.filter((i) => i.name.toLowerCase().includes(q));
    }, [ingredients, search]);

    const lowStockCount = ingredients.filter(isLowStock).length;

    const startEdit = (ing: Ingredient) => {
        setEditingId(ing.id);
        setEditForm({
            name: ing.name,
            unit: ing.unit,
            note: ing.note ?? "",
            lowStockThreshold: ing.lowStockThreshold ? Number.parseFloat(ing.lowStockThreshold) : undefined,
        });
    };

    const confirmDelete = async (ing: Ingredient) => {
        const ok = await confirm({
            title: "Xóa nguyên liệu?",
            description: `Xóa "${ing.name}"? Không thể xóa nếu đang dùng trong công thức sản phẩm.`,
            tone: "danger",
            confirmLabel: "Xóa",
        });
        if (ok) deleteMut.mutate(ing.id);
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-lg font-bold text-[#1a3c34]">Nguyên liệu &amp; tồn kho</h2>
                    <p className="text-sm text-foreground/50">
                        Quản lý danh mục nguyên liệu dùng cho công thức pha chế từng sản phẩm.
                    </p>
                </div>
                <Button
                    className="h-9 shrink-0 rounded-full bg-[#1a3c34] px-4 text-sm font-semibold text-white"
                    onPress={() => setShowAddForm((v) => !v)}
                    isDisabled={createMut.isPending}
                >
                    <Plus className="mr-1.5 size-3.5" />
                    Thêm nguyên liệu
                </Button>
            </div>

            {showAddForm && (
                <Card className="rounded-2xl border border-[#1a3c34]/12 bg-[#f7faf9] shadow-sm">
                    <CardContent className="flex flex-col gap-3 p-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-[#1a3c34]">Nguyên liệu mới</h3>
                            <button
                                type="button"
                                onClick={() => setShowAddForm(false)}
                                disabled={createMut.isPending}
                                className="text-foreground/40 hover:text-foreground/70 disabled:opacity-40"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Input
                                fullWidth
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="Tên nguyên liệu (vd. Sữa tươi)"
                                className={adminInputClass}
                                disabled={createMut.isPending}
                            />
                            <Input
                                fullWidth
                                value={form.unit}
                                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                                placeholder="Đơn vị (g, ml, kg, l, cái…)"
                                className={adminInputClass}
                                disabled={createMut.isPending}
                            />
                            <Input
                                fullWidth
                                type="number"
                                min={0}
                                step={0.01}
                                value={String(form.stockQty ?? 0)}
                                onChange={(e) => setForm((f) => ({ ...f, stockQty: Number(e.target.value) || 0 }))}
                                placeholder="Tồn kho ban đầu"
                                className={adminInputClass}
                                disabled={createMut.isPending}
                            />
                            <Input
                                fullWidth
                                type="number"
                                min={0}
                                step={0.01}
                                value={form.lowStockThreshold != null ? String(form.lowStockThreshold) : ""}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        lowStockThreshold: e.target.value ? Number(e.target.value) : undefined,
                                    }))
                                }
                                placeholder="Ngưỡng cảnh báo hết (tuỳ chọn)"
                                className={adminInputClass}
                                disabled={createMut.isPending}
                            />
                        </div>
                        <TextArea
                            fullWidth
                            value={form.note ?? ""}
                            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                            placeholder="Ghi chú (tuỳ chọn)"
                            className="min-h-[70px] w-full rounded-xl"
                            disabled={createMut.isPending}
                        />
                        {createMut.isError && (
                            <p className="text-xs text-red-600">Không lưu được nguyên liệu. Vui lòng thử lại.</p>
                        )}
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="ghost"
                                className="rounded-full"
                                onPress={() => setShowAddForm(false)}
                                isDisabled={createMut.isPending}
                            >
                                Hủy
                            </Button>
                            <Button
                                className="rounded-full bg-[#1a3c34] px-5 text-sm font-semibold text-white"
                                isDisabled={!form.name.trim() || !form.unit.trim() || createMut.isPending}
                                onPress={() =>
                                    createMut.mutate({
                                        name: form.name.trim(),
                                        unit: form.unit.trim(),
                                        stockQty: form.stockQty,
                                        lowStockThreshold: form.lowStockThreshold,
                                        note: form.note?.trim() || undefined,
                                    })
                                }
                            >
                                {createMut.isPending ? (
                                    <>
                                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                                        Đang lưu…
                                    </>
                                ) : (
                                    "Lưu nguyên liệu"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="flex items-center gap-3">
                <div className="relative min-w-0 flex-1 max-w-sm">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground/35" aria-hidden />
                    <Input
                        aria-label="Tìm nguyên liệu"
                        placeholder="Tìm theo tên…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-10 w-full rounded-full border border-black/10 bg-white pl-10 pr-4 text-sm shadow-sm"
                    />
                </div>
                {lowStockCount > 0 && (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 ring-1 ring-red-600/15">
                        <AlertTriangle className="size-3.5" />
                        {lowStockCount} sắp hết
                    </span>
                )}
            </div>

            {isLoading ? (
                <div className="flex flex-col divide-y divide-black/6 overflow-hidden rounded-2xl border border-black/6 bg-white">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-14 animate-pulse bg-black/[0.03]" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-[#fafafa] py-16 text-center">
                    <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#f0f6f4]">
                        <Boxes className="size-6 text-[#5a8f7a]" />
                    </div>
                    <p className="text-base font-semibold text-foreground">
                        {ingredients.length === 0 ? "Chưa có nguyên liệu nào" : "Không tìm thấy nguyên liệu nào"}
                    </p>
                    <p className="mt-1 text-sm text-foreground/50">
                        {ingredients.length === 0
                            ? "Thêm nguyên liệu để dùng trong công thức pha chế sản phẩm."
                            : "Thử từ khoá khác."}
                    </p>
                </div>
            ) : (
                <Card className="overflow-hidden rounded-2xl border border-black/6 shadow-sm">
                    <CardContent className="flex flex-col divide-y divide-black/6 p-0">
                        {filtered.map((ing) => {
                            const low = isLowStock(ing);
                            const isEditing = editingId === ing.id;
                            const isAdjustingStock = stockDraftId === ing.id;
                            const isTogglingThis =
                                toggleActiveMut.isPending && toggleActiveMut.variables?.id === ing.id;
                            const isDeletingThis = deleteMut.isPending && deletingId === ing.id;
                            const isAdjustingThis =
                                adjustStockMut.isPending && adjustStockMut.variables?.id === ing.id;
                            // Bất kỳ thao tác nào khác đang chạy trên dòng này thì khóa các nút còn lại
                            const rowBusy = isTogglingThis || isDeletingThis || isAdjustingThis;

                            if (isEditing) {
                                return (
                                    <div key={ing.id} className="flex flex-col gap-2 px-5 py-4">
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <Input
                                                fullWidth
                                                value={editForm.name}
                                                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                                placeholder="Tên"
                                                className={adminInputClass}
                                                disabled={updateMut.isPending}
                                            />
                                            <Input
                                                fullWidth
                                                value={editForm.unit}
                                                onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                                                placeholder="Đơn vị"
                                                className={adminInputClass}
                                                disabled={updateMut.isPending}
                                            />
                                            <Input
                                                fullWidth
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={editForm.lowStockThreshold != null ? String(editForm.lowStockThreshold) : ""}
                                                onChange={(e) =>
                                                    setEditForm((f) => ({
                                                        ...f,
                                                        lowStockThreshold: e.target.value ? Number(e.target.value) : undefined,
                                                    }))
                                                }
                                                placeholder="Ngưỡng cảnh báo hết"
                                                className={adminInputClass}
                                                disabled={updateMut.isPending}
                                            />
                                            <Input
                                                fullWidth
                                                value={editForm.note ?? ""}
                                                onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                                                placeholder="Ghi chú"
                                                className={adminInputClass}
                                                disabled={updateMut.isPending}
                                            />
                                        </div>
                                        {updateMut.isError && (
                                            <p className="text-xs text-red-600">Không lưu được thay đổi. Vui lòng thử lại.</p>
                                        )}
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="rounded-full"
                                                onPress={() => setEditingId(null)}
                                                isDisabled={updateMut.isPending}
                                            >
                                                Hủy
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="rounded-full bg-[#1a3c34] px-4 text-white"
                                                isDisabled={!editForm.name.trim() || !editForm.unit.trim() || updateMut.isPending}
                                                onPress={() =>
                                                    updateMut.mutate({
                                                        id: ing.id,
                                                        body: {
                                                            name: editForm.name.trim(),
                                                            unit: editForm.unit.trim(),
                                                            lowStockThreshold: editForm.lowStockThreshold,
                                                            note: editForm.note?.trim() || undefined,
                                                        },
                                                    })
                                                }
                                            >
                                                {updateMut.isPending ? (
                                                    <>
                                                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                                                        Đang lưu…
                                                    </>
                                                ) : (
                                                    "Lưu"
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={ing.id} className={`flex flex-col gap-2 px-5 py-3.5 transition-opacity ${!ing.isActive ? "opacity-50" : ""} ${isDeletingThis ? "opacity-40" : ""}`}>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate text-sm font-semibold text-foreground">{ing.name}</p>
                                                {low && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                                        <AlertTriangle className="size-3" />
                                                        Sắp hết
                                                    </span>
                                                )}
                                                {isTogglingThis && (
                                                    <Loader2 className="size-3 animate-spin text-foreground/40" />
                                                )}
                                            </div>
                                            <p className="text-xs text-foreground/45">
                                                Tồn kho:{" "}
                                                <span className={`font-semibold tabular-nums ${low ? "text-red-600" : "text-[#1a3c34]"}`}>
                                                    {Number.parseFloat(ing.stockQty).toLocaleString("vi-VN")} {ing.unit}
                                                </span>
                                                {ing.lowStockThreshold && (
                                                    <span className="ml-1">
                                                        (ngưỡng {Number.parseFloat(ing.lowStockThreshold).toLocaleString("vi-VN")} {ing.unit})
                                                    </span>
                                                )}
                                            </p>
                                            {ing.note && <p className="mt-0.5 text-xs text-foreground/40">{ing.note}</p>}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1.5">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="rounded-full text-xs"
                                                onPress={() => {
                                                    setStockDraftId(ing.id);
                                                    setStockDraft({ changeQty: "", note: "" });
                                                }}
                                                isDisabled={rowBusy}
                                            >
                                                Nhập kho
                                            </Button>
                                            <Switch
                                                isSelected={ing.isActive}
                                                onChange={(v) => toggleActiveMut.mutate({ id: ing.id, isActive: v })}
                                                isDisabled={isTogglingThis || isDeletingThis}
                                                aria-label={`Bật/tắt ${ing.name}`}
                                            >
                                                <Switch.Control>
                                                    <Switch.Thumb />
                                                </Switch.Control>
                                            </Switch>
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="ghost"
                                                aria-label="Sửa"
                                                onPress={() => startEdit(ing)}
                                                isDisabled={rowBusy}
                                            >
                                                <Pencil className="size-3.5" />
                                            </Button>
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="ghost"
                                                aria-label="Xóa"
                                                className="text-red-500 hover:bg-red-50"
                                                onPress={() => void confirmDelete(ing)}
                                                isDisabled={rowBusy}
                                            >
                                                {isDeletingThis ? (
                                                    <Loader2 className="size-3.5 animate-spin" />
                                                ) : (
                                                    <Trash2 className="size-3.5" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    {isAdjustingStock && (
                                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/8 bg-[#fafafa] px-3 py-2.5">
                                            <Input
                                                type="number"
                                                step={0.01}
                                                value={stockDraft.changeQty}
                                                onChange={(e) => setStockDraft((s) => ({ ...s, changeQty: e.target.value }))}
                                                placeholder="+ nhập / − điều chỉnh giảm"
                                                className={`w-40 ${adminInputClass}`}
                                                disabled={isAdjustingThis}
                                            />
                                            <Input
                                                value={stockDraft.note}
                                                onChange={(e) => setStockDraft((s) => ({ ...s, note: e.target.value }))}
                                                placeholder="Ghi chú (vd. nhập hàng đợt 1)"
                                                className={`flex-1 min-w-[160px] ${adminInputClass}`}
                                                disabled={isAdjustingThis}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="rounded-full"
                                                onPress={() => setStockDraftId(null)}
                                                isDisabled={isAdjustingThis}
                                            >
                                                Hủy
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="rounded-full bg-[#1a3c34] px-4 text-white"
                                                isDisabled={!stockDraft.changeQty || isAdjustingThis}
                                                onPress={() =>
                                                    adjustStockMut.mutate({
                                                        id: ing.id,
                                                        changeQty: Number.parseFloat(stockDraft.changeQty) || 0,
                                                        note: stockDraft.note.trim() || undefined,
                                                    })
                                                }
                                            >
                                                {isAdjustingThis ? (
                                                    <>
                                                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                                                        Đang lưu…
                                                    </>
                                                ) : (
                                                    "Xác nhận"
                                                )}
                                            </Button>
                                            {adjustStockMut.isError && adjustStockMut.variables?.id === ing.id && (
                                                <p className="w-full text-xs text-red-600">Không cập nhật được tồn kho.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}