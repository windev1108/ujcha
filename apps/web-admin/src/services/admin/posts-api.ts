import { api } from "@/config/server";

import type {
  AdminPost,
  AdminPostsListResponse,
  CreatePostBody,
  UpdatePostBody,
} from "./types";

export async function fetchAdminPosts(params: {
  q?: string;
  status?: AdminPost["status"];
  type?: AdminPost["type"];
  sort?: "newest" | "oldest";
  page?: number;
  pageSize?: number;
}): Promise<AdminPostsListResponse> {
  const { data } = await api.get<AdminPostsListResponse>("/admin/posts", {
    params,
  });
  return data;
}

export async function fetchAdminPost(id: string): Promise<AdminPost> {
  const { data } = await api.get<AdminPost>(`/admin/posts/${id}`);
  return data;
}

export async function createAdminPost(body: CreatePostBody): Promise<AdminPost> {
  const { data } = await api.post<AdminPost>("/admin/posts", body);
  return data;
}

export async function updateAdminPost(
  id: string,
  body: UpdatePostBody,
): Promise<AdminPost> {
  const { data } = await api.patch<AdminPost>(`/admin/posts/${id}`, body);
  return data;
}

export async function deleteAdminPost(id: string): Promise<void> {
  await api.delete(`/admin/posts/${id}`);
}

export async function publishAdminPost(id: string): Promise<AdminPost> {
  const { data } = await api.post<AdminPost>(`/admin/posts/${id}/publish`);
  return data;
}

export async function unpublishAdminPost(id: string): Promise<AdminPost> {
  const { data } = await api.post<AdminPost>(`/admin/posts/${id}/unpublish`);
  return data;
}
