import { AIAssistantSettings } from '../models/LivoModels'
import { ChatMessage } from './ChatHistoryStore'
import { ChatToolDefinition, buildDefaultTools, executeToolCall, ToolCallFunction } from './AIChatTools'
import { runChatCompletionForAgent, AgentChatCompletionResult } from './article-assist/ChatCompletionRunner'
import { AgentMessage, ChatToolCallMessage } from './article-assist/ProviderProtocol'
import { ExtractedToolCall } from './article-assist/ProviderResponseParser'
import { FeedRepository } from '../repositories/FeedRepository'
import { EntryRepository } from '../repositories/EntryRepository'
import { Feed, Entry } from '../models/LivoModels'

const MAX_AGENT_ROUNDS = 5

export interface AgentRoundDetail {
  name: string
  args: string
  resultSummary: string
}

export interface AgentRunResult {
  text: string
  toolRounds: AgentRoundDetail[]
}

const AGENT_SYSTEM_PROMPT = `你是 Livo 的智能助手，可以帮用户查看和管理 RSS 订阅。

你可以使用以下工具（必须通过 function calling 调用，不要在文本中描述工具名）：
- list_subscribed_feeds：查看所有已订阅的 RSS 源
- get_feed_entries：查看某个订阅源的文章列表
- get_today_updates：查看今天哪些订阅源更新了内容
- get_entry_detail：查看某篇文章的完整内容和细节
- get_unread_count：查看未读文章统计

使用规则：
1. 默认使用中文回复。
2. 当用户的问题需要查询订阅数据时，必须调用对应的 function，不要凭空猜测或描述你要调用什么函数。
3. 回复时使用友好的语气，对信息做适当的归纳和总结。`

function toolCallResultSummary(name: string, result: string): string {
  if (result.length > 0 && (result.charAt(0) === '{' || result.startsWith('错误'))) {
    return result.slice(0, 100)
  }
  return `${name} 执行完毕 (返回 ${result.length} 字)`
}

function truncateToolResult(result: string): string {
  const maxLen = 8000
  if (result.length <= maxLen) {
    return result
  }
  return result.slice(0, maxLen) + '\n\n...(结果已截断，总长度 ' + result.length + ' 字)'
}

async function buildContextFallback(): Promise<string> {
  let ctx = ''
  try {
    const feeds = await FeedRepository.default.list()
    if (feeds.length === 0) {
      return '当前没有任何订阅源。'
    }
    ctx += `用户订阅了 ${feeds.length} 个源：\n`
    for (const f of feeds) {
      const viewNames = ['文章', '社交', '视频', '图片']
      const vn = viewNames[f.view] ?? '未知'
      ctx += `- ${f.title} [${f.category || vn}] (ID: ${f.id})\n`
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayMs = today.getTime()
    const entries = await EntryRepository.default.listRecent(30)
    const todayEntries: Entry[] = []
    for (const e of entries) {
      if (e.publishedAt >= todayMs) {
        todayEntries.push(e)
      }
    }
    if (todayEntries.length > 0) {
      ctx += `\n今天更新的文章 (${todayEntries.length} 篇)：\n`
      const feedMap = new Map<string, string>()
      for (const f of feeds) {
        feedMap.set(f.id, f.title)
      }
      for (let i = 0; i < todayEntries.length; i += 1) {
        const e = todayEntries[i]
        const fn = feedMap.get(e.feedId) ?? e.feedId
        ctx += `[${i + 1}] ${e.title} (来自: ${fn}) - ${new Date(e.publishedAt).toLocaleString()}\n`
        if (e.summary) {
          const s = e.summary.slice(0, 150)
          ctx += `  摘要: ${s}\n`
        }
      }
    }

    const unread = await EntryRepository.default.countUnread()
    ctx += `\n未读文章总计: ${unread} 篇`
  } catch (_e) {
    ctx = '无法获取订阅数据。'
  }
  return ctx
}

export async function runChatAgent(
  prompt: string,
  aiSettings: AIAssistantSettings,
  history?: ChatMessage[],
  tools?: ChatToolDefinition[],
  onToolCall?: (name: string) => void,
): Promise<AgentRunResult> {
  const toolRounds: AgentRoundDetail[] = []
  let effectiveTools = tools
  if (!effectiveTools || effectiveTools.length === 0) {
    effectiveTools = buildDefaultTools()
  }

  const enrichedPrompt = AGENT_SYSTEM_PROMPT

  const contextFallback = await buildContextFallback()
  const systemWithContext = enrichedPrompt + '\n\n当前订阅数据如下（如果模型不支持 function calling，请直接基于此数据回答）：\n' + contextFallback

  const agentMessages: AgentMessage[] = [{ role: 'system', content: systemWithContext, name: undefined }]

  if (history && history.length > 0) {
    for (const m of history) {
      if (m.role === 'user' || m.role === 'assistant') {
        const am: AgentMessage = { role: m.role, content: m.content, name: undefined }
        agentMessages.push(am)
      }
    }
  }

  const userMsg: AgentMessage = { role: 'user', content: prompt, name: undefined }
  agentMessages.push(userMsg)

  let currentMessages = agentMessages

  for (let round = 0; round < MAX_AGENT_ROUNDS; round += 1) {
    console.info('[ChatAgent] round', round, 'messages:', currentMessages.length)
    let result: AgentChatCompletionResult
    try {
      result = await runChatCompletionForAgent(currentMessages, effectiveTools, aiSettings, 2000)
    } catch (err) {
      console.error('[ChatAgent] round', round, 'error:', err instanceof Error ? err.message : String(err))
      throw new Error(err instanceof Error ? err.message : String(err))
    }

    console.info('[ChatAgent] round', round, 'contentLen:', result.content.length, 'toolCalls:', result.toolCalls.length, 'finish:', result.finishReason)

    if (result.toolCalls.length === 0) {
      const text = result.content || '抱歉，我暂时无法回答这个问题。'
      console.info('[ChatAgent] round', round, 'final text len:', text.length)
      return { text, toolRounds }
    }

    if (result.content && result.content.length > 0) {
      console.info('[ChatAgent] round', round, 'partial content:', result.content.slice(0, 200))
    }

    console.info('[ChatAgent] round', round, 'executing', result.toolCalls.length, 'tools')
    const assistantCallMessages: AgentMessage = {
      role: 'assistant',
      content: result.content || null,
      tool_calls: [],
      name: undefined,
    }
    for (const tc of result.toolCalls) {
      const func: ToolCallFunction = { name: tc.function.name, arguments: tc.function.arguments }
      const callMsg: ChatToolCallMessage = {
        id: tc.id,
        type: 'function',
        function: func,
      }
      assistantCallMessages.tool_calls!.push(callMsg)
    }
    currentMessages.push(assistantCallMessages)

    for (const tc of result.toolCalls) {
      if (onToolCall) {
        onToolCall(tc.function.name)
      }
      const rawResult = await executeToolCall(tc.function.name, tc.function.arguments)
      const toolResult = truncateToolResult(rawResult)
      const rd: AgentRoundDetail = {
        name: tc.function.name,
        args: tc.function.arguments,
        resultSummary: toolCallResultSummary(tc.function.name, toolResult),
      }
      toolRounds.push(rd)
      const toolMsg: AgentMessage = {
        role: 'tool',
        content: toolResult,
        tool_call_id: tc.id,
        name: tc.function.name,
      }
      currentMessages.push(toolMsg)
    }
  }

  try {
    console.info('[ChatAgent] max rounds reached, making final call, messages:', currentMessages.length)
    const finalResult = await runChatCompletionForAgent(currentMessages, effectiveTools, aiSettings, 2000)
    const text = finalResult.content || '抱歉，我暂时无法回答这个问题。'
    console.info('[ChatAgent] final result len:', text.length, 'toolCalls:', finalResult.toolCalls.length)
    return { text, toolRounds }
  } catch (err) {
    console.error('[ChatAgent] final call error:', err instanceof Error ? err.message : String(err))
    throw new Error(err instanceof Error ? err.message : String(err))
  }
}
