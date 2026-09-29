"use client";

import {
    Button, Card, CardContent, Input, Label, ListBox, Modal, Select, Switch,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
    ArrowDown, ArrowUp, GripVertical, ImageOff, ImagePlus, Link as LinkIcon,
    Loader2, Pencil, Plus, RotateCcw, Save, Search, Sticker as StickerIcon,
    Trash2, Upload, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { adminFieldStack, adminInputClass, adminLabelClass } from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import {
    AdminSticker,
    AdminStickerAlbum,
    batchUpdateStickers,
    createStickerAlbum, createStickerByUrl, deleteSticker, deleteStickerAlbum,
    fetchStickerAlbums, fetchStickers, reorderStickerAlbums,
    updateStickerAlbum, uploadStickerFile,
} from "@/services/admin/chat-widget-api";
import { Reorder, useDragControls } from "motion/react";
import { mergeSubsetOrder, reconcile, sameOrder } from "@/lib/functions";
import {
    DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter,
    useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
    SortableContext, arrayMove, rectSortingStrategy,
    sortableKeyboardCoordinates, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

type AddMode = "upload" | "url";
type StickerEdit = { isActive?: boolean; albumId?: string | null };

const UNASSIGNED = "__unassigned__";
const ALBUMS_KEY = ["admin", "sticker-albums"] as const;
const EMPTY_STICKERS: AdminSticker[] = [];
const EMPTY_ALBUMS: AdminStickerAlbum[] = [];

// ── Select chọn album, dùng chung cho card sticker + form thêm sticker ─────
function AlbumSelect({
    value,
    onChange,
    albums,
    isDisabled,
    className,
}: {
    value: string;
    onChange: (id: string) => void;
    albums: { id: string; name: string }[];
    isDisabled?: boolean;
    className?: string;
}) {
    return (
        <Select value={value} onChange={(key) => onChange(key as string)} isDisabled={isDisabled}>
            <Select.Trigger className={className ?? adminInputClass}>
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox className="max-h-60 min-w-(--trigger-width) overflow-y-auto outline-none">
                    <ListBox.Item id={UNASSIGNED} textValue="Chưa phân loại" className="rounded-lg text-sm">
                        Chưa phân loại
                    </ListBox.Item>
                    {albums.map((a) => (
                        <ListBox.Item key={a.id} id={a.id} textValue={a.name} className="rounded-lg text-sm">
                            {a.name}
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}

function AlbumChip({
    id, label, count, active, onSelect,
}: { id: string; label: string; count: number; active: boolean; onSelect: () => void }) {
    const controls = useDragControls();
    return (
        <Reorder.Item
            as="div"
            value={id}
            dragListener={false}
            dragControls={controls}
            whileDrag={{ scale: 1.06, boxShadow: "0 8px 20px rgba(0,0,0,0.18)", zIndex: 10 }}
            className={`flex shrink-0 select-none items-center gap-0.5 rounded-full py-1 pl-1 pr-3 text-xs font-semibold transition-colors ${active ? "bg-[#1a3c34] text-white" : "bg-black/[0.04] text-foreground/60 hover:bg-black/[0.08]"
                }`}
        >
            <span
                onPointerDown={(e) => controls.start(e)}
                aria-label="Kéo để sắp xếp"
                className="flex size-6 cursor-grab touch-none items-center justify-center opacity-50 hover:opacity-100 active:cursor-grabbing"
            >
                <GripVertical className="size-3.5" />
            </span>
            <button type="button" onClick={onSelect} className="whitespace-nowrap">
                {label}
                <span className="ml-1 font-normal opacity-60">{count}</span>
            </button>
        </Reorder.Item>
    );
}

function StickerCard({
    s, albums, edited, onPatch, onDelete,
}: {
    s: AdminSticker;
    albums: { id: string; name: string }[];
    edited: boolean;
    onPatch: (patch: StickerEdit) => void;
    onDelete: () => void;
}) {
    const {
        attributes, listeners, setNodeRef, setActivatorNodeRef,
        transform, transition, isDragging,
    } = useSortable({ id: s.id });

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform), transition }}
            className={`relative flex min-w-0 flex-col gap-2 rounded-2xl border bg-white p-2.5 ${edited ? "border-amber-300 ring-1 ring-amber-200" : "border-black/8"
                }  ${isDragging ? "opacity-30" : ""}`}
        >
            {/* Ảnh lớn */}
            <div className={`relative aspect-square w-full overflow-hidden rounded-xl bg-[#fafafa] ${s.isActive ? "" : "opacity-50"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt={s.alt || "sticker"} draggable={false} className="size-full object-contain p-3" />

                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    {...attributes}
                    {...listeners}
                    aria-label="Kéo để sắp xếp"
                    className="absolute left-1.5 top-1.5 flex size-8 cursor-grab touch-none items-center justify-center rounded-full bg-white/90 text-foreground/50 shadow-sm ring-1 ring-black/5 hover:text-foreground active:cursor-grabbing"
                >
                    <GripVertical className="size-4" />
                </button>

                <button
                    type="button"
                    onClick={onDelete}
                    aria-label="Xoá"
                    className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full bg-white/90 text-foreground/40 shadow-sm ring-1 ring-black/5 hover:bg-red-50 hover:text-red-600"
                >
                    <Trash2 className="size-3.5" />
                </button>
            </div>

            <p className="truncate px-0.5 text-center text-xs text-foreground/55" title={s.alt}>
                {s.alt || <span className="text-foreground/25">Không mô tả</span>}
            </p>

            <AlbumSelect
                value={s.albumId ?? UNASSIGNED}
                onChange={(id) => onPatch({ albumId: id === UNASSIGNED ? null : id })}
                albums={albums}
                className="h-8 w-full text-[11px]"
            />

            <div className="flex items-center justify-between px-0.5">
                <span className="text-[11px] text-foreground/45">{s.isActive ? "Đang hiện" : "Đã ẩn"}</span>
                <Switch size="sm" isSelected={s.isActive} onChange={(v) => onPatch({ isActive: v })}>
                    <Switch.Control><Switch.Thumb /></Switch.Control>
                </Switch>
            </div>
        </div>
    );
}

export function ChatWidgetConfigClient() {
    const qc = useQueryClient();
    const { showAlert } = useAppDialog();

    const albumsQuery = useQuery({ queryKey: ALBUMS_KEY, queryFn: fetchStickerAlbums });
    const stickersQuery = useQuery({ queryKey: adminKeys.chat_widget, queryFn: fetchStickers });
    const albums = albumsQuery.data ?? EMPTY_ALBUMS;
    const stickers = stickersQuery.data ?? EMPTY_STICKERS;
    const [addMode, setAddMode] = useState<AddMode>("upload");
    const [urlInput, setUrlInput] = useState("");
    const [altInput, setAltInput] = useState("");
    const [selectedAlbumId, setSelectedAlbumId] = useState<string>(UNASSIGNED);
    const [previewFile, setPreviewFile] = useState<{ file: File; previewUrl: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── UI state ──
    const [activeAlbumId, setActiveAlbumId] = useState<string>("all"); // "all" | "none" | albumId
    const [search, setSearch] = useState("");
    const [addingAlbum, setAddingAlbum] = useState(false);
    const [newAlbumName, setNewAlbumName] = useState("");
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState("");

    // ── Draft state (chỉ gửi server khi bấm Lưu) ──
    const [orderDraft, setOrderDraft] = useState<string[] | null>(null);
    const [albumOrderDraft, setAlbumOrderDraft] = useState<string[] | null>(null);
    const [edits, setEdits] = useState<Record<string, StickerEdit>>({});

    const [confirmTarget, setConfirmTarget] = useState<
        { type: "sticker" | "album"; id: string; label: string } | null
    >(null);

    const invalidate = () => qc.invalidateQueries({ queryKey: adminKeys.chat_widget });
    const invalidateAlbums = () => qc.invalidateQueries({ queryKey: ALBUMS_KEY });

    // ── Derived: album ──
    const albumMap = useMemo(() => new Map(albums.map((a) => [a.id, a])), [albums]);
    const serverAlbumOrder = useMemo(() => albums.map((a) => a.id), [albums]);
    const albumOrder = useMemo(() => reconcile(albumOrderDraft, serverAlbumOrder), [albumOrderDraft, serverAlbumOrder]);
    const albumOrderDirty = !sameOrder(albumOrder, serverAlbumOrder);
    const orderedAlbums = useMemo(
        () => albumOrder.map((id) => albumMap.get(id)).filter((a): a is AdminStickerAlbum => !!a),
        [albumOrder, albumMap],
    );

    // ── Derived: sticker ──
    const stickerMap = useMemo(() => new Map(stickers.map((s) => [s.id, s])), [stickers]);
    const serverOrder = useMemo(() => stickers.map((s) => s.id), [stickers]);
    const order = useMemo(() => reconcile(orderDraft, serverOrder), [orderDraft, serverOrder]);
    const orderDirty = !sameOrder(order, serverOrder);

    // bỏ edit của sticker đã bị xoá
    const effectiveEdits = useMemo(
        () => Object.fromEntries(Object.entries(edits).filter(([id]) => stickerMap.has(id))),
        [edits, stickerMap],
    );
    const editCount = Object.keys(effectiveEdits).length;

    const view = useMemo(
        () => order.map((id) => ({ ...stickerMap.get(id)!, ...effectiveEdits[id] })),
        [order, stickerMap, effectiveEdits],
    );
    const viewMap = useMemo(() => new Map(view.map((s) => [s.id, s])), [view]);

    const albumCounts = useMemo(() => {
        const m = new Map<string, number>();
        for (const s of view) if (s.albumId) m.set(s.albumId, (m.get(s.albumId) ?? 0) + 1);
        return m;
    }, [view]);
    const unassignedCount = view.filter((s) => !s.albumId).length;

    const filteredIds = useMemo(() => {
        const q = search.trim().toLowerCase();
        return view
            .filter((s) => {
                if (activeAlbumId === "none" && s.albumId) return false;
                if (activeAlbumId !== "all" && activeAlbumId !== "none" && s.albumId !== activeAlbumId) return false;
                if (q && !(s.alt || "").toLowerCase().includes(q)) return false;
                return true;
            })
            .map((s) => s.id);
    }, [view, activeAlbumId, search]);

    const isDirty = albumOrderDirty || orderDirty || editCount > 0;
    const activeAlbum = activeAlbumId !== "all" && activeAlbumId !== "none" ? albumMap.get(activeAlbumId) : undefined;

    // ── Edit helper: tự bỏ edit nếu giá trị trùng server ──
    const patchSticker = (id: string, patch: StickerEdit) => {
        const server = stickerMap.get(id);
        if (!server) return;
        setEdits((prev) => {
            const merged: StickerEdit = { ...prev[id], ...patch };
            if (merged.isActive === server.isActive) delete merged.isActive;
            if (merged.albumId !== undefined && merged.albumId === server.albumId) delete merged.albumId;
            const next = { ...prev };
            if (Object.keys(merged).length === 0) delete next[id];
            else next[id] = merged;
            return next;
        });
    };

    const discardDrafts = () => {
        setOrderDraft(null);
        setAlbumOrderDraft(null);
        setEdits({});
    };

    // cảnh báo khi rời trang mà chưa lưu
    useEffect(() => {
        if (!isDirty) return;
        const handler = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [isDirty]);

    // ── Save ──
    const saveMut = useMutation({
        mutationFn: async () => {
            const jobs: Promise<unknown>[] = [];
            if (albumOrderDirty) {
                jobs.push(reorderStickerAlbums(albumOrder).then((d) => qc.setQueryData(ALBUMS_KEY, d)));
            }
            if (orderDirty || editCount > 0) {
                jobs.push(
                    batchUpdateStickers({
                        order: orderDirty ? order : undefined,
                        changes: editCount > 0
                            ? Object.entries(effectiveEdits).map(([id, e]) => ({ id, ...e }))
                            : undefined,
                    }).then((d) => qc.setQueryData(adminKeys.chat_widget, d)),
                );
            }
            await Promise.all(jobs);
        },
        onSuccess: discardDrafts,
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    // ── Album mutations (tạo / đổi tên / xoá: thực hiện ngay) ──
    const createAlbumMut = useMutation({
        mutationFn: () => createStickerAlbum(newAlbumName.trim()),
        onSuccess: () => { setNewAlbumName(""); setAddingAlbum(false); invalidateAlbums(); },
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const renameAlbumMut = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => updateStickerAlbum(id, { name }),
        onSuccess: () => { setRenaming(false); invalidateAlbums(); },
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const deleteAlbumMut = useMutation({
        mutationFn: (id: string) => deleteStickerAlbum(id),
        onSuccess: (_, id) => {
            invalidateAlbums();
            invalidate();
            // bỏ các edit đang trỏ tới album vừa xoá
            setEdits((prev) => {
                const next = { ...prev };
                for (const [sid, e] of Object.entries(next)) {
                    if (e.albumId === id) {
                        const { albumId: _drop, ...rest } = e;
                        if (Object.keys(rest).length) next[sid] = rest;
                        else delete next[sid];
                    }
                }
                return next;
            });
            if (activeAlbumId === id) setActiveAlbumId("all");
            setConfirmTarget(null);
        },
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const deleteStickerMut = useMutation({
        mutationFn: (id: string) => deleteSticker(id),
        onSuccess: () => { invalidate(); setConfirmTarget(null); },
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const createUrlMut = useMutation({
        mutationFn: () =>
            createStickerByUrl(
                urlInput.trim(),
                altInput.trim() || undefined,
                selectedAlbumId === UNASSIGNED ? undefined : selectedAlbumId,
            ),
        onSuccess: () => { setUrlInput(""); setAltInput(""); invalidate(); },
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const uploadFileMut = useMutation({
        mutationFn: () => {
            if (!previewFile) throw new Error("Chưa chọn ảnh.");
            return uploadStickerFile(
                previewFile.file,
                altInput.trim() || undefined,
                selectedAlbumId === UNASSIGNED ? undefined : selectedAlbumId,
            );
        },
        onSuccess: () => {
            if (previewFile) URL.revokeObjectURL(previewFile.previewUrl);
            setPreviewFile(null);
            setAltInput("");
            invalidate();
        },
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (previewFile) URL.revokeObjectURL(previewFile.previewUrl);
        setPreviewFile({ file, previewUrl: URL.createObjectURL(file) });
    };

    const confirmPending = deleteStickerMut.isPending || deleteAlbumMut.isPending;

    const selectAlbum = (id: string) => { setActiveAlbumId(id); setRenaming(false); };

    const [draggingId, setDraggingId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleDragStart = ({ active }: DragStartEvent) => setDraggingId(String(active.id));

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        setDraggingId(null);
        if (!over || active.id === over.id) return;
        const from = filteredIds.indexOf(String(active.id));
        const to = filteredIds.indexOf(String(over.id));
        if (from < 0 || to < 0) return;
        setOrderDraft(mergeSubsetOrder(order, arrayMove(filteredIds, from, to)));
    };
    const dirtySummary = [
        albumOrderDirty && "thứ tự album",
        orderDirty && "thứ tự sticker",
        editCount > 0 && `${editCount} sticker chỉnh sửa`,
    ].filter(Boolean).join(" · ");

    const staticChip = (active: boolean) =>
        `shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-[#1a3c34] text-white" : "bg-black/[0.04] text-foreground/60 hover:bg-black/[0.08]"
        }`;

    return (
        <div className="flex flex-col gap-8 pb-16">
            <header>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">Chat</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">Quản lý Sticker</h1>
                <p className="mt-2 max-w-2xl text-sm text-foreground/55">
                    Sticker và album hiển thị trong khung chat của khách hàng. Tải ảnh lên trực tiếp hoặc dán URL ảnh có sẵn.
                </p>
            </header>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="flex min-w-0 flex-col gap-4">
                    <Card className="rounded-2xl border border-black/6 shadow-sm">
                        <CardContent className="flex flex-col gap-4 px-5 py-5">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                                    Sticker ({filteredIds.length}/{stickers.length})
                                </p>
                                <div className="relative w-full sm:w-56">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-foreground/30" />
                                    <Input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Tìm theo mô tả…"
                                        className={`${adminInputClass} h-8 pl-8 text-xs`}
                                    />
                                </div>
                            </div>

                            {/* Thanh album: vừa là bộ lọc vừa kéo thả được */}
                            <div className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-1">
                                <button type="button" onClick={() => selectAlbum("all")} className={staticChip(activeAlbumId === "all")}>
                                    Tất cả ({stickers.length})
                                </button>

                                <Reorder.Group
                                    as="div"
                                    axis="x"
                                    values={albumOrder}
                                    onReorder={setAlbumOrderDraft}
                                    className="flex items-center gap-1.5"
                                >
                                    {orderedAlbums.map((a) => (
                                        <AlbumChip
                                            key={a.id}
                                            id={a.id}
                                            label={a.name}
                                            count={albumCounts.get(a.id) ?? 0}
                                            active={activeAlbumId === a.id}
                                            onSelect={() => selectAlbum(a.id)}
                                        />
                                    ))}
                                </Reorder.Group>

                                <button type="button" onClick={() => selectAlbum("none")} className={staticChip(activeAlbumId === "none")}>
                                    Chưa phân loại ({unassignedCount})
                                </button>
                            </div>

                            {/* Tạo album: hàng riêng */}
                            {addingAlbum ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        autoFocus
                                        value={newAlbumName}
                                        onChange={(e) => setNewAlbumName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && newAlbumName.trim()) createAlbumMut.mutate();
                                            if (e.key === "Escape") { setAddingAlbum(false); setNewAlbumName(""); }
                                        }}
                                        placeholder="Tên album mới, ví dụ: Vui vẻ"
                                        className={`${adminInputClass} h-8 min-w-0 flex-1 text-xs sm:max-w-xs`}
                                    />
                                    <Button
                                        size="sm"
                                        className="rounded-full bg-[#1a3c34] px-3 text-[11px] font-semibold text-white"
                                        isDisabled={!newAlbumName.trim() || createAlbumMut.isPending}
                                        onPress={() => createAlbumMut.mutate()}
                                    >
                                        Tạo
                                    </Button>
                                    <button
                                        type="button"
                                        aria-label="Huỷ"
                                        onClick={() => { setAddingAlbum(false); setNewAlbumName(""); }}
                                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-foreground/40 hover:bg-black/5"
                                    >
                                        <X className="size-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setAddingAlbum(true)}
                                    className="flex w-fit items-center gap-1 rounded-full border border-dashed border-black/15 px-3 py-1.5 text-xs font-semibold text-foreground/50 hover:border-[#1a3c34]/40 hover:text-[#1a3c34]"
                                >
                                    <Plus className="size-3.5" />Thêm album
                                </button>
                            )}

                            {/* Đổi tên / xoá album đang chọn */}
                            {activeAlbum && (
                                <div className="flex items-center gap-2 rounded-xl bg-black/[0.02] px-3 py-2">
                                    {renaming ? (
                                        <>
                                            <Input
                                                autoFocus
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && renameValue.trim())
                                                        renameAlbumMut.mutate({ id: activeAlbum.id, name: renameValue.trim() });
                                                    if (e.key === "Escape") setRenaming(false);
                                                }}
                                                className={`${adminInputClass} h-8 flex-1 text-xs`}
                                            />
                                            <Button
                                                size="sm"
                                                className="rounded-full bg-[#1a3c34] px-3 text-[11px] font-semibold text-white"
                                                isDisabled={!renameValue.trim() || renameValue.trim() === activeAlbum.name || renameAlbumMut.isPending}
                                                onPress={() => renameAlbumMut.mutate({ id: activeAlbum.id, name: renameValue.trim() })}
                                            >
                                                Lưu tên
                                            </Button>
                                            <button type="button" aria-label="Huỷ" onClick={() => setRenaming(false)}
                                                className="flex size-7 items-center justify-center rounded-full text-foreground/40 hover:bg-black/5">
                                                <X className="size-3.5" />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <p className="min-w-0 flex-1 truncate text-xs text-foreground/55">
                                                Album: <span className="font-semibold text-foreground/80">{activeAlbum.name}</span>
                                            </p>
                                            <button type="button" aria-label="Đổi tên"
                                                onClick={() => { setRenameValue(activeAlbum.name); setRenaming(true); }}
                                                className="flex size-7 items-center justify-center rounded-full text-foreground/35 hover:bg-black/5 hover:text-foreground">
                                                <Pencil className="size-3.5" />
                                            </button>
                                            <button type="button" aria-label="Xoá album"
                                                onClick={() => setConfirmTarget({ type: "album", id: activeAlbum.id, label: activeAlbum.name })}
                                                className="flex size-7 items-center justify-center rounded-full text-foreground/35 hover:bg-red-50 hover:text-red-600">
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            <p className="text-[11px] text-foreground/40">
                                Kéo biểu tượng ⋮⋮ để sắp xếp album và sticker. Thay đổi chỉ được lưu khi bấm “Lưu thay đổi”.
                            </p>

                            {/* Thanh lưu: luôn hiện, chỉ enable khi có thay đổi */}
                            <div className="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
                                <p className={`text-xs ${isDirty ? "font-medium text-amber-600" : "text-foreground/40"}`}>
                                    {isDirty ? `Chưa lưu: ${dirtySummary}` : "Không có thay đổi"}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="gap-1.5 rounded-full text-foreground/60"
                                        isDisabled={!isDirty || saveMut.isPending}
                                        onPress={discardDrafts}
                                    >
                                        <RotateCcw className="size-3.5" />Hoàn tác
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="gap-1.5 rounded-full bg-[#1a3c34] px-4 font-semibold text-white"
                                        isDisabled={!isDirty || saveMut.isPending}
                                        onPress={() => saveMut.mutate()}
                                    >
                                        {saveMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                                        {saveMut.isPending ? "Đang lưu…" : "Lưu thay đổi"}
                                    </Button>
                                </div>
                            </div>

                            {stickersQuery.isLoading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="size-5 animate-spin text-foreground/30" />
                                </div>
                            ) : stickers.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-10 text-foreground/35">
                                    <StickerIcon className="size-8" />
                                    <p className="text-sm">Chưa có sticker nào — thêm sticker đầu tiên ở cột bên phải.</p>
                                </div>
                            ) : filteredIds.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-10 text-foreground/35">
                                    <ImageOff className="size-8" />
                                    <p className="text-sm">Không có sticker nào khớp với bộ lọc hiện tại.</p>
                                </div>
                            ) : (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                    onDragCancel={() => setDraggingId(null)}
                                >
                                    <SortableContext items={filteredIds} strategy={rectSortingStrategy}>
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
                                            {filteredIds.map((id) => {
                                                const s = viewMap.get(id)!;
                                                return (
                                                    <StickerCard
                                                        key={id}
                                                        s={s}
                                                        albums={orderedAlbums}
                                                        edited={!!effectiveEdits[id]}
                                                        onPatch={(patch) => patchSticker(id, patch)}
                                                        onDelete={() => setConfirmTarget({ type: "sticker", id, label: s.alt || "sticker này" })}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </SortableContext>

                                    <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
                                        {draggingId && viewMap.get(draggingId) ? (
                                            <div className="rotate-2 scale-105 rounded-2xl border border-[#1a3c34]/30 bg-white p-2.5 shadow-2xl">
                                                <div className="aspect-square w-full overflow-hidden rounded-xl bg-[#fafafa]">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={viewMap.get(draggingId)!.url} alt="" className="size-full object-contain p-3" />
                                                </div>
                                            </div>
                                        ) : null}
                                    </DragOverlay>
                                </DndContext>
                            )}
                        </CardContent>
                    </Card>


                </div>

                <div className="flex min-w-0 flex-col gap-4">
                    <Card className="min-w-0 rounded-2xl border border-black/6 shadow-sm">
                        <CardContent className="flex min-w-0 flex-col gap-4 px-5 py-5">
                            <div className="flex items-center gap-2">
                                <Plus className="size-4 text-[#1a3c34]" />
                                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">Thêm sticker</p>
                            </div>

                            <div className="flex rounded-xl bg-black/[0.04] p-1">
                                <button
                                    type="button"
                                    onClick={() => setAddMode("upload")}
                                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${addMode === "upload" ? "bg-white text-[#1a3c34] shadow-sm" : "text-foreground/50"}`}
                                >
                                    <Upload className="size-3.5" />Tải ảnh lên
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAddMode("url")}
                                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${addMode === "url" ? "bg-white text-[#1a3c34] shadow-sm" : "text-foreground/50"}`}
                                >
                                    <LinkIcon className="size-3.5" />Dán URL
                                </button>
                            </div>

                            {addMode === "upload" ? (
                                <div className="flex flex-col gap-3">
                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                    {previewFile ? (
                                        <div className="flex items-center gap-3 rounded-xl bg-black/[0.03] p-3">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={previewFile.previewUrl} alt="preview" className="size-16 rounded-lg object-contain ring-1 ring-black/10" />
                                            <button
                                                type="button"
                                                onClick={() => { URL.revokeObjectURL(previewFile.previewUrl); setPreviewFile(null); }}
                                                className="text-xs font-medium text-red-500 hover:underline"
                                            >
                                                Bỏ ảnh
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-black/10 py-8 text-foreground/40 hover:border-[#1a3c34]/40 hover:text-[#1a3c34]"
                                        >
                                            <ImagePlus className="size-6" />
                                            <span className="text-xs font-medium">Chọn ảnh từ máy</span>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div className={adminFieldStack}>
                                        <Label className={adminLabelClass}>URL ảnh *</Label>
                                        <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://..." className={adminInputClass} />
                                    </div>
                                    {urlInput.trim() && (
                                        <div className="flex justify-center rounded-xl border border-black/8 bg-[#fafafa] p-3">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={urlInput.trim()}
                                                alt="preview"
                                                className="h-16 w-16 object-contain"
                                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className={adminFieldStack}>
                                <Label className={adminLabelClass}>Mô tả (alt, không bắt buộc)</Label>
                                <Input value={altInput} onChange={(e) => setAltInput(e.target.value)} placeholder="VD: Mèo vẫy tay" className={adminInputClass} />
                            </div>

                            <div className={adminFieldStack}>
                                <Label className={adminLabelClass}>Album</Label>
                                <AlbumSelect value={selectedAlbumId} onChange={setSelectedAlbumId} albums={albums} className={adminInputClass} />
                            </div>

                            {addMode === "upload" ? (
                                <Button
                                    className="w-full rounded-full bg-[#1a3c34] font-semibold text-white"
                                    onPress={() => uploadFileMut.mutate()}
                                    isDisabled={!previewFile || uploadFileMut.isPending}
                                >
                                    {uploadFileMut.isPending ? "Đang tải lên…" : "Thêm sticker"}
                                </Button>
                            ) : (
                                <Button
                                    className="w-full rounded-full bg-[#1a3c34] font-semibold text-white"
                                    onPress={() => createUrlMut.mutate()}
                                    isDisabled={!urlInput.trim() || createUrlMut.isPending}
                                >
                                    {createUrlMut.isPending ? "Đang thêm…" : "Thêm sticker"}
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Modal xác nhận xoá — mount có điều kiện, controlled qua isOpen/onOpenChange */}
            {confirmTarget && (
                <Modal
                    isOpen
                    onOpenChange={(open) => { if (!open && !confirmPending) setConfirmTarget(null); }}
                >
                    <Modal.Backdrop>
                        <Modal.Container>
                            <Modal.Dialog className="sm:max-w-[400px]">
                                <Modal.CloseTrigger isDisabled={confirmPending} />
                                <Modal.Header>
                                    <Modal.Icon className="bg-red-50 text-red-600">
                                        <Trash2 className="size-5" />
                                    </Modal.Icon>
                                    <Modal.Heading>
                                        {confirmTarget.type === "album" ? "Xoá album?" : "Xoá sticker?"}
                                    </Modal.Heading>
                                </Modal.Header>
                                <Modal.Body>
                                    <p className="text-sm text-foreground/60">
                                        {confirmTarget.type === "album"
                                            ? `Album "${confirmTarget.label}" sẽ bị xoá. Sticker trong album sẽ chuyển về "Chưa phân loại", không bị xoá kèm theo.`
                                            : `Sticker "${confirmTarget.label}" sẽ bị xoá vĩnh viễn khỏi hệ thống.`}
                                    </p>
                                </Modal.Body>
                                <Modal.Footer>
                                    <Button
                                        variant="ghost"
                                        className="flex-1 text-foreground/60"
                                        isDisabled={confirmPending}
                                        onPress={() => setConfirmTarget(null)}
                                    >
                                        Huỷ
                                    </Button>
                                    <Button
                                        className="flex-1 bg-red-600 font-semibold text-white hover:bg-red-700"
                                        isDisabled={confirmPending}
                                        onPress={() => {
                                            if (confirmTarget.type === "sticker") deleteStickerMut.mutate(confirmTarget.id);
                                            else deleteAlbumMut.mutate(confirmTarget.id);
                                        }}
                                    >
                                        {confirmPending ? "Đang xoá…" : "Xoá"}
                                    </Button>
                                </Modal.Footer>
                            </Modal.Dialog>
                        </Modal.Container>
                    </Modal.Backdrop>
                </Modal>
            )}
        </div>
    );
}