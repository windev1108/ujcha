'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicPointConfig } from './api';

export function usePublicPointConfigQuery() {
  return useQuery({
    queryKey: ['point-public-config'],
    queryFn: fetchPublicPointConfig,
    staleTime: 5 * 60_000,
  });
}