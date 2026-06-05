import { registerChannel } from '../ipc/register-channel'
import { IPC, type AppSettings } from '../../shared/types'
import { mergeSettings } from '../../shared/settings'
import { settingsProvider } from '../services/system/settings-provider'

/** @deprecated Use `settingsProvider.get()` instead. */
export function getSettings(): AppSettings {
  return settingsProvider.get()
}

export async function applySettingsUpdate(
  updates: Partial<AppSettings>,
): Promise<AppSettings> {
  return settingsProvider.update(updates)
}

export function registerSettingsHandlers(): void {
  registerChannel(IPC.SETTINGS_GET, () => {
    return settingsProvider.get()
  })

  registerChannel(
    IPC.SETTINGS_SET,
    async (_event, newSettings: Partial<AppSettings>) => {
      const merged = mergeSettings(settingsProvider.get(), newSettings)
      await settingsProvider.update(newSettings)
      return { success: true, settings: merged }
    },
  )
}
