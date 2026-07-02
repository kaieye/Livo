import { useTranslation } from 'react-i18next'
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import { ViewRecommendations } from '../ViewRecommendations'
import type { FeedViewType } from '../../../../../shared/types'

interface EntryListEmptyProps {
  selectedFeedId: string | null
  activeView: FeedViewType | null
  isRefreshing: boolean
  onRefresh: () => void
  lastRefreshError?: string | null
}

/**
 * Empty state display for EntryList
 * Shows different messages based on context (specific feed, view, or global empty)
 */
export function EntryListEmpty({
  selectedFeedId,
  activeView,
  isRefreshing,
  onRefresh,
  lastRefreshError,
}: EntryListEmptyProps) {
  const { t } = useTranslation()

  // Specific feed selected but empty - offer refresh
  if (selectedFeedId && selectedFeedId !== 'starred') {
    return (
      <div className="text-text-secondary dark:text-text-dark-secondary flex flex-col items-center justify-center py-12">
        {lastRefreshError ? (
          <AlertCircle size={40} className="mb-3 text-red-400" />
        ) : (
          <Inbox size={40} className="text-text-tertiary mb-3" />
        )}
        <p className="text-sm">
          {lastRefreshError || t('entryList.noArticles')}
        </p>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="bg-accent hover:bg-accent/90 mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? t('common.refreshing') : t('common.refresh')}
        </button>
      </div>
    )
  }

  // Active view with no entries - show view-specific recommendations
  if (activeView !== null) {
    return <ViewRecommendations viewType={activeView} />
  }

  // Global empty state - prompt to add feeds
  return (
    <div className="text-text-secondary dark:text-text-dark-secondary flex flex-col items-center justify-center py-12">
      <Inbox size={40} className="text-text-tertiary mb-3" />
      <p className="text-sm">{t('entryList.noArticles')}</p>
      <p className="mt-1 text-xs">{t('entryList.addFeedToStart')}</p>
    </div>
  )
}
