import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'

const KEY = 'ujcha_device_id'

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY)
  if (existing) return existing
  const id = Crypto.randomUUID()
  await AsyncStorage.setItem(KEY, id)
  return id
}
