import { ipcMain } from "electron"
import { app } from "electron"
import { join } from "path"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import {
  IPC,
  type AppSettings,
  DEFAULT_SETTINGS,
  DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE,
} from "../../shared/types"

let cachedSettings: AppSettings | null = null

function isLegacyDefaultSystemPromptTemplate(template: string | undefined): boolean {
  const normalized = (template || "").trim().replace(/\s+/g, " ")
  if (!normalized) return false
  return (
    normalized.includes("AI assistant")
    && normalized.includes("{{context}}")
    && normalized.includes("{{persona}}")
    && normalized.includes("RSS feed content")
  )
}

function getSettingsPath(): string {
  const userDataPath = app.getPath("userData")
  return join(userDataPath, "data", "settings.json")
}

export function getSettings(): AppSettings {
  if (cachedSettings) return cachedSettings

  const settingsPath = getSettingsPath()
  if (existsSync(settingsPath)) {
    try {
      const raw = readFileSync(settingsPath, "utf-8")
      const saved = JSON.parse(raw) as Partial<AppSettings>
      cachedSettings = {
        ...DEFAULT_SETTINGS,
        ...saved,
        ai: { ...DEFAULT_SETTINGS.ai, ...(saved.ai || {}) },
        general: { ...DEFAULT_SETTINGS.general, ...(saved.general || {}) },
        data: { ...DEFAULT_SETTINGS.data, ...(saved.data || {}) },
        translation: { ...DEFAULT_SETTINGS.translation, ...(saved.translation || {}) },
      }
      // Migrate legacy English default system prompt to concise Chinese default.
      if (isLegacyDefaultSystemPromptTemplate(cachedSettings.ai.systemPromptTemplate)) {
        cachedSettings.ai.systemPromptTemplate = DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE
      }
      return cachedSettings!
    } catch {
      cachedSettings = { ...DEFAULT_SETTINGS }
      return cachedSettings
    }
  }

  cachedSettings = { ...DEFAULT_SETTINGS }
  return cachedSettings
}

function saveSettings(settings: AppSettings): void {
  const settingsPath = getSettingsPath()
  const dir = join(settingsPath, "..")
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  cachedSettings = settings
}

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_GET, () => {
    return getSettings()
  })

  ipcMain.handle(IPC.SETTINGS_SET, (_event, newSettings: Partial<AppSettings>) => {
    const current = getSettings()
    const merged = {
      ...current,
      ...newSettings,
      ai: { ...current.ai, ...(newSettings.ai || {}) },
      general: { ...current.general, ...(newSettings.general || {}) },
      data: { ...(current.data || {}), ...(newSettings.data || {}) },
      translation: { ...current.translation, ...(newSettings.translation || {}) },
    }
    saveSettings(merged)
    return { success: true, settings: merged }
  })
}



