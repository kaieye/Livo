import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { EntryTaskState } from '../../../../shared/types'
import { buildEntryInlineTaskStatusItems } from '../../lib/entry-inline-task-status'

export function InlineTaskStatus({
  fulltext,
  aiSummary,
  onRetryFulltext,
  onRetrySummary,
  onOpenAISettings,
}: {
  fulltext?: EntryTaskState
  aiSummary?: EntryTaskState
  onRetryFulltext: () => void
  onRetrySummary: () => void
  onOpenAISettings: () => void
}) {
  const { t } = useTranslation()
  const items = buildEntryInlineTaskStatusItems({
    fulltext,
    aiSummary,
    labels: {
      fulltextRunning: t('entry.fulltextFetching', {
        defaultValue: '正在抓取全文...',
      }),
      fulltextFailed: t('entry.fulltextFailed', {
        defaultValue: '全文抓取失败',
      }),
      aiSummaryRunning: t('entry.generatingSummary', {
        defaultValue: '正在生成摘要...',
      }),
      aiSummaryFailed: t('entry.aiSummaryFailed', {
        defaultValue: 'AI 摘要生成失败',
      }),
      unknownError: t('common.unknownError', { defaultValue: '未知错误' }),
    },
  })

  if (items.length === 0) return null

  return (
    <div className="mb-6 space-y-2">
      {items.map((item) => {
        const isRunning = item.isRunning
        return (
          <div
            key={item.key}
            className={`border-border/70 bg-surface-secondary/70 dark:border-border-dark/70 dark:bg-surface-dark-secondary/70 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              !isRunning
                ? 'border-amber-300/50 bg-amber-50/70 text-amber-800 dark:bg-amber-900/15 dark:text-amber-200'
                : 'text-text-secondary dark:text-text-dark-secondary'
            }`}
          >
            {isRunning ? (
              <Loader2 size={14} className="text-accent animate-spin" />
            ) : (
              <AlertTriangle size={14} className="text-amber-500" />
            )}
            <span className="min-w-0 flex-1 break-words">{item.message}</span>
            {item.canOpenSettings && (
              <button
                type="button"
                onClick={onOpenAISettings}
                className="hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary rounded-md px-2 py-1 text-xs font-medium transition-colors"
              >
                {t('entry.openSettings', { defaultValue: '打开设置' })}
              </button>
            )}
            {!isRunning && (
              <button
                type="button"
                onClick={
                  item.key === 'fulltext' ? onRetryFulltext : onRetrySummary
                }
                className="text-accent hover:bg-accent/10 rounded-md px-2 py-1 text-xs font-medium transition-colors"
              >
                {t('entry.retry', { defaultValue: '重试' })}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
