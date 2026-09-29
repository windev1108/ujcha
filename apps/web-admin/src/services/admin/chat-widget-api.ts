import { api } from "@/config/server";

export async function fetchStickers(): Promise<AdminSticker[]> {
    const { data } = await api.get<AdminSticker[]>("/admin/chat-widget/stickers");
    return data;
}

export async function createStickerByUrl(url: string, alt?: string, albumId?: string): Promise<AdminSticker> {
    const { data } = await api.post<AdminSticker>("/admin/chat-widget/stickers", { url, alt, albumId });
    return data;
}

export async function uploadStickerFile(file: File, alt?: string, albumId?: string): Promise<AdminSticker> {
    const form = new FormData();
    form.append("file", file);
    if (alt) form.append("alt", alt);
    if (albumId) form.append("albumId", albumId);
    const { data } = await api.post<AdminSticker>("/admin/chat-widget/stickers/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
}

export async function updateSticker(
    id: string,
    patch: Partial<Pick<AdminSticker, "alt" | "isActive" | "albumId">>,
): Promise<AdminSticker> {
    const { data } = await api.patch<AdminSticker>(`/admin/chat-widget/stickers/${id}`, patch);
    return data;
}

export async function deleteSticker(id: string): Promise<void> {
    await api.delete(`/admin/chat-widget/stickers/${id}`);
}

export async function reorderStickers(ids: string[]): Promise<AdminSticker[]> {
    const { data } = await api.post<AdminSticker[]>("/admin/chat-widget/stickers/reorder", { ids });
    return data;
}


export interface AdminStickerAlbum {
    id: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
}

export interface AdminSticker {
    id: string;
    url: string;
    alt: string;
    sortOrder: number;
    isActive: boolean;
    albumId: string | null;
    album: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
}

export async function fetchStickerAlbums(): Promise<AdminStickerAlbum[]> {
    const { data } = await api.get<AdminStickerAlbum[]>("/admin/chat-widget/stickers/albums");
    return data;
}

export async function createStickerAlbum(name: string): Promise<AdminStickerAlbum> {
    const { data } = await api.post<AdminStickerAlbum>("/admin/chat-widget/stickers/albums", { name });
    return data;
}

export async function updateStickerAlbum(
    id: string,
    patch: Partial<Pick<AdminStickerAlbum, "name" | "isActive">>,
): Promise<AdminStickerAlbum> {
    const { data } = await api.patch<AdminStickerAlbum>(`/admin/chat-widget/stickers/albums/${id}`, patch);
    return data;
}

export async function deleteStickerAlbum(id: string): Promise<void> {
    await api.delete(`/admin/chat-widget/stickers/albums/${id}`);
}

export async function reorderStickerAlbums(ids: string[]): Promise<AdminStickerAlbum[]> {
    const { data } = await api.post<AdminStickerAlbum[]>("/admin/chat-widget/stickers/albums/reorder", { ids });
    return data;
}


export interface StickerChange {
    id: string;
    isActive?: boolean;
    albumId?: string | null;
}

export async function batchUpdateStickers(body: {
    order?: string[];
    changes?: StickerChange[];
}): Promise<AdminSticker[]> {
    const { data } = await api.put<AdminSticker[]>("/admin/chat-widget/stickers/batch", body);
    return data;
}