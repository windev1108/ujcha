'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchProfile, updateProfile, uploadAvatar, checkAvatarUploadAllowed, type UpdateProfilePayload } from './api'
import { useAuthStore } from '@/store/auth-store'

export function useProfileQuery() {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
    staleTime: 60_000,
    enabled: !!accessToken,
  })
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient()
  const patchUser = useAuthStore((s) => s.patchUser)
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateProfile(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data)
      patchUser({ name: data.name, avatar: data.avatar, email: data.email, emailMarketingEnabled: data.emailMarketingEnabled })
    },
  })
}

export function useUploadAvatarMutation() {
  const queryClient = useQueryClient()
  const patchUser = useAuthStore((s) => s.patchUser)
  return useMutation({
    mutationFn: (avatarUrl: string) => uploadAvatar(avatarUrl),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data)
      patchUser({ avatar: data.avatar })
    },
  })
}

export function useCheckAvatarUploadAllowed() {
  return useMutation({
    mutationFn: checkAvatarUploadAllowed,
  })
}
