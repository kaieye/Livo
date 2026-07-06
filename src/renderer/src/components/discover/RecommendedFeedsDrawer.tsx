import { useTranslation } from 'react-i18next'
import {
  X,
  Rss,
  ExternalLink,
  Check,
  Plus,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { openExternalUrlSafe } from '../../services/external-url'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CuratedFeedInfo {
  title: string
  url: string
  siteUrl: string
  description: string
  category: string
  language: string
  imageUrl?: string
}

export interface DiscoverCategory {
  id: string
  name: string
  nameEn: string
  icon: string
  description: string
}

interface RecommendedFeedsDrawerProps {
  isOpen: boolean
  onClose: () => void
  categories: DiscoverCategory[]
  selectedCategory: string | null
  onSelectCategory: (categoryId: string | null) => void
  feeds: CuratedFeedInfo[]
  isLoading: boolean
  isSubscribed: (url: string) => boolean
  isSubscribing: (url: string) => boolean
  onPreview: (feed: CuratedFeedInfo) => void
  onToggleSubscribe: (feed: CuratedFeedInfo) => void
}

// ── Component ────────────────────────────────────────────────────────────────

export function RecommendedFeedsDrawer({
  isOpen,
  onClose,
  categories,
  selectedCategory,
  onSelectCategory,
  feeds,
  isLoading,
  isSubscribed,
  isSubscribing,
  onPreview,
  onToggleSubscribe,
}: RecommendedFeedsDrawerProps) {
  const { t } = useTranslation()

  if (!isOpen) return null

  const activeCategoryLabel = selectedCategory
    ? categories.find((c) => c.id === selectedCategory)?.name
    : null

  return (
    <>
      {/* Overlay */}
      <div
        className="animate-in fade-in-0 fixed inset-0 z-40 bg-black/30 backdrop-blur-sm duration-200"
        onClick={onClose}
      />

      {/* Centered modal */}
      <div className="animate-in zoom-in-95 fade-in-0 fixed inset-0 z-50 flex items-center justify-center p-4 duration-200">
        <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl dark:border-white/10 dark:bg-[#1a1a1a]">
          {/* Header */}
          <div className="flex-shrink-0 border-b px-5 py-4 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <Sparkles size={18} className="text-accent" />
              <h2 className="flex-1 text-base font-semibold">
                {t('discover.featuredFeeds')}
                {activeCategoryLabel ? ` — ${activeCategoryLabel}` : ''}
              </h2>
              <button
                onClick={onClose}
                className="hover:bg-surface-secondary rounded-lg p-1.5 transition-colors dark:hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Category chips */}
          <div className="flex-shrink-0 border-b px-5 py-3 dark:border-white/10">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() =>
                    onSelectCategory(
                      selectedCategory === cat.id ? null : cat.id,
                    )
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-accent text-white'
                      : 'bg-surface-secondary text-text-secondary hover:bg-accent/10 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Feed list — scrollable */}
          <div className="overflow-y-auto px-5 py-3">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-[66px] animate-pulse rounded-xl border bg-white dark:border-white/10 dark:bg-white/5"
                  />
                ))}
              </div>
            ) : feeds.length === 0 ? (
              <p className="text-text-tertiary px-1 text-xs">
                {t('discover.noCategoryFeeds')}
              </p>
            ) : (
              <div className="space-y-2">
                {feeds.map((feed) => (
                  <CuratedFeedRow
                    key={feed.url}
                    feed={feed}
                    subscribed={isSubscribed(feed.url)}
                    subscribing={isSubscribing(feed.url)}
                    onPreview={() => onPreview(feed)}
                    onToggleSubscribe={() => onToggleSubscribe(feed)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Sub-component ────────────────────────────────────────────────────────────

export function CuratedFeedRow({
  feed,
  subscribed,
  subscribing,
  onPreview,
  onToggleSubscribe,
}: {
  feed: CuratedFeedInfo
  subscribed: boolean
  subscribing: boolean
  onPreview: () => void
  onToggleSubscribe: () => void
}) {
  const { t } = useTranslation()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPreview}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPreview()
        }
      }}
      className="hover:border-accent/30 hover:bg-surface-secondary/50 focus:ring-accent/50 group flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-3.5 transition-all duration-200 focus:outline-none focus:ring-2 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
    >
      <div className="bg-accent/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
        <Rss size={16} className="text-accent" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="block min-w-0 truncate text-sm font-medium">
            {feed.title}
          </span>
          <span className="bg-surface-secondary text-text-tertiary flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium dark:bg-white/10 dark:text-white/40">
            {feed.language === 'Chinese' ? '中' : 'EN'}
          </span>
        </div>
        {feed.description && (
          <p className="text-text-secondary mt-0.5 truncate text-xs dark:text-white/50">
            {feed.description}
          </p>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        <a
          href={feed.siteUrl || feed.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void openExternalUrlSafe(feed.siteUrl || feed.url)
          }}
          className="text-text-tertiary hover:bg-surface-secondary hover:text-text-secondary rounded-lg p-1.5 opacity-0 transition-colors focus:opacity-100 group-hover:opacity-100 dark:hover:bg-white/10"
          title={t('discover.viewSource')}
        >
          <ExternalLink size={14} />
        </a>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleSubscribe()
          }}
          disabled={subscribing}
          className={`group/btn flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ${
            subscribed
              ? 'bg-green-100 text-green-600 hover:bg-red-100 hover:text-red-600 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-red-900/30 dark:hover:text-red-400'
              : 'bg-accent hover:bg-accent-hover text-white active:scale-95'
          } disabled:cursor-default disabled:opacity-70`}
        >
          {subscribing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : subscribed ? (
            <>
              <Check size={12} className="group-hover/btn:hidden" />
              <X size={12} className="hidden group-hover/btn:block" />
              <span className="group-hover/btn:hidden">
                {t('common.subscribed')}
              </span>
              <span className="hidden group-hover/btn:block">
                {t('discover.unsubscribeAction')}
              </span>
            </>
          ) : (
            <>
              <Plus size={12} />
              <span>{t('common.subscribe')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
