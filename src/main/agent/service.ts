import { settingsProvider } from '../services/system/settings-provider'
import type { AgentRunSummary } from '@shared'
import {
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
      })
      return this.finalize(request.requestId, request.prompt, startedAt, result)
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
      })
      return this.finalize(
        parked.requestId,
        '(用户确认后继续)',
        parked.startedAt,
        result,
        parked.traceId,
        parked.prompt,
      )
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
