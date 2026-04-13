import preferences from '@ohos.data.preferences'
import {
  AIProvider,
  AIAssistantSettings,
  AITargetLanguage,
  DEFAULT_AI_ASSISTANT_SETTINGS,
  DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE,
  DEFAULT_HARMONY_SETTINGS,
  HarmonySettings,
  RefreshLogEntry,
} from '../models/LivoModels'
import { AppContextService } from './AppContextService'

const SETTINGS_NAME = 'livo_harmony_settings'
const AI_KEY_PROVIDER: string = 'aiProvider'
const AI_KEY_BASE_URL: string = 'aiBaseUrl'
const AI_KEY_MODEL: string = 'aiModel'
const AI_KEY_ENABLE_SYSTEM_PROMPT: string = 'aiEnableSystemPrompt'
const AI_KEY_SYSTEM_PROMPT_TEMPLATE: string = 'aiSystemPromptTemplate'
const AI_KEY_CHAT_PERSONA_PROMPT: string = 'aiChatPersonaPrompt'
const REFRESH_LOGS_KEY: string = 'refreshLogs'
const MAX_REFRESH_LOGS: number = 60
const AI_PROVIDERS: string[] = ['minimax', 'deepseek', 'openai', 'anthropic', 'glm', 'custom']

function normalizeRefreshLogEntry(item: RefreshLogEntry): RefreshLogEntry {
  const normalized: RefreshLogEntry = {
    id: item.id,
    refreshedAt: Number(item.refreshedAt) || 0,
    successFeedCount: Math.max(0, Number(item.successFeedCount) || 0),
    failedFeedCount: Math.max(0, Number(item.failedFeedCount) || 0),
    failedFeedTitles: Array.isArray(item.failedFeedTitles)
      ? item.failedFeedTitles.filter((title: string) => !!title)
      : [],
  }
  return normalized
}
export class AppPreferenceService {
  private static pref: preferences.Preferences | null = null
  private static async getPref(): Promise<preferences.Preferences> {
    if (!AppPreferenceService.pref) {
      try {
        AppPreferenceService.pref = await preferences.getPreferences(AppContextService.getContext(), SETTINGS_NAME)
      } catch (error) {
        throw new Error(`读取 Preferences 失败：${error instanceof Error ? error.message : 'unknown error'}`)
      }
    }

    return AppPreferenceService.pref!
  }
  static async loadSettings(): Promise<HarmonySettings> {
    try {
      const pref = await AppPreferenceService.getPref()

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
  static async saveSettings(next: HarmonySettings): Promise<HarmonySettings> {
    try {
      const pref = await AppPreferenceService.getPref()

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

      return AppPreferenceService.loadSettings()
    } catch (error) {
      throw new Error(`保存设置失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async loadAISettings(): Promise<AIAssistantSettings> {
    try {
      const pref = await AppPreferenceService.getPref()
      const provider = await pref.get(AI_KEY_PROVIDER, await pref.get('ai.provider', DEFAULT_AI_ASSISTANT_SETTINGS.provider))
      const baseUrl = await pref.get(AI_KEY_BASE_URL, await pref.get('ai.baseUrl', DEFAULT_AI_ASSISTANT_SETTINGS.baseUrl))
      const model = await pref.get(AI_KEY_MODEL, await pref.get('ai.model', DEFAULT_AI_ASSISTANT_SETTINGS.model))
      const enableSystemPrompt = await pref.get(
        AI_KEY_ENABLE_SYSTEM_PROMPT,
        await pref.get('ai.enableSystemPrompt', DEFAULT_AI_ASSISTANT_SETTINGS.enableSystemPrompt),
      )
      const systemPromptTemplate = await pref.get(
        AI_KEY_SYSTEM_PROMPT_TEMPLATE,
        await pref.get(
          'ai.systemPromptTemplate',
          DEFAULT_AI_ASSISTANT_SETTINGS.systemPromptTemplate || DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE,
        ),
      )
      const chatPersonaPrompt = await pref.get(
        AI_KEY_CHAT_PERSONA_PROMPT,
        await pref.get('ai.chatPersonaPrompt', DEFAULT_AI_ASSISTANT_SETTINGS.chatPersonaPrompt),
      )

      // 迁移旧的单一 apiKey 到 per-provider 存储
      const legacyApiKey = await pref.get('aiApiKey', await pref.get('ai.apiKey', ''))
      const apiKeys: Record<string, string> = {}
      for (const p of AI_PROVIDERS) {
        const perProviderKey = await pref.get(`aiApiKey_${p}`, '') as string
        if (perProviderKey) {
          apiKeys[p] = perProviderKey
        } else if (legacyApiKey && p === (provider as string)) {
          // 迁移旧数据：把旧 apiKey 归到当前 provider
          apiKeys[p] = legacyApiKey as string
        }
      }

      return {
        provider: provider as AIProvider,
        apiKeys,
        baseUrl: baseUrl as string,
        model: model as string,
        enableSystemPrompt: enableSystemPrompt as boolean,
        systemPromptTemplate: systemPromptTemplate as string,
        chatPersonaPrompt: chatPersonaPrompt as string,
      }
    } catch (error) {
      throw new Error(`加载 AI 设置失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async saveAISettings(next: AIAssistantSettings): Promise<AIAssistantSettings> {
    try {
      const pref = await AppPreferenceService.getPref()
      await pref.put(AI_KEY_PROVIDER, next.provider)
      await pref.put(AI_KEY_BASE_URL, next.baseUrl)
      await pref.put(AI_KEY_MODEL, next.model)
      await pref.put(AI_KEY_ENABLE_SYSTEM_PROMPT, next.enableSystemPrompt)
      await pref.put(AI_KEY_SYSTEM_PROMPT_TEMPLATE, next.systemPromptTemplate)
      await pref.put(AI_KEY_CHAT_PERSONA_PROMPT, next.chatPersonaPrompt)
      for (const p of AI_PROVIDERS) {
        await pref.put(`aiApiKey_${p}`, next.apiKeys[p] ?? '')
      }
      await pref.flush()
      return AppPreferenceService.loadAISettings()
    } catch (error) {
      throw new Error(`保存 AI 设置失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async loadRefreshLogs(): Promise<RefreshLogEntry[]> {
    try {
      const pref = await AppPreferenceService.getPref()
      const raw = await pref.get(REFRESH_LOGS_KEY, '[]')
      const text = typeof raw === 'string' ? raw : '[]'
      const parsed = JSON.parse(text) as RefreshLogEntry[]
      if (!Array.isArray(parsed)) {
        return []
      }

      return parsed
        .filter((item: RefreshLogEntry) => item && typeof item.id === 'string')
        .map((item: RefreshLogEntry) => normalizeRefreshLogEntry(item))
    } catch (_error) {
      return []
    }
  }

  static async saveRefreshLogs(entries: RefreshLogEntry[]): Promise<RefreshLogEntry[]> {
    const normalizedEntries = entries
      .slice(0, MAX_REFRESH_LOGS)
      .map((entry: RefreshLogEntry) => normalizeRefreshLogEntry(entry))

    const pref = await AppPreferenceService.getPref()
    await pref.put(REFRESH_LOGS_KEY, JSON.stringify(normalizedEntries))
    await pref.flush()
    return normalizedEntries
  }

  static async appendRefreshLog(entry: RefreshLogEntry): Promise<RefreshLogEntry[]> {
    const current = await AppPreferenceService.loadRefreshLogs()
    const nextEntries = [entry, ...current].slice(0, MAX_REFRESH_LOGS)
    return AppPreferenceService.saveRefreshLogs(nextEntries)
  }

  static async clearRefreshLogs(): Promise<void> {
    await AppPreferenceService.saveRefreshLogs([])
  }
}
