import { useEffect } from 'react'
import {
  getSettingsSnapshot,
  useGeneralSettingsShallowSelector,
} from '../store/settings-store'
import { applyAppearanceSettings } from '../lib/appearance'

export function useApplyAppearanceSettings() {
  const general = useGeneralSettingsShallowSelector((settings) => ({
    theme: settings.theme,
    accentColor: settings.accentColor,
    reduceMotion: settings.reduceMotion,
    uiFontFamily: settings.uiFontFamily,
    contentFontFamily: settings.contentFontFamily,
    customCSS: settings.customCSS,
  }))

  useEffect(() => {
    applyAppearanceSettings(general)
  }, [general])

  useEffect(() => {
    if (general.theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () =>
      applyAppearanceSettings(getSettingsSnapshot().general)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [general.theme])
}
