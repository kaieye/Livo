import {
  useSettingSection,
  useSettingsActions,
} from '../../store/settings-store'
import { useTranslation } from 'react-i18next'
import { useState, useEffect, useCallback } from 'react'
import {
  Database,
  Trash2,
  BarChart3,
  Loader2,
  FileText,
  FolderOpen,
  FolderCog,
  HardDriveDownload,
} from 'lucide-react'

interface DbStats {
  totalFeeds: number
  totalEntries: number
  readEntries: number
  starredEntries: number
  dataSizeBytes: number
  cacheSizeBytes: number
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let idx = 0
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024
    idx++
  }
  return `${size >= 10 || idx === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[idx]}`
}

export function DataSettings() {
  const data = useSettingSection('data')
  const { updateSettingsSection } = useSettingsActions()
  const dataSettings = data ?? {
    entriesPerFeed: 128,
    maxEntryAgeDays: 90,
    freshnessTTL: 10,
    refreshConcurrency: 5,
    enrichVideoDuration: false,
    autoCleanCache: true,
    cacheSizeLimitMB: 1024,
    codeCacheLimitMB: 100,
  }
  const { t } = useTranslation()
  const [stats, setStats] = useState<DbStats | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [recentLogs, setRecentLogs] = useState('')
  const [logActionMessage, setLogActionMessage] = useState<string | null>(null)
  const [directoryActionMessage, setDirectoryActionMessage] = useState<
    string | null
  >(null)
  const [cacheClearing, setCacheClearing] = useState(false)

  const loadStats = useCallback(async () => {
    if (window.api?.data?.stats) {
      const s = await window.api.data.stats()
      setStats(s)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const handleCleanup = async () => {
    setCleaning(true)
    setCleanupResult(null)
    try {
      const result = await window.api.data.cleanup({
        entriesPerFeed: dataSettings.entriesPerFeed,
        maxEntryAgeDays: dataSettings.maxEntryAgeDays,
      })
      if (result.removed > 0) {
        setCleanupResult(
          t('settings.dataCleanupDone', { count: result.removed }),
        )
      } else {
        setCleanupResult(t('settings.dataCleanupNone'))
      }
      loadStats()
    } catch {
      setCleanupResult('Error')
    } finally {
      setCleaning(false)
    }
  }

  const handleLoadRecentLogs = async () => {
    if (!window.api?.app?.readRecentLogs) return
    setLogsLoading(true)
    setLogActionMessage(null)
    try {
      const result = await window.api.app.readRecentLogs(160)
      setRecentLogs(result.content || '')
    } finally {
      setLogsLoading(false)
    }
  }

  const handleCopyLogs = async () => {
    if (!recentLogs) return
    try {
      await navigator.clipboard.writeText(recentLogs)
      setLogActionMessage('日志已复制到剪贴板')
    } catch {
      setLogActionMessage('复制失败，请稍后重试')
    }
  }

  const handleExportLogs = () => {
    if (!recentLogs) return
    void (async () => {
      try {
        const result = await window.api.app.saveTextFile({
          content: recentLogs,
          defaultFileName: `livo-recent-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.log`,
          title: '导出最近日志',
          filters: [{ name: 'Log Files', extensions: ['log', 'txt'] }],
        })
        if (result.success) {
          setLogActionMessage('日志已导出')
        } else if (!result.canceled) {
          setLogActionMessage(result.error || '导出失败，请稍后重试')
        }
      } catch {
        setLogActionMessage('导出失败，请稍后重试')
      }
    })()
  }

  const handleExportDiagnostics = () => {
    void (async () => {
      setLogActionMessage(null)
      try {
        const [settings, latestStats] = await Promise.all([
          window.api.settings.get(),
          window.api.data.stats(),
        ])
        const bundle = {
          exportedAt: new Date().toISOString(),
          appVersion: await window.api.app.getVersion(),
          stats: latestStats,
          settings: {
            general: settings.general,
            data: settings.data,
            aggregator: settings.aggregator,
            translation: settings.translation,
          },
          recentLogs,
        }
        const result = await window.api.app.saveTextFile({
          content: JSON.stringify(bundle, null, 2),
          defaultFileName: `livo-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
          title: '导出诊断包',
          filters: [{ name: 'JSON Files', extensions: ['json'] }],
        })
        if (result.success) {
          setLogActionMessage('诊断包已导出')
        } else if (!result.canceled) {
          setLogActionMessage(result.error || '导出诊断包失败')
        }
      } catch {
        setLogActionMessage('导出诊断包失败，请稍后重试')
      }
    })()
  }

  const handleOpenDirectory = async (
    action: () => Promise<{ success: boolean; error?: string }>,
    successMessage: string,
  ) => {
    setDirectoryActionMessage(null)
    try {
      const result = await action()
      setDirectoryActionMessage(
        result.success ? successMessage : result.error || '打开目录失败',
      )
    } catch {
      setDirectoryActionMessage('打开目录失败，请稍后重试')
    }
  }

  const handleClearCache = async () => {
    if (!window.api?.app?.clearCache) return
    setCacheClearing(true)
    setDirectoryActionMessage(null)
    try {
      const result = await window.api.app.clearCache()
      if (result.success) {
        setDirectoryActionMessage(
          `缓存已清理，约释放 ${formatBytes(result.clearedBytes)}`,
        )
      } else {
        setDirectoryActionMessage(result.error || '缓存清理失败')
      }
      await loadStats()
    } finally {
      setCacheClearing(false)
    }
  }

  const updateData = (updates: Partial<typeof dataSettings>) => {
    void updateSettingsSection('data', updates)
  }

  return (
    <div className="space-y-6">
      {/* Database Stats */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 size={16} className="text-accent" />
          <h4 className="text-sm font-medium">{t('settings.dataStats')}</h4>
        </div>
        {stats ? (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-3">
              <StatCard
                label={t('settings.dataStatsFeeds')}
                value={stats.totalFeeds}
              />
              <StatCard
                label={t('settings.dataStatsEntries')}
                value={stats.totalEntries}
              />
              <StatCard
                label={t('settings.dataStatsRead')}
                value={stats.readEntries}
              />
              <StatCard
                label={t('settings.dataStatsStarred')}
                value={stats.starredEntries}
              />
            </div>
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
              {t('settings.dataStorageSize', { defaultValue: '数据文件大小' })}:{' '}
              <span className="text-text-primary font-medium dark:text-text-dark-primary">
                {formatBytes(stats.dataSizeBytes)}
              </span>
            </p>
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
              {t('settings.dataCacheSize')}:{' '}
              <span className="text-text-primary font-medium dark:text-text-dark-primary">
                {formatBytes(stats.cacheSizeBytes)}
              </span>
            </p>
          </div>
        ) : (
          <div className="text-xs text-text-secondary dark:text-text-dark-secondary">
            Loading...
          </div>
        )}
      </section>

      {/* Retention Settings */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Database size={16} className="text-accent" />
          <h4 className="text-sm font-medium">
            {t('settings.dataEntriesPerFeed')}
          </h4>
        </div>
        <p className="mb-2 text-xs text-text-secondary dark:text-text-dark-secondary">
          {t('settings.dataEntriesPerFeedDesc')}
        </p>
        <input
          type="number"
          min={0}
          step={1}
          value={dataSettings.entriesPerFeed}
          onChange={(e) =>
            updateData({
              entriesPerFeed: Math.max(0, Number(e.target.value) || 0),
            })
          }
          className="settings-select"
        />
        <div className="mt-1 text-xs text-text-tertiary">
          0 = {t('settings.dataUnlimited')}
        </div>
      </section>

      <section>
        <h4 className="mb-1 text-sm font-medium">
          {t('settings.dataMaxEntryAge')}
        </h4>
        <p className="mb-2 text-xs text-text-secondary dark:text-text-dark-secondary">
          {t('settings.dataMaxEntryAgeDesc')}
        </p>
        <input
          type="number"
          min={0}
          step={1}
          value={dataSettings.maxEntryAgeDays}
          onChange={(e) =>
            updateData({
              maxEntryAgeDays: Math.max(0, Number(e.target.value) || 0),
            })
          }
          className="settings-select"
        />
        <div className="mt-1 text-xs text-text-tertiary">
          0 = {t('settings.dataUnlimited')}
        </div>
      </section>

      <section>
        <div className="rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-xs text-text-secondary dark:text-text-dark-secondary">
          {t('settings.dataRetentionRule', {
            defaultValue:
              '清理规则：仅当条目同时超出“每源保留条数”和“保留天数”时才会删除。',
          })}
        </div>
      </section>

      {/* Refresh Settings */}
      <section>
        <h4 className="mb-1 text-sm font-medium">
          {t('settings.dataFreshnessTTL')}
        </h4>
        <p className="mb-2 text-xs text-text-secondary dark:text-text-dark-secondary">
          {t('settings.dataFreshnessTTLDesc')}
        </p>
        <select
          value={dataSettings.freshnessTTL}
          onChange={(e) => updateData({ freshnessTTL: Number(e.target.value) })}
          className="settings-select"
        >
          <option value={0}>{t('settings.dataUnlimited')}</option>
          <option value={5}>5 {t('settings.dataMinutes')}</option>
          <option value={10}>10 {t('settings.dataMinutes')}</option>
          <option value={15}>15 {t('settings.dataMinutes')}</option>
          <option value={30}>30 {t('settings.dataMinutes')}</option>
          <option value={60}>60 {t('settings.dataMinutes')}</option>
        </select>
      </section>

      <section>
        <h4 className="mb-1 text-sm font-medium">
          {t('settings.dataConcurrency')}
        </h4>
        <p className="mb-2 text-xs text-text-secondary dark:text-text-dark-secondary">
          {t('settings.dataConcurrencyDesc')}
        </p>
        <select
          value={dataSettings.refreshConcurrency}
          onChange={(e) =>
            updateData({ refreshConcurrency: Number(e.target.value) })
          }
          className="settings-select"
        >
          <option value={1}>1</option>
          <option value={3}>3</option>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
        </select>
      </section>

      <section>
        <h4 className="mb-1 text-sm font-medium">
          {t('settings.dataVideoDuration')}
        </h4>
        <p className="mb-2 text-xs text-text-secondary dark:text-text-dark-secondary">
          {t('settings.dataVideoDurationDesc')}
        </p>
        <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!dataSettings.enrichVideoDuration}
            onChange={(e) =>
              updateData({ enrichVideoDuration: e.target.checked })
            }
            className="rounded accent-accent"
          />
          {t('settings.dataVideoDurationEnabled')}
        </label>
      </section>

      <section>
        <h4 className="mb-1 text-sm font-medium">
          {t('settings.dataAutoCleanCache')}
        </h4>
        <p className="mb-2 text-xs text-text-secondary dark:text-text-dark-secondary">
          {t('settings.dataAutoCleanCacheDesc')}
        </p>
        <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!dataSettings.autoCleanCache}
            onChange={(e) => updateData({ autoCleanCache: e.target.checked })}
            className="rounded accent-accent"
          />
          {t('settings.dataAutoCleanCacheEnabled')}
        </label>
      </section>

      <section>
        <h4 className="mb-1 text-sm font-medium">
          {t('settings.dataCacheLimit')}
        </h4>
        <p className="mb-2 text-xs text-text-secondary dark:text-text-dark-secondary">
          {t('settings.dataCacheLimitDesc')}
        </p>
        <input
          type="number"
          min={0}
          step={128}
          value={dataSettings.cacheSizeLimitMB}
          onChange={(e) =>
            updateData({
              cacheSizeLimitMB: Math.max(0, Number(e.target.value) || 0),
            })
          }
          className="settings-select"
          disabled={!dataSettings.autoCleanCache}
        />
        <div className="mt-1 text-xs text-text-tertiary">
          0 = {t('settings.dataUnlimited')}
        </div>
      </section>

      <section>
        <h4 className="mb-1 text-sm font-medium">
          {t('settings.dataCodeCacheLimit')}
        </h4>
        <p className="mb-2 text-xs text-text-secondary dark:text-text-dark-secondary">
          {t('settings.dataCodeCacheLimitDesc')}
        </p>
        <input
          type="number"
          min={0}
          step={32}
          value={dataSettings.codeCacheLimitMB}
          onChange={(e) =>
            updateData({
              codeCacheLimitMB: Math.max(0, Number(e.target.value) || 0),
            })
          }
          className="settings-select"
          disabled={!dataSettings.autoCleanCache}
        />
        <div className="mt-1 text-xs text-text-tertiary">
          0 = {t('settings.dataUnlimited')}
        </div>
      </section>

      {/* Manual Cleanup */}
      <section>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCleanup}
            disabled={cleaning}
            className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-500/20 disabled:opacity-50 dark:text-red-400"
          >
            {cleaning ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {t('settings.dataCleanupNow')}
          </button>
          {cleanupResult && (
            <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
              {cleanupResult}
            </span>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderCog size={16} className="text-accent" />
          <h4 className="text-sm font-medium">目录与缓存</h4>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() =>
              void handleOpenDirectory(
                window.api.app.openDataDirectory,
                '已打开数据目录',
              )
            }
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
          >
            <FolderOpen size={14} />
            打开数据目录
          </button>
          <button
            onClick={() =>
              void handleOpenDirectory(
                window.api.app.openCacheDirectory,
                '已打开缓存目录',
              )
            }
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
          >
            <FolderOpen size={14} />
            打开缓存目录
          </button>
          <button
            onClick={() =>
              void handleOpenDirectory(
                window.api.app.openLogsDirectory,
                '已打开日志目录',
              )
            }
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
          >
            <FolderOpen size={14} />
            打开日志目录
          </button>
          <button
            onClick={handleClearCache}
            disabled={cacheClearing}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-secondary disabled:opacity-50 dark:hover:bg-surface-dark-tertiary"
          >
            {cacheClearing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <HardDriveDownload size={14} />
            )}
            清理缓存
          </button>
        </div>
        <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
          数据目录包含数据库、设置和日志；缓存目录主要是图片缓存和 Electron
          网络缓存。
        </p>
        {directoryActionMessage ? (
          <div className="text-xs text-text-secondary dark:text-text-dark-secondary">
            {directoryActionMessage}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-accent" />
          <h4 className="text-sm font-medium">最近日志</h4>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleLoadRecentLogs}
            disabled={logsLoading}
            className="flex items-center gap-2 rounded-lg bg-accent/10 px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
          >
            {logsLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileText size={14} />
            )}
            读取最近日志
          </button>
          <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
            显示主进程最近日志，便于排查刷新、窗口和渲染异常。
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyLogs}
            disabled={!recentLogs}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-secondary disabled:opacity-50 dark:hover:bg-surface-dark-tertiary"
          >
            复制日志
          </button>
          <button
            onClick={handleExportLogs}
            disabled={!recentLogs}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-secondary disabled:opacity-50 dark:hover:bg-surface-dark-tertiary"
          >
            导出日志
          </button>
          <button
            onClick={handleExportDiagnostics}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
          >
            导出诊断包
          </button>
          {logActionMessage && (
            <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
              {logActionMessage}
            </span>
          )}
        </div>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-secondary p-3 text-[11px] leading-5 text-text-secondary dark:bg-surface-dark-tertiary dark:text-text-dark-secondary">
          {recentLogs || '暂无日志，点击上方按钮加载。'}
        </pre>
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-secondary p-3 text-center dark:bg-surface-dark-tertiary">
      <div className="text-lg font-semibold">{value.toLocaleString()}</div>
      <div className="text-xs text-text-secondary dark:text-text-dark-secondary">
        {label}
      </div>
    </div>
  )
}
