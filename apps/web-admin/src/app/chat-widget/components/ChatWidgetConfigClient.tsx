"use client";

import {
    Button, Card, CardContent, CloseIcon, Input, Label, Spinner, Switch,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
    ArrowDown, ArrowUp, ImagePlus, Link as LinkIcon,
    Loader2, Plus, Sticker as StickerIcon, Trash2, Upload,
} from "lucide-react";
import { Fragment, useMemo, useRef, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { adminFieldStack, adminInputClass, adminLabelClass } from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import { createStickerAlbum, createStickerByUrl, deleteSticker, deleteStickerAlbum, fetchStickerAlbums, fetchStickers, reorderStickers, updateSticker, uploadStickerFile } from "@/services/admin/chat-widget-api";


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

    const [addMode, setAddMode] = useState<AddMode>("upload");
    const [urlInput, setUrlInput] = useState("");
    const [altInput, setAltInput] = useState("");
    const [previewFile, setPreviewFile] = useState<{ file: File; previewUrl: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeAlbumId, setActiveAlbumId] = useState<string | "all" | "none">("all");
    const [newAlbumName, setNewAlbumName] = useState("");
    const [selectedAlbumId, setSelectedAlbumId] = useState<string | undefined>(undefined);
    const invalidateAlbums = () => qc.invalidateQueries({ queryKey: ["admin", "sticker-albums"] });
    const [activeStickerAlbum, setActiveStickerAlbum] = useState<string | "all">("all");

    const invalidate = () => qc.invalidateQueries({ queryKey: adminKeys.chat_widget });

    const createAlbumMut = useMutation({
        mutationFn: () => createStickerAlbum(newAlbumName.trim()),
        onSuccess: () => { setNewAlbumName(""); invalidateAlbums(); },
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const deleteAlbumMut = useMutation({
        mutationFn: (id: string) => deleteStickerAlbum(id),
        onSuccess: () => { invalidateAlbums(); invalidate(); },
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });


    const filteredStickers = useMemo(() => {
        if (activeStickerAlbum === "all") return stickers;
        if (activeStickerAlbum === "none") return stickers.filter((s) => !s.albumId);
        return stickers.filter((s) => s.albumId === activeStickerAlbum);
    }, [stickers, activeStickerAlbum]);
    const createUrlMut = useMutation({
        mutationFn: () => createStickerByUrl(urlInput.trim(), altInput.trim() || undefined, selectedAlbumId),
        onSuccess: () => { setUrlInput(""); setAltInput(""); invalidate(); },
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const uploadFileMut = useMutation({
        mutationFn: () => {
            if (!previewFile) throw new Error("Chưa chọn ảnh.");
            return uploadStickerFile(previewFile.file, altInput.trim() || undefined, selectedAlbumId);
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

    const deleteMut = useMutation({
        mutationFn: (id: string) => deleteSticker(id),
        onSuccess: invalidate,
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

    const reorderMut = useMutation({
        mutationFn: (ids: string[]) => reorderStickers(ids),
        onSuccess: (data) => qc.setQueryData(adminKeys.chat_widget, data),
        onError: (e) => showAlert(axiosMessage(e), "Lỗi"),
    });

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

    return (
        <div className="flex flex-col gap-8 pb-16">
            <header>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">Chat</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">Quản lý Sticker</h1>
                <p className="mt-2 max-w-2xl text-sm text-foreground/55">
                    Sticker hiển thị trong khung chat của khách hàng. Tải ảnh lên trực tiếp hoặc dán URL ảnh có sẵn.
                </p>
            </header>

            <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
                <div className="flex flex-col gap-4">
                    <Card className="rounded-2xl border border-black/6 shadow-sm">
                        <CardContent className="flex flex-col gap-4 px-5 py-5">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {[
                                    { id: "all" as const, name: `Tất cả (${stickers.length})` },
                                    ...albums.map((a) => ({ id: a.id, name: `${a.name} (${stickers.filter((s) => s.albumId === a.id).length})` })),
                                ].map((tab) => (
                                    <div
                                        key={tab.id}
                                        className="flex items-center gap-2"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setActiveAlbumId(tab.id)}
                                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${activeAlbumId === tab.id ? "bg-[#1a3c34] text-white" : "bg-black/[0.04] text-foreground/60 hover:bg-black/[0.08]"}`}
                                        >
                                            {tab.name}
                                        </button>
                                        {tab.id !== 'all' &&
                                            <Button size="sm" onClick={() => deleteAlbumMut.mutate(tab.id)}>
                                                {deleteAlbumMut.isPending ?
                                                    <Spinner />
                                                    :
                                                    <CloseIcon />
                                                }
                                            </Button>
                                        }
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center gap-2">
                                <Input value={newAlbumName} onChange={(e) => setNewAlbumName(e.target.value)}
                                    placeholder="Tên album mới" className={`${adminInputClass} h-8 text-xs`} />
                                <Button size="sm" className="shrink-0 rounded-full bg-[#1a3c34] px-3 text-xs font-semibold text-white"
                                    onPress={() => createAlbumMut.mutate()} isDisabled={!newAlbumName.trim() || createAlbumMut.isPending}>
                                    + Album
                                </Button>
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                                Danh sách ({stickers.length})
                            </p>

                            {isLoading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="size-5 animate-spin text-foreground/30" />
                                </div>
                            ) : stickers.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-10 text-foreground/35">
                                    <StickerIcon className="size-8" />
                                    <p className="text-sm">Chưa có sticker nào</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    {filteredStickers.map((s, idx) => (
                                        <div
                                            key={s.id}
                                            className={`relative flex flex-col gap-2 rounded-xl border p-2.5 ${s.isActive ? "border-black/8" : "border-black/6 opacity-50"}`}
                                        >
                                            <div className="flex items-center justify-center rounded-lg bg-[#fafafa] p-2">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={s.url} alt={s.alt || "sticker"} className="h-16 w-16 object-contain" />
                                            </div>

                                            <div className="flex items-center justify-between gap-1">
                                                <div className="flex gap-0.5">
                                                    <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0 || reorderMut.isPending}
                                                        aria-label="Lên" className="flex size-6 items-center justify-center rounded-full text-foreground/40 hover:bg-black/5 disabled:opacity-30">
                                                        <ArrowUp className="size-3.5" />
                                                    </button>
                                                    <button type="button" onClick={() => move(idx, 1)} disabled={idx === stickers.length - 1 || reorderMut.isPending}
                                                        aria-label="Xuống" className="flex size-6 items-center justify-center rounded-full text-foreground/40 hover:bg-black/5 disabled:opacity-30">
                                                        <ArrowDown className="size-3.5" />
                                                    </button>
                                                </div>

                                                <Switch size="sm" isSelected={s.isActive}
                                                    onChange={(v) => toggleActiveMut.mutate({ id: s.id, isActive: v })}
                                                    isDisabled={toggleActiveMut.isPending}>
                                                    <Switch.Control><Switch.Thumb /></Switch.Control>
                                                </Switch>

                                                <button type="button" onClick={() => deleteMut.mutate(s.id)} disabled={deleteMut.isPending}
                                                    aria-label="Xoá" className="flex size-6 items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            </div>
                                            <select
                                                value={s.albumId ?? ""}
                                                onChange={(e) => updateSticker(s.id, { albumId: e.target.value || null }).then(invalidate)}
                                                className="w-full rounded-lg border border-black/10 bg-white px-2 py-1 text-[11px]"
                                            >
                                                <option value="">Chưa phân loại</option>
                                                {albums.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                            </select>
                                        </div>
                                    ))}
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
                                <button type="button" onClick={() => setAddMode("upload")}
                                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${addMode === "upload" ? "bg-white text-[#1a3c34] shadow-sm" : "text-foreground/50"}`}>
                                    <Upload className="size-3.5" />Tải ảnh lên
                                </button>
                                <button type="button" onClick={() => setAddMode("url")}
                                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${addMode === "url" ? "bg-white text-[#1a3c34] shadow-sm" : "text-foreground/50"}`}>
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
                                            <button type="button" onClick={() => { URL.revokeObjectURL(previewFile.previewUrl); setPreviewFile(null); }}
                                                className="text-xs font-medium text-red-500 hover:underline">Bỏ ảnh</button>
                                        </div>
                                    ) : (
                                        <button type="button" onClick={() => fileInputRef.current?.click()}
                                            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-black/10 py-8 text-foreground/40 hover:border-[#1a3c34]/40 hover:text-[#1a3c34]">
                                            <ImagePlus className="size-6" />
                                            <span className="text-xs font-medium">Chọn ảnh từ máy</span>
                                        </button>
                                    )}

                                    <div className={adminFieldStack}>
                                        <Label className={adminLabelClass}>Mô tả (alt, không bắt buộc)</Label>
                                        <Input value={altInput} onChange={(e) => setAltInput(e.target.value)} placeholder="VD: Mèo vẫy tay" className={adminInputClass} />
                                    </div>
                                    <div className={adminFieldStack}>
                                        <Label className={adminLabelClass}>Album (không bắt buộc)</Label>
                                        <select
                                            value={selectedAlbumId ?? ""}
                                            onChange={(e) => setSelectedAlbumId(e.target.value || undefined)}
                                            className={adminInputClass}
                                        >
                                            {albums.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                    <Button className="w-full rounded-full bg-[#1a3c34] font-semibold text-white"
                                        onPress={() => uploadFileMut.mutate()} isDisabled={!previewFile || uploadFileMut.isPending}>
                                        {uploadFileMut.isPending ? "Đang tải lên…" : "Thêm sticker"}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div className={adminFieldStack}>
                                        <Label className={adminLabelClass}>URL ảnh *</Label>
                                        <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://..." className={adminInputClass} />
                                    </div>
                                    <div className={adminFieldStack}>
                                        <Label className={adminLabelClass}>Mô tả (alt, không bắt buộc)</Label>
                                        <Input value={altInput} onChange={(e) => setAltInput(e.target.value)} placeholder="VD: Mèo vẫy tay" className={adminInputClass} />
                                    </div>

                                    {urlInput.trim() && (
                                        <div className="flex justify-center rounded-xl border border-black/8 bg-[#fafafa] p-3">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={urlInput.trim()} alt="preview" className="h-16 w-16 object-contain"
                                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                                        </div>
                                    )}

                                    <Button className="w-full rounded-full bg-[#1a3c34] font-semibold text-white"
                                        onPress={() => createUrlMut.mutate()} isDisabled={!urlInput.trim() || createUrlMut.isPending}>
                                        {createUrlMut.isPending ? "Đang thêm…" : "Thêm sticker"}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}