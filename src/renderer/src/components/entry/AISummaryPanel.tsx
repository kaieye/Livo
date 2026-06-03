import { useTranslation } from 'react-i18next'
import { Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react'

export interface AISummaryPanelProps {
  /** The generated summary text. Panel is hidden when null and not loading/error. */
  summary: string | null
  /** Error message from the last summarize attempt. */
  error: string | null
  /** Whether a summarize request is currently in flight. */
  isLoading: boolean
  /** Callback to retry summarization (shown on error state). */
  onRetry: () => void
  /** Optional additional CSS classes. */
  className?: string
}

/**
 * Presentational panel for AI article summary.
 *
 * States:
 * - **idle** (no summary, no error, not loading): renders nothing
 * - **loading**: animated spinner with "Generating summary..." label
 * - **error**: error message with retry button
 * - **success**: gradient card with summary text
 *
 * The parent component owns the `useAISummary` hook and passes state + callbacks
 * as props. This keeps the panel agnostic to content source and lifecycle.
 */
export function AISummaryPanel({
  summary,
  error,
  isLoading,
  onRetry,
  className = '',
}: AISummaryPanelProps) {
  const { t } = useTranslation()

  // Idle state — render nothing
  if (!isLoading && !summary && !error) {
    return null
  }

  return (
    <div
      className={`animate-in fade-in-0 slide-in-from-top-2 border-accent/15 from-accent/5 to-accent/10 mb-8 rounded-xl border bg-gradient-to-br p-4 transition-all duration-300 ${className}`}
    >
      <div className="text-accent mb-2 flex items-center gap-2 text-sm font-medium">
        <Sparkles size={16} />
        {t('entry.aiSummaryTitle')}
      </div>

      {isLoading ? (
        <div className="text-text-secondary flex items-center gap-2 text-sm">
          <Loader2 size={14} className="animate-spin" />
          {t('entry.generatingSummary')}
        </div>
      ) : error ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle
              size={14}
              className="mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="leading-relaxed">{error}</span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="text-accent hover:bg-accent/10 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          >
            <RefreshCw size={12} aria-hidden="true" />
            {t('entry.retry')}
          </button>
        </div>
      ) : summary ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{summary}</p>
      ) : null}
    </div>
  )
}
