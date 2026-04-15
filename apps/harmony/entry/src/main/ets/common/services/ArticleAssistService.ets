import { http } from '@kit.NetworkKit'
import { AIAssistantSettings, AI_PROVIDER_OPTIONS, AIProvider, AITargetLanguage } from '../models/LivoModels'
import { AI_REQUEST_CONNECT_TIMEOUT_MS, AI_REQUEST_READ_TIMEOUT_MS } from '../AppConfig'

interface ChatMessage {
  role: string
  content: string
}

interface ChatRequest {
  model: string
  messages: ChatMessage[]
  max_tokens: number
}

interface ChatContentPart {
  text?: string
}

interface ChatMessageResponse {
  content?: string | ChatContentPart[] | ChatContentPart
  reasoning_content?: string
}

interface ChatChoiceResponse {
  text?: string
  message?: ChatMessageResponse
  delta?: ChatChoiceDelta
}

interface ChatChoiceDelta {
  content?: string
}

interface ChatCompletionResponse {
  output_text?: string
  choices?: ChatChoiceResponse[]
  content?: string | ChatContentPart[] | ChatContentPart
  message?: string
  reply?: string
  data?: ChatCompletionResponse
  output_sensitive?: boolean
  output_sensitive_type?: number
  base_resp?: ProviderBaseResponse
}

interface AnthropicTextContentBlock {
  type: string
  text?: string
  thinking?: string
}

interface AnthropicTextInputBlock {
  type: string
  text: string
}

interface AnthropicMessageRequest {
  role: string
  content: string | AnthropicTextInputBlock[]
}

interface AnthropicRequest {
  model: string
  messages: AnthropicMessageRequest[]
  max_tokens: number
  system?: string
}

interface AnthropicResponse {
  content?: AnthropicTextContentBlock[]
}

interface MiniMaxTextRequest {
  model: string
  messages: ChatMessage[]
  max_completion_tokens: number
}

interface ProviderBaseResponse {
  status_code?: number
  status_msg?: string
}

interface ProviderErrorObject {
  message?: string
}

interface ProviderErrorResponse {
  base_resp?: ProviderBaseResponse
  message?: string
  error?: ProviderErrorObject
}

export interface TranslationFormattingHint {
  tweetKind?: 'tweet' | 'retweet' | 'quote'
  sourceUserName?: string
  retweetedUserName?: string
}

export class ArticleAssistService {
  private static decodeByteArray(bytes: Uint8Array): string {
    let output = ''
    for (let index = 0; index < bytes.length; index += 1) {
      output += String.fromCharCode(bytes[index])
    }
    return output
  }

  private static stringifyHttpResult(result: Object | string | number | boolean | null | undefined): string {
    if (typeof result === 'string') {
      return result
    }
    if (result instanceof ArrayBuffer) {
      try {
        return ArticleAssistService.decodeByteArray(new Uint8Array(result))
      } catch (_error) {
        return ''
      }
    }
    if (result instanceof Uint8Array) {
      try {
        return ArticleAssistService.decodeByteArray(result)
      } catch (_error) {
        return ''
      }
    }
    try {
      return JSON.stringify(result ?? '')
    } catch (_error) {
      return String(result ?? '')
    }
  }

  private static async delay(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve: () => void) => {
      setTimeout(() => resolve(), milliseconds)
    })
  }

  private static extractErrorDetail(raw: string): string {
    try {
      const parsed = JSON.parse(raw) as ProviderErrorResponse
      const statusMessage = (parsed.base_resp?.status_msg || '')
      if ((statusMessage || '').trim()) {
        return statusMessage.trim()
      }
      const message = (parsed.message || '')
      if ((message || '').trim()) {
        return message.trim()
      }
      const errorMessage = (parsed.error?.message || '')
      return (errorMessage || '').trim()
    } catch (_error) {
      return ''
    }
  }

  static summarize(title: string, summary: string, paragraphs: string[]): string {
    return ArticleAssistService.summarizeInLanguage(title, summary, paragraphs, 'zh-CN')
  }

  static summarizeInLanguage(
    title: string,
    summary: string,
    paragraphs: string[],
    language: AITargetLanguage,
  ): string {
    const compactParagraphs = paragraphs
      .map((paragraph: string) => paragraph.trim())
      .filter((paragraph: string) => paragraph.length > 0)

    const lead = compactParagraphs.slice(0, 2).join(' ')
    const source = summary.trim() || lead || title
    const trimmed = source.length > 140 ? `${source.slice(0, 140)}...` : source
    const prefix = ArticleAssistService.summaryPrefix(language)

    return `${prefix}${trimmed}`
  }

  static async summarizeWithAI(
    title: string,
    summary: string,
    paragraphs: string[],
    language: AITargetLanguage,
    aiSettings: AIAssistantSettings,
  ): Promise<string> {
    const articleContext = ArticleAssistService.buildArticleContext(title, summary, paragraphs)
    const outputLanguage = ArticleAssistService.languageLabel(language)
    const prompt =
      `请基于给定文章信息，使用${outputLanguage}生成100字内的精炼摘要，不要编造原文没有的信息`
      
    return ArticleAssistService.runChatCompletion(prompt, aiSettings, articleContext, 240)
  }

  static async translateWithAI(
    title: string,
    summary: string,
    paragraphs: string[],
    language: AITargetLanguage,
    aiSettings: AIAssistantSettings,
    formattingHint?: TranslationFormattingHint,
  ): Promise<string> {
    const fullContext = ArticleAssistService.buildArticleContext(title, summary, paragraphs)
    const compactContext = ArticleAssistService.buildCompactArticleContext(title, summary)
    const linePreservedContext = ArticleAssistService.buildTranslationLineContext(title, summary, paragraphs)
    const outputLanguage = ArticleAssistService.languageLabel(language)
    const prompt =
      `请将给定文章内容翻译为${outputLanguage}：\n` +
      '1. 保留原文事实与专有名词\n' +
      '2. 语气自然、简洁\n' +
      '3. 只输出翻译内容，不加解释，不要输出“标题：”“摘要：”“正文：”等标签\n' +
      '4. 若出现 RT，表示“转发”；RT 下方的人名/账号名不翻译；RT 下方正文视为被转发内容并继续翻译'
    const linePrompt =
      `请将给定文本逐行翻译为${outputLanguage}，必须保留原文换行结构：\n` +
      '1. 一行原文对应一行译文\n' +
      '2. 空行保留为空行\n' +
      '3. 只输出译文，不加解释或标签'
    const enhancedPrompt = ArticleAssistService.enhanceTranslationPromptForRetweet(prompt, formattingHint)
    try {
      const raw = await ArticleAssistService.runChatCompletion(enhancedPrompt, aiSettings, fullContext, 520)
      const normalized = ArticleAssistService.normalizeTranslationOutput(raw)
      if (!normalized) {
        throw new Error('AI 返回翻译内容为空')
      }
      return normalized
    } catch (_error) {
      try {
        const raw = await ArticleAssistService.runChatCompletion(enhancedPrompt, aiSettings, compactContext, 320)
        const normalized = ArticleAssistService.normalizeTranslationOutput(raw)
        if (!normalized) {
          throw new Error('AI 返回翻译内容为空')
        }
        return normalized
      } catch (_retryError) {
        const lineEnhancedPrompt = ArticleAssistService.enhanceTranslationPromptForRetweet(linePrompt, formattingHint)
        const raw = await ArticleAssistService.runChatCompletion(lineEnhancedPrompt, aiSettings, linePreservedContext, 560)
        const normalized = ArticleAssistService.normalizeTranslationOutput(raw)
        if (!normalized) {
          throw new Error('AI 返回翻译内容为空')
        }
        return normalized
      }
    }
  }

  static async localizeTextWithAI(
    text: string,
    language: AITargetLanguage,
    aiSettings: AIAssistantSettings,
  ): Promise<string> {
    const plainText = (text || '').trim()
    if (!plainText) {
      return ''
    }
    const outputLanguage = ArticleAssistService.languageLabel(language)
    const prompt = `请将以下文本转换为${outputLanguage}，只输出结果，不要解释。`
    const raw = await ArticleAssistService.runChatCompletion(prompt, aiSettings, `文本：${plainText}`, 160)
    return ArticleAssistService.sanitizeModelOutput(raw)
  }

  private static providerDefinition(provider: AIProvider) {
    switch (provider) {
      case 'minimax':
        return AI_PROVIDER_OPTIONS.minimax
      case 'deepseek':
        return AI_PROVIDER_OPTIONS.deepseek
      case 'openai':
        return AI_PROVIDER_OPTIONS.openai
      case 'anthropic':
        return AI_PROVIDER_OPTIONS.anthropic
      case 'glm':
        return AI_PROVIDER_OPTIONS.glm
      case 'custom':
        return AI_PROVIDER_OPTIONS.custom
      default:
        return AI_PROVIDER_OPTIONS.deepseek
    }
  }

  private static buildArticleContext(title: string, summary: string, paragraphs: string[]): string {
    const compactParagraphs = paragraphs
      .map((paragraph: string) => paragraph.trim())
      .filter((paragraph: string) => paragraph.length > 0)
    const contentExcerpt = compactParagraphs.slice(0, 4).join('\n')
    const merged = [
      `标题：${(title || '').trim()}`,
      `摘要：${(summary || '').trim()}`,
      `正文片段：${contentExcerpt}`,
    ].join('\n')
    return merged.slice(0, 2200)
  }

  private static buildCompactArticleContext(title: string, summary: string): string {
    const merged = [
      `标题：${(title || '').trim()}`,
      `摘要：${(summary || '').trim()}`,
    ].join('\n')
    return merged.slice(0, 900)
  }

  private static buildTranslationLineContext(title: string, summary: string, paragraphs: string[]): string {
    const compactParagraphs = paragraphs
      .map((paragraph: string) => paragraph.trim())
      .filter((paragraph: string) => paragraph.length > 0)
    const content = compactParagraphs.slice(0, 6).join('\n\n')
    const merged = [
      (title || '').trim(),
      '',
      (summary || '').trim(),
      '',
      content,
    ].join('\n')
    return merged.slice(0, 2600)
  }

  private static languageLabel(language: AITargetLanguage): string {
    switch (language) {
      case 'zh-CN':
        return '简体中文'
      case 'zh-TW':
        return '繁体中文'
      case 'en':
        return 'English'
      case 'ja':
        return '日本語'
      case 'ko':
        return '한국어'
      case 'fr':
        return 'Français'
      case 'de':
        return 'Deutsch'
      case 'es':
        return 'Español'
      case 'ru':
        return 'Русский'
      case 'ar':
        return 'العربية'
      default:
        return language
    }
  }

  private static providerApiKey(aiSettings: AIAssistantSettings): string {
    const apiKey = (aiSettings.apiKeys[aiSettings.provider] ?? '').trim()
    if (!apiKey) {
      throw new Error('请先在 设置 > AI助手 中填写当前提供商 API Key')
    }
    return apiKey
  }

  private static completionEndpoint(aiSettings: AIAssistantSettings): string {
    const providerConfig = ArticleAssistService.providerDefinition(aiSettings.provider)
    const baseUrl = (aiSettings.baseUrl || providerConfig.defaultBaseUrl || '').trim()
    if (!baseUrl) {
      throw new Error('请先在 设置 > AI助手 中配置 Base URL')
    }
    const normalizedBase = baseUrl.toLowerCase()
    if (
      normalizedBase.includes('/chat/completions')
      || normalizedBase.includes('/text/chatcompletion_v2')
      || normalizedBase.includes('/v1/messages')
      || normalizedBase.includes('/anthropic/')
    ) {
      return baseUrl
    }

    if (aiSettings.provider === 'anthropic') {
      return ArticleAssistService.joinBaseUrl(baseUrl, '/messages')
    }
    if (aiSettings.provider === 'minimax') {
      return ArticleAssistService.joinBaseUrl(baseUrl, '/text/chatcompletion_v2')
    }
    return ArticleAssistService.joinBaseUrl(baseUrl, '/chat/completions')
  }

  private static joinBaseUrl(baseUrl: string, path: string): string {
    const normalizedBase = (baseUrl || '').trim().replace(/\/+$/g, '')
    return `${normalizedBase}${path}`
  }

  private static shouldUseAnthropicFormat(aiSettings: AIAssistantSettings, endpoint: string): boolean {
    return aiSettings.provider === 'minimax' && endpoint.includes('/anthropic/')
  }

  private static shouldUseMiniMaxTextFormat(aiSettings: AIAssistantSettings, endpoint: string): boolean {
    return aiSettings.provider === 'minimax' && endpoint.includes('/text/chatcompletion_v2')
  }

  private static enhanceTranslationPromptForRetweet(
    basePrompt: string,
    formattingHint?: TranslationFormattingHint,
  ): string {
    if (!formattingHint || formattingHint.tweetKind !== 'retweet') {
      return basePrompt
    }
    const sourceUser = (formattingHint.sourceUserName || '').trim() || '用户'
    const retweetedUser = (formattingHint.retweetedUserName || '').trim() || '转发用户'
    return `${basePrompt}\n` +
      '5. 当内容为 RT 转发时，必须严格按以下格式输出（保持换行，不要添加其他行）：\n' +
      `{${sourceUser}}: 翻译内容\n` +
      '转发了：\n' +
      `{${retweetedUser}}：转发文字`
  }

  private static resolveSystemPrompt(template: string, context: string, persona: string): string {
    return (template || '')
      .replace(/\{\{context\}\}/g, context)
      .replace(/\{\{persona\}\}/g, persona)
      .trim()
  }

  private static sanitizeModelOutput(content: string): string {
    let normalized = (content || '')
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
      .trim()

    const finalMarkers = [
      'Final Answer:',
      'Final answer:',
      '最终答案：',
      '最终回答：',
      '答案：',
    ]
    for (const marker of finalMarkers) {
      const markerIndex = normalized.lastIndexOf(marker)
      if (markerIndex >= 0) {
        const candidate = normalized.slice(markerIndex + marker.length).trim()
        if (candidate) {
          normalized = candidate
          break
        }
      }
    }
    return normalized
  }

  private static normalizeTranslationOutput(content: string): string {
    const lines = (content || '')
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .split(/\r?\n/)
    const normalizedLines: string[] = []
    lines.forEach((line: string) => {
      const cleanedLine = line.replace(/^(标题|摘要|正文|正文片段|翻译)\s*[：:]\s*/g, '').trim()
      if (!cleanedLine) {
        if (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1] !== '') {
          normalizedLines.push('')
        }
        return
      }
      normalizedLines.push(cleanedLine)
    })
    while (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1] === '') {
      normalizedLines.pop()
    }
    return normalizedLines.join('\n')
  }

  private static summaryPrefix(language: AITargetLanguage): string {
    switch (language) {
      case 'en':
        return 'Summary: '
      case 'ja':
        return '要点: '
      case 'ko':
        return '요약: '
      case 'fr':
        return 'Résumé : '
      case 'de':
        return 'Zusammenfassung: '
      case 'es':
        return 'Resumen: '
      case 'ru':
        return 'Кратко: '
      case 'ar':
        return 'الملخص: '
      case 'zh-TW':
        return '摘要重點：'
      case 'zh-CN':
      default:
        return '摘要重点：'
    }
  }

  private static parseTextFromContentArray(content?: string | ChatContentPart[] | ChatContentPart): string {
    if (!content || typeof content === 'string') {
      return ''
    }
    if (!Array.isArray(content)) {
      const singlePartText = (content.text || '').trim()
      return singlePartText
    }
    const fragments: string[] = []
    content.forEach((item: ChatContentPart) => {
      const text = (item?.text || '').trim()
      if (text.trim()) {
        fragments.push(text.trim())
      }
    })
    return fragments.join('\n').trim()
  }

  private static extractResponseContent(parsed: ChatCompletionResponse, allowReasoningFallback: boolean = true): string {
    if (parsed.data) {
      const nested = ArticleAssistService.extractResponseContent(parsed.data, allowReasoningFallback)
      if (nested) {
        return nested
      }
    }

    const reply = (parsed.reply || '').trim()
    if (reply) {
      return reply
    }

    const rootMessage = (parsed.message || '').trim()
    if (rootMessage) {
      return rootMessage
    }

    const outputText = (parsed.output_text || '').trim()
    if (outputText.trim()) {
      return outputText.trim()
    }

    const choices = parsed.choices || []
    const firstChoice = choices?.[0]
    if (firstChoice) {
      const deltaContent = (firstChoice.delta?.content || '').trim()
      if (deltaContent) {
        return deltaContent
      }

      const choiceText = (firstChoice.text || '').trim()
      if (choiceText.trim()) {
        return choiceText.trim()
      }

      const message = firstChoice.message
      if (message) {
        const messageContent = message.content
        if (typeof messageContent === 'string' && messageContent.trim()) {
          return messageContent.trim()
        }

        if (messageContent && !Array.isArray(messageContent)) {
          const singlePartText = ((messageContent as ChatContentPart).text || '').trim()
          if (singlePartText) {
            return singlePartText
          }
        }

        const messageArrayText = ArticleAssistService.parseTextFromContentArray(messageContent)
        if (messageArrayText) {
          return messageArrayText
        }

        if (allowReasoningFallback) {
          const reasoningContent = (message.reasoning_content || '').trim()
          if (reasoningContent.trim()) {
            return reasoningContent.trim()
          }
        }
      }
    }

    const content = parsed.content
    if (typeof content === 'string' && content.trim()) {
      return content.trim()
    }
    const rootArrayText = ArticleAssistService.parseTextFromContentArray(content)
    if (rootArrayText) {
      return rootArrayText
    }
    return ''
  }

  private static extractSoftProviderError(parsed: ChatCompletionResponse): string {
    if (parsed.output_sensitive) {
      const sensitiveType = parsed.output_sensitive_type ? `（类型 ${parsed.output_sensitive_type}）` : ''
      return `输出被策略拦截${sensitiveType}`
    }
    const statusCode = parsed.base_resp?.status_code || 0
    if (statusCode && statusCode !== 0) {
      const statusMessage = (parsed.base_resp?.status_msg || '').trim()
      return statusMessage ? `${statusCode} ${statusMessage}` : `${statusCode}`
    }
    return ''
  }

  private static extractAnthropicResponseContent(parsed: AnthropicResponse): string {
    const blocks = parsed.content || []
    const fragments: string[] = []
    blocks.forEach((block: AnthropicTextContentBlock) => {
      if (!block) {
        return
      }
      if (block.type === 'text' && (block.text || '').trim()) {
        fragments.push((block.text || '').trim())
      }
    })
    return fragments.join('\n').trim()
  }

  private static miniMaxTextEndpoint(endpoint: string): string {
    const normalized = (endpoint || '').trim().replace(/\/+$/g, '')
    if (normalized.includes('/text/chatcompletion_v2')) {
      return normalized
    }
    if (normalized.endsWith('/chat/completions')) {
      return normalized.replace(/\/chat\/completions$/g, '/text/chatcompletion_v2')
    }
    return `${normalized}/text/chatcompletion_v2`
  }

  private static async runChatCompletion(
    prompt: string,
    aiSettings: AIAssistantSettings,
    context: string,
    maxTokens: number,
  ): Promise<string> {
    const endpoint = ArticleAssistService.completionEndpoint(aiSettings)
    const apiKey = ArticleAssistService.providerApiKey(aiSettings)
    const model = (aiSettings.model || '').trim()
    if (!model) {
      throw new Error('请先在 设置 > AI助手 中配置模型')
    }

    const useAnthropicFormat = ArticleAssistService.shouldUseAnthropicFormat(aiSettings, endpoint)
    const useMiniMaxTextFormat = ArticleAssistService.shouldUseMiniMaxTextFormat(aiSettings, endpoint)
    const persona = (aiSettings.chatPersonaPrompt || '').trim()
    const userContent = `${prompt}\n\n${context}`
    const systemPrompt = aiSettings.enableSystemPrompt
      ? ArticleAssistService.resolveSystemPrompt(aiSettings.systemPromptTemplate, context, persona)
      : (persona ? `Persona: ${persona}` : '')

    let requestBody: string = ''
    if (useAnthropicFormat) {
      const anthropicMessages: AnthropicMessageRequest[] = [{
        role: 'user',
        content: [{
          type: 'text',
          text: userContent,
        }],
      }]
      const anthropicRequest: AnthropicRequest = {
        model,
        messages: anthropicMessages,
        max_tokens: maxTokens,
      }
      if (systemPrompt) {
        anthropicRequest.system = systemPrompt
      }
      requestBody = JSON.stringify(anthropicRequest)
    } else if (useMiniMaxTextFormat) {
      const minimaxMessages: ChatMessage[] = []
      if (systemPrompt) {
        minimaxMessages.push({ role: 'system', content: systemPrompt })
      }
      minimaxMessages.push({ role: 'user', content: userContent })
      const miniMaxRequest: MiniMaxTextRequest = {
        model,
        messages: minimaxMessages,
        max_completion_tokens: maxTokens,
      }
      requestBody = JSON.stringify(miniMaxRequest)
    } else {
      const chatMessages: ChatMessage[] = []
      if (systemPrompt) {
        chatMessages.push({ role: 'system', content: systemPrompt })
      }
      chatMessages.push({ role: 'user', content: userContent })
      const chatRequest: ChatRequest = {
        model,
        messages: chatMessages,
        max_tokens: maxTokens,
      }
      requestBody = JSON.stringify(chatRequest)
    }

    const request = http.createHttp()
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      }
      if (useAnthropicFormat) {
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
      }
      const maxAttempts = 2
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const response = await request.request(endpoint, {
          method: http.RequestMethod.POST,
          connectTimeout: AI_REQUEST_CONNECT_TIMEOUT_MS,
          readTimeout: AI_REQUEST_READ_TIMEOUT_MS,
          header: headers,
          extraData: requestBody,
        })
        const raw = ArticleAssistService.stringifyHttpResult(response.result)
        if (response.responseCode !== 200) {
          const detail = ArticleAssistService.extractErrorDetail(raw)
          if (response.responseCode === 529 && attempt < maxAttempts - 1) {
            await ArticleAssistService.delay(900)
            continue
          }
          if (detail) {
            throw new Error(`AI 请求失败：HTTP ${response.responseCode} - ${detail}`)
          }
          throw new Error(`AI 请求失败：HTTP ${response.responseCode}`)
        }
      const responseContent = useAnthropicFormat
        ? ArticleAssistService.extractAnthropicResponseContent(JSON.parse(raw) as AnthropicResponse)
        : (() => {
          const parsed = JSON.parse(raw) as ChatCompletionResponse
          const softError = ArticleAssistService.extractSoftProviderError(parsed)
          if (softError) {
            throw new Error(softError)
          }
          return ArticleAssistService.extractResponseContent(parsed, aiSettings.provider !== 'minimax')
        })()
        let content = ArticleAssistService.sanitizeModelOutput(responseContent)
        if (!content && aiSettings.provider === 'minimax' && !useAnthropicFormat && !useMiniMaxTextFormat) {
          const fallbackEndpoint = ArticleAssistService.miniMaxTextEndpoint(endpoint)
          const minimaxMessages: ChatMessage[] = []
          if (systemPrompt) {
            minimaxMessages.push({ role: 'system', content: systemPrompt })
          }
          minimaxMessages.push({ role: 'user', content: userContent })
          const fallbackBody = JSON.stringify({
            model,
            messages: minimaxMessages,
            max_completion_tokens: maxTokens,
          } as MiniMaxTextRequest)
          const fallbackResponse = await request.request(fallbackEndpoint, {
            method: http.RequestMethod.POST,
            connectTimeout: AI_REQUEST_CONNECT_TIMEOUT_MS,
            readTimeout: AI_REQUEST_READ_TIMEOUT_MS,
            header: headers,
            extraData: fallbackBody,
          })
          const fallbackRaw = ArticleAssistService.stringifyHttpResult(fallbackResponse.result)
          if (fallbackResponse.responseCode === 200) {
            const fallbackContent = ArticleAssistService.extractResponseContent(
              JSON.parse(fallbackRaw) as ChatCompletionResponse,
              false,
            )
            content = ArticleAssistService.sanitizeModelOutput(fallbackContent)
          }
        }
        if (!content) {
          throw new Error('AI 返回内容为空')
        }
        return content
      }
      throw new Error('AI 请求失败：未知错误')
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error))
    } finally {
      request.destroy()
    }
  }
}
