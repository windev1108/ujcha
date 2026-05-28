'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchBlogPosts, fetchBlogPost, type PostType } from './api';

export function useBlogPostsQuery(params: { type?: PostType; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['blog-posts', params],
    queryFn: () => fetchBlogPosts(params),
    staleTime: 2 * 60_000,
  });
}

export function useBlogPostQuery(slug: string) {
  return useQuery({
    queryKey: ['blog-post', slug],
    queryFn: () => fetchBlogPost(slug),
    staleTime: 5 * 60_000,
    enabled: !!slug,
  });
}
