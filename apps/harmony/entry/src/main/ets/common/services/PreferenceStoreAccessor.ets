import preferences from '@ohos.data.preferences'
import { AppContextService } from './AppContextService'

const SETTINGS_NAME = 'livo_harmony_settings'

export class PreferenceStoreAccessor {
  private static pref: preferences.Preferences | null = null

  static async getPreferences(): Promise<preferences.Preferences> {
    if (!PreferenceStoreAccessor.pref) {
      try {
        PreferenceStoreAccessor.pref = await preferences.getPreferences(AppContextService.getContext(), SETTINGS_NAME)
      } catch (error) {
        throw new Error(`读取 Preferences 失败：${error instanceof Error ? error.message : 'unknown error'}`)
      }
    }

    return PreferenceStoreAccessor.pref!
  }
}
