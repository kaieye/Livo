import {
  AITargetLanguage,
  DEFAULT_HARMONY_SETTINGS,
  HarmonySettings,
} from '../models/LivoModels'
import { PreferenceStoreAccessor } from './PreferenceStoreAccessor'

export interface ISettingsStore {
  load(): Promise<HarmonySettings>
  save(next: HarmonySettings): Promise<HarmonySettings>
}

export class SettingsStore implements ISettingsStore {
  static readonly default: SettingsStore = new SettingsStore()

  async load(): Promise<HarmonySettings> {
    try {
      const pref = await PreferenceStoreAccessor.getPreferences()

      const autoRefresh = await pref.get('autoRefresh', DEFAULT_HARMONY_SETTINGS.autoRefresh)
      const aiSummaryEnabled = await pref.get('aiSummaryEnabled', DEFAULT_HARMONY_SETTINGS.aiSummaryEnabled)
      const aiSummaryAutoTrigger = await pref.get('aiSummaryAutoTrigger', DEFAULT_HARMONY_SETTINGS.aiSummaryAutoTrigger)
      const aiTranslationEnabled = await pref.get('aiTranslationEnabled', DEFAULT_HARMONY_SETTINGS.aiTranslationEnabled)
      const aiTranslationLanguage = await pref.get('aiTranslationLanguage', DEFAULT_HARMONY_SETTINGS.aiTranslationLanguage)
      const aiTranslationAutoTrigger = await pref.get('aiTranslationAutoTrigger', DEFAULT_HARMONY_SETTINGS.aiTranslationAutoTrigger)
      const imageProxyEnabled = await pref.get('imageProxyEnabled', DEFAULT_HARMONY_SETTINGS.imageProxyEnabled)
      const searchAllHomeCategories = await pref.get('searchAllHomeCategories', DEFAULT_HARMONY_SETTINGS.searchAllHomeCategories)
      const refreshIntervalMinutes = await pref.get('refreshIntervalMinutes', DEFAULT_HARMONY_SETTINGS.refreshIntervalMinutes)
      const themeMode = await pref.get('themeMode', DEFAULT_HARMONY_SETTINGS.themeMode)
      const themeAccent = await pref.get('themeAccent', DEFAULT_HARMONY_SETTINGS.themeAccent)
      const language = await pref.get('language', DEFAULT_HARMONY_SETTINGS.language)
      const remoteFeedUrl = await pref.get('remoteFeedUrl', DEFAULT_HARMONY_SETTINGS.remoteFeedUrl)
      const showUnreadDot = await pref.get('showUnreadDot', DEFAULT_HARMONY_SETTINGS.showUnreadDot)
      return {
        autoRefresh: autoRefresh as boolean,
        aiSummaryEnabled: aiSummaryEnabled as boolean,
        aiSummaryAutoTrigger: aiSummaryAutoTrigger as boolean,
        aiTranslationEnabled: aiTranslationEnabled as boolean,
        aiTranslationLanguage: aiTranslationLanguage as AITargetLanguage,
        aiTranslationAutoTrigger: aiTranslationAutoTrigger as boolean,
        imageProxyEnabled: imageProxyEnabled as boolean,
        searchAllHomeCategories: searchAllHomeCategories as boolean,
        refreshIntervalMinutes: refreshIntervalMinutes as number,
        themeMode: themeMode as 'light' | 'dark' | 'system',
        themeAccent: themeAccent as 'orange' | 'blue' | 'red' | 'pink' | 'green',
        language: language as string,
        remoteFeedUrl: remoteFeedUrl as string,
        showUnreadDot: showUnreadDot as boolean,
      }
    } catch (error) {
      throw new Error(`加载设置失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  async save(next: HarmonySettings): Promise<HarmonySettings> {
    try {
      const pref = await PreferenceStoreAccessor.getPreferences()

      await pref.put('autoRefresh', next.autoRefresh)
      await pref.put('aiSummaryEnabled', next.aiSummaryEnabled)
      await pref.put('aiSummaryAutoTrigger', next.aiSummaryAutoTrigger)
      await pref.put('aiTranslationEnabled', next.aiTranslationEnabled)
      await pref.put('aiTranslationLanguage', next.aiTranslationLanguage)
      await pref.put('aiTranslationAutoTrigger', next.aiTranslationAutoTrigger)
      await pref.put('imageProxyEnabled', next.imageProxyEnabled)
      await pref.put('searchAllHomeCategories', next.searchAllHomeCategories)
      await pref.put('refreshIntervalMinutes', next.refreshIntervalMinutes)
      await pref.put('themeMode', next.themeMode)
      await pref.put('themeAccent', next.themeAccent)
      await pref.put('language', next.language)
      await pref.put('remoteFeedUrl', next.remoteFeedUrl)
      await pref.put('showUnreadDot', next.showUnreadDot)
      await pref.flush()

      return this.load()
    } catch (error) {
      throw new Error(`保存设置失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  // --- Static convenience methods (delegate to singleton, backward-compatible) ---

  static async load(): Promise<HarmonySettings> {
    return SettingsStore.default.load()
  }

  static async save(next: HarmonySettings): Promise<HarmonySettings> {
    return SettingsStore.default.save(next)
  }
}
