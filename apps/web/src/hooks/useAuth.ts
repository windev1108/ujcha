import { useAuthStore } from "@/store/auth-store"

export const useAuth = () => {
    const { accessToken, user, hydrated } = useAuthStore()
    return {
        isLoggedIn: !!accessToken && !!user,
        isHydrated: hydrated,
        user,
    }
}