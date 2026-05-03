import { HarmonySettings, ThemeAccent, ThemeMode } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'

export interface AppearanceOption {
  label: string
  value: string
  color?: string
}

export interface AppearanceSettingsPatch {
  themeMode?: ThemeMode
  themeAccent?: ThemeAccent
  showUnreadDot?: boolean
}

export const THEME_MODE_OPTIONS: AppearanceOption[] = [
  { label: '跟随系统', value: 'system' },
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
]

export const THEME_ACCENT_OPTIONS: AppearanceOption[] = [
  { label: '流光橙', value: 'orange', color: '#FF6A00' },
  { label: '星河蓝', value: 'blue', color: '#2563EB' },
  { label: '珊瑚红', value: 'red', color: '#DC2626' },
  { label: '莓果粉', value: 'pink', color: '#DB2777' },
  { label: '森林绿', value: 'green', color: '#16A34A' },
]

const DEFAULT_ACCENT_COLOR: string = '#FF6A00'

export function themeModeLabel(mode: ThemeMode): string {
  for (const option of THEME_MODE_OPTIONS) {
    if (option.value === mode) {
      return option.label
    }
  }
  return THEME_MODE_OPTIONS[0].label
}

export function themeAccentLabel(accent: ThemeAccent): string {
  for (const option of THEME_ACCENT_OPTIONS) {
    if (option.value === accent) {
      return option.label
    }
  }
  return THEME_ACCENT_OPTIONS[0].label
}

export function themeAccentColor(accent: ThemeAccent): string {
  for (const option of THEME_ACCENT_OPTIONS) {
    if (option.value === accent) {
      return option.color ?? DEFAULT_ACCENT_COLOR
    }
  }
  return DEFAULT_ACCENT_COLOR
}

export function patchAppearanceSettings(
  settings: HarmonySettings,
  patch: AppearanceSettingsPatch,
): HarmonySettings {
  return {
    autoRefresh: settings.autoRefresh,
    aiSummaryEnabled: settings.aiSummaryEnabled,
    aiSummaryAutoTrigger: settings.aiSummaryAutoTrigger,
    aiTranslationEnabled: settings.aiTranslationEnabled,
    aiTranslationLanguage: settings.aiTranslationLanguage,
    aiTranslationAutoTrigger: settings.aiTranslationAutoTrigger,
    imageProxyEnabled: settings.imageProxyEnabled,
    searchAllHomeCategories: settings.searchAllHomeCategories,
    refreshIntervalMinutes: settings.refreshIntervalMinutes,
    themeMode: patch.themeMode ?? settings.themeMode,
    themeAccent: patch.themeAccent ?? settings.themeAccent,
    language: settings.language,
    remoteFeedUrl: settings.remoteFeedUrl,
    showUnreadDot: patch.showUnreadDot ?? settings.showUnreadDot,
  }
}

export function optimisticAppearancePalette(
  settings: HarmonySettings,
  currentPalette: ThemePalette,
): ThemePalette {
  let basePalette: ThemePalette
  if (settings.themeMode === 'dark') {
    basePalette = ThemeService.darkPalette()
  } else if (settings.themeMode === 'light') {
    basePalette = ThemeService.lightPalette()
  } else {
    basePalette = currentPalette.isDark
      ? ThemeService.darkPalette()
      : ThemeService.lightPalette()
  }
  basePalette.accent = themeAccentColor(settings.themeAccent)
  basePalette.accentText = '#FFFFFF'
  return basePalette
}
