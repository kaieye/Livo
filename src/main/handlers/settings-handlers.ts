import { registerChannel } from '../ipc/register-channel'
import { app } from 'electron'
import { getEventBus } from '../services/system/event-bus'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { IPC, type AppSettings } from '../../shared/types'
import {
  cloneDefaultSettings,
  mergeSettings,
  normalizeSettings,
} from '../../shared/settings'
import { applyProxySettings } from '../services/system/proxy'

let cachedSettings: AppSettings | null = null

function getSettingsPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'data', 'settings.json')
}

export function getSettings(): AppSettings {
  if (cachedSettings) return cachedSettings

  const settingsPath = getSettingsPath()
  if (existsSync(settingsPath)) {
    try {
      const raw = readFileSync(settingsPath, 'utf-8')
      const saved = JSON.parse(raw) as Partial<AppSettings>
      cachedSettings = normalizeSettings(saved)
      return cachedSettings!
    } catch {
      cachedSettings = cloneDefaultSettings()
      return cachedSettings
    }
  }

  cachedSettings = cloneDefaultSettings()
  return cachedSettings
}

function saveSettings(settings: AppSettings): void {
  const settingsPath = getSettingsPath()
  const dir = join(settingsPath, '..')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  cachedSettings = settings
}

/**
 * Apply a partial settings update from the main process (e.g. agent settings
 * tools), persist it, re-apply proxy config and broadcast the merged result to
 * all renderer windows so their settings store can stay in sync.
 */
export async function applySettingsUpdate(
  updates: Partial<AppSettings>,
): Promise<AppSettings> {
  const merged = mergeSettings(getSettings(), updates)
  saveSettings(merged)
  await applyProxySettings(merged)
  getEventBus().send('settings:changed', merged)
  return merged
}

export function registerSettingsHandlers(): void {
  registerChannel(IPC.SETTINGS_GET, () => {
    return getSettings()
  })

  registerChannel(
    IPC.SETTINGS_SET,
    async (_event, newSettings: Partial<AppSettings>) => {
      const current = getSettings()
      const merged = mergeSettings(current, newSettings)
      saveSettings(merged)
      await applyProxySettings(merged)
      return { success: true, settings: merged }
    },
  )
}
