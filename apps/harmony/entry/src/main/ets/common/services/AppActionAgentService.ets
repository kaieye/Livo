import type {
  AgentToolArgs,
  AgentToolInputSchema,
  AgentToolParamSchema,
  AgentToolResult,
} from '../agent/AgentTypes.ts'
import { AgentHarness } from '../agent/AgentHarness.ts'
import {
  buildDefaultAgentToolRegistry,
  normalizeDefaultAgentToolArgs,
} from '../agent/DefaultAgentTools'
import { agentToolResultToText } from '../agent/AgentToolResultText.ts'

export interface AppActionToolDefinition {
  name: string
  description: string
  parameters: AppActionToolParams
}

export interface AppActionToolParams {
  type: string
  properties: Record<string, AppActionToolProp>
  required: string[]
}

export interface AppActionToolProp {
  type: string
  description: string
  enum?: string[]
}

export interface AppActionToolCall {
  id: string
  type: string
  function: AppActionToolCallFunction
}

export interface AppActionToolCallFunction {
  name: string
  arguments: string
}

export interface AppActionResult {
  success: boolean
  message: string
  data?: Record<string, Object>
}

export interface AppActionAgentRound {
  name: string
  args: string
  result: AppActionResult
}

export interface AppActionAgentResult {
  text: string
  rounds: AppActionAgentRound[]
  executedActions: string[]
}

interface AppActionToolAlias {
  legacyName: string
  agentName: string
  description?: string
}

interface ParsedCompatToolCall {
  name: string
  args: string
  confirmed: boolean
}

const APP_ACTION_RULES_DEPRECATED_TEXT =
  '操作助手的自然语言规则入口已废弃。应用操作已经迁入统一 AI 对话页和 Agent Harness；兼容层只接受明确的工具调用请求，不再根据文本规则直接改数据。'

const APP_ACTION_TOOL_ALIASES: AppActionToolAlias[] = [
  {
    legacyName: 'list_subscriptions',
    agentName: 'list_subscribed_feeds',
    description: '兼容旧操作助手：查看用户所有已订阅的 RSS 源列表',
  },
  {
    legacyName: 'list_builtin_feeds',
    agentName: 'list_builtin_feeds',
  },
  {
    legacyName: 'add_subscription',
    agentName: 'add_feed',
    description: '兼容旧操作助手：添加新的 RSS 订阅源到订阅列表',
  },
  {
    legacyName: 'remove_subscription',
    agentName: 'remove_subscription',
    description: '兼容旧操作助手：删除订阅源。该操作会通过 Agent Harness 的强确认门禁',
  },
  {
    legacyName: 'add_builtin_subscription',
    agentName: 'add_builtin_subscription',
  },
  {
    legacyName: 'toggle_theme_mode',
    agentName: 'toggle_theme_mode',
  },
  {
    legacyName: 'change_accent_color',
    agentName: 'change_accent_color',
  },
  {
    legacyName: 'view_starred_entries',
    agentName: 'view_starred_entries',
  },
  {
    legacyName: 'view_chat_history',
    agentName: 'view_chat_history',
  },
  {
    legacyName: 'view_refresh_log',
    agentName: 'view_refresh_log',
  },
  {
    legacyName: 'get_unread_stats',
    agentName: 'get_unread_count',
    description: '兼容旧操作助手：获取未读文章的统计信息',
  },
  {
    legacyName: 'mark_all_read',
    agentName: 'mark_all_read',
  },
]

export function buildAppActionTools(): AppActionToolDefinition[] {
  const registry = buildDefaultAgentToolRegistry()
  const tools: AppActionToolDefinition[] = []

  for (const alias of APP_ACTION_TOOL_ALIASES) {
    const tool = registry.get(alias.agentName)
    if (!tool) {
      continue
    }
    tools.push({
      name: alias.legacyName,
      description: alias.description || tool.description,
      parameters: toAppActionParams(tool.inputSchema),
    })
  }
  return tools
}

export async function executeAppActionTool(
  name: string,
  args: string,
  confirmed: boolean = false,
): Promise<AppActionResult> {
  const mappedName = resolveAgentToolName(name)
  if (!mappedName) {
    return { success: false, message: `未知工具: ${name}` }
  }

  const parsedArgs = parseToolArgs(args)
  const normalizedArgs = normalizeDefaultAgentToolArgs(mappedName, parsedArgs)
  console.info('[AppActionCompat] execute', name, '->', mappedName, 'confirmed:', confirmed)

  try {
    const registry = buildDefaultAgentToolRegistry()
    const harness = new AgentHarness(registry)
    const run = await harness.execute({
      toolName: mappedName,
      args: normalizedArgs,
      context: {
        sessionId: 'app-action-compat',
        now: Date.now(),
      },
      confirmed,
    })
    return toAppActionResult(run.result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[AppActionCompat] execute failed:', message)
    return { success: false, message: `执行工具失败: ${message}` }
  }
}

export async function runAppActionAgent(
  prompt: string,
  _history?: { role: string, content: string }[],
): Promise<AppActionAgentResult> {
  const toolCall = parseCompatToolCall(prompt)
  if (!toolCall) {
    return {
      text: APP_ACTION_RULES_DEPRECATED_TEXT,
      rounds: [],
      executedActions: [],
    }
  }

  const result = await executeAppActionTool(toolCall.name, toolCall.args, toolCall.confirmed)
  const round: AppActionAgentRound = {
    name: toolCall.name,
    args: toolCall.args,
    result,
  }
  return {
    text: result.message,
    rounds: [round],
    executedActions: result.success ? [toolCall.name] : [],
  }
}

function resolveAgentToolName(name: string): string {
  const alias = APP_ACTION_TOOL_ALIASES.find((item: AppActionToolAlias): boolean => item.legacyName === name)
  if (alias) {
    return alias.agentName
  }
  const registry = buildDefaultAgentToolRegistry()
  return registry.get(name) ? name : ''
}

function parseToolArgs(args: string): AgentToolArgs {
  try {
    const raw = JSON.parse(args || '{}') as Object
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
      return raw as AgentToolArgs
    }
  } catch (_error) {
    // 参数解析失败时保留空对象，让 Harness 统一给出 schema 错误。
  }
  return {}
}

function parseCompatToolCall(prompt: string): ParsedCompatToolCall | undefined {
  try {
    const raw = JSON.parse(prompt.trim()) as Record<string, Object>
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return undefined
    }

    const rawName = raw['name'] || raw['tool'] || raw['toolName']
    if (typeof rawName !== 'string' || rawName.trim().length === 0) {
      return undefined
    }

    const rawArgs = raw['arguments'] || raw['args'] || raw['parameters']
    const args = stringifyCompatArgs(rawArgs)
    const confirmed = raw['confirmed'] === true
    return {
      name: rawName.trim(),
      args,
      confirmed,
    }
  } catch (_error) {
    return undefined
  }
}

function stringifyCompatArgs(rawArgs: Object | undefined): string {
  if (typeof rawArgs === 'string') {
    return rawArgs
  }
  if (typeof rawArgs === 'object' && rawArgs !== null) {
    return JSON.stringify(rawArgs)
  }
  return '{}'
}

function toAppActionResult(result: AgentToolResult): AppActionResult {
  const data: Record<string, Object> = {}
  if (result.data) {
    const keys = Object.keys(result.data)
    for (const key of keys) {
      data[key] = result.data[key]
    }
  }
  if (result.confirmation) {
    data['confirmation'] = result.confirmation as Object
  }

  return {
    success: result.status === 'success',
    message: agentToolResultToText(result),
    data: Object.keys(data).length > 0 ? data : undefined,
  }
}

function toAppActionParams(schema: AgentToolInputSchema): AppActionToolParams {
  const properties: Record<string, AppActionToolProp> = {}
  const keys = Object.keys(schema.properties)
  for (const key of keys) {
    properties[key] = toAppActionProp(schema.properties[key])
  }
  return {
    type: schema.type,
    properties,
    required: schema.required,
  }
}

function toAppActionProp(prop: AgentToolParamSchema): AppActionToolProp {
  const result: AppActionToolProp = {
    type: prop.type,
    description: prop.description || '',
  }
  if (prop.enum) {
    result.enum = prop.enum
  }
  return result
}
