import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Star,
  Trash2,
  ArrowUpDown,
  Filter,
  CheckSquare,
  Square,
  Loader2,
  Search,
  ChevronDown,
  X,
} from 'lucide-react'
import type { Entry, Feed } from '../../../../shared/types'

type SortKey = 'date-desc' | 'date-asc' | 'feed-asc' | 'feed-desc'
type DateFilter = 'all' | '7d' | '30d' | '90d'

function formatDate(ts: number): string {
  if (!ts) return '--'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function timeAgo(
  ts: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('settings.favoritesJustNow')
  if (minutes < 60) return t('settings.favoritesMinutesAgo', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('settings.favoritesHoursAgo', { n: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('settings.favoritesDaysAgo', { n: days })
  return formatDate(ts)
}

export function FavoritesPanel() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<Entry[]>([])
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('date-desc')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [feedFilter, setFeedFilter] = useState<string>('')
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [entryResult, feedList] = await Promise.all([
        window.api.entries.list({ starred: true, limit: 1000 }),
        window.api.feeds.list(),
      ])
      setEntries(entryResult.entries || [])
      setFeeds(feedList || [])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleStar = async (entryId: string) => {
    const result = await window.api.entries.toggleStar(entryId)
    if (result.success) {
      setEntries((prev) => prev.filter((e) => e.id !== entryId))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(entryId)
        return next
      })
    }
  }

  const handleBatchUnfavorite = async () => {
    if (selectedIds.size === 0) return
    setProcessing(true)
    setActionMsg(null)
    let removed = 0
    for (const id of selectedIds) {
      try {
        const result = await window.api.entries.toggleStar(id)
        if (result.success) removed++
      } catch {
        // continue
      }
    }
    setEntries((prev) => prev.filter((e) => !selectedIds.has(e.id)))
    setSelectedIds(new Set())
    setBatchMode(false)
    setActionMsg(t('settings.favoritesBatchUnfavorited', { count: removed }))
    setProcessing(false)
  }

  const feedMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const feed of feeds) {
      map.set(feed.id, feed.title)
    }
    return map
  }, [feeds])

  const feedList = useMemo(() => {
    const seen = new Set<string>()
    return feeds
      .filter((f) => {
        if (seen.has(f.title)) return false
        seen.add(f.title)
        return true
      })
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [feeds])

  const filteredAndSorted = useMemo(() => {
    let list = [...entries]

    // Date filter
    if (dateFilter !== 'all') {
      const cutoffMap: Record<DateFilter, number> = {
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000,
        all: 0,
      }
      const cutoff = Date.now() - cutoffMap[dateFilter]
      list = list.filter((e) => e.publishedAt >= cutoff)
    }

    // Feed filter
    if (feedFilter) {
      list = list.filter((e) => e.feedId === feedFilter)
    }

    // Sort
    list.sort((a, b) => {
      switch (sortKey) {
        case 'date-asc':
          return a.publishedAt - b.publishedAt
        case 'feed-asc': {
          const ta = feedMap.get(a.feedId) || ''
          const tb = feedMap.get(b.feedId) || ''
          return ta.localeCompare(tb) || b.publishedAt - a.publishedAt
        }
        case 'feed-desc': {
          const ta = feedMap.get(a.feedId) || ''
          const tb = feedMap.get(b.feedId) || ''
          return tb.localeCompare(ta) || b.publishedAt - a.publishedAt
        }
        case 'date-desc':
        default:
          return b.publishedAt - a.publishedAt
      }
    })

    return list
  }, [entries, sortKey, dateFilter, feedFilter, feedMap])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSorted.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredAndSorted.map((e) => e.id)))
    }
  }

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: 'date-desc', label: t('settings.favoritesSortNewest') },
    { value: 'date-asc', label: t('settings.favoritesSortOldest') },
    { value: 'feed-asc', label: t('settings.favoritesSortFeedAZ') },
    { value: 'feed-desc', label: t('settings.favoritesSortFeedZA') },
  ]

  const dateFilterOptions: { value: DateFilter; label: string }[] = [
    { value: 'all', label: t('settings.favoritesFilterAll') },
    { value: '7d', label: t('settings.favoritesFilter7d') },
    { value: '30d', label: t('settings.favoritesFilter30d') },
    { value: '90d', label: t('settings.favoritesFilter90d') },
  ]

  const handleOpenArticle = useCallback(
    async (entryId: string) => {
      const { useEntryStore } = await import('../../store/entry-store')
      const entry = entries.find((e) => e.id === entryId)
      if (entry) {
        useEntryStore.getState().selectEntry(entry)
      }
    },
    [entries],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Star size={16} className="fill-yellow-500 text-yellow-500" />
          <h4 className="text-sm font-medium">
            {t('settings.favoritesTitle')}
          </h4>
        </div>
        <p className="text-text-secondary dark:text-text-dark-secondary text-xs">
          {t('settings.favoritesDesc', { count: entries.length })}
        </p>
      </section>

      {/* Toolbar */}
      {!isLoading && entries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort */}
          <div className="relative">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="border-border bg-surface dark:bg-surface-dark-secondary appearance-none rounded-lg border px-3 py-1.5 pr-7 text-sm"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ArrowUpDown
              size={12}
              className="text-text-secondary pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
              showFilters || feedFilter || dateFilter !== 'all'
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border hover:bg-surface-secondary dark:border-surface-dark-tertiary dark:hover:bg-surface-dark-tertiary'
            }`}
          >
            <Filter size={14} />
            {t('settings.favoritesFilter')}
            <ChevronDown size={12} />
          </button>

          {/* Batch mode toggle */}
          <button
            onClick={() => {
              setBatchMode(!batchMode)
              setSelectedIds(new Set())
            }}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
              batchMode
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border hover:bg-surface-secondary dark:border-surface-dark-tertiary dark:hover:bg-surface-dark-tertiary'
            }`}
          >
            <CheckSquare size={14} />
            {batchMode
              ? t('settings.favoritesExitBatch')
              : t('settings.favoritesBatchMode')}
          </button>

          {/* Batch unfavorite */}
          {batchMode && selectedIds.size > 0 && (
            <button
              onClick={handleBatchUnfavorite}
              disabled={processing}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-500/20 disabled:opacity-50 dark:text-red-400"
            >
              {processing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              {t('settings.favoritesUnfavoriteSelected', {
                count: selectedIds.size,
              })}
            </button>
          )}

          {/* Select all in batch mode */}
          {batchMode && (
            <button
              onClick={toggleSelectAll}
              className="border-border hover:bg-surface-secondary dark:border-surface-dark-tertiary dark:hover:bg-surface-dark-tertiary rounded-lg border px-3 py-1.5 text-sm"
            >
              {selectedIds.size === filteredAndSorted.length
                ? t('settings.favoritesDeselectAll')
                : t('settings.favoritesSelectAll')}
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={loadData}
            className="border-border hover:bg-surface-secondary dark:border-surface-dark-tertiary dark:hover:bg-surface-dark-tertiary ml-auto rounded-lg border px-3 py-1.5 text-sm"
          >
            {t('settings.refreshLogsRefresh')}
          </button>

          {actionMsg && (
            <span className="text-text-secondary text-xs">{actionMsg}</span>
          )}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="border-border bg-surface-secondary dark:bg-surface-dark-tertiary flex flex-wrap items-center gap-3 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <span className="text-text-secondary text-xs">
              {t('settings.dataMaxEntryAgeDesc')}:
            </span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="border-border bg-surface dark:bg-surface-dark-secondary rounded border px-2 py-1 text-xs"
            >
              {dateFilterOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-secondary text-xs">
              {t('settings.favoritesFilterByFeed')}:
            </span>
            <select
              value={feedFilter}
              onChange={(e) => setFeedFilter(e.target.value)}
              className="border-border bg-surface dark:bg-surface-dark-secondary max-w-[200px] rounded border px-2 py-1 text-xs"
            >
              <option value="">{t('settings.favoritesAllFeeds')}</option>
              {feedList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
            {feedFilter && (
              <button
                onClick={() => setFeedFilter('')}
                className="hover:bg-surface-secondary rounded p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="text-text-secondary dark:text-text-dark-secondary flex min-h-[120px] items-center justify-center text-sm">
          <Loader2 size={18} className="mr-2 animate-spin" />
          {t('settings.favoritesLoading')}
        </div>
      ) : entries.length === 0 ? (
        <div className="border-border bg-surface-secondary dark:bg-surface-dark-tertiary rounded-lg border p-8 text-center">
          <Star
            size={36}
            className="dark:text-text-dark-tertiary text-text-tertiary mx-auto mb-3"
          />
          <p className="text-text-primary dark:text-text-dark-primary text-sm font-medium">
            {t('settings.favoritesEmpty')}
          </p>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-1 text-xs">
            {t('settings.favoritesEmptyHint')}
          </p>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="border-border bg-surface-secondary dark:bg-surface-dark-tertiary rounded-lg border p-6 text-center">
          <Search
            size={28}
            className="dark:text-text-dark-tertiary text-text-tertiary mx-auto mb-2"
          />
          <p className="text-text-secondary text-sm">
            {t('settings.favoritesNoMatch')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAndSorted.map((entry) => (
            <div
              key={entry.id}
              className={`bg-surface hover:bg-surface-secondary dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary group rounded-lg border p-3 transition-colors ${
                selectedIds.has(entry.id)
                  ? 'border-accent bg-accent/5'
                  : 'border-border dark:border-surface-dark-tertiary'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox in batch mode */}
                {batchMode && (
                  <button
                    onClick={() => toggleSelect(entry.id)}
                    className="text-text-secondary hover:text-accent mt-0.5 flex-shrink-0"
                  >
                    {selectedIds.has(entry.id) ? (
                      <CheckSquare size={18} className="text-accent" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                )}

                {/* Content */}
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => {
                    if (!batchMode) handleOpenArticle(entry.id)
                  }}
                >
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <span className="text-accent truncate font-medium">
                      {feedMap.get(entry.feedId) || entry.feedId}
                    </span>
                    <span className="text-text-muted">·</span>
                    <span className="text-text-secondary whitespace-nowrap">
                      {timeAgo(entry.publishedAt, t)}
                    </span>
                    <span className="text-text-muted whitespace-nowrap">
                      {formatDate(entry.publishedAt)}
                    </span>
                  </div>
                  <p className="text-text-primary dark:text-text-dark-primary line-clamp-2 text-sm font-medium">
                    {entry.title}
                  </p>
                  {entry.summary && (
                    <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 line-clamp-2 text-xs">
                      {entry.summary}
                    </p>
                  )}
                </div>

                {/* Unfavorite button */}
                {!batchMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleStar(entry.id)
                    }}
                    className="flex-shrink-0 rounded p-1.5 text-yellow-500 opacity-0 transition-opacity hover:bg-yellow-500/10 group-hover:opacity-100"
                    title={t('settings.favoritesUnfavorite')}
                  >
                    <Star size={16} className="fill-current" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {entries.length > 0 && (
        <p className="dark:text-text-dark-tertiary text-text-tertiary text-xs">
          {filteredAndSorted.length !== entries.length
            ? t('settings.favoritesShowingFiltered', {
                shown: filteredAndSorted.length,
                total: entries.length,
              })
            : t('settings.favoritesShowingAll', { total: entries.length })}
        </p>
      )}
    </div>
  )
}
