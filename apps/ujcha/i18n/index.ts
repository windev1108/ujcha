import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Localization from 'expo-localization'

import vi from '../../web/i18n/messages/vi/default.json'
import en from '../../web/i18n/messages/en/default.json'

export const SUPPORTED_LANGUAGES = ['vi', 'en'] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const STORAGE_KEY = 'ujcha_language'

const deviceLang = Localization.getLocales()[0]?.languageCode ?? 'vi'
const initialLang: AppLanguage = deviceLang.startsWith('vi') ? 'vi' : 'en'

i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
    en: { translation: en },
  },
  lng: initialLang,
  fallbackLng: 'vi',
  interpolation: {
    prefix: '{',
    suffix: '}',
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
})

// Load user's saved language preference after init
AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
  if (saved === 'vi' || saved === 'en') {
    i18n.changeLanguage(saved)
  }
})

export async function changeLanguage(lang: AppLanguage) {
  await i18n.changeLanguage(lang)
  await AsyncStorage.setItem(STORAGE_KEY, lang)
}

export default i18n
