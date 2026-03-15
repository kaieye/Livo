import { useSettingsStore } from "../../store/settings-store"
import { useTranslation } from "react-i18next"
import { useState, useEffect, useCallback } from "react"
import { Database, Trash2, BarChart3, Loader2 } from "lucide-react"

interface DbStats {
  totalFeeds: number
  totalEntries: number
  readEntries: number
  starredEntries: number
  cacheSizeBytes: number
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let idx = 0
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024
    idx++
  }
  return `${size >= 10 || idx === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[idx]}`
}

export function DataSettings() {
  const { settings, updateSettings } = useSettingsStore()
  const dataSettings = settings.data ?? {
    entriesPerFeed: 128,
    maxEntryAgeDays: 90,
    freshnessTTL: 10,
    refreshConcurrency: 5,
    enrichVideoDuration: false,
  }
  const { t } = useTranslation()
  const [stats, setStats] = useState<DbStats | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)

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
        setCleanupResult(t("settings.dataCleanupDone", { count: result.removed }))
      } else {
        setCleanupResult(t("settings.dataCleanupNone"))
      }
      loadStats()
    } catch {
      setCleanupResult("Error")
    } finally {
      setCleaning(false)
    }
  }

  const updateData = (updates: Partial<typeof dataSettings>) => {
    updateSettings({ data: { ...dataSettings, ...updates } })
  }

  return (
    <div className="space-y-6">
      {/* Database Stats */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-accent" />
          <h4 className="font-medium text-sm">{t("settings.dataStats")}</h4>
        </div>
        {stats ? (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-3">
            <StatCard label={t("settings.dataStatsFeeds")} value={stats.totalFeeds} />
            <StatCard label={t("settings.dataStatsEntries")} value={stats.totalEntries} />
            <StatCard label={t("settings.dataStatsRead")} value={stats.readEntries} />
            <StatCard label={t("settings.dataStatsStarred")} value={stats.starredEntries} />
            </div>
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
              {t("settings.dataCacheSize")}: <span className="font-medium text-text-primary dark:text-text-dark-primary">{formatBytes(stats.cacheSizeBytes)}</span>
            </p>
          </div>
        ) : (
          <div className="text-text-secondary dark:text-text-dark-secondary text-xs">Loading...</div>
        )}
      </section>

      {/* Retention Settings */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Database size={16} className="text-accent" />
          <h4 className="font-medium text-sm">{t("settings.dataEntriesPerFeed")}</h4>
        </div>
        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mb-2">
          {t("settings.dataEntriesPerFeedDesc")}
        </p>
        <input
          type="number"
          min={0}
          step={1}
          value={dataSettings.entriesPerFeed}
          onChange={(e) => updateData({ entriesPerFeed: Math.max(0, Number(e.target.value) || 0) })}
          className="settings-select"
        />
        <div className="text-xs text-text-tertiary mt-1">
          0 = {t("settings.dataUnlimited")}
        </div>
      </section>

      <section>
        <h4 className="font-medium text-sm mb-1">{t("settings.dataMaxEntryAge")}</h4>
        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mb-2">
          {t("settings.dataMaxEntryAgeDesc")}
        </p>
        <input
          type="number"
          min={0}
          step={1}
          value={dataSettings.maxEntryAgeDays}
          onChange={(e) => updateData({ maxEntryAgeDays: Math.max(0, Number(e.target.value) || 0) })}
          className="settings-select"
        />
        <div className="text-xs text-text-tertiary mt-1">
          0 = {t("settings.dataUnlimited")}
        </div>
      </section>

      <section>
        <div className="rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-xs text-text-secondary dark:text-text-dark-secondary">
          {t("settings.dataRetentionRule", {
            defaultValue: "清理规则：仅当条目同时超出“每源保留条数”和“保留天数”时才会删除。",
          })}
        </div>
      </section>

      {/* Refresh Settings */}
      <section>
        <h4 className="font-medium text-sm mb-1">{t("settings.dataFreshnessTTL")}</h4>
        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mb-2">
          {t("settings.dataFreshnessTTLDesc")}
        </p>
        <select
          value={dataSettings.freshnessTTL}
          onChange={(e) => updateData({ freshnessTTL: Number(e.target.value) })}
          className="settings-select"
        >
          <option value={0}>{t("settings.dataUnlimited")}</option>
          <option value={5}>5 {t("settings.dataMinutes")}</option>
          <option value={10}>10 {t("settings.dataMinutes")}</option>
          <option value={15}>15 {t("settings.dataMinutes")}</option>
          <option value={30}>30 {t("settings.dataMinutes")}</option>
          <option value={60}>60 {t("settings.dataMinutes")}</option>
        </select>
      </section>

      <section>
        <h4 className="font-medium text-sm mb-1">{t("settings.dataConcurrency")}</h4>
        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mb-2">
          {t("settings.dataConcurrencyDesc")}
        </p>
        <select
          value={dataSettings.refreshConcurrency}
          onChange={(e) => updateData({ refreshConcurrency: Number(e.target.value) })}
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
        <h4 className="font-medium text-sm mb-1">{t("settings.dataVideoDuration")}</h4>
        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mb-2">
          {t("settings.dataVideoDurationDesc")}
        </p>
        <label className="inline-flex items-center gap-2 text-sm select-none cursor-pointer">
          <input
            type="checkbox"
            checked={!!dataSettings.enrichVideoDuration}
            onChange={(e) => updateData({ enrichVideoDuration: e.target.checked })}
            className="rounded accent-accent"
          />
          {t("settings.dataVideoDurationEnabled")}
        </label>
      </section>

      {/* Manual Cleanup */}
      <section>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCleanup}
            disabled={cleaning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 text-sm"
          >
            {cleaning ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {t("settings.dataCleanupNow")}
          </button>
          {cleanupResult && (
            <span className="text-xs text-text-secondary dark:text-text-dark-secondary">{cleanupResult}</span>
          )}
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-secondary dark:bg-surface-dark-tertiary rounded-lg p-3 text-center">
      <div className="text-lg font-semibold">{value.toLocaleString()}</div>
      <div className="text-xs text-text-secondary dark:text-text-dark-secondary">{label}</div>
    </div>
  )
}
