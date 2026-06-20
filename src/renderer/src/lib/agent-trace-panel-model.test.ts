import { describe, expect, it } from 'vitest'
import type { AgentTraceRecord } from '@shared'
import {
  agentTraceFailureContext,
  agentTraceFailureReason,
  agentTraceFailureStage,
  agentTraceStatusColor,
  agentTraceStatusLabel,
  failedAgentTraceTool,
  formatAgentTraceDuration,
  formatAgentTraceDurationMs,
  formatAgentTraceTime,
} from './agent-trace-panel-model'

function trace(overrides: Partial<AgentTraceRecord>): AgentTraceRecord {
  return {
    traceId: 'trace-1',
    sessionId: 'agent-1',
    startedAt: 1_700_000_000_000,
    completedAt: 1_700_000_002_400,
    promptSummary: '搜索并打开最相关文章',
    finalText: 'AbortError: The operation was aborted',
    status: 'failed',
    toolCalls: [],
    ...overrides,
  }
}

describe('agent trace panel model', () => {
  it('summarizes a failed trace that did not reach tool execution', () => {
    const failedTrace = trace({})

    expect(agentTraceStatusLabel(failedTrace.status)).toBe('失败')
    expect(agentTraceStatusColor(failedTrace.status)).toBe('#DC2626')
    expect(formatAgentTraceDuration(failedTrace)).toBe('2.4s')
    expect(agentTraceFailureStage(failedTrace)).toBe('模型调用或启动阶段')
    expect(agentTraceFailureContext(failedTrace)).toBe('未进入工具调用')
    expect(agentTraceFailureReason(failedTrace)).toBe(
      'AbortError: The operation was aborted',
    )
  })

  it('summarizes a failed trace with a failed tool call', () => {
    const failedTrace = trace({
      toolCalls: [
        {
          id: 'call-1',
          toolName: 'set_entry_starred_state',
          argsPreview: '{"entryId":"entry-1","starred":true}',
          status: 'failed',
          resultSummary: '写回失败',
          elapsedMs: 1234,
          at: 1_700_000_000_500,
        },
      ],
    })
    const labelOf = (toolName: string) =>
      toolName === 'set_entry_starred_state' ? '收藏状态' : toolName

    expect(failedAgentTraceTool(failedTrace)?.toolName).toBe(
      'set_entry_starred_state',
    )
    expect(agentTraceFailureStage(failedTrace, labelOf)).toBe(
      '工具执行阶段：收藏状态',
    )
    expect(agentTraceFailureContext(failedTrace, labelOf)).toBe(
      '收藏状态 · 1.2s',
    )
  })

  it('uses stable fallbacks for missing time or error text', () => {
    expect(formatAgentTraceTime(0)).toBe('未知时间')
    expect(formatAgentTraceDuration(trace({ completedAt: 0 }))).toBe('未知耗时')
    expect(formatAgentTraceDurationMs(620)).toBe('620ms')
    expect(agentTraceFailureReason(trace({ finalText: '   ' }))).toBe(
      '未记录错误原因',
    )
  })
})
