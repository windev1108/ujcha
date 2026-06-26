"use client";

import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Modal,
  Table,
  useOverlayState,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { adminKeys } from "@/services/admin/keys";
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  updateAdminCategory,
} from "@/services/admin/categories-api";
import type { AdminCategory } from "@/services/admin/types";

// ─── Category form modal ──────────────────────────────────────────────────────

type CategoryFormData = {
  name: string;
  slug: string;
  sortOrder: string;
  thumbnail: string;
};

function CategoryModal({
  mode,
  initial,
  onSave,
  onClose,
  isPending,
}: {
  mode: "create" | "edit";
  initial?: AdminCategory;
  onSave: (d: CategoryFormData) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [thumbnail, setThumbnail] = useState(initial?.thumbnail ?? "");
  const [thumbError, setThumbError] = useState(false);

  return (
    <>
      <Modal.Header className="border-b border-black/6 px-5 py-4">
        <Modal.Heading>
          {mode === "create" ? "Thêm danh mục" : "Sửa danh mục"}
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4 px-5 py-5">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Tên *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Matcha Series"
            className="rounded-xl"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Slug (tuỳ chọn)</Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="matcha-series"
            className="rounded-xl"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Thứ tự</Label>
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="rounded-xl"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Thumbnail (URL ảnh)</Label>
          <Input
            value={thumbnail}
            onChange={(e) => { setThumbnail(e.target.value); setThumbError(false); }}
            placeholder="https://example.com/image.jpg"
            className="rounded-xl"
            disabled={isPending}
          />
          {thumbnail && !thumbError && (
            <div className="relative h-24 w-full overflow-hidden rounded-xl border border-black/6 bg-[#f3f4f6]">
              <Image
                src={thumbnail}
                alt="preview"
                fill
                className="object-cover"
                sizes="400px"
                unoptimized
                onError={() => setThumbError(true)}
              />
            </div>
          )}
          {thumbnail && thumbError && (
            <p className="text-xs text-red-500">URL ảnh không hợp lệ hoặc không tải được.</p>
          )}
          <p className="text-[11px] text-foreground/40">
            Dán link ảnh từ Cloudinary, Imgur… Để trống để dùng màu gradient mặc định.
          </p>
        </div>
      </Modal.Body>
      <Modal.Footer className="flex justify-end gap-2 border-t border-black/6 px-5 py-4">
        <Button variant="ghost" onPress={onClose} isDisabled={isPending}>Hủy</Button>
        <Button
          className="rounded-full bg-[#1a3c34] font-semibold text-white"
          onPress={() => onSave({ name, slug, sortOrder, thumbnail })}
          isDisabled={isPending || !name.trim()}
        >
          {isPending ? "Đang lưu…" : mode === "create" ? "Thêm" : "Lưu"}
        </Button>
      </Modal.Footer>
    </>
  );
}

// ─── Tab content ──────────────────────────────────────────────────────────────

export function CategoriesTab() {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: adminKeys.categories,
    queryFn: fetchAdminCategories,
  });

  const catModal = useOverlayState();
  const [editCat, setEditCat] = useState<AdminCategory | null>(null);

  const createMut = useMutation({
    mutationFn: (d: CategoryFormData) =>
      createAdminCategory({
        name: d.name.trim(),
        slug: d.slug.trim() || undefined,
        sortOrder: Number.parseInt(d.sortOrder, 10) || 0,
        thumbnail: d.thumbnail.trim() || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.categories });
      catModal.close();
    },
  });

  const updateMut = useMutation({
    mutationFn: (d: CategoryFormData) =>
      updateAdminCategory(editCat!.id, {
        name: d.name.trim(),
        slug: d.slug.trim() || undefined,
        sortOrder: Number.parseInt(d.sortOrder, 10) || 0,
        thumbnail: d.thumbnail.trim() || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.categories });
      catModal.close();
      setEditCat(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteAdminCategory,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: adminKeys.categories }),
  });

  const pending = createMut.isPending || updateMut.isPending;

  const openCreate = () => { setEditCat(null); catModal.open(); };
  const openEdit = (c: AdminCategory) => { setEditCat(c); catModal.open(); };
  const closeModal = () => { catModal.close(); setEditCat(null); };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-foreground/55">
            Tạo và sắp xếp danh mục dùng cho menu và form sản phẩm.
          </p>
        </div>
        <Button
          className="shrink-0 rounded-full bg-[#1a3c34] px-5 font-semibold text-white"
          onPress={openCreate}
        >
          <Plus className="mr-2 size-4" />
          Thêm danh mục
        </Button>
      </div>

      <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-sm">
        <CardContent className="p-0">
          <Table.Root className="min-w-[640px]" aria-label="Danh mục">
            <Table.ScrollContainer>
              <Table.Content>
                <Table.Header>
                  <Table.Column isRowHeader className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Tên
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Ảnh
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Slug
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Thứ tự
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Số SP
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Thao tác
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <Table.Row key={i}>
                          {Array.from({ length: 6 }).map((__, j) => (
                            <Table.Cell key={j} className="px-5 py-4">
                              <div className="h-4 animate-pulse rounded-md bg-black/5" />
                            </Table.Cell>
                          ))}
                        </Table.Row>
                      ))
                    : categories.map((c) => (
                        <Table.Row key={c.id} id={c.id}>
                          <Table.Cell className="px-5 py-4 font-semibold text-foreground">
                            {c.name}
                          </Table.Cell>
                          <Table.Cell className="px-5 py-4">
                            {c.thumbnail ? (
                              <div className="relative size-10 overflow-hidden rounded-lg border border-black/6">
                                <Image
                                  src={c.thumbnail}
                                  alt={c.name}
                                  fill
                                  className="object-cover"
                                  sizes="40px"
                                  unoptimized
                                />
                              </div>
                            ) : (
                              <span className="text-xs text-foreground/30">—</span>
                            )}
                          </Table.Cell>
                          <Table.Cell className="px-5 py-4 font-mono text-xs text-foreground/70">
                            {c.slug}
                          </Table.Cell>
                          <Table.Cell className="px-5 py-4 tabular-nums">
                            {c.sortOrder}
                          </Table.Cell>
                          <Table.Cell className="px-5 py-4 text-sm text-foreground/60">
                            {c._count?.products ?? 0}
                          </Table.Cell>
                          <Table.Cell className="px-5 py-4 text-right">
                            <div className="inline-flex justify-end gap-1">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="ghost"
                                aria-label="Sửa"
                                onPress={() => openEdit(c)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:bg-red-50"
                                aria-label="Xóa"
                                isDisabled={
                                  deleteMut.isPending ||
                                  (c._count?.products ?? 0) > 0
                                }
                                onPress={async () => {
                                  const ok = await confirm({
                                    title: "Xóa danh mục?",
                                    description: `Xóa danh mục "${c.name}"?`,
                                    tone: "danger",
                                    confirmLabel: "Xóa",
                                  });
                                  if (ok) deleteMut.mutate(c.id);
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table.Root>
        </CardContent>
      </Card>

      <Modal.Root
        state={catModal}
        onOpenChange={(open) => { if (!open) closeModal(); }}
      >
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md" scroll="inside">
            <Modal.Dialog className="max-w-md rounded-2xl border border-black/6 p-0 shadow-xl">
              <CategoryModal
                mode={editCat ? "edit" : "create"}
                initial={editCat ?? undefined}
                onSave={(d) => (editCat ? updateMut.mutate(d) : createMut.mutate(d))}
                onClose={closeModal}
                isPending={pending}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </div>
  );
}
