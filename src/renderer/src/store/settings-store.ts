import { createAppStore, useStoreShallow } from './helpers'
import type { AppSettings, SettingsTabId } from '../../../shared/types'
import {
  cloneDefaultSettings,
  mergeSettings,
  normalizeSettings,
} from '../../../shared/settings'

interface SettingsState {
  settings: AppSettings
  isLoaded: boolean
  isOpen: boolean
  activeTab: SettingsTabId

  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>
  updateSettingsSection: <K extends keyof AppSettings>(
    section: K,
    updates: Partial<AppSettings[K]>,
  ) => Promise<void>
  setOpen: (open: boolean) => void
  setActiveTab: (tab: SettingsTabId) => void
}

type SettingsSelector<T> = (settings: AppSettings) => T

export const useSettingsStore = createAppStore<SettingsState>((set, get) => ({
  settings: cloneDefaultSettings(),
  isLoaded: false,
  isOpen: false,
  activeTab: 'general',

  loadSettings: async () => {
    try {
      const settings = await window.api.settings.get()
      set({ settings: normalizeSettings(settings), isLoaded: true })
    } catch {
      // Use defaults
      set({ settings: cloneDefaultSettings(), isLoaded: true })
    }
  },

  updateSettings: async (updates) => {
    const optimistic = mergeSettings(get().settings, updates)
    set({ settings: optimistic })
    const result = await window.api.settings.set(updates)
    if (result.success) {
      set({ settings: normalizeSettings(result.settings) })
    }
  },

  updateSettingsSection: async (section, updates) => {
    await get().updateSettings({ [section]: updates } as Partial<AppSettings>)
  },

  setOpen: (open) => set({ isOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}))

export function getSettingsSnapshot(): AppSettings {
  return useSettingsStore.getState().settings
}

export function useSettingsSelector<T>(selector: SettingsSelector<T>): T {
  return useSettingsStore((state) => selector(state.settings))
}

export function useSettingsShallowSelector<T>(
  selector: SettingsSelector<T>,
): T {
  return useStoreShallow(useSettingsStore, (state) => selector(state.settings))
}

export function useSettingSection<K extends keyof AppSettings>(
  section: K,
): AppSettings[K] {
  return useSettingsSelector((settings) => settings[section])
}

export function useGeneralSettingKey<K extends keyof AppSettings['general']>(
  key: K,
): AppSettings['general'][K] {
  return useSettingsSelector((settings) => settings.general[key])
}

export function useGeneralSettingsSelector<T>(
  selector: (general: AppSettings['general']) => T,
): T {
  return useSettingsSelector((settings) => selector(settings.general))
}

export function useGeneralSettingsShallowSelector<T>(
  selector: (general: AppSettings['general']) => T,
): T {
  return useSettingsShallowSelector((settings) => selector(settings.general))
}

export function useAISettingKey<K extends keyof AppSettings['ai']>(
  key: K,
): AppSettings['ai'][K] {
  return useSettingsSelector((settings) => settings.ai[key])
}

export function useAISettingsShallowSelector<T>(
  selector: (ai: AppSettings['ai']) => T,
): T {
  return useSettingsShallowSelector((settings) => selector(settings.ai))
}

export function useTranslationSettingKey<
  K extends keyof AppSettings['translation'],
>(key: K): AppSettings['translation'][K] {
  return useSettingsSelector((settings) => settings.translation[key])
}

export function useTranslationSettingsShallowSelector<T>(
  selector: (translation: AppSettings['translation']) => T,
): T {
  return useSettingsShallowSelector((settings) =>
    selector(settings.translation),
  )
}

export function useSettingsActions() {
  return useStoreShallow(useSettingsStore, (state) => ({
    updateSettings: state.updateSettings,
    updateSettingsSection: state.updateSettingsSection,
    setOpen: state.setOpen,
    setActiveTab: state.setActiveTab,
  }))
}
