import { useTranslation } from 'react-i18next'
import { RefreshCw, CheckCheck } from 'lucide-react'
import { HomeInlineSearch } from '../HomeInlineSearch'
import type { Entry } from '../../../../../shared/types'

export interface EntryListHeaderProps {
  displayTitle: string
  viewColor?: string
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onSearchSubmit: (e: React.FormEvent) => void
  entries: Entry[]
  feedTitleFor: (entry: Entry) => string
  onSelectEntry: (entry: Entry) => void
  filterMode: 'all' | 'unread'
  onFilterModeChange: (mode: 'all' | 'unread') => void
  isRefreshing: boolean
  onRefresh: () => void
  onMarkAllRead: () => void
  refreshProgress?: {
    completed: number
    total: number
    percent: number
    feedTitle?: string
  } | null
}

export function EntryListHeader({
  displayTitle,
  viewColor,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  entries,
  feedTitleFor,
  onSelectEntry,
  filterMode,
  onFilterModeChange,
  isRefreshing,
  onRefresh,
  onMarkAllRead,
  refreshProgress,
}: EntryListHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className="flex-shrink-0 space-y-2.5 px-4 pb-2 pt-3">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 truncate text-base font-semibold">
          {viewColor ? (
            <span className={viewColor}>{displayTitle}</span>
          ) : (
            displayTitle
          )}
        </h2>
      </div>

      {/* Search */}
      <HomeInlineSearch
        query={searchQuery}
        onQueryChange={onSearchQueryChange}
        onSubmit={onSearchSubmit}
        entries={entries}
        feedTitleFor={feedTitleFor}
        onSelectEntry={onSelectEntry}
        placeholder={t('entryList.searchArticles')}
      />

      {/* Filter tabs */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 gap-1 text-xs">
          <button
            onClick={() => onFilterModeChange('all')}
            className={`rounded-full px-3 py-1 transition-colors ${
              filterMode === 'all'
                ? 'bg-accent text-white'
                : 'bg-surface-secondary hover:bg-surface-tertiary dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary'
            }`}
          >
            {t('common.all')}
          </button>
          <button
            onClick={() => onFilterModeChange('unread')}
            className={`rounded-full px-3 py-1 transition-colors ${
              filterMode === 'unread'
                ? 'bg-accent text-white'
                : 'bg-surface-secondary hover:bg-surface-tertiary dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary'
            }`}
          >
            {t('entryList.unread')}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary rounded-lg p-1.5 disabled:opacity-50"
            title={t('common.refresh')}
          >
            <RefreshCw
              size={16}
              className={`text-text-secondary dark:text-text-dark-secondary ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={onMarkAllRead}
            className="hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary rounded-lg p-1.5"
            title={t('common.markAllRead')}
          >
            <CheckCheck
              size={16}
              className="text-text-secondary dark:text-text-dark-secondary"
            />
          </button>
        </div>
      </div>

      {/* Refresh progress */}
      {isRefreshing && refreshProgress && refreshProgress.total > 0 && (
        <div className="space-y-1">
          <div className="text-text-tertiary flex items-center justify-between text-[11px]">
            <span>{`Refreshing ${refreshProgress.completed}/${refreshProgress.total}`}</span>
            <span>{`${refreshProgress.percent}%`}</span>
          </div>
          <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-accent h-full transition-[width] duration-200"
              style={{
                width: `${Math.max(0, Math.min(100, refreshProgress.percent))}%`,
              }}
            />
          </div>
          {refreshProgress.feedTitle && (
            <div className="text-text-tertiary truncate text-[11px]">
              {refreshProgress.feedTitle}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
