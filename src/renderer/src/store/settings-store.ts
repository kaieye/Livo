import { create } from "zustand"
import type { AppSettings } from "../../../shared/types"
import { DEFAULT_SETTINGS } from "../../../shared/types"

interface SettingsState {
  settings: AppSettings
  isLoaded: boolean
  isOpen: boolean
  activeTab: "general" | "reading" | "subscriptions" | "ai" | "translation" | "actions" | "accounts" | "data" | "about"

  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>
  setOpen: (open: boolean) => void
  setActiveTab: (tab: SettingsState["activeTab"]) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,
  isOpen: false,
  activeTab: "general",

  loadSettings: async () => {
    try {
      const settings = await window.api.settings.get()
      set({ settings, isLoaded: true })
    } catch {
      // Use defaults
      set({ isLoaded: true })
    }
  },

  updateSettings: async (updates) => {
    const result = await window.api.settings.set(updates)
    if (result.success) {
      set({ settings: result.settings })
    }
  },

  setOpen: (open) => set({ isOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
