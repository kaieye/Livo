import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Loader2, Zap, Timer } from 'lucide-react'
import type { ToolStatusItem } from './types'

interface Props {
  items: ToolStatusItem[]
  show: boolean
  timerVisible: boolean
  elapsedLabel: string
}

function statusColor(status: ToolStatusItem['status']): string {
  switch (status) {
    case 'success':
      return '#16A34A'
    case 'failed':
    case 'cancelled':
      return '#DC2626'
    case 'confirmation_required':
      return '#F59E0B'
    default:
      return 'var(--accent, #7A5AF8)'
  }
}

function statusSuffix(status: ToolStatusItem['status']): string {
  switch (status) {
    case 'confirmation_required':
      return ' · 待确认'
    case 'failed':
      return ' · 失败'
    case 'cancelled':
      return ' · 已取消'
    case 'success':
      return ' · 完成'
    default:
      return ''
  }
}

function StatusIcon({ status }: { status: ToolStatusItem['status'] }) {
  const color = statusColor(status)
  if (status === 'success') return <CheckCircle2 size={12} style={{ color }} />
  if (status === 'failed' || status === 'cancelled')
    return <XCircle size={12} style={{ color }} />
  if (status === 'confirmation_required')
    return <Zap size={12} style={{ color }} />
  return <Loader2 size={12} className="animate-spin" style={{ color }} />
}

/** Animated ellipsis for running tools. */
function RunningDots() {
  const [dots, setDots] = useState('')
  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : `${d}.`))
    }, 400)
    return () => clearInterval(id)
  }, [])
  return <span>{dots}</span>
}

/**
 * Live status bar showing each tool the agent is invoking this run plus an
 * elapsed timer. Mirrors Harmony's AIChatRunStatusBar.
 */
export function AIChatRunStatusBar({
  items,
  show,
  timerVisible,
  elapsedLabel,
}: Props) {
  if (!show && !timerVisible) return null

  return (
    <div className="flex items-start gap-2 px-4 pb-2">
      {show && items.length > 0 && (
        <div className="flex-1 space-y-1.5 rounded-xl border bg-surface-secondary/60 px-3 py-2 dark:bg-surface-dark-secondary/60">
          {items.map((item) => (
            <div key={item.key}>
              <div className="flex items-center gap-1.5">
                <StatusIcon status={item.status} />
                <span className="flex-1 truncate text-[11px] text-text-secondary dark:text-text-dark-secondary">
                  {item.label}
                  {item.status === 'running' ? (
                    <RunningDots />
                  ) : (
                    statusSuffix(item.status)
                  )}
                </span>
                {item.elapsedMs !== undefined && item.elapsedMs > 0 && (
                  <span className="text-[10px] tabular-nums text-text-tertiary">
                    {(item.elapsedMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              {item.message && item.status !== 'running' && (
                <div className="ml-[18px] mt-0.5 line-clamp-2 text-[10px] leading-snug text-text-tertiary">
                  {item.message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {timerVisible && (
        <div className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border bg-surface-secondary/60 px-2.5 py-1.5 dark:bg-surface-dark-secondary/60">
          <Timer size={11} className="text-accent" />
          <span className="font-mono text-[11px] tabular-nums text-text-secondary dark:text-text-dark-secondary">
            {elapsedLabel}
          </span>
        </div>
      )}
    </div>
  )
}
