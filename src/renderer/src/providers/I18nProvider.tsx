import { useEffect, useState, type FC, type PropsWithChildren } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n, { initI18n, changeLanguage } from '../i18n'
import { useGeneralSettingKey } from '../store/settings-store'

let initialLanguagePromise: Promise<string> | null = null

async function resolveInitialLanguage(): Promise<string> {
  if (!initialLanguagePromise) {
    initialLanguagePromise = (async () => {
      try {
        const result = await window.api.settings.get()
        return result?.general?.language || 'zh-CN'
      } catch {
        return 'zh-CN'
      }
    })()
  }

  return await initialLanguagePromise
}

export const I18nProvider: FC<PropsWithChildren> = ({ children }) => {
  const [i18nInstance, setI18nInstance] = useState<typeof i18n | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        const language = await resolveInitialLanguage()
        const instance = await initI18n(language)
        setI18nInstance(instance)
        setReady(true)
      } catch (error) {
        console.error('Failed to initialize i18n:', error)
        const instance = await initI18n('zh-CN')
        setI18nInstance(instance)
        setReady(true)
      }
    }

    init()
  }, [])

  // React to language changes from settings store
  const language = useGeneralSettingKey('language')

  useEffect(() => {
    if (ready && i18nInstance && language) {
      if (i18nInstance.language !== language) {
        changeLanguage(language).catch(console.error)
      }
    }
  }, [language, ready, i18nInstance])

  if (!ready || !i18nInstance) {
    return null
  }

  return <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>
}
