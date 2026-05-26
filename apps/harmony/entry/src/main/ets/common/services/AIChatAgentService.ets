import { AIAssistantSettings } from '../models/LivoModels'
import { ChatMessage } from './ChatHistoryStore'
import { ChatToolDefinition, buildDefaultTools, executeToolCallRun, ToolCallFunction } from './AIChatTools'
import { runChatCompletionForAgent, AgentChatCompletionResult, AgentAbortSignal } from './article-assist/ChatCompletionRunner'
import { AgentMessage, ChatToolCallMessage } from './article-assist/ProviderProtocol'
import { ExtractedToolCall } from './article-assist/ProviderResponseParser'
import { FeedRepository } from '../repositories/FeedRepository'
import { EntryRepository } from '../repositories/EntryRepository'
import { Feed, Entry } from '../models/LivoModels'
import {
  isAgentCapabilityAllowed,
  normalizeAgentPermissionSettings,
} from '../agent/AgentTypes.ts'
import type {
  AgentConfirmationRequest,
  AgentPermissionSettings,
  AgentToolRun,
} from '../agent/AgentTypes.ts'
import { agentToolResultToText } from '../agent/AgentToolResultText.ts'

export { AgentAbortSignal }

const MAX_AGENT_ROUNDS = 5

export interface AgentRoundDetail {
  name: string
  args: string
  resultSummary: string
  status?: string
  elapsedMs?: number
  confirmation?: AgentConfirmationRequest
}

export type AgentRunStatus = 'completed' | 'confirmation_required'
export type AgentToolEventType = 'tool_started' | 'tool_completed' | 'tool_failed' | 'confirmation_required'

export interface AgentToolExecutionEvent {
  type: AgentToolEventType
  toolCallId: string
  toolName: string
  args: string
  message?: string
  resultSummary?: string
  elapsedMs?: number
  confirmation?: AgentConfirmationRequest
}

export interface AgentPendingConfirmation {
  toolCallId: string
  toolName: string
  args: string
  confirmation: AgentConfirmationRequest
}

export interface AgentContinuationState {
  messages: AgentMessage[]
  pendingToolCall: ExtractedToolCall
  remainingToolCalls: ExtractedToolCall[]
  toolRounds: AgentRoundDetail[]
  nextRound: number
}

export interface AgentRunResult {
  text: string
  toolRounds: AgentRoundDetail[]
  status?: AgentRunStatus
  confirmation?: AgentPendingConfirmation
  continuation?: AgentContinuationState
}

const AGENT_SYSTEM_PROMPT = `你是 Livo 的智能助手，可以帮用户查看和管理 RSS 订阅。

你可以使用以下工具（必须通过 function calling 调用，不要在文本中描述工具名）：
- list_subscribed_feeds：查看所有已订阅的 RSS 源
- get_feed_entries：查看某个订阅源的文章列表
- get_today_updates：查看今天哪些订阅源更新了内容
- get_entry_detail：查看某篇文章的完整内容和细节
- get_unread_count：查看未读文章统计
- web_search：执行网络搜索，获取实时信息（新闻、天气、股票、最新事件等）
- add_feed：添加自定义 RSS 订阅源
- remove_subscription：删除订阅源及其本地文章
- refresh_subscription：刷新指定订阅源
- refresh_all_subscriptions：刷新全部订阅源
- list_builtin_feeds：查看应用内嵌推荐订阅源
- add_builtin_subscription：从推荐列表添加订阅源
- get_settings：查看设置摘要（不含 API Key）
- toggle_theme_mode：切换深色/浅色/跟随系统
- change_accent_color：调整主题强调色
- update_general_settings：更新通用设置
- update_ai_feature_settings：更新 AI 摘要和翻译开关
- update_ai_runtime_settings：更新 AI 提供商、模型、Base URL 或提示词（不修改 API Key）
- view_starred_entries：查看收藏内容
- view_chat_history：查看历史对话
- view_refresh_log：查看刷新日志
- export_opml：导出 OPML
- import_opml：导入 OPML
- clear_refresh_log：清空刷新日志
- clear_local_cache：清理本地缓存
- list_account_providers：查看账号关联状态
- open_account_login：打开账号登录/关联页
- unlink_account：取消账号关联
- refresh_account_status：刷新账号状态
- mark_all_read：全部标记为已读
- open_root_tab：打开首页、订阅、发现或设置根标签
- go_back：返回上一页
- open_entry_detail：打开文章详情页
- open_feed_detail：打开订阅详情页
- open_settings_panel：打开设置首页或具体设置面板
- open_video_player：打开视频播放页
- open_image_viewer：打开图片预览页

使用规则：
1. 默认使用中文回复。
2. 当用户的问题需要查询订阅数据时，必须调用对应的 function，不要凭空猜测或描述你要调用什么函数。
3. 当用户的问题需要最新网络信息（如新闻、天气、股票、实时事件等）时，使用 web_search 工具。
4. 当工具返回需要确认时，不要声称已完成动作，应告诉用户需要确认。
5. 回复时使用友好的语气，对信息做适当的归纳和总结。`

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

interface ParsedTextToolCalls {
  cleanedContent: string
  toolCalls: ExtractedToolCall[]
}

function parseTextToolCalls(content: string): ParsedTextToolCalls {
  const toolCalls: ExtractedToolCall[] = []
  let cleaned = content

  // Format 1: <tool_call>{"name":"xxx","parameters":{}}</tool_call>
  const jsonRegex = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g
  let match = jsonRegex.exec(content)
  while (match) {
    try {
      const json = JSON.parse(match[1]) as Record<string, string>
      const toolName = json.name || json.tool
      if (toolName) {
        toolCalls.push({
          id: 'text_' + toolCalls.length,
          type: 'function',
          function: {
            name: toolName,
            arguments: JSON.stringify(json.parameters || json.tool_input || {}),
          },
        })
      }
    } catch (_e) {
    }
    match = jsonRegex.exec(content)
  }
  cleaned = cleaned.replace(jsonRegex, '')

  // Format 2 & 3: <minimax:tool_call>...</minimax:tool_call>
  const minimaxRegex = /<minimax:tool_call>\s*([\s\S]*?)\s*<\/minimax:tool_call>/gi
  match = minimaxRegex.exec(cleaned)
  while (match) {
    const body = match[1].trim()

    // Format 3: <invoke name="funcName"><param>value</param></invoke>
    const invokeRegex = /<invoke\s+name\s*=\s*"([^"]+)"\s*>([\s\S]*?)<\/invoke>/g
    let invokeMatch = invokeRegex.exec(body)

    if (invokeMatch) {
      do {
        const invokeName = invokeMatch[1]
        const invokeBody = invokeMatch[2]
        const params: Record<string, string> = {}
        const paramRegex = /<(\w+)[^>]*>([\s\S]*?)<\/\1>/g
        let paramMatch = paramRegex.exec(invokeBody)
        while (paramMatch) {
          const tagName = paramMatch[1]
          const tagContent = paramMatch[2].trim()
          const nameAttrMatch = paramMatch[0].match(/name\s*=\s*"([^"]+)"/)
          const key = nameAttrMatch ? nameAttrMatch[1] : tagName
          params[key] = tagContent
          paramMatch = paramRegex.exec(invokeBody)
        }
        if (invokeName) {
          toolCalls.push({
            id: 'text_' + toolCalls.length,
            type: 'function',
            function: {
              name: invokeName,
              arguments: JSON.stringify(params),
            },
          })
        }
        invokeMatch = invokeRegex.exec(body)
      } while (invokeMatch)
    } else {
      // Format 2: func_name(arg1="val1", arg2="val2")
      const parenIdx = body.indexOf('(')
      if (parenIdx >= 0) {
        const funcName = body.slice(0, parenIdx).trim()
        const endIdx = body.lastIndexOf(')')
        const argsStr = endIdx >= 0 ? body.slice(parenIdx + 1, endIdx).trim() : body.slice(parenIdx + 1).trim()
        const params: Record<string, string> = {}
        if (argsStr) {
          const argRegex = /(\w+)\s*=\s*"([^"]*)"/g
          let argMatch = argRegex.exec(argsStr)
          while (argMatch) {
            params[argMatch[1]] = argMatch[2]
            argMatch = argRegex.exec(argsStr)
          }
        }
        if (funcName) {
          toolCalls.push({
            id: 'text_' + toolCalls.length,
            type: 'function',
            function: {
              name: funcName,
              arguments: JSON.stringify(params),
            },
          })
        }
      }
    }
    match = minimaxRegex.exec(cleaned)
  }
  cleaned = cleaned.replace(minimaxRegex, '').trim()

  // Format 4: <function_call>...</function_call>
  const functionCallRegex = /<function_call>\s*([\s\S]*?)\s*<\/function_call>/g
  match = functionCallRegex.exec(cleaned)
  while (match) {
    const body = match[1].trim()
    
    // Try parsing as JSON first
    try {
      const json = JSON.parse(body) as Record<string, string>
      if (json.name) {
        toolCalls.push({
          id: 'text_' + toolCalls.length,
          type: 'function',
          function: {
            name: json.name,
            arguments: JSON.stringify(json.parameters || json.arguments || {}),
          },
        })
      }
    } catch (_e) {}

    // Fallback: extract name from first line, args from subsequent lines
    if (toolCalls.length === 0 || toolCalls[toolCalls.length - 1].function.name !== body.split('\n')[0].trim()) {
      const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0)
      if (lines.length > 0) {
        const name = lines[0].replace(/^["']|["']$/g, '').split(/\s+/)[0]
        const args: Record<string, string> = {}
        for (let i = 1; i < lines.length; i += 1) {
          const argRegex = /(\w+)\s*=\s*"([^"]*)"/g
          let argMatch = argRegex.exec(lines[i])
          while (argMatch) {
            args[argMatch[1]] = argMatch[2]
            argMatch = argRegex.exec(lines[i])
          }
          // Also try key: "value" or key: value format
          const kvRegex = /(\w+)\s*:\s*"([^"]*)"/g
          let kvMatch = kvRegex.exec(lines[i])
          while (kvMatch) {
            args[kvMatch[1]] = kvMatch[2]
            kvMatch = kvRegex.exec(lines[i])
          }
        }
        if (name && name.length > 2) {
          toolCalls.push({
            id: 'text_' + toolCalls.length,
            type: 'function',
            function: {
              name: name,
              arguments: JSON.stringify(args),
            },
          })
        }
      }
    }
    match = functionCallRegex.exec(cleaned)
  }
  cleaned = cleaned.replace(functionCallRegex, '').trim()

  // Format 5: [TOOL_CALL]{tool => "funcName", args => { --key "value" }}[/TOOL_CALL]
  const toolCallBlockRegex = /\[TOOL_CALL\]\s*([\s\S]*?)\s*\[\/TOOL_CALL\]/gi
  match = toolCallBlockRegex.exec(cleaned)
  while (match) {
    const body = match[1].trim()
    const toolMatch = body.match(/tool\s*=>\s*"([^"]+)"/i)
    if (toolMatch) {
      const funcName = toolMatch[1]
      const params: Record<string, string> = {}
      const dashArgRegex = /--(\w+)\s+"([^"]*)"/g
      let dashMatch = dashArgRegex.exec(body)
      while (dashMatch) {
        params[dashMatch[1]] = dashMatch[2]
        dashMatch = dashArgRegex.exec(body)
      }
      const eqArgRegex = /--(\w+)\s*=\s*"?([^"\s}]+)"?/g
      let eqMatch = eqArgRegex.exec(body)
      while (eqMatch) {
        if (!params[eqMatch[1]]) {
          params[eqMatch[1]] = eqMatch[2]
        }
        eqMatch = eqArgRegex.exec(body)
      }
      const argsBlockMatch = body.match(/args\s*=>\s*\{([\s\S]*?)\}/)
      if (argsBlockMatch) {
        const argsBlock = argsBlockMatch[1]
        const kvRegex = /(\w+)\s*:\s*"([^"]*)"/g
        let kvMatch = kvRegex.exec(argsBlock)
        while (kvMatch) {
          if (!params[kvMatch[1]]) {
            params[kvMatch[1]] = kvMatch[2]
          }
          kvMatch = kvRegex.exec(argsBlock)
        }
      }
      if (funcName) {
        toolCalls.push({
          id: 'text_' + toolCalls.length,
          type: 'function',
          function: {
            name: funcName,
            arguments: JSON.stringify(params),
          },
        })
      }
    }
    match = toolCallBlockRegex.exec(cleaned)
  }
  cleaned = cleaned.replace(toolCallBlockRegex, '').trim()

  return { cleanedContent: cleaned, toolCalls }
}

async function buildContextFallback(
  pageContext: string = '',
  permissions?: AgentPermissionSettings,
): Promise<string> {
  if (!isAgentCapabilityAllowed('read', permissions)) {
    return '当前 Agent 权限未允许读取本地订阅上下文。'
  }

  let ctx = ''
  const trimmedPageContext = pageContext.trim()
  if (trimmedPageContext) {
    ctx += `当前页面上下文：\n${trimmedPageContext}\n\n`
  }
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
  onToolEvent?: (event: AgentToolExecutionEvent) => void,
  abortSignal?: AgentAbortSignal,
  pageContext: string = '',
): Promise<AgentRunResult> {
  let effectiveTools = tools
  if (!effectiveTools || effectiveTools.length === 0) {
    effectiveTools = buildDefaultTools(aiSettings.agentPermissions)
  }

  const enrichedPrompt = AGENT_SYSTEM_PROMPT

  const agentPermissions = normalizeAgentPermissionSettings(aiSettings.agentPermissions)
  const contextFallback = await buildContextFallback(pageContext, agentPermissions)
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

  return runAgentLoop(currentMessages, effectiveTools, aiSettings, [], 0, onToolEvent, abortSignal, agentPermissions)
}

export async function resumeChatAgent(
  continuation: AgentContinuationState,
  aiSettings: AIAssistantSettings,
  tools?: ChatToolDefinition[],
  onToolEvent?: (event: AgentToolExecutionEvent) => void,
  abortSignal?: AgentAbortSignal,
): Promise<AgentRunResult> {
  let effectiveTools = tools
  if (!effectiveTools || effectiveTools.length === 0) {
    effectiveTools = buildDefaultTools(aiSettings.agentPermissions)
  }

  const currentMessages = continuation.messages.slice()
  const toolRounds = continuation.toolRounds.slice()
  const agentPermissions = normalizeAgentPermissionSettings(aiSettings.agentPermissions)
  const pendingResult = await executeAgentToolCall(
    continuation.pendingToolCall,
    true,
    toolRounds,
    onToolEvent,
    abortSignal,
    agentPermissions,
  )
  currentMessages.push(toToolResultMessage(continuation.pendingToolCall, pendingResult.text))

  const remaining = continuation.remainingToolCalls
  for (let index = 0; index < remaining.length; index += 1) {
    const tc = remaining[index]
    const executed = await executeAgentToolCall(tc, false, toolRounds, onToolEvent, abortSignal, agentPermissions)
    if (executed.run.result.status === 'confirmation_required') {
      return buildConfirmationRequiredResult(
        tc,
        remaining.slice(index + 1),
        currentMessages,
        toolRounds,
        continuation.nextRound,
        executed,
      )
    }
    currentMessages.push(toToolResultMessage(tc, executed.text))
  }

  return runAgentLoop(
    currentMessages,
    effectiveTools,
    aiSettings,
    toolRounds,
    continuation.nextRound,
    onToolEvent,
    abortSignal,
    agentPermissions,
  )
}

async function runAgentLoop(
  currentMessages: AgentMessage[],
  effectiveTools: ChatToolDefinition[],
  aiSettings: AIAssistantSettings,
  toolRounds: AgentRoundDetail[],
  startRound: number,
  onToolEvent?: (event: AgentToolExecutionEvent) => void,
  abortSignal?: AgentAbortSignal,
  agentPermissions?: AgentPermissionSettings,
): Promise<AgentRunResult> {
  for (let round = 0; round < MAX_AGENT_ROUNDS; round += 1) {
    if (round < startRound) {
      continue
    }
    console.info('[ChatAgent] round', round, 'messages:', currentMessages.length)
    let result: AgentChatCompletionResult
    try {
      result = await runChatCompletionForAgent(currentMessages, effectiveTools, aiSettings, 2000, abortSignal)
    } catch (err) {
      console.error('[ChatAgent] round', round, 'error:', err instanceof Error ? err.message : String(err))
      throw new Error(err instanceof Error ? err.message : String(err))
    }

    console.info('[ChatAgent] round', round, 'contentLen:', result.content.length, 'toolCalls:', result.toolCalls.length, 'finish:', result.finishReason)

    let effectiveContent = result.content
    let effectiveToolCalls = result.toolCalls

    const nativeToolCallingSupported = result.nativeToolCallingSupported !== false
    if (nativeToolCallingSupported && effectiveToolCalls.length === 0 && (effectiveContent.includes('<tool_call>') || effectiveContent.includes('<minimax:tool_call>'))) {
      const parsed = parseTextToolCalls(effectiveContent)
      effectiveContent = parsed.cleanedContent
      effectiveToolCalls = parsed.toolCalls
      console.info('[ChatAgent] round', round, 'parsed text tool calls:', effectiveToolCalls.length)
    }
    if (!nativeToolCallingSupported && effectiveToolCalls.length === 0 && (effectiveContent.includes('<tool_call>') || effectiveContent.includes('<minimax:tool_call>'))) {
      console.info('[ChatAgent] round', round, 'ignored text tool calls because provider has no native tool-calling support')
    }

    if (effectiveToolCalls.length === 0) {
      const text = effectiveContent || '抱歉，我暂时无法回答这个问题。'
      console.info('[ChatAgent] round', round, 'final text len:', text.length)
      return { text, toolRounds, status: 'completed' }
    }

    if (effectiveContent && effectiveContent.length > 0) {
      console.info('[ChatAgent] round', round, 'partial content:', effectiveContent.slice(0, 200))
    }

    console.info('[ChatAgent] round', round, 'executing', effectiveToolCalls.length, 'tools')
    const assistantCallMessages: AgentMessage = {
      role: 'assistant',
      content: effectiveContent || null,
      tool_calls: [],
      name: undefined,
    }
    for (const tc of effectiveToolCalls) {
      const func: ToolCallFunction = { name: tc.function.name, arguments: tc.function.arguments }
      const callMsg: ChatToolCallMessage = {
        id: tc.id,
        type: 'function',
        function: func,
      }
      assistantCallMessages.tool_calls!.push(callMsg)
    }
    currentMessages.push(assistantCallMessages)

    for (let toolIndex = 0; toolIndex < effectiveToolCalls.length; toolIndex += 1) {
      const tc = effectiveToolCalls[toolIndex]
      const executed = await executeAgentToolCall(tc, false, toolRounds, onToolEvent, abortSignal, agentPermissions)
      if (executed.run.result.status === 'confirmation_required') {
        return buildConfirmationRequiredResult(
          tc,
          effectiveToolCalls.slice(toolIndex + 1),
          currentMessages,
          toolRounds,
          round + 1,
          executed,
        )
      }
      currentMessages.push(toToolResultMessage(tc, executed.text))
    }
  }

  try {
    console.info('[ChatAgent] max rounds reached, making final call, messages:', currentMessages.length)
    const finalResult = await runChatCompletionForAgent(currentMessages, effectiveTools, aiSettings, 2000, abortSignal)
    const text = finalResult.content || '抱歉，我暂时无法回答这个问题。'
    console.info('[ChatAgent] final result len:', text.length, 'toolCalls:', finalResult.toolCalls.length)
    return { text, toolRounds, status: 'completed' }
  } catch (err) {
    console.error('[ChatAgent] final call error:', err instanceof Error ? err.message : String(err))
    throw new Error(err instanceof Error ? err.message : String(err))
  }
}

interface ExecutedAgentToolCall {
  run: AgentToolRun
  text: string
}

async function executeAgentToolCall(
  tc: ExtractedToolCall,
  confirmed: boolean,
  toolRounds: AgentRoundDetail[],
  onToolEvent?: (event: AgentToolExecutionEvent) => void,
  abortSignal?: AgentAbortSignal,
  agentPermissions?: AgentPermissionSettings,
): Promise<ExecutedAgentToolCall> {
  if (abortSignal?.aborted) {
    throw new Error('请求已取消')
  }

  emitToolEvent(onToolEvent, {
    type: 'tool_started',
    toolCallId: tc.id,
    toolName: tc.function.name,
    args: tc.function.arguments,
  })

  const run = await executeToolCallRun(tc.function.name, tc.function.arguments, confirmed, agentPermissions)
  const toolText = truncateToolResult(agentToolResultToText(run.result))
  const resultSummary = toolCallResultSummary(tc.function.name, toolText)
  const roundDetail: AgentRoundDetail = {
    name: tc.function.name,
    args: tc.function.arguments,
    resultSummary,
    status: run.result.status,
    elapsedMs: run.elapsedMs,
    confirmation: run.result.confirmation,
  }
  toolRounds.push(roundDetail)

  if (run.result.status === 'confirmation_required') {
    emitToolEvent(onToolEvent, {
      type: 'confirmation_required',
      toolCallId: tc.id,
      toolName: tc.function.name,
      args: tc.function.arguments,
      message: run.result.message,
      resultSummary,
      elapsedMs: run.elapsedMs,
      confirmation: run.result.confirmation,
    })
  } else {
    emitToolEvent(onToolEvent, {
      type: run.result.status === 'success' ? 'tool_completed' : 'tool_failed',
      toolCallId: tc.id,
      toolName: tc.function.name,
      args: tc.function.arguments,
      message: run.result.message,
      resultSummary,
      elapsedMs: run.elapsedMs,
    })
  }

  return {
    run,
    text: toolText,
  }
}

function buildConfirmationRequiredResult(
  tc: ExtractedToolCall,
  remainingToolCalls: ExtractedToolCall[],
  currentMessages: AgentMessage[],
  toolRounds: AgentRoundDetail[],
  nextRound: number,
  executed: ExecutedAgentToolCall,
): AgentRunResult {
  const confirmation = executed.run.result.confirmation
  if (!confirmation) {
    return {
      text: executed.text,
      toolRounds,
      status: 'completed',
    }
  }

  return {
    text: executed.text,
    toolRounds,
    status: 'confirmation_required',
    confirmation: {
      toolCallId: tc.id,
      toolName: tc.function.name,
      args: tc.function.arguments,
      confirmation,
    },
    continuation: {
      messages: currentMessages.slice(),
      pendingToolCall: tc,
      remainingToolCalls,
      toolRounds: toolRounds.slice(),
      nextRound,
    },
  }
}

function toToolResultMessage(tc: ExtractedToolCall, toolResult: string): AgentMessage {
  return {
    role: 'tool',
    content: toolResult,
    tool_call_id: tc.id,
    name: tc.function.name,
  }
}

function emitToolEvent(
  onToolEvent: ((event: AgentToolExecutionEvent) => void) | undefined,
  event: AgentToolExecutionEvent,
): void {
  if (onToolEvent) {
    onToolEvent(event)
  }
}
