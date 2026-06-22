import { settingsProvider } from '../services/system/settings-provider'
import {
  DEFAULT_AGENT_RUN_TIMEOUT_SECONDS,
  DEFAULT_AGENT_MAX_ROUNDS,
  MAX_AGENT_MAX_ROUNDS,
  MAX_AGENT_RUN_TIMEOUT_SECONDS,
  type AgentRunSummary,
  type AppSettings,
} from '@shared'
import {
  agentRunFailureToolRounds,
  runAgentCore,
  resumeAgentCore,
  type AgentContinuationState,
  type AgentHistoryMessage,
  type AgentRunResult,
  type AgentToolExecutionEvent,
} from './loop'
import {
  AgentTraceStore,
  type AgentTraceRecord,
  type AgentTraceStatus,
} from './trace-store'

/** Back-compat alias — the canonical shape lives in `@shared`. */
export type AgentServiceResult = AgentRunSummary

export interface AgentServiceRunRequest {
  requestId: string
  prompt: string
  history?: AgentHistoryMessage[]
  pageContext?: string
  onToolEvent?: (event: AgentToolExecutionEvent) => void
}

export interface AgentServiceResumeRequest {
  requestId: string
  pendingId: string
  onToolEvent?: (event: AgentToolExecutionEvent) => void
}

const PENDING_TTL_MS = 10 * 60 * 1000
const ERROR_TRACE_TEXT_MAX_LEN = 2000
const MS_PER_SECOND = 1000

function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function errorFinalText(error: unknown): string {
  const err = error as { name?: unknown } | undefined
  const name = typeof err?.name === 'string' ? err.name : 'Error'
  const message = errorMessageOf(error)
  return `${name}: ${message}`.slice(0, ERROR_TRACE_TEXT_MAX_LEN)
}

function resolveAgentRunTimeoutMs(settings: {
  agent?: Partial<AppSettings['agent']>
}): number {
  const seconds = settings.agent?.runTimeoutSeconds
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return DEFAULT_AGENT_RUN_TIMEOUT_SECONDS * MS_PER_SECOND
  }

  const safeSeconds = Math.floor(seconds)
  if (safeSeconds <= 0) {
    return DEFAULT_AGENT_RUN_TIMEOUT_SECONDS * MS_PER_SECOND
  }

  return Math.min(safeSeconds, MAX_AGENT_RUN_TIMEOUT_SECONDS) * MS_PER_SECOND
}

function resolveAgentMaxRounds(settings: {
  agent?: Partial<AppSettings['agent']>
}): number {
  const rounds = settings.agent?.maxRounds
  if (typeof rounds !== 'number' || !Number.isFinite(rounds)) {
    return DEFAULT_AGENT_MAX_ROUNDS
  }

  const safeRounds = Math.floor(rounds)
  if (safeRounds <= 0) return DEFAULT_AGENT_MAX_ROUNDS
  return Math.min(safeRounds, MAX_AGENT_MAX_ROUNDS)
}

/**
 * Unified entry point for the agent: owns abort controllers per request,
 * parks continuation state while waiting for user confirmation, and records a
 * trace for every run.
 */
class AgentServiceImpl {
  private readonly aborters = new Map<string, AbortController>()
  private readonly pending = new Map<
    string,
    {
      continuation: AgentContinuationState
      requestId: string
      traceId: string
      startedAt: number
      prompt: string
      expiresAt: number
    }
  >()

  async run(request: AgentServiceRunRequest): Promise<AgentServiceResult> {
    const settings = settingsProvider.get()
    const timeoutMs = resolveAgentRunTimeoutMs(settings)
    const maxRounds = resolveAgentMaxRounds(settings)
    const controller = new AbortController()
    this.aborters.set(request.requestId, controller)
    const startedAt = Date.now()
    try {
      const result = await runAgentCore({
        prompt: request.prompt,
        aiConfig: settings.ai,
        permissions: settings.agentPermissions,
        history: request.history,
        pageContext: request.pageContext,
        sessionId: request.requestId,
        onToolEvent: request.onToolEvent,
        signal: controller.signal,
        timeoutMs,
        maxRounds,
      })
      return this.finalize(request.requestId, request.prompt, startedAt, result)
    } catch (error) {
      this.saveFailedTrace(request.requestId, request.prompt, startedAt, error)
      throw error
    } finally {
      this.aborters.delete(request.requestId)
    }
  }

  async resume(
    request: AgentServiceResumeRequest,
  ): Promise<AgentServiceResult> {
    const parked = this.pending.get(request.pendingId)
    if (!parked || parked.expiresAt < Date.now()) {
      this.pending.delete(request.pendingId)
      throw new Error('确认请求已过期，请重新发送消息。')
    }
    this.pending.delete(request.pendingId)

    const settings = settingsProvider.get()
    const timeoutMs = resolveAgentRunTimeoutMs(settings)
    const maxRounds = resolveAgentMaxRounds(settings)
    const controller = new AbortController()
    this.aborters.set(request.requestId, controller)
    try {
      const result = await resumeAgentCore({
        continuation: parked.continuation,
        aiConfig: settings.ai,
        permissions: settings.agentPermissions,
        sessionId: request.requestId,
        onToolEvent: request.onToolEvent,
        signal: controller.signal,
        timeoutMs,
        maxRounds,
      })
      return this.finalize(
        parked.requestId,
        '(用户确认后继续)',
        parked.startedAt,
        result,
        parked.traceId,
        parked.prompt,
      )
    } catch (error) {
      this.saveFailedTrace(
        parked.requestId,
        parked.prompt,
        parked.startedAt,
        error,
        parked.traceId,
      )
      throw error
    } finally {
      this.aborters.delete(request.requestId)
    }
  }

  abort(requestId: string): boolean {
    const controller = this.aborters.get(requestId)
    if (!controller) return false
    controller.abort()
    this.aborters.delete(requestId)
    return true
  }

  cancelPending(pendingId: string): boolean {
    const parked = this.pending.get(pendingId)
    if (!parked) return false
    if (parked.expiresAt < Date.now()) {
      this.pending.delete(pendingId)
      return false
    }
    this.pending.delete(pendingId)
    this.saveTraceRecord({
      traceId: parked.traceId,
      sessionId: parked.requestId,
      startedAt: parked.startedAt,
      completedAt: Date.now(),
      promptSummary: parked.prompt.slice(0, 120),
      finalText: '用户取消执行等待确认的 Agent 工具调用。',
      status: 'cancelled',
      toolCalls: parked.continuation.toolRounds.map((round, index) => ({
        id: `${parked.requestId}-${index}`,
        toolName: round.name,
        argsPreview: (round.args || '').slice(0, 200),
        status: round.status || 'confirmation_required',
        resultSummary: round.resultSummary,
        elapsedMs: round.elapsedMs || 0,
        at: parked.startedAt,
      })),
      metricsSnapshot: parked.continuation.metrics,
    })
    return true
  }

  private finalize(
    requestId: string,
    prompt: string,
    startedAt: number,
    result: AgentRunResult,
    traceId = this.createTraceId(requestId, startedAt),
    tracePrompt = prompt,
  ): AgentServiceResult {
    this.evictExpiredPending()

    let pendingId: string | undefined
    if (result.status === 'confirmation_required' && result.continuation) {
      pendingId = `pending-${requestId}-${Date.now()}`
      this.pending.set(pendingId, {
        continuation: result.continuation,
        requestId,
        traceId,
        startedAt,
        prompt: tracePrompt,
        expiresAt: Date.now() + PENDING_TTL_MS,
      })
    }

    this.saveTrace(requestId, tracePrompt, startedAt, result, traceId)

    return {
      text: result.text,
      status: result.status,
      toolRounds: result.toolRounds,
      confirmation: result.confirmation,
      pendingId,
      metrics: result.metrics,
    }
  }

  private saveTrace(
    requestId: string,
    prompt: string,
    startedAt: number,
    result: AgentRunResult,
    traceId = this.createTraceId(requestId, startedAt),
  ): void {
    const status: AgentTraceStatus =
      result.status === 'confirmation_required'
        ? 'confirmation_required'
        : 'completed'
    const record: AgentTraceRecord = {
      traceId,
      sessionId: requestId,
      startedAt,
      completedAt: Date.now(),
      promptSummary: prompt.slice(0, 120),
      finalText: result.text.slice(0, 2000),
      status,
      toolCalls: result.toolRounds.map((round, index) => ({
        id: `${requestId}-${index}`,
        toolName: round.name,
        argsPreview: (round.args || '').slice(0, 200),
        status: round.status || 'success',
        resultSummary: round.resultSummary,
        elapsedMs: round.elapsedMs || 0,
        at: startedAt,
      })),
      metricsSnapshot: result.metrics,
    }
    this.saveTraceRecord(record)
  }

  private saveFailedTrace(
    requestId: string,
    prompt: string,
    startedAt: number,
    error: unknown,
    traceId = this.createTraceId(requestId, startedAt),
  ): void {
    const toolRounds = agentRunFailureToolRounds(error)
    const record: AgentTraceRecord = {
      traceId,
      sessionId: requestId,
      startedAt,
      completedAt: Date.now(),
      promptSummary: prompt.slice(0, 120),
      finalText: errorFinalText(error),
      status: 'failed',
      toolCalls: toolRounds.map((round, index) => ({
        id: `${requestId}-${index}`,
        toolName: round.name,
        argsPreview: (round.args || '').slice(0, 200),
        status: round.status || 'success',
        resultSummary: round.resultSummary,
        elapsedMs: round.elapsedMs || 0,
        at: startedAt,
      })),
    }
    this.saveTraceRecord(record)
  }

  private saveTraceRecord(record: AgentTraceRecord): void {
    AgentTraceStore.save(record)
  }

  private createTraceId(requestId: string, startedAt: number): string {
    return `trace-${requestId}-${startedAt}`
  }

  private evictExpiredPending(): void {
    const now = Date.now()
    for (const [id, parked] of this.pending) {
      if (parked.expiresAt < now) this.pending.delete(id)
    }
  }
}

export const agentService = new AgentServiceImpl()
