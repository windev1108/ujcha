import { useTranslation } from 'react-i18next'
import { changeLanguage, SUPPORTED_LANGUAGES, type AppLanguage } from '@/i18n'

export function useLocale() {
  const { i18n } = useTranslation()

  return {
    locale: i18n.language as AppLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    changeLocale: changeLanguage,
  }
}
