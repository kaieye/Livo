import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

async function loadLanguageResource(language: string) {
  if (language === 'en') {
    const { en } = await import('./locales/en')
    return en
  }

  const { zhCN } = await import('./locales/zh-CN')
  return zhCN
}

async function ensureLanguageResource(language: string): Promise<void> {
  if (i18n.hasResourceBundle(language, 'translation')) return

  const resource = await loadLanguageResource(language)
  i18n.addResourceBundle(language, 'translation', resource, true, true)
}

// Initialize i18n
export const initI18n = async (language: string = 'zh-CN') => {
  if (i18n.isInitialized) {
    if (i18n.language !== language) {
      await changeLanguage(language)
    }
    return i18n
  }

  const resource = await loadLanguageResource(language)

  await i18n.use(initReactI18next).init({
    resources: {
      [language]: { translation: resource },
    },
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
  await ensureLanguageResource(language)
  await i18n.changeLanguage(language)
}

export default i18n
