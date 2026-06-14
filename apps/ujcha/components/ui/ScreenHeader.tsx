import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

interface ScreenHeaderProps {
  title: string
  showBack?: boolean
  right?: React.ReactNode
}

export function ScreenHeader({ title, showBack = true, right }: ScreenHeaderProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <View style={{ paddingTop: insets.top }} className="bg-white border-b border-black/5">
      <View className="h-14 flex-row items-center px-4">
        {showBack ? (
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1" hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
          </TouchableOpacity>
        ) : (
          <View className="w-8 mr-3" />
        )}
        <Text className="flex-1 text-[17px] font-bold text-ink">{title}</Text>
        {right && <View>{right}</View>}
      </View>
    </View>
  )
}
