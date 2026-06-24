import { app } from 'electron'
import { dirname, join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import type {
  AgentTraceRecord,
  AgentTraceStatus,
  AgentTraceToolCall,
} from '../../shared/types'

export type { AgentTraceRecord, AgentTraceStatus, AgentTraceToolCall }

const MAX_AGENT_TRACES = 50
const REDACTED = '***'
const TRACE_TEXT_MAX_LEN = 2000
const TOOL_ARGS_MAX_LEN = 200

const SENSITIVE_KEY =
  /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|passphrase|secret|cookie|authorization|credential|account|account[_-]?id|username|email|display[_-]?name)/i
const URL_KEY = /(?:url|uri|link|href|endpoint|base[_-]?url)/i
const HTTP_URL = /\bhttps?:\/\/[^\s"'<>),\]}]+/gi
const KEY_VALUE_SECRET =
  /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|passphrase|secret|cookie|authorization|credential|account|account[_-]?id|username|email|display[_-]?name)(\s*[:=]\s*)("?)[^"',\s}\]]+/gi

export interface AgentTraceIndex {
  sessions: Record<string, string[]>
}

function getTracesPath(): string {
  return join(app.getPath('userData'), 'data', 'agent-traces.json')
}

function ensureTraceDir(path: string): void {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function writeTraces(traces: AgentTraceRecord[]): void {
  const path = getTracesPath()
  ensureTraceDir(path)
  writeFileSync(path, JSON.stringify(traces, null, 2))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function redactUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    return `${url.protocol}//${url.host}/...`
  } catch {
    return rawUrl
  }
}

function redactUrlsInText(input: string): string {
  return input.replace(HTTP_URL, (url) => redactUrl(url))
}

export function redactTraceText(
  input: string,
  maxLength = TRACE_TEXT_MAX_LEN,
): string {
  const redacted = redactUrlsInText(input).replace(
    KEY_VALUE_SECRET,
    (_match, key: string, separator: string, quote: string) =>
      `${key}${separator}${quote}${REDACTED}${quote}`,
  )
  return redacted.slice(0, maxLength)
}

function redactArgValue(value: unknown, key = '', toolName = ''): unknown {
  if (toolName === 'remember_preference' && key === 'content') return REDACTED
  if (SENSITIVE_KEY.test(key)) return REDACTED
  if (typeof value === 'string') {
    const withoutSecrets = redactTraceText(value, value.length)
    return URL_KEY.test(key) ? redactUrlsInText(withoutSecrets) : withoutSecrets
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactArgValue(item, '', toolName))
  }
  if (!isRecord(value)) return value

  const output: Record<string, unknown> = {}
  for (const [childKey, childValue] of Object.entries(value)) {
    output[childKey] = redactArgValue(childValue, childKey, toolName)
  }
  return output
}

export function redactToolArgs(toolName: string, argsPreview: string): string {
  const text = argsPreview.trim()
  if (!text) return argsPreview

  try {
    const parsed = JSON.parse(text) as unknown
    return JSON.stringify(redactArgValue(parsed, '', toolName)).slice(
      0,
      TOOL_ARGS_MAX_LEN,
    )
  } catch {
    return redactTraceText(text, TOOL_ARGS_MAX_LEN)
  }
}

function sanitizeTraceRecord(trace: AgentTraceRecord): AgentTraceRecord {
  return {
    ...trace,
    promptSummary: redactTraceText(trace.promptSummary, 120),
    finalText: redactTraceText(trace.finalText),
    toolCalls: trace.toolCalls.map((call) => ({
      ...call,
      argsPreview: redactToolArgs(call.toolName, call.argsPreview),
      resultSummary: redactTraceText(call.resultSummary, 1000),
    })),
  }
}

export function buildAgentTraceIndex(
  traces: AgentTraceRecord[],
): AgentTraceIndex {
  const sessions: AgentTraceIndex['sessions'] = {}
  for (const trace of traces) {
    const sessionId = trace.sessionId || '(unknown)'
    sessions[sessionId] ??= []
    sessions[sessionId].push(trace.traceId)
  }
  return { sessions }
}

/**
 * Persists a bounded, newest-first list of agent run traces (prompt, tool
 * calls and final text) for the Tool Trace panel and diagnostics.
 */
export const AgentTraceStore = {
  loadAll(): AgentTraceRecord[] {
    const path = getTracesPath()
    if (!existsSync(path)) return []
    try {
      const parsed = JSON.parse(
        readFileSync(path, 'utf-8'),
      ) as AgentTraceRecord[]
      if (!Array.isArray(parsed)) return []
      return parsed.sort((a, b) => b.startedAt - a.startedAt)
    } catch {
      return []
    }
  },

  loadBySession(sessionId: string): AgentTraceRecord[] {
    const target = sessionId.trim()
    if (!target) return AgentTraceStore.loadAll()
    return AgentTraceStore.loadAll().filter(
      (trace) => trace.sessionId === target,
    )
  },

  loadIndex(): AgentTraceIndex {
    return buildAgentTraceIndex(AgentTraceStore.loadAll())
  },

  save(trace: AgentTraceRecord): void {
    try {
      const traces = AgentTraceStore.loadAll()
      const sanitized = sanitizeTraceRecord(trace)
      const index = traces.findIndex((item) => item.traceId === trace.traceId)
      if (index >= 0) {
        traces[index] = sanitized
      } else {
        traces.unshift(sanitized)
      }
      const trimmed = traces.slice(0, MAX_AGENT_TRACES)
      writeTraces(trimmed)
    } catch {
      // Traces are diagnostic only; a save failure must not break the chat flow.
    }
  },

  delete(traceId: string): boolean {
    try {
      const target = traceId.trim()
      if (!target) return false
      const traces = AgentTraceStore.loadAll()
      const next = traces.filter((trace) => trace.traceId !== target)
      if (next.length === traces.length) return false
      writeTraces(next)
      return true
    } catch {
      return false
    }
  },

  clearAll(): void {
    try {
      writeTraces([])
    } catch {
      // ignore
    }
  },
}
