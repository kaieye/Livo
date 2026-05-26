import type { LivoAgentRunResult } from '../agent/LivoAgentService'
import type { AgentRoundDetail } from '../services/AIChatAgentService'
import { AgentTraceStore } from '../agent/AgentTraceStore'
import type {
  AgentTraceRecord,
  AgentTraceStatus,
  AgentTraceToolCall,
} from '../agent/AgentTraceStore'

export class AIChatTraceRecorder {
  private traceId: string = ''
  private sessionId: string = ''
  private promptSummary: string = ''
  private startedAt: number = 0

  start(prompt: string, sessionId: string): void {
    const now = Date.now()
    this.traceId = `trace_${now}`
    this.sessionId = sessionId || 'ai-chat'
    this.promptSummary = prompt.trim().slice(0, 120)
    this.startedAt = now
  }

  async saveResult(result: LivoAgentRunResult): Promise<void> {
    const status: AgentTraceStatus =
      result.status === 'confirmation_required'
        ? 'confirmation_required'
        : 'completed'
    await AgentTraceStore.save(
      this.buildRecord(status, result.text, result.toolRounds),
    )
    if (status === 'completed') {
      this.reset()
    }
  }

  async saveFailed(message: string): Promise<void> {
    await AgentTraceStore.save(this.buildRecord('failed', message, []))
    this.reset()
  }

  async saveCancelled(toolName: string, toolLabel: string): Promise<void> {
    const call: AgentTraceToolCall = {
      id: `${this.traceId || 'trace'}_cancelled`,
      toolName,
      argsPreview: '',
      status: 'cancelled',
      message: '用户取消执行',
      resultSummary: '',
      elapsedMs: 0,
      risk: '',
      at: Date.now(),
    }
    await AgentTraceStore.save(
      this.buildRecord('cancelled', `已取消执行「${toolLabel}」。`, [call]),
    )
    this.reset()
  }

  private buildRecord(
    status: AgentTraceStatus,
    finalText: string,
    rounds: AgentRoundDetail[],
  ): AgentTraceRecord {
    const now = Date.now()
    return {
      traceId: this.traceId || `trace_${now}`,
      sessionId: this.sessionId || 'ai-chat',
      startedAt: this.startedAt || now,
      completedAt: now,
      promptSummary: this.promptSummary || '未记录提示',
      finalText,
      status,
      toolCalls: this.toolCallsFromRounds(rounds),
    }
  }

  private toolCallsFromRounds(
    rounds: AgentRoundDetail[],
  ): AgentTraceToolCall[] {
    return rounds.map(
      (round: AgentRoundDetail, index: number): AgentTraceToolCall => ({
        id: `${this.traceId || 'trace'}_${index}`,
        toolName: round.name,
        argsPreview: round.args,
        status: round.status || 'success',
        message: round.confirmation?.message || '',
        resultSummary: round.resultSummary,
        elapsedMs: round.elapsedMs ?? 0,
        risk: round.confirmation?.risk || '',
        at: this.startedAt || Date.now(),
      }),
    )
  }

  private reset(): void {
    this.traceId = ''
    this.sessionId = ''
    this.promptSummary = ''
    this.startedAt = 0
  }
}
