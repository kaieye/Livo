import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from 'react'
import {
  X,
  RotateCw,
  Trash2,
  ListTree,
  Loader2,
  ChevronRight,
  Download,
} from 'lucide-react'
import { aiChatToolLabelOf } from './tool-labels'
import {
  agentTraceFailureContext,
  agentTraceFailureReason,
  agentTraceFailureStage,
  agentTraceStatusColor,
  agentTraceStatusLabel,
  formatAgentTraceDuration,
  formatAgentTraceTime,
} from '../../lib/agent-trace-panel-model'
import type { AgentTraceRecord, AgentTraceToolCall } from '@shared'

interface Props {
  onClose: () => void
}

type TraceStatusFilter = 'all' | AgentTraceRecord['status']

const STATUS_FILTERS: Array<{ value: TraceStatusFilter; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'completed', label: '完成' },
  { value: 'confirmation_required', label: '待确认' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
]

function formatMetricMs(value: number | undefined): string {
  if (typeof value !== 'number' || value < 0) return ''
  if (value < 1000) return `${Math.round(value)}ms`
  return `${(value / 1000).toFixed(1)}s`
}

function firstTokenMs(trace: AgentTraceRecord): number | undefined {
  return trace.metricsSnapshot?.rounds.find(
    (round) => typeof round.firstTokenMs === 'number',
  )?.firstTokenMs
}

function traceMetricSummary(trace: AgentTraceRecord): string {
  const metrics = trace.metricsSnapshot
  if (!metrics) return ''
  const parts = [
    metrics.rounds.length > 0 ? `${metrics.rounds.length} 轮` : '',
    typeof metrics.tokens?.totalTokens === 'number'
      ? `${metrics.tokens.totalTokens} tokens`
      : '',
    firstTokenMs(trace) !== undefined
      ? `首 token ${formatMetricMs(firstTokenMs(trace))}`
      : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

/**
 * Execution-trace panel listing recent agent runs and their tool calls.
 * Backed by the persisted AgentTraceStore over IPC. Mirrors Harmony's
 * AIChatTracePanel.
 */
export function AIChatTracePanel({ onClose }: Props) {
  const [traces, setTraces] = useState<AgentTraceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState('')
  const [statusFilter, setStatusFilter] = useState<TraceStatusFilter>('all')
  const [sessionFilter, setSessionFilter] = useState('all')

  const sessionOptions = useMemo(
    () =>
      Array.from(
        new Set(traces.map((trace) => trace.sessionId).filter(Boolean)),
      ),
    [traces],
  )

  const visibleTraces = useMemo(
    () =>
      traces.filter((trace) => {
        if (statusFilter !== 'all' && trace.status !== statusFilter) {
          return false
        }
        if (sessionFilter !== 'all' && trace.sessionId !== sessionFilter) {
          return false
        }
        return true
      }),
    [sessionFilter, statusFilter, traces],
  )

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setTraces(await window.api.agent.listTraces())
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const clear = useCallback(async () => {
    await window.api.agent.clearTraces()
    setTraces([])
    setExpandedId('')
  }, [])

  const deleteTrace = useCallback(
    async (event: MouseEvent, traceId: string) => {
      event.stopPropagation()
      const result = await window.api.agent.deleteTrace(traceId)
      if (!result.success) return
      setTraces((current) =>
        current.filter((trace) => trace.traceId !== traceId),
      )
      if (expandedId === traceId) setExpandedId('')
    },
    [expandedId],
  )

  const exportTraces = useCallback(async () => {
    if (visibleTraces.length === 0) return
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await window.api.app.saveTextFile({
      title: '导出 Agent 执行轨迹',
      defaultFileName: `livo-agent-traces-${stamp}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
      content: JSON.stringify(visibleTraces, null, 2),
    })
  }, [visibleTraces])

  return (
    <div className="dark:bg-surface-dark absolute inset-0 z-10 flex flex-col overflow-hidden rounded-2xl bg-white">
      <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ListTree size={16} className="text-accent" />
          <span className="text-sm font-medium">执行轨迹</span>
        </div>
        <div className="flex items-center gap-1">
          {traces.length > 0 && (
            <>
              <button
                onClick={() => void exportTraces()}
                className="text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary rounded-lg p-1.5"
                title="导出"
                disabled={visibleTraces.length === 0}
              >
                <Download size={14} />
              </button>
              <button
                onClick={() => void clear()}
                className="text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary rounded-lg p-1.5"
                title="清空"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => void load()}
                className="text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary rounded-lg p-1.5"
                title="刷新"
              >
                <RotateCw size={14} />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary rounded-lg p-1.5"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {traces.length > 0 && (
        <div className="flex flex-shrink-0 items-center gap-2 border-b px-4 py-2">
          <select
            aria-label="按状态过滤"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as TraceStatusFilter)
            }
            className="border-border bg-surface dark:bg-surface-dark text-text-secondary min-w-0 rounded-lg border px-2 py-1 text-[11px] outline-none"
          >
            {STATUS_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            aria-label="按会话过滤"
            value={sessionFilter}
            onChange={(event) => setSessionFilter(event.target.value)}
            className="border-border bg-surface dark:bg-surface-dark text-text-secondary min-w-0 flex-1 rounded-lg border px-2 py-1 text-[11px] outline-none"
          >
            <option value="all">全部会话</option>
            {sessionOptions.map((sessionId) => (
              <option key={sessionId} value={sessionId}>
                {sessionId}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="text-text-secondary flex flex-col items-center gap-2 py-10">
            <Loader2 size={22} className="text-accent animate-spin" />
            <span className="text-xs">正在加载执行轨迹</span>
          </div>
        ) : traces.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ListTree size={28} className="text-text-tertiary" />
            <p className="text-sm font-medium">暂无执行轨迹</p>
            <p className="text-text-secondary text-xs">
              完成一次带工具调用的 AI 对话后会出现在这里
            </p>
          </div>
        ) : visibleTraces.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ListTree size={28} className="text-text-tertiary" />
            <p className="text-sm font-medium">没有匹配的执行轨迹</p>
          </div>
        ) : (
          visibleTraces.map((trace) => {
            const expanded = expandedId === trace.traceId
            const failed = trace.status === 'failed'
            const metricSummary = traceMetricSummary(trace)
            return (
              <div
                key={trace.traceId}
                className="bg-surface-secondary/50 dark:bg-surface-dark-secondary/50 cursor-pointer rounded-xl border p-3"
                onClick={() => setExpandedId(expanded ? '' : trace.traceId)}
              >
                <div className="flex items-center gap-2 text-[11px]">
                  <span style={{ color: agentTraceStatusColor(trace.status) }}>
                    {agentTraceStatusLabel(trace.status)}
                  </span>
                  <span className="text-text-tertiary flex-1">
                    {formatAgentTraceTime(trace.startedAt)}
                  </span>
                  <span className="text-text-tertiary tabular-nums">
                    {formatAgentTraceDuration(trace)}
                  </span>
                  <span className="text-accent">
                    {trace.toolCalls.length} 工具
                  </span>
                  {metricSummary && (
                    <span className="text-text-tertiary hidden max-w-[150px] truncate tabular-nums sm:inline">
                      {metricSummary}
                    </span>
                  )}
                  <button
                    onClick={(event) => void deleteTrace(event, trace.traceId)}
                    className="text-text-tertiary hover:bg-surface dark:hover:bg-surface-dark rounded-md p-1"
                    title="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                  <ChevronRight
                    size={13}
                    className={`text-text-tertiary transition-transform ${expanded ? 'rotate-90' : ''}`}
                  />
                </div>
                <p className="mt-1.5 line-clamp-2 text-[13px] font-medium">
                  {trace.promptSummary || '(无提示词)'}
                </p>
                {expanded && (
                  <div className="mt-2 space-y-1.5">
                    {trace.metricsSnapshot && (
                      <div className="bg-surface dark:bg-surface-dark grid grid-cols-2 gap-2 rounded-lg px-2.5 py-2 text-[11px] md:grid-cols-4">
                        <div>
                          <div className="text-text-tertiary">LLM</div>
                          <div className="text-text-secondary font-mono tabular-nums">
                            {formatMetricMs(trace.metricsSnapshot.llmMs) ||
                              '0ms'}
                          </div>
                        </div>
                        <div>
                          <div className="text-text-tertiary">工具</div>
                          <div className="text-text-secondary font-mono tabular-nums">
                            {formatMetricMs(trace.metricsSnapshot.toolMs) ||
                              '0ms'}
                          </div>
                        </div>
                        <div>
                          <div className="text-text-tertiary">Tokens</div>
                          <div className="text-text-secondary font-mono tabular-nums">
                            {trace.metricsSnapshot.tokens?.totalTokens ?? '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-text-tertiary">首 token</div>
                          <div className="text-text-secondary font-mono tabular-nums">
                            {formatMetricMs(firstTokenMs(trace)) || '-'}
                          </div>
                        </div>
                      </div>
                    )}
                    {failed && (
                      <div className="rounded-lg border border-red-200 bg-red-50/70 px-2.5 py-2 dark:border-red-900/40 dark:bg-red-950/20">
                        <div className="grid gap-1 text-[11px] leading-snug">
                          <div className="flex items-center gap-2">
                            <span className="text-text-tertiary shrink-0">
                              失败阶段
                            </span>
                            <span className="text-text-primary min-w-0 flex-1 truncate font-medium">
                              {agentTraceFailureStage(trace, aiChatToolLabelOf)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-text-tertiary shrink-0">
                              耗时
                            </span>
                            <span className="text-text-secondary min-w-0 flex-1 truncate tabular-nums">
                              {formatAgentTraceDuration(trace)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-text-tertiary shrink-0">
                              上下文
                            </span>
                            <span className="text-text-secondary min-w-0 flex-1 truncate">
                              {agentTraceFailureContext(
                                trace,
                                aiChatToolLabelOf,
                              )}
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-text-tertiary shrink-0">
                              错误原因
                            </span>
                            <span className="text-text-secondary max-h-24 min-w-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words">
                              {agentTraceFailureReason(trace)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {trace.toolCalls.length === 0 ? (
                      <p className="text-text-tertiary text-[11px]">
                        没有工具调用
                      </p>
                    ) : (
                      trace.toolCalls.map((call: AgentTraceToolCall) => (
                        <div
                          key={call.id}
                          className="bg-surface dark:bg-surface-dark rounded-lg px-2.5 py-2"
                        >
                          <div className="flex items-center gap-2 text-[11px]">
                            <span
                              style={{
                                color: agentTraceStatusColor(call.status),
                              }}
                            >
                              {agentTraceStatusLabel(call.status)}
                            </span>
                            <span className="flex-1 truncate font-medium">
                              {aiChatToolLabelOf(call.toolName)}
                            </span>
                            {call.elapsedMs > 0 && (
                              <span className="text-text-tertiary tabular-nums">
                                {(call.elapsedMs / 1000).toFixed(1)}s
                              </span>
                            )}
                          </div>
                          {call.resultSummary && (
                            <p className="text-text-secondary mt-1 line-clamp-2 text-[11px] leading-snug">
                              {call.resultSummary}
                            </p>
                          )}
                          {call.argsPreview && (
                            <p className="text-text-tertiary mt-1 line-clamp-2 break-all font-mono text-[10px] leading-snug">
                              {call.argsPreview}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
