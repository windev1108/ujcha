"use client";

import {
    Button, Card, CardContent, Input, Label, ListBox, Modal, Select, Switch,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
    ArrowDown, ArrowUp, ImageOff, ImagePlus, Link as LinkIcon,
    Loader2, Pencil, Plus, Search, Sticker as StickerIcon,
    Trash2, Upload, X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { adminFieldStack, adminInputClass, adminLabelClass } from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import {
    createStickerAlbum, createStickerByUrl, deleteSticker, deleteStickerAlbum,
    fetchStickerAlbums, fetchStickers, reorderStickers, updateSticker,
    updateStickerAlbum, uploadStickerFile,
} from "@/services/admin/chat-widget-api";

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
const UNASSIGNED = "__unassigned__";

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

export function ChatWidgetConfigClient() {
    const qc = useQueryClient();
    const { showAlert } = useAppDialog();

    const { data: albums = [] } = useQuery({
        queryKey: ["admin", "sticker-albums"],
        queryFn: fetchStickerAlbums,
    });
    const { data: stickers = [], isLoading } = useQuery({
        queryKey: adminKeys.chat_widget,
        queryFn: fetchStickers,
    });

    const [activeAlbumId, setActiveAlbumId] = useState<string | "all" | "none">("all");
    const [search, setSearch] = useState("");

    const [newAlbumName, setNewAlbumName] = useState("");
    const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
    const [editingAlbumName, setEditingAlbumName] = useState("");

    const [addMode, setAddMode] = useState<AddMode>("upload");
    const [urlInput, setUrlInput] = useState("");
    const [altInput, setAltInput] = useState("");
    const [selectedAlbumId, setSelectedAlbumId] = useState<string>(UNASSIGNED);
    const [previewFile, setPreviewFile] = useState<{ file: File; previewUrl: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [confirmTarget, setConfirmTarget] = useState<{ type: "sticker"; id: string; label: string } | { type: "album"; id: string; label: string } | null>(null);

    const invalidate = () => qc.invalidateQueries({ queryKey: adminKeys.chat_widget });
    const invalidateAlbums = () => qc.invalidateQueries({ queryKey: ["admin", "sticker-albums"] });

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

    const toggleActiveMut = useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateSticker(id, { isActive }),
        onSuccess: invalidate,
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const assignAlbumMut = useMutation({
        mutationFn: ({ id, albumId }: { id: string; albumId: string | null }) => updateSticker(id, { albumId }),
        onSuccess: invalidate,
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const deleteStickerMut = useMutation({
        mutationFn: (id: string) => deleteSticker(id),
        onSuccess: () => { invalidate(); setConfirmTarget(null); },
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const reorderMut = useMutation({
        mutationFn: (ids: string[]) => reorderStickers(ids),
        onSuccess: (data) => qc.setQueryData(adminKeys.chat_widget, data),
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const createAlbumMut = useMutation({
        mutationFn: () => createStickerAlbum(newAlbumName.trim()),
        onSuccess: () => { setNewAlbumName(""); invalidateAlbums(); },
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const renameAlbumMut = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => updateStickerAlbum(id, { name }),
        onSuccess: () => { setEditingAlbumId(null); invalidateAlbums(); },
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const deleteAlbumMut = useMutation({
        mutationFn: (id: string) => deleteStickerAlbum(id),
        onSuccess: () => {
            invalidateAlbums();
            invalidate();
            if (activeAlbumId === confirmTarget?.id) setActiveAlbumId("all");
            setConfirmTarget(null);
        },
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const albumCounts = useMemo(() => {
        const map = new Map<string, number>();
        for (const s of stickers) {
            if (s.albumId) map.set(s.albumId, (map.get(s.albumId) ?? 0) + 1);
        }
        return map;
    }, [stickers]);

    const unassignedCount = stickers.filter((s) => !s.albumId).length;
    const canReorder = activeAlbumId === "all" && search.trim() === "";

    const filteredStickers = useMemo(() => {
        let list = stickers;
        if (activeAlbumId === "none") list = list.filter((s) => !s.albumId);
        else if (activeAlbumId !== "all") list = list.filter((s) => s.albumId === activeAlbumId);
        const q = search.trim().toLowerCase();
        if (q) list = list.filter((s) => (s.alt || "").toLowerCase().includes(q));
        return list;
    }, [stickers, activeAlbumId, search]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (previewFile) URL.revokeObjectURL(previewFile.previewUrl);
        setPreviewFile({ file, previewUrl: URL.createObjectURL(file) });
    };

    const move = (index: number, direction: -1 | 1) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= stickers.length) return;
        const next = [...stickers];
        [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
        reorderMut.mutate(next.map((s) => s.id));
    };

    function requestDeleteSticker(s: { id: string; alt: string }) {
        setConfirmTarget({ type: "sticker", id: s.id, label: s.alt || "sticker này" });
    }
    function requestDeleteAlbum(a: { id: string; name: string }) {
        setConfirmTarget({ type: "album", id: a.id, label: a.name });
    }

    const confirmPending = deleteStickerMut.isPending || deleteAlbumMut.isPending;

    return (
        <div className="flex flex-col gap-8 pb-16">
            <header>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">Chat</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">Quản lý Sticker</h1>
                <p className="mt-2 max-w-2xl text-sm text-foreground/55">
                    Sticker và album hiển thị trong khung chat của khách hàng. Tải ảnh lên trực tiếp hoặc dán URL ảnh có sẵn.
                </p>
            </header>

            <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
                <div className="flex flex-col gap-6">

                    {/* Quản lý Album */}
                    <Card className="rounded-2xl border border-black/6 shadow-sm">
                        <CardContent className="flex flex-col gap-4 px-5 py-5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                                Album ({albums.length})
                            </p>

                            {albums.length === 0 ? (
                                <p className="text-xs text-foreground/40">
                                    Chưa có album nào — tạo album để nhóm sticker theo chủ đề (vui, buồn, chào hỏi…).
                                </p>
                            ) : (
                                <div className="flex flex-col gap-1.5">
                                    {albums.map((a) => (
                                        <div key={a.id} className="flex items-center gap-2 rounded-xl bg-black/[0.02] px-3 py-2">
                                            {editingAlbumId === a.id ? (
                                                <>
                                                    <Input
                                                        autoFocus
                                                        value={editingAlbumName}
                                                        onChange={(e) => setEditingAlbumName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" && editingAlbumName.trim()) {
                                                                renameAlbumMut.mutate({ id: a.id, name: editingAlbumName.trim() });
                                                            }
                                                            if (e.key === "Escape") setEditingAlbumId(null);
                                                        }}
                                                        className={`${adminInputClass} h-8 flex-1 text-xs`}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="shrink-0 rounded-full bg-[#1a3c34] px-2.5 text-[11px] font-semibold text-white"
                                                        onPress={() => editingAlbumName.trim() && renameAlbumMut.mutate({ id: a.id, name: editingAlbumName.trim() })}
                                                        isDisabled={renameAlbumMut.isPending || !editingAlbumName.trim()}
                                                    >
                                                        Lưu
                                                    </Button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingAlbumId(null)}
                                                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-foreground/40 hover:bg-black/5"
                                                        aria-label="Huỷ"
                                                    >
                                                        <X className="size-3.5" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveAlbumId(a.id)}
                                                        className={`flex-1 truncate text-left text-sm font-medium transition ${activeAlbumId === a.id ? "text-[#1a3c34]" : "text-foreground/75 hover:text-foreground"}`}
                                                    >
                                                        {a.name}
                                                        <span className="ml-1.5 text-xs font-normal text-foreground/35">
                                                            {albumCounts.get(a.id) ?? 0} sticker
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setEditingAlbumId(a.id); setEditingAlbumName(a.name); }}
                                                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-foreground/35 hover:bg-black/5 hover:text-foreground"
                                                        aria-label="Đổi tên"
                                                    >
                                                        <Pencil className="size-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => requestDeleteAlbum(a)}
                                                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-foreground/35 hover:bg-red-50 hover:text-red-600"
                                                        aria-label="Xoá album"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center gap-2 border-t border-black/6 pt-4">
                                <Input
                                    value={newAlbumName}
                                    onChange={(e) => setNewAlbumName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && newAlbumName.trim() && createAlbumMut.mutate()}
                                    placeholder="Tên album mới, ví dụ: Vui vẻ"
                                    className={`${adminInputClass} h-9 flex-1 text-xs`}
                                />
                                <Button
                                    size="sm"
                                    className="shrink-0 rounded-full bg-[#1a3c34] px-4 text-xs font-semibold text-white"
                                    onPress={() => createAlbumMut.mutate()}
                                    isDisabled={!newAlbumName.trim() || createAlbumMut.isPending}
                                >
                                    <Plus className="size-3.5" />
                                    Tạo album
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Danh sách sticker */}
                    <Card className="rounded-2xl border border-black/6 shadow-sm">
                        <CardContent className="flex flex-col gap-4 px-5 py-5">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                                    Sticker ({filteredStickers.length}/{stickers.length})
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

                            <div className="flex flex-wrap gap-1.5">
                                {([
                                    { id: "all" as const, label: `Tất cả (${stickers.length})` },
                                    ...albums.map((a) => ({ id: a.id, label: `${a.name} (${albumCounts.get(a.id) ?? 0})` })),
                                    { id: "none" as const, label: `Chưa phân loại (${unassignedCount})` },
                                ]).map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveAlbumId(tab.id)}
                                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${activeAlbumId === tab.id ? "bg-[#1a3c34] text-white" : "bg-black/[0.04] text-foreground/60 hover:bg-black/[0.08]"}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {!canReorder && stickers.length > 0 && (
                                <p className="text-[11px] text-amber-600">
                                    Sắp xếp thủ công chỉ khả dụng khi xem "Tất cả" và không tìm kiếm.
                                </p>
                            )}

                            {isLoading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="size-5 animate-spin text-foreground/30" />
                                </div>
                            ) : stickers.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-10 text-foreground/35">
                                    <StickerIcon className="size-8" />
                                    <p className="text-sm">Chưa có sticker nào — thêm sticker đầu tiên ở cột bên phải.</p>
                                </div>
                            ) : filteredStickers.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-10 text-foreground/35">
                                    <ImageOff className="size-8" />
                                    <p className="text-sm">Không có sticker nào khớp với bộ lọc hiện tại.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    {filteredStickers.map((s) => {
                                        const realIdx = stickers.findIndex((x) => x.id === s.id);
                                        return (
                                            <div
                                                key={s.id}
                                                className={`flex flex-col gap-2 rounded-xl border p-2.5 transition ${s.isActive ? "border-black/8" : "border-black/6 bg-black/[0.015] opacity-60"}`}
                                            >
                                                <div className="flex items-center justify-center rounded-lg bg-[#fafafa] p-2">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={s.url} alt={s.alt || "sticker"} className="h-16 w-16 object-contain" />
                                                </div>

                                                {s.alt && (
                                                    <p className="truncate text-center text-[11px] text-foreground/45" title={s.alt}>
                                                        {s.alt}
                                                    </p>
                                                )}

                                                <AlbumSelect
                                                    value={s.albumId ?? UNASSIGNED}
                                                    onChange={(id) => assignAlbumMut.mutate({ id: s.id, albumId: id === UNASSIGNED ? null : id })}
                                                    albums={albums}
                                                    isDisabled={assignAlbumMut.isPending}
                                                    className="h-8 w-full text-[11px]"
                                                />

                                                <div className="flex items-center justify-between gap-1">
                                                    <div className="flex gap-0.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => move(realIdx, -1)}
                                                            disabled={!canReorder || realIdx === 0 || reorderMut.isPending}
                                                            aria-label="Lên"
                                                            className="flex size-6 items-center justify-center rounded-full text-foreground/40 hover:bg-black/5 disabled:opacity-25"
                                                        >
                                                            <ArrowUp className="size-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => move(realIdx, 1)}
                                                            disabled={!canReorder || realIdx === stickers.length - 1 || reorderMut.isPending}
                                                            aria-label="Xuống"
                                                            className="flex size-6 items-center justify-center rounded-full text-foreground/40 hover:bg-black/5 disabled:opacity-25"
                                                        >
                                                            <ArrowDown className="size-3.5" />
                                                        </button>
                                                    </div>

                                                    <Switch
                                                        size="sm"
                                                        isSelected={s.isActive}
                                                        onChange={(v) => toggleActiveMut.mutate({ id: s.id, isActive: v })}
                                                        isDisabled={toggleActiveMut.isPending}
                                                    >
                                                        <Switch.Control><Switch.Thumb /></Switch.Control>
                                                    </Switch>

                                                    <button
                                                        type="button"
                                                        onClick={() => requestDeleteSticker(s)}
                                                        className="flex size-6 items-center justify-center rounded-full text-foreground/35 hover:bg-red-50 hover:text-red-600"
                                                        aria-label="Xoá"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col gap-4">
                    <Card className="sticky top-6 rounded-2xl border border-black/6 shadow-sm">
                        <CardContent className="flex flex-col gap-5 px-5 py-5">
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