import { Redirect } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'

export default function RootIndex() {
  const { isLoggedIn } = useAuth()
  return <Redirect href={isLoggedIn ? '/(tabs)' : '/(tabs)'} />
}
