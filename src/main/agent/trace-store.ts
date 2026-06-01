import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import type {
  AgentTraceRecord,
  AgentTraceStatus,
  AgentTraceToolCall,
} from '../../shared/types'

export type { AgentTraceRecord, AgentTraceStatus, AgentTraceToolCall }

const MAX_AGENT_TRACES = 50

function getTracesPath(): string {
  return join(app.getPath('userData'), 'data', 'agent-traces.json')
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

  save(trace: AgentTraceRecord): void {
    try {
      const traces = AgentTraceStore.loadAll()
      const index = traces.findIndex((item) => item.traceId === trace.traceId)
      if (index >= 0) {
        traces[index] = trace
      } else {
        traces.unshift(trace)
      }
      const trimmed = traces.slice(0, MAX_AGENT_TRACES)
      const path = getTracesPath()
      const dir = join(path, '..')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(path, JSON.stringify(trimmed, null, 2))
    } catch {
      // Traces are diagnostic only; a save failure must not break the chat flow.
    }
  },

  clearAll(): void {
    try {
      const path = getTracesPath()
      const dir = join(path, '..')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(path, '[]')
    } catch {
      // ignore
    }
  },
}
