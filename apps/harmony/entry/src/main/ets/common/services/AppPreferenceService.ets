import preferences from '@ohos.data.preferences'
import { DEFAULT_HARMONY_SETTINGS, HarmonySettings } from '../models/LivoModels'
import { AppContextService } from './AppContextService'

const SETTINGS_NAME = 'livo_harmony_settings'
export class AppPreferenceService {
  private static pref: preferences.Preferences | null = null
  private static async getPref(): Promise<preferences.Preferences> {
    if (!AppPreferenceService.pref) {
      AppPreferenceService.pref = await preferences.getPreferences(AppContextService.getContext(), SETTINGS_NAME)
    }

    return AppPreferenceService.pref!
  }
  static async loadSettings(): Promise<HarmonySettings> {
    const pref = await AppPreferenceService.getPref()

    const autoRefresh = await pref.get('autoRefresh', DEFAULT_HARMONY_SETTINGS.autoRefresh)
    const aiSummaryEnabled = await pref.get('aiSummaryEnabled', DEFAULT_HARMONY_SETTINGS.aiSummaryEnabled)
    const imageProxyEnabled = await pref.get('imageProxyEnabled', DEFAULT_HARMONY_SETTINGS.imageProxyEnabled)
    const refreshIntervalMinutes = await pref.get('refreshIntervalMinutes', DEFAULT_HARMONY_SETTINGS.refreshIntervalMinutes)
    const themeMode = await pref.get('themeMode', DEFAULT_HARMONY_SETTINGS.themeMode)
    const themeAccent = await pref.get('themeAccent', DEFAULT_HARMONY_SETTINGS.themeAccent)
    const language = await pref.get('language', DEFAULT_HARMONY_SETTINGS.language)
    const remoteFeedUrl = await pref.get('remoteFeedUrl', DEFAULT_HARMONY_SETTINGS.remoteFeedUrl)
    return {
      autoRefresh: autoRefresh as boolean,
      aiSummaryEnabled: aiSummaryEnabled as boolean,
      imageProxyEnabled: imageProxyEnabled as boolean,
      refreshIntervalMinutes: refreshIntervalMinutes as number,
      themeMode: themeMode as 'light' | 'dark' | 'system',
      themeAccent: themeAccent as 'orange' | 'blue' | 'red' | 'pink' | 'green',
      language: language as string,
      remoteFeedUrl: remoteFeedUrl as string,
    }
  }
  static async saveSettings(next: HarmonySettings): Promise<HarmonySettings> {
    const pref = await AppPreferenceService.getPref()

    await pref.put('autoRefresh', next.autoRefresh)
    await pref.put('aiSummaryEnabled', next.aiSummaryEnabled)
    await pref.put('imageProxyEnabled', next.imageProxyEnabled)
    await pref.put('refreshIntervalMinutes', next.refreshIntervalMinutes)
    await pref.put('themeMode', next.themeMode)
    await pref.put('themeAccent', next.themeAccent)
    await pref.put('language', next.language)
    await pref.put('remoteFeedUrl', next.remoteFeedUrl)
    await pref.flush()

    return AppPreferenceService.loadSettings()
  }
}
