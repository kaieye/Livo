import { useCallback, useEffect, useState } from 'react'
import {
  X,
  RotateCw,
  Trash2,
  ListTree,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import { aiChatToolLabelOf } from './tool-labels'
import type { AgentTraceRecord, AgentTraceToolCall } from '@livo/models'

interface Props {
  onClose: () => void
}

function formatTime(timestamp: number): string {
  if (timestamp <= 0) return '未知时间'
  const date = new Date(timestamp)
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function statusLabel(status: string): string {
  if (status === 'completed' || status === 'success') return '完成'
  if (status === 'confirmation_required') return '待确认'
  if (status === 'cancelled') return '已取消'
  return '失败'
}

function statusColor(status: string): string {
  if (status === 'completed' || status === 'success') return '#16A34A'
  if (status === 'confirmation_required') return '#F59E0B'
  if (status === 'cancelled' || status === 'failed') return '#DC2626'
  return 'var(--text-tertiary)'
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

  return (
    <div className="absolute inset-0 z-10 flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-surface-dark">
      <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ListTree size={16} className="text-accent" />
          <span className="text-sm font-medium">执行轨迹</span>
        </div>
        <div className="flex items-center gap-1">
          {traces.length > 0 && (
            <>
              <button
                onClick={() => void clear()}
                className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                title="清空"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => void load()}
                className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                title="刷新"
              >
                <RotateCw size={14} />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 py-10 text-text-secondary">
            <Loader2 size={22} className="animate-spin text-accent" />
            <span className="text-xs">正在加载执行轨迹</span>
          </div>
        ) : traces.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ListTree size={28} className="text-text-tertiary" />
            <p className="text-sm font-medium">暂无执行轨迹</p>
            <p className="text-xs text-text-secondary">
              完成一次带工具调用的 AI 对话后会出现在这里
            </p>
          </div>
        ) : (
          traces.map((trace) => {
            const expanded = expandedId === trace.traceId
            return (
              <div
                key={trace.traceId}
                className="cursor-pointer rounded-xl border bg-surface-secondary/50 p-3 dark:bg-surface-dark-secondary/50"
                onClick={() => setExpandedId(expanded ? '' : trace.traceId)}
              >
                <div className="flex items-center gap-2 text-[11px]">
                  <span style={{ color: statusColor(trace.status) }}>
                    {statusLabel(trace.status)}
                  </span>
                  <span className="flex-1 text-text-tertiary">
                    {formatTime(trace.startedAt)}
                  </span>
                  <span className="text-accent">
                    {trace.toolCalls.length} 工具
                  </span>
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
                    {trace.toolCalls.length === 0 ? (
                      <p className="text-[11px] text-text-tertiary">
                        没有工具调用
                      </p>
                    ) : (
                      trace.toolCalls.map((call: AgentTraceToolCall) => (
                        <div
                          key={call.id}
                          className="rounded-lg bg-surface px-2.5 py-2 dark:bg-surface-dark"
                        >
                          <div className="flex items-center gap-2 text-[11px]">
                            <span style={{ color: statusColor(call.status) }}>
                              {statusLabel(call.status)}
                            </span>
                            <span className="flex-1 truncate font-medium">
                              {aiChatToolLabelOf(call.toolName)}
                            </span>
                            {call.elapsedMs > 0 && (
                              <span className="tabular-nums text-text-tertiary">
                                {(call.elapsedMs / 1000).toFixed(1)}s
                              </span>
                            )}
                          </div>
                          {call.resultSummary && (
                            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-text-secondary">
                              {call.resultSummary}
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
