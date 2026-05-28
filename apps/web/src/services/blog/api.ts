import { api } from '@/config/server';

export type PostType = 'news' | 'blog' | 'promotion';
export type PostContentFormat = 'markdown' | 'html';

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  thumbnail: string | null;
  type: PostType;
  contentFormat: PostContentFormat;
  publishedAt: string;
  createdAt: string;
}

export interface BlogPost extends BlogPostSummary {
  content: string;
  updatedAt: string;
}

export interface BlogPostsResponse {
  items: BlogPostSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function fetchBlogPosts(params: {
  type?: PostType;
  page?: number;
  limit?: number;
}): Promise<BlogPostsResponse> {
  const { data } = await api.get<BlogPostsResponse>('/blog/posts', { params });
  return data;
}

export async function fetchBlogPost(slug: string): Promise<BlogPost> {
  const { data } = await api.get<BlogPost>(`/blog/posts/${slug}`);
  return data;
}
