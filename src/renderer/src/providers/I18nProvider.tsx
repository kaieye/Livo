import { useEffect, useState, type FC, type PropsWithChildren } from "react"
import { I18nextProvider } from "react-i18next"
import i18n, { initI18n, changeLanguage } from "../i18n"
import { useSettingsStore } from "../store/settings-store"

export const I18nProvider: FC<PropsWithChildren> = ({ children }) => {
  const [i18nInstance, setI18nInstance] = useState<typeof i18n | null>(null)
  const [ready, setReady] = useState(false)

  // Initialize i18n on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Get saved language from settings
        let language = "zh-CN"
        try {
          const result = await window.api.settings.get()
          // The IPC handler returns AppSettings directly
          language = result?.general?.language || "zh-CN"
        } catch {
          // Fallback to default
        }

        const instance = await initI18n(language)
        setI18nInstance(instance)
        setReady(true)
      } catch (error) {
        console.error("Failed to initialize i18n:", error)
        const instance = await initI18n("zh-CN")
        setI18nInstance(instance)
        setReady(true)
      }
    }

    init()
  }, [])

  // React to language changes from settings store
  const language = useSettingsStore((s) => s.settings.general.language)

  useEffect(() => {
    if (ready && i18nInstance && language) {
      // Only change language if it's different from the current one
      if (i18nInstance.language !== language) {
        changeLanguage(language).catch(console.error)
      }
    }
  }, [language, ready, i18nInstance])

  if (!ready || !i18nInstance) {
    return null // or a loading state
  }

  return <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>
}
