import { Zap, Check, X, Loader2 } from 'lucide-react'
import type { PendingAgentConfirmationView } from './types'

interface Props {
  confirmation: PendingAgentConfirmationView
  isConfirming: boolean
  onConfirm: () => void
  onCancel: () => void
}

function riskColor(risk: string): string {
  if (risk === 'high') return '#DC2626'
  if (risk === 'medium') return '#F59E0B'
  return '#16A34A'
}

/**
 * Inline confirmation card shown when the agent requests approval for a
 * mutate / destructive / external tool. Confirm resumes the parked agent run;
 * cancel aborts it. Mirrors Harmony's AIChatConfirmationCard.
 */
export function AIChatConfirmationCard({
  confirmation,
  isConfirming,
  onConfirm,
  onCancel,
}: Props) {
  const color = riskColor(confirmation.risk)

  return (
    <div className="flex gap-2.5">
      <div className="bg-accent/10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full">
        <Zap size={14} style={{ color }} />
      </div>
      <div
        className="bg-surface-secondary dark:bg-surface-dark-secondary max-w-[85%] rounded-xl rounded-bl-sm border p-3.5"
        style={{ borderColor: color }}
      >
        <div className="flex items-center gap-1.5">
          <Zap size={14} style={{ color }} />
          <span className="text-sm font-medium">{confirmation.title}</span>
        </div>
        <p className="text-text-secondary dark:text-text-dark-secondary mt-1.5 text-[13px] leading-relaxed">
          {confirmation.message}
        </p>
        {confirmation.argsPreview && confirmation.argsPreview !== '无参数' && (
          <pre className="text-text-tertiary mt-2 line-clamp-4 whitespace-pre-wrap break-words font-mono text-[11px] leading-snug">
            {confirmation.argsPreview}
          </pre>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={isConfirming}
            onClick={onConfirm}
            className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] text-white disabled:opacity-60"
            style={{ backgroundColor: color }}
          >
            {isConfirming ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Check size={12} />
            )}
            {isConfirming ? '执行中' : '执行'}
          </button>
          <button
            type="button"
            disabled={isConfirming}
            onClick={onCancel}
            className="bg-surface text-text-secondary hover:bg-surface-tertiary dark:bg-surface-dark dark:text-text-dark-secondary dark:hover:bg-surface-dark-tertiary inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px] disabled:opacity-60"
          >
            <X size={12} />
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
