import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useFeedStore } from '../../store/feed-store'

/** Maximum number of feeds to auto-refresh after import. */
export const OPML_IMPORT_AUTO_REFRESH_LIMIT = 8

/** Hint shown when the import is too large for auto-refresh. */
export const OPML_IMPORT_LARGE_BATCH_HINT_KEY = 'opml.largeBatchHint'

interface OpmlImportProgressProps {
  importedFeedIds?: string[]
  onRefreshComplete?: (result: {
    total: number
    refreshed: number
    failed: number
  }) => void
}

/**
 * Displays background refresh progress after OPML import.
 *
 * Shows one of three states:
 * - **In progress**: spinner + "Syncing X/Y feeds..."
 * - **Complete**: check + "Sync complete: X/Y"
 * - **Skipped** (large batch): hint to manually refresh
 */
export function OpmlImportProgress({
  importedFeedIds,
  onRefreshComplete,
}: OpmlImportProgressProps) {
  const { t } = useTranslation()
  const progress = useFeedStore((s) => s.importRefreshProgress)
  const refreshImportedFeeds = useFeedStore((s) => s.refreshImportedFeeds)

  // Trigger refresh on mount if within limits
  const shouldAutoRefresh =
    importedFeedIds &&
    importedFeedIds.length > 0 &&
    importedFeedIds.length <= OPML_IMPORT_AUTO_REFRESH_LIMIT

  // The caller is expected to invoke refreshImportedFeeds when ready.
  // This component only displays progress.

  if (!progress) {
    if (
      importedFeedIds &&
      importedFeedIds.length > OPML_IMPORT_AUTO_REFRESH_LIMIT
    ) {
      return (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {t(OPML_IMPORT_LARGE_BATCH_HINT_KEY, {
              defaultValue:
                '订阅较多，已暂停自动同步以避免卡顿。你可以稍后手动刷新。',
            })}
          </p>
        </div>
      )
    }
    return null
  }

  const { completed, total, success, failed, currentTitle } = progress
  const isDone = completed >= total

  return (
    <div className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-bg-secondary)] px-4 py-3">
      <div className="flex items-center gap-2.5">
        {isDone ? (
          <CheckCircle2
            size={16}
            className="flex-shrink-0 text-green-500"
            aria-hidden="true"
          />
        ) : (
          <Loader2
            size={16}
            className="flex-shrink-0 animate-spin text-[var(--color-accent)]"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[var(--color-text-primary)]">
            {isDone
              ? t('opml.refreshComplete', {
                  defaultValue: `后台同步完成：成功 ${success}/${total}`,
                  success,
                  total,
                })
              : t('opml.refreshing', {
                  defaultValue: `正在后台同步导入订阅的头像与内容… ${completed}/${total}`,
                  completed,
                  total,
                })}
          </p>
          {failed > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-red-500">
              <XCircle size={11} aria-hidden="true" />
              {t('opml.refreshFailed', {
                defaultValue: `失败 ${failed}`,
                failed,
              })}
            </p>
          )}
          {currentTitle && !isDone && (
            <p className="mt-0.5 truncate text-xs text-[var(--color-text-tertiary)]">
              {currentTitle}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && !isDone && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300 ease-out"
            style={{ width: `${Math.round((completed / total) * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
