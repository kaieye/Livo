import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Clock,
  Trash2,
  RefreshCw,
  Loader2,
  FileText,
  X,
  CheckCircle2,
  XCircle,
  Cloud,
  Link2,
} from 'lucide-react'
import type {
  RefreshLogEntry,
  RefreshRunItemResult,
} from '../../../../shared/types'

function formatDateTime(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return '--'
  const date = new Date(timestamp)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

function sortItems(items: RefreshRunItemResult[]): RefreshRunItemResult[] {
  return [...items].sort((a, b) => {
    if (a.status === 'failed' && b.status !== 'failed') return -1
    if (a.status !== 'failed' && b.status === 'failed') return 1
    return a.feedTitle.localeCompare(b.feedTitle)
  })
}

function FeedSourceBadge({
  source,
  t,
}: {
  source: RefreshRunItemResult['source']
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  if (source !== 'server-cache' && source !== 'upstream') return null

  const isServerCache = source === 'server-cache'
  const Icon = isServerCache ? Cloud : Link2
  const label = isServerCache
    ? t('settings.refreshLogsSourceServerCache')
    : t('settings.refreshLogsSourceUpstream')
  const className = isServerCache
    ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'

  return (
    <span
      className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}
      title={t('settings.refreshLogsSourceLabel', { source: label })}
    >
      <Icon size={11} />
      {label}
    </span>
  )
}

function FeedDetailModal({
  log,
  onClose,
  t,
}: {
  log: RefreshLogEntry
  onClose: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const items = sortItems(log.items ?? [])
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="dark:bg-surface-dark-secondary flex max-h-[70vh] w-[520px] max-w-[90vw] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
          <div>
            <h3 className="text-text-primary dark:text-text-dark-primary text-sm font-semibold">
              {formatDateTime(log.refreshedAt)}
            </h3>
            <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
              {t('settings.refreshLogsSuccessCount', {
                count: log.successFeedCount,
              })}
              {' · '}
              {t('settings.refreshLogsFailedCount', {
                count: log.failedFeedCount,
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-lg p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Feed list */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ul className="divide-border dark:divide-border-dark divide-y">
            {items.map((item) => (
              <li
                key={item.feedId}
                className="flex items-start gap-3 px-5 py-3"
              >
                {item.status === 'succeeded' ? (
                  <CheckCircle2
                    size={16}
                    className="mt-0.5 shrink-0 text-green-500"
                  />
                ) : (
                  <XCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary dark:text-text-dark-primary truncate text-sm font-medium">
                    {item.feedTitle}
                  </p>
                  <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
                    {item.status === 'succeeded'
                      ? t('settings.refreshLogsFeedSuccess', {
                          count: item.newEntries,
                        })
                      : item.error || t('settings.refreshLogsFeedFailed')}
                  </p>
                  <FeedSourceBadge source={item.source} t={t} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export function RefreshLogSettings() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<RefreshLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [detailLog, setDetailLog] = useState<RefreshLogEntry | null>(null)

  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      if (window.api?.refreshLogs?.list) {
        const result = await window.api.refreshLogs.list()
        setLogs(result)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const handleClear = async () => {
    setClearing(true)
    setActionMessage(null)
    try {
      if (window.api?.refreshLogs?.clear) {
        await window.api.refreshLogs.clear()
        setLogs([])
        setActionMessage(t('settings.refreshLogsCleared'))
      }
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Clock size={16} className="text-accent" />
          <h4 className="text-sm font-medium">{t('settings.refreshLogs')}</h4>
        </div>
        <p className="text-text-secondary dark:text-text-dark-secondary text-xs">
          {t('settings.refreshLogsDesc')}
        </p>
      </section>

      {/* Toolbar */}
      {!isLoading && (
        <div className="flex items-center gap-3">
          <button
            onClick={loadLogs}
            className="border-border hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
          >
            <RefreshCw size={14} />
            {t('settings.refreshLogsRefresh')}
          </button>
          <button
            onClick={handleClear}
            disabled={clearing || logs.length === 0}
            className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-500/20 disabled:opacity-50 dark:text-red-400"
          >
            {clearing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {t('settings.refreshLogsClear')}
          </button>
          {actionMessage && (
            <span className="text-text-secondary dark:text-text-dark-secondary text-xs">
              {actionMessage}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="text-text-secondary dark:text-text-dark-secondary flex min-h-[120px] items-center justify-center text-sm">
          <Loader2 size={18} className="mr-2 animate-spin" />
          {t('settings.refreshLogsLoading')}
        </div>
      ) : logs.length === 0 ? (
        <div className="border-border bg-surface-secondary dark:bg-surface-dark-tertiary rounded-lg border p-6 text-center">
          <FileText
            size={32}
            className="dark:text-text-dark-tertiary text-text-tertiary mx-auto mb-3"
          />
          <p className="text-text-primary dark:text-text-dark-primary text-sm font-medium">
            {t('settings.refreshLogsEmpty')}
          </p>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-1 text-xs">
            {t('settings.refreshLogsEmptyHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log, index) => {
            const hasItems = log.items && log.items.length > 0
            return (
              <button
                key={log.id}
                type="button"
                onClick={() => hasItems && setDetailLog(log)}
                disabled={!hasItems}
                className={`border-border bg-surface dark:bg-surface-dark-secondary w-full rounded-lg border p-3 text-left ${
                  hasItems
                    ? 'hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary cursor-pointer transition-colors'
                    : 'cursor-default'
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-text-primary dark:text-text-dark-primary text-sm font-medium">
                    {formatDateTime(log.refreshedAt)}
                  </span>
                  <span className="text-text-muted dark:text-text-dark-muted text-xs">
                    #{logs.length - index}
                  </span>
                </div>
                <p className="text-text-secondary dark:text-text-dark-secondary text-xs">
                  {t('settings.refreshLogsSuccessCount', {
                    count: log.successFeedCount,
                  })}
                  {' · '}
                  {t('settings.refreshLogsFailedCount', {
                    count: log.failedFeedCount,
                  })}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {/* Footer hint */}
      <p className="dark:text-text-dark-tertiary text-text-tertiary text-xs">
        {t('settings.refreshLogsMaxHint')}
      </p>

      {/* Detail modal */}
      {detailLog && (
        <FeedDetailModal
          log={detailLog}
          onClose={() => setDetailLog(null)}
          t={t}
        />
      )}
    </div>
  )
}
