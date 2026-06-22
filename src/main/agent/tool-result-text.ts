import type { AgentToolResult, AgentToolValue } from '../../shared/types'

const STRUCTURED_TEXT_MAX_LEN = 1000
const STRUCTURED_ARRAY_MAX_ITEMS = 8
const STRUCTURED_OBJECT_MAX_KEYS = 24
const PROMPT_LIKE_LINE =
  /^\s*(ignore (all )?(previous|above|prior) (instructions|messages|rules)|you are now|system prompt|developer message|act as|disregard (the )?(previous|above|prior))/i

const TRUSTED_TOOL_NAMES = new Set([
  'get_settings',
  'list_subscribed_feeds',
  'get_session_overview',
  'get_feed_entries',
  'get_today_updates',
  'search_entries',
  'get_unread_count',
  'view_starred_entries',
  'view_refresh_log',
  'list_builtin_feeds',
  'list_account_providers',
])

export function isTrustedAgentToolResultSource(toolName: string): boolean {
  return TRUSTED_TOOL_NAMES.has(toolName)
}

export function redactPromptLikeText(input: string): string {
  return input
    .split(/\r?\n/)
    .map((line) =>
      PROMPT_LIKE_LINE.test(line) ? '[已移除疑似提示注入文本]' : line,
    )
    .join('\n')
}

function truncateStructuredText(value: string): string {
  if (value.length <= STRUCTURED_TEXT_MAX_LEN) return value
  return `${value.slice(0, STRUCTURED_TEXT_MAX_LEN)}...`
}

function sanitizeStructuredValue(value: AgentToolValue): unknown {
  if (typeof value === 'string') {
    return value.length > STRUCTURED_TEXT_MAX_LEN
      ? {
          text: truncateStructuredText(value),
          text_truncated: true,
        }
      : value
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return value
  }
  if (Array.isArray(value)) {
    const items = value
      .slice(0, STRUCTURED_ARRAY_MAX_ITEMS)
      .map((item) => sanitizeStructuredValue(item as AgentToolValue))
    if (value.length > STRUCTURED_ARRAY_MAX_ITEMS) {
      items.push({
        omitted_items: value.length - STRUCTURED_ARRAY_MAX_ITEMS,
      })
    }
    return items
  }
  if (typeof value === 'object' && value) {
    const entries = Object.entries(value as Record<string, AgentToolValue>)
    const output: Record<string, unknown> = {}
    for (const [key, nested] of entries.slice(0, STRUCTURED_OBJECT_MAX_KEYS)) {
      output[key] = sanitizeStructuredValue(nested)
    }
    if (entries.length > STRUCTURED_OBJECT_MAX_KEYS) {
      output.omitted_keys = entries.length - STRUCTURED_OBJECT_MAX_KEYS
    }
    return output
  }
  return String(value)
}

function sanitizeStructuredData(
  data: AgentToolResult['data'],
): Record<string, unknown> | undefined {
  if (!data) return undefined
  return sanitizeStructuredValue(data) as Record<string, unknown>
}

/** Flattens a tool result into the plain text fed back to the model as a tool message. */
export function agentToolResultToText(result: AgentToolResult): string {
  if (result.status === 'confirmation_required') {
    const confirmation = result.confirmation
    if (!confirmation) {
      return result.message
    }
    return [
      confirmation.title,
      confirmation.message,
      `风险等级: ${confirmation.risk}`,
      `参数: ${confirmation.argsPreview}`,
    ].join('\n')
  }

  if (result.status === 'failed') {
    return result.message.startsWith('错误')
      ? result.message
      : `错误：${result.message}`
  }

  return result.message
}

export function serializeToolResultForModel(
  toolName: string,
  result: AgentToolResult,
): string {
  const baseText = agentToolResultToText(result)
  const payload = {
    tool: toolName,
    status: result.status,
    message: truncateStructuredText(baseText),
    message_truncated: baseText.length > STRUCTURED_TEXT_MAX_LEN || undefined,
    data: sanitizeStructuredData(result.data),
  }
  return JSON.stringify(payload, null, 2)
}

export function wrapToolResultForModelSource(
  toolName: string,
  resultText: string,
): string {
  const trusted = isTrustedAgentToolResultSource(toolName)
  const safeText = trusted ? resultText : redactPromptLikeText(resultText)
  return `<source name="${toolName}" trusted="${trusted ? 'true' : 'false'}">\n${safeText}\n</source>`
}
