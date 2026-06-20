import type {
  AgentTraceRecord,
  AgentTraceStatus,
  AgentTraceToolCall,
} from '@shared'

type TraceStatus = AgentTraceStatus | string
type ToolLabeler = (toolName: string) => string

function identityToolLabel(toolName: string): string {
  return toolName
}

export function formatAgentTraceTime(timestamp: number): string {
  if (timestamp <= 0) return '未知时间'
  const date = new Date(timestamp)
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function agentTraceStatusLabel(status: TraceStatus): string {
  if (status === 'completed' || status === 'success') return '完成'
  if (status === 'confirmation_required') return '待确认'
  if (status === 'cancelled') return '已取消'
  return '失败'
}

export function agentTraceStatusColor(status: TraceStatus): string {
  if (status === 'completed' || status === 'success') return '#16A34A'
  if (status === 'confirmation_required') return '#F59E0B'
  if (status === 'cancelled' || status === 'failed') return '#DC2626'
  return 'var(--text-tertiary)'
}

export function agentTraceDurationMs(
  trace: Pick<AgentTraceRecord, 'startedAt' | 'completedAt'>,
): number | null {
  if (trace.startedAt <= 0 || trace.completedAt <= 0) return null
  return Math.max(0, trace.completedAt - trace.startedAt)
}

export function formatAgentTraceDurationMs(durationMs: number | null): string {
  if (durationMs === null) return '未知耗时'
  if (durationMs < 1000) return `${durationMs}ms`
  return `${(durationMs / 1000).toFixed(1)}s`
}

export function formatAgentTraceDuration(
  trace: Pick<AgentTraceRecord, 'startedAt' | 'completedAt'>,
): string {
  return formatAgentTraceDurationMs(agentTraceDurationMs(trace))
}

export function failedAgentTraceTool(
  trace: Pick<AgentTraceRecord, 'toolCalls'>,
): AgentTraceToolCall | null {
  return trace.toolCalls.find((call) => call.status === 'failed') ?? null
}

export function agentTraceFailureReason(
  trace: Pick<AgentTraceRecord, 'finalText'>,
): string {
  const text = trace.finalText.trim()
  return text || '未记录错误原因'
}

export function agentTraceFailureStage(
  trace: Pick<AgentTraceRecord, 'status' | 'toolCalls'>,
  toolLabelOf: ToolLabeler = identityToolLabel,
): string {
  if (trace.status !== 'failed') return ''
  const failedTool = failedAgentTraceTool(trace)
  if (failedTool) return `工具执行阶段：${toolLabelOf(failedTool.toolName)}`
  if (trace.toolCalls.length > 0) return 'Agent 收尾阶段'
  return '模型调用或启动阶段'
}

export function agentTraceFailureContext(
  trace: Pick<AgentTraceRecord, 'status' | 'toolCalls'>,
  toolLabelOf: ToolLabeler = identityToolLabel,
): string {
  if (trace.status !== 'failed') return ''
  const failedTool = failedAgentTraceTool(trace)
  if (failedTool) {
    return `${toolLabelOf(failedTool.toolName)} · ${formatAgentTraceDurationMs(
      failedTool.elapsedMs > 0 ? failedTool.elapsedMs : null,
    )}`
  }
  if (trace.toolCalls.length > 0) {
    return `已记录 ${trace.toolCalls.length} 个工具调用，未定位到失败工具`
  }
  return '未进入工具调用'
}
