import { createAppStore } from "./helpers"
import type { AppSettings } from "../../../shared/types"
import { cloneDefaultSettings, mergeSettings, normalizeSettings } from "../../../shared/settings"

interface SettingsState {
  settings: AppSettings
  isLoaded: boolean
  isOpen: boolean
  activeTab: "general" | "reading" | "subscriptions" | "ai" | "translation" | "actions" | "accounts" | "data" | "about"

  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>
  updateSettingsSection: <K extends keyof AppSettings>(section: K, updates: Partial<AppSettings[K]>) => Promise<void>
  setOpen: (open: boolean) => void
  setActiveTab: (tab: SettingsState["activeTab"]) => void
}

export const useSettingsStore = createAppStore<SettingsState>((set, get) => ({
  settings: cloneDefaultSettings(),
  isLoaded: false,
  isOpen: false,
  activeTab: "general",

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
