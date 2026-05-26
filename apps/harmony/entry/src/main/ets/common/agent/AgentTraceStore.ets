import { PreferenceStoreAccessor } from '../services/PreferenceStoreAccessor'

const AGENT_TRACES_KEY = 'agentTraces'
const MAX_AGENT_TRACES = 50

export type AgentTraceStatus =
  | 'completed'
  | 'confirmation_required'
  | 'failed'
  | 'cancelled'

export interface AgentTraceToolCall {
  id: string
  toolName: string
  argsPreview: string
  status: string
  message: string
  resultSummary: string
  elapsedMs: number
  risk: string
  at: number
}

export interface AgentTraceRecord {
  traceId: string
  sessionId: string
  startedAt: number
  completedAt: number
  promptSummary: string
  finalText: string
  status: AgentTraceStatus
  toolCalls: AgentTraceToolCall[]
}

export class AgentTraceStore {
  static async loadAll(): Promise<AgentTraceRecord[]> {
    try {
      const pref = await PreferenceStoreAccessor.getPreferences()
      const raw = await pref.get(AGENT_TRACES_KEY, '[]') as string
      const traces = JSON.parse(raw) as AgentTraceRecord[]
      return traces.sort((a: AgentTraceRecord, b: AgentTraceRecord) => b.startedAt - a.startedAt)
    } catch (_error) {
      return []
    }
  }

  static async save(trace: AgentTraceRecord): Promise<void> {
    try {
      const traces = await AgentTraceStore.loadAll()
      const index = traces.findIndex((item: AgentTraceRecord) => item.traceId === trace.traceId)
      if (index >= 0) {
        traces[index] = trace
      } else {
        traces.unshift(trace)
      }
      const trimmed = traces.slice(0, MAX_AGENT_TRACES)
      const pref = await PreferenceStoreAccessor.getPreferences()
      await pref.put(AGENT_TRACES_KEY, JSON.stringify(trimmed))
      await pref.flush()
    } catch (_error) {
      // trace 是诊断信息，保存失败不能打断对话主流程。
    }
  }

  static async clearAll(): Promise<void> {
    try {
      const pref = await PreferenceStoreAccessor.getPreferences()
      await pref.put(AGENT_TRACES_KEY, '[]')
      await pref.flush()
    } catch (_error) {
    }
  }
}
