import {
  CheckCheck,
  ChevronLeft,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
} from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { FeedViewType, type ViewDefinition } from '../../../../shared/types'

export const WideViewHeader = memo(function WideViewHeader({
  activeView,
  inlineBilibili,
  title,
  viewDef,
  filterMode,
  isRefreshing,
  refreshProgress,
  searchQuery,
  onBack,
  onRefresh,
  onToggleUnreadFilter,
  onMarkAllRead,
  onSearch,
  onSearchQueryChange,
  onSetFilterMode,
}: {
  activeView: FeedViewType | null
  inlineBilibili: boolean
  title: string
  viewDef: ViewDefinition | null
  filterMode: 'all' | 'unread'
  isRefreshing: boolean
  refreshProgress?: {
    completed: number
    total: number
    percent: number
    feedTitle?: string
  } | null
  searchQuery: string
  onBack: () => void
  onRefresh: () => void | Promise<void>
  onToggleUnreadFilter: () => void
  onMarkAllRead: () => void
  onSearch: (e: React.FormEvent) => void
  onSearchQueryChange: (value: string) => void
  onSetFilterMode: (mode: 'all' | 'unread') => void
}) {
  const { t } = useTranslation()

  return (
    <div
      className={`flex-shrink-0 border-b px-6 pb-2 pt-3 ${activeView === FeedViewType.SocialMedia || activeView === FeedViewType.Pictures ? '' : 'space-y-2.5'}`}
    >
      <div className="flex items-center justify-between">
        {inlineBilibili ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              className="inline-flex items-center gap-1.5 rounded-md border border-surface-tertiary bg-surface-secondary/70 px-3 py-1.5 text-base font-semibold hover:bg-surface-secondary dark:border-surface-dark-tertiary dark:bg-surface-dark-secondary/70 dark:hover:bg-surface-dark-secondary"
              onClick={onBack}
              title={t('common.back')}
            >
              <ChevronLeft size={16} />
              {t('common.back')}
            </button>
          </div>
        ) : (
          <h2 className="flex items-center gap-2 truncate text-lg font-bold leading-tight">
            {viewDef && <span className={viewDef.color}>{title}</span>}
            {!viewDef && title}
          </h2>
        )}
        {!inlineBilibili && (
          <div className="flex items-center gap-2 text-text-secondary dark:text-text-dark-secondary">
            <button
              onClick={() => void onRefresh()}
              disabled={isRefreshing}
              className="rounded-lg p-1.5 hover:bg-surface-secondary disabled:opacity-50 dark:hover:bg-surface-dark-secondary"
              title={t('common.refresh')}
            >
              <RefreshCw
                size={16}
                className={isRefreshing ? 'animate-spin' : ''}
              />
            </button>
            <button
              onClick={onToggleUnreadFilter}
              className={`rounded-lg p-1.5 transition-colors ${
                filterMode === 'unread'
                  ? 'bg-accent/10 text-accent'
                  : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary'
              }`}
              title={
                filterMode === 'unread'
                  ? t('common.all')
                  : t('entryList.unread')
              }
            >
              {filterMode === 'unread' ? (
                <Eye size={16} />
              ) : (
                <EyeOff size={16} />
              )}
            </button>
            <button
              onClick={onMarkAllRead}
              className="rounded-lg p-1.5 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              title={t('common.markAllRead')}
            >
              <CheckCheck size={16} />
            </button>
          </div>
        )}
      </div>

      {activeView !== FeedViewType.SocialMedia &&
        activeView !== FeedViewType.Pictures &&
        !inlineBilibili && (
          <div className="mt-2 flex items-center gap-3">
            <form onSubmit={onSearch} className="relative max-w-xs flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder={t('entryList.searchArticles')}
                className="w-full rounded-lg border bg-surface-secondary py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-surface-dark-secondary"
              />
            </form>

            <div className="flex gap-1 text-xs">
              <button
                onClick={() => onSetFilterMode('all')}
                className={`rounded-full px-3 py-1 transition-colors ${
                  filterMode === 'all'
                    ? 'bg-accent text-white'
                    : 'bg-surface-secondary hover:bg-surface-tertiary dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary'
                }`}
              >
                {t('common.all')}
              </button>
              <button
                onClick={() => onSetFilterMode('unread')}
                className={`rounded-full px-3 py-1 transition-colors ${
                  filterMode === 'unread'
                    ? 'bg-accent text-white'
                    : 'bg-surface-secondary hover:bg-surface-tertiary dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary'
                }`}
              >
                {t('entryList.unread')}
              </button>
            </div>

            {isRefreshing && refreshProgress && refreshProgress.total > 0 && (
              <div
                className="flex min-w-[220px] max-w-[360px] flex-1 items-center gap-2"
                title={refreshProgress.feedTitle || ''}
              >
                <span className="whitespace-nowrap text-[11px] text-text-tertiary">
                  {`Refreshing ${refreshProgress.completed}/${refreshProgress.total}`}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary">
                  <div
                    className="h-full bg-accent transition-[width] duration-200"
                    style={{
                      width: `${Math.max(0, Math.min(100, refreshProgress.percent))}%`,
                    }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-[11px] text-text-tertiary">
                  {`${refreshProgress.percent}%`}
                </span>
              </div>
            )}
          </div>
        )}
    </div>
  )
})
