import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en } from './locales/en'
import { zhCN } from './locales/zh-CN'

// Get resources dynamically
const resources = {
  en: { translation: en },
  'zh-CN': { translation: zhCN },
}

// Initialize i18n
export const initI18n = async (language: string = 'zh-CN') => {
  if (i18n.isInitialized) {
    if (i18n.language !== language) {
      await i18n.changeLanguage(language)
    }
    return i18n
  }

  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false, // Disable suspense to avoid flickering
    },
  })

  return i18n
}

// Change language
export const changeLanguage = async (language: string) => {
  await i18n.changeLanguage(language)
}

export default i18n
