import { useEffect, type PropsWithChildren } from 'react'
import { useApplyAppearanceSettings } from '../hooks/useApplyAppearanceSettings'
import { useGeneralSettingKey } from '../store/settings-store'

function resolveDocumentDir(language: string): 'ltr' | 'rtl' {
  return /^(ar|fa|he|ur)\b/i.test(language) ? 'rtl' : 'ltr'
}

export function SettingSyncProvider({ children }: PropsWithChildren) {
  const language = useGeneralSettingKey('language')

  useApplyAppearanceSettings()

  useEffect(() => {
    const root = document.documentElement
    if (!language) return

    root.lang = language
    root.dir = resolveDocumentDir(language)
    root.dataset.locale = language
  }, [language])

  return children
}
