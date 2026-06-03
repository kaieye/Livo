import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Trash2, RefreshCw, Loader2, FileText } from 'lucide-react'
import type { RefreshLogEntry } from '../../../../shared/types'

function formatDateTime(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return '--'
  const date = new Date(timestamp)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

export function RefreshLogSettings() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<RefreshLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

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
          {logs.map((log, index) => (
            <div
              key={log.id}
              className="border-border bg-surface dark:bg-surface-dark-secondary rounded-lg border p-3"
            >
              <div className="mb-2 flex items-center justify-between">
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
              {log.failedFeedTitles && log.failedFeedTitles.length > 0 && (
                <p className="text-text-secondary dark:text-text-dark-secondary mt-1 line-clamp-3 text-xs">
                  {t('settings.refreshLogsFailedFeeds')}
                  {': '}
                  {log.failedFeedTitles.join('、')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer hint */}
      <p className="dark:text-text-dark-tertiary text-text-tertiary text-xs">
        {t('settings.refreshLogsMaxHint')}
      </p>
    </div>
  )
}
