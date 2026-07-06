import { registerChannel } from '../ipc/register-channel'
import { IPC, type AppSettings } from '../../shared/types'
import { redactSettingsSecrets } from '../../shared/settings-secrets'
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
    return redactSettingsSecrets(settingsProvider.get())
  })

  registerChannel(
    IPC.SETTINGS_SET,
    async (_event, newSettings: Partial<AppSettings>) => {
      const settings = await settingsProvider.update(newSettings)
      return { success: true, settings: redactSettingsSecrets(settings) }
    },
  )
}
