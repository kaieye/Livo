import { useEffect, useRef, type FC, type PropsWithChildren } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n, { initI18n, changeLanguage } from '../i18n'
import { useGeneralSettingKey } from '../store/settings-store'

let i18nInitDone = false

/**
 * Initialize i18n synchronously with the default language (zh-CN),
 * then asynchronously switch to the user's preferred language.
 *
 * PERF: By not blocking children on the async IPC call, the entire
 * React tree renders immediately with default translations. The switch
 * to the user's preferred language happens in-place without a flash.
 */
function bootstrapI18n(): typeof i18n {
  if (!i18nInitDone) {
    i18nInitDone = true
    // Fire-and-forget: initialize with default, then switch to user pref.
    initI18n('zh-CN').then((instance) => {
      window.api.settings
        .get()
        .then((result) => {
          const lang = result?.general?.language
          if (lang && lang !== 'zh-CN') {
            changeLanguage(lang).catch(console.error)
          }
        })
        .catch(() => {
          // Settings not available yet — stay on zh-CN default.
        })
      return instance
    })
  }
  return i18n
}

export const I18nProvider: FC<PropsWithChildren> = ({ children }) => {
  const i18nInstance = bootstrapI18n()
  const language = useGeneralSettingKey('language')
  const prevLanguage = useRef(language)

  useEffect(() => {
    if (language && language !== prevLanguage.current) {
      prevLanguage.current = language
      changeLanguage(language).catch(console.error)
    }
  }, [language])

  return <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>
}
