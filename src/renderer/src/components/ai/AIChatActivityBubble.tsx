import {
  CheckCircle2,
  CircleDashed,
  Loader2,
  Timer,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react'
import type { ToolStatusItem } from './types'

interface Props {
  items: ToolStatusItem[]
  elapsedLabel: string
  timerVisible: boolean
}

function statusText(status: ToolStatusItem['status']): string {
  switch (status) {
    case 'success':
      return '完成'
    case 'failed':
      return '失败'
    case 'cancelled':
      return '已取消'
    case 'confirmation_required':
      return '待确认'
    default:
      return '执行中'
  }
}

function statusTone(status: ToolStatusItem['status']): string {
  switch (status) {
    case 'success':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'failed':
    case 'cancelled':
      return 'text-red-600 dark:text-red-400'
    case 'confirmation_required':
      return 'text-amber-600 dark:text-amber-400'
    default:
      return 'text-accent'
  }
}

function ActivityStatusIcon({ status }: { status: ToolStatusItem['status'] }) {
  const tone = statusTone(status)
  if (status === 'success') return <CheckCircle2 size={14} className={tone} />
  if (status === 'failed' || status === 'cancelled') {
    return <XCircle size={14} className={tone} />
  }
  if (status === 'confirmation_required') {
    return <Zap size={14} className={tone} />
  }
  return <Loader2 size={14} className={`${tone} animate-spin`} />
}

function ActivityRow({ item }: { item: ToolStatusItem }) {
  const detail = item.message || item.argsPreview
  return (
    <div className="group rounded-lg px-2.5 py-2 transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.04]">
      <div className="grid min-w-0 grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2">
        <span className="text-text-tertiary rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-normal dark:bg-white/[0.06]">
          tool
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <Wrench size={12} className="text-text-tertiary flex-shrink-0" />
            <span className="text-text dark:text-text-dark-primary truncate font-mono text-[11px]">
              {item.name}
            </span>
          </div>
          <div className="text-text-secondary dark:text-text-dark-secondary mt-0.5 truncate text-[11px]">
            {item.label}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ActivityStatusIcon status={item.status} />
          <span className={`text-[10px] ${statusTone(item.status)}`}>
            {statusText(item.status)}
          </span>
        </div>
      </div>
      {detail && (
        <div className="text-text-tertiary ml-[52px] mt-1 line-clamp-2 text-[10px] leading-snug">
          {detail}
        </div>
      )}
      {item.elapsedMs !== undefined && item.elapsedMs > 0 && (
        <div className="text-text-tertiary ml-[52px] mt-1 font-mono text-[10px] tabular-nums">
          {(item.elapsedMs / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  )
}

export function AIChatActivityBubble({
  items,
  elapsedLabel,
  timerVisible,
}: Props) {
  const hasRunningTool = items.some((item) => item.status === 'running')
  const reasoningText =
    items.length === 0
      ? '正在理解问题与当前上下文'
      : hasRunningTool
        ? '正在等待工具返回结果'
        : '正在整理工具结果并准备回答'

  return (
    <div
      aria-live="polite"
      className="bg-surface-secondary dark:bg-surface-dark-secondary max-w-[85%] rounded-xl rounded-bl-sm border border-black/5 px-3 py-3 text-sm leading-relaxed shadow-sm dark:border-white/10"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CircleDashed size={15} className="text-accent animate-spin" />
          <span className="text-text dark:text-text-dark-primary truncate text-xs font-medium">
            Agent 正在处理
          </span>
        </div>
        {timerVisible && (
          <div className="text-text-tertiary flex flex-shrink-0 items-center gap-1 font-mono text-[10px] tabular-nums">
            <Timer size={11} className="text-accent" />
            {elapsedLabel}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="rounded-lg px-2.5 py-2">
          <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-2">
            <span className="text-text-tertiary rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium tracking-normal dark:bg-white/[0.06]">
              reasoning
            </span>
            <div className="text-text-secondary dark:text-text-dark-secondary min-w-0 truncate text-[11px]">
              思考
            </div>
            <Loader2 size={14} className="text-accent animate-spin" />
          </div>
          <div className="text-text-tertiary ml-[82px] mt-1 text-[10px] leading-snug">
            {reasoningText}
          </div>
        </div>

        {items.length > 0 && (
          <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
            {items.map((item) => (
              <ActivityRow key={item.key} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
