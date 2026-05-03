import {
  AIProvider,
  AIAssistantSettings,
  DEFAULT_AI_ASSISTANT_SETTINGS,
  DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE,
} from '../models/LivoModels'
import { PreferenceStoreAccessor } from './PreferenceStoreAccessor'

const AI_KEY_PROVIDER: string = 'aiProvider'
const AI_KEY_BASE_URL: string = 'aiBaseUrl'
const AI_KEY_MODEL: string = 'aiModel'
const AI_KEY_ENABLE_SYSTEM_PROMPT: string = 'aiEnableSystemPrompt'
const AI_KEY_SYSTEM_PROMPT_TEMPLATE: string = 'aiSystemPromptTemplate'
const AI_KEY_CHAT_PERSONA_PROMPT: string = 'aiChatPersonaPrompt'
const AI_PROVIDERS: string[] = ['minimax', 'deepseek', 'openai', 'anthropic', 'glm', 'custom']

export class AIAssistantSettingsStore {
  static async load(): Promise<AIAssistantSettings> {
    try {
      const pref = await PreferenceStoreAccessor.getPreferences()
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

  static async save(next: AIAssistantSettings): Promise<AIAssistantSettings> {
    try {
      const pref = await PreferenceStoreAccessor.getPreferences()
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
      return AIAssistantSettingsStore.load()
    } catch (error) {
      throw new Error(`保存 AI 设置失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }
}
