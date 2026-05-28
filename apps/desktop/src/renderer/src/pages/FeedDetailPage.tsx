import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Edit3,
  ExternalLink,
  Globe,
  RefreshCw,
  Rss,
  Trash2,
} from 'lucide-react'

import { useFeedStore } from '../store/feed-store'
import { useEntryStore } from '../store/entry-store'
import { FeedViewType } from '../../../shared/types'
import type { Entry, FeedWithCount } from '../../../shared/types'
import { ROUTES } from '../router/route-paths'
import { isUserFeed } from '../lib/feed-filters'
import { VIEW_TYPE_I18N_KEYS } from '../lib/view-type-keys'
import { FeedAvatar } from '../components/feed/FeedAvatar'

/**
 * FeedDetailPage — desktop counterpart of the Harmony `FeedDetail` page.
 *
 * Responsibilities:
 * - Hero area: avatar, title, description, view-type / unread / category badges,
 *   raw feed URL.
 * - Action bar: back, refresh (with spinner), open site, edit, unsubscribe.
 * - Article preview list for the feed's recent entries.
 * - Preview mode for feeds that are not part of the user's own subscriptions
 *   (`!isUserFeed`) — the unsubscribe / edit actions are hidden and a
 *   "Subscribe" CTA is shown instead.
 *
 * Entry click contract: navigates to `/entry/:entryId` (handled by
 * `ArticleDetailPage`). The home Layout's selectedEntry reset effect is no
 * longer a concern because the dedicated route owns its own
 * `selectEntry` lifecycle.
 *
 * Data freshness: we drive entries from the live `useEntryStore` selector
 * (filtered by `feedId`) rather than mirroring into local state. This keeps
 * the page consistent with star/read mutations from other components.
 */
export default function FeedDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { feedId } = useParams<{ feedId: string }>()

  const feeds = useFeedStore((s) => s.feeds)
  const refreshFeed = useFeedStore((s) => s.refreshFeed)
  const removeFeed = useFeedStore((s) => s.removeFeed)

  const storeEntries = useEntryStore((s) => s.entries)
  const isEntriesLoading = useEntryStore((s) => s.isLoading)
  const loadEntries = useEntryStore((s) => s.loadEntries)

  const [isRefreshing, setIsRefreshing] = useState(false)

  const feed: FeedWithCount | null = useMemo(
    () => (feedId ? (feeds.find((f) => f.id === feedId) ?? null) : null),
    [feeds, feedId],
  )

  // Filter store entries down to those that belong to this feed. The entry
  // store is process-wide and can hold entries from a different feed if the
  // user navigated quickly; filtering by `feedId` makes the page resilient to
  // those races without forcing a duplicate copy of the data.
  const entries = useMemo(
    () => (feedId ? storeEntries.filter((e) => e.feedId === feedId) : []),
    [storeEntries, feedId],
  )

  const isSubscribed = feed !== null && isUserFeed(feed)

  // Load entries when the feedId changes.
  useEffect(() => {
    if (!feedId) return
    void loadEntries({ feedId, limit: 50 })
  }, [feedId, loadEntries])

  const handleBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  const handleRefresh = useCallback(async () => {
    if (!feed || isRefreshing) return
    setIsRefreshing(true)
    try {
      await refreshFeed(feed.id)
      // refreshFeed already calls reloadEntriesForCurrentScope, but that uses
      // the home view's selectedFeedId/activeView — not necessarily this page.
      // Re-load explicitly so the preview list always reflects the refresh.
      await loadEntries({ feedId: feed.id, limit: 50 })
    } finally {
      setIsRefreshing(false)
    }
  }, [feed, isRefreshing, refreshFeed, loadEntries])

  const handleUnsubscribe = useCallback(async () => {
    if (!feed) return
    const confirmed = window.confirm(
      t('feedDetail.unsubscribeConfirm', {
        title: feed.title || feed.url,
      }),
    )
    if (!confirmed) return
    await removeFeed(feed.id)
    navigate(ROUTES.subscriptions)
  }, [feed, removeFeed, navigate, t])

  const handleSubscribe = useCallback(() => {
    if (!feed) return
    navigate(
      ROUTES.discoverSubscribe({
        feedId: feed.id,
        url: feed.url,
        title: feed.title,
        siteUrl: feed.siteUrl,
        imageUrl: feed.imageUrl,
        description: feed.description,
        category: feed.folder || feed.category,
        view: feed.view ?? FeedViewType.Articles,
      }),
    )
  }, [feed, navigate])

  const handleEdit = useCallback(() => {
    if (!feed) return
    navigate(
      ROUTES.discoverSubscribe({
        feedId: feed.id,
        url: feed.url,
        title: feed.title,
        siteUrl: feed.siteUrl,
        imageUrl: feed.imageUrl,
        description: feed.description,
        category: feed.folder || feed.category,
        view: feed.view ?? FeedViewType.Articles,
      }),
    )
  }, [feed, navigate])

  const handleEntryClick = useCallback(
    (entry: Entry) => {
      navigate(ROUTES.entry(entry.id))
    },
    [navigate],
  )

  // Reuse the shared `VIEW_TYPE_I18N_KEYS` mapping (also used by Sidebar /
  // DiscoverPanel / FeedsSettings) — single source of truth for the four view
  // labels. See `lib/view-type-keys.ts`.
  const viewLabel = useMemo(() => {
    if (!feed) return ''
    const view = feed.view ?? FeedViewType.Articles
    return t(VIEW_TYPE_I18N_KEYS[view] || 'viewTypes.articles')
  }, [feed, t])

  const unreadLabel = useMemo(() => {
    const count = feed?.unreadCount ?? 0
    return t('feedDetail.meta.unread', { count })
  }, [feed, t])

  const title = feed
    ? feed.title || t('feedDetail.pageTitle')
    : t('feedDetail.pageTitle')

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[var(--color-bg-primary)]">
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-[var(--color-border-secondary)] px-6 py-3">
        <button
          type="button"
          onClick={handleBack}
          aria-label={t('feedDetail.back')}
          title={t('feedDetail.back')}
          className="rounded-md p-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-[var(--color-text-primary)]">
            {title}
          </h1>
        </div>
        {feed && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label={
                isRefreshing
                  ? t('feedDetail.refreshing')
                  : t('feedDetail.refresh')
              }
              title={
                isRefreshing
                  ? t('feedDetail.refreshing')
                  : t('feedDetail.refresh')
              }
              className="rounded-md p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
            >
              <RefreshCw
                size={16}
                className={isRefreshing ? 'animate-spin' : ''}
                aria-hidden="true"
              />
            </button>
            {feed.siteUrl && (
              <a
                href={feed.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('feedDetail.openSite')}
                title={t('feedDetail.openSite')}
                className="rounded-md p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            )}
            {isSubscribed ? (
              <>
                <button
                  type="button"
                  onClick={handleEdit}
                  aria-label={t('feedDetail.edit')}
                  title={t('feedDetail.edit')}
                  className="rounded-md p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  <Edit3 size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleUnsubscribe}
                  aria-label={t('feedDetail.unsubscribe')}
                  title={t('feedDetail.unsubscribe')}
                  className="rounded-md p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:hover:bg-red-950"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSubscribe}
                className="ml-1 inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                {t('feedDetail.subscribe')}
              </button>
            )}
          </div>
        )}
      </header>

      <main className="flex flex-1 flex-col overflow-hidden">
        {!feed ? (
          // Either feedId is missing or the feed is unknown to the local store.
          <div className="flex flex-1 items-center justify-center">
            <div className="px-6 text-center">
              <Rss
                size={48}
                aria-hidden="true"
                className="mx-auto mb-4 text-[var(--color-text-tertiary)] opacity-40"
              />
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t('feedDetail.notFound')}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                {t('feedDetail.notFoundHint')}
              </p>
              <button
                type="button"
                onClick={handleBack}
                className="mt-4 text-sm text-[var(--color-accent)] hover:underline"
              >
                {t('feedDetail.back')}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Hero */}
            <section className="bg-[var(--color-bg-secondary)]/50 flex-shrink-0 border-b border-[var(--color-border-secondary)] px-6 py-5">
              <div className="flex items-start gap-4">
                <FeedAvatar
                  imageUrl={feed.imageUrl}
                  size="lg"
                  className="shadow-sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-semibold leading-snug text-[var(--color-text-primary)]">
                      {feed.title || feed.url}
                    </h2>
                    {!isSubscribed && (
                      <span className="inline-flex items-center rounded-md bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                        {t('feedDetail.previewBadge')}
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                      {viewLabel}
                    </span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      {unreadLabel}
                    </span>
                    {feed.category && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                        {feed.category}
                      </span>
                    )}
                  </div>

                  {feed.description && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--color-text-tertiary)]">
                      {feed.description}
                    </p>
                  )}

                  <div className="mt-2 flex min-w-0 items-center gap-1.5">
                    <Globe
                      size={12}
                      aria-hidden="true"
                      className="flex-shrink-0 text-[var(--color-text-tertiary)]"
                    />
                    <span className="truncate text-xs text-[var(--color-text-tertiary)]">
                      {feed.url || feed.siteUrl || ''}
                    </span>
                  </div>

                  {!isSubscribed && (
                    <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
                      {t('feedDetail.previewHint')}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Entry list */}
            <div className="flex-1 overflow-y-auto">
              <EntryPreviewList
                entries={entries}
                isLoading={isEntriesLoading}
                onSelect={handleEntryClick}
                emptyTitle={t('feedDetail.noEntries')}
                emptyHint={t('feedDetail.noEntriesHint')}
                loadingLabel={t('feedDetail.loadingEntries')}
              />
            </div>
          </>
        )}
      </main>
    </div>
  )
}

/* ----------------------------- Sub-components ----------------------------- */

interface EntryPreviewListProps {
  entries: Entry[]
  isLoading: boolean
  onSelect: (entry: Entry) => void
  emptyTitle: string
  emptyHint: string
  loadingLabel: string
}

function EntryPreviewList({
  entries,
  isLoading,
  onSelect,
  emptyTitle,
  emptyHint,
  loadingLabel,
}: EntryPreviewListProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <Rss
          size={40}
          aria-hidden="true"
          className="mb-3 text-[var(--color-text-tertiary)] opacity-30"
        />
        <p className="text-sm text-[var(--color-text-secondary)]">
          {isLoading ? loadingLabel : emptyTitle}
        </p>
        {!isLoading && (
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            {emptyHint}
          </p>
        )}
      </div>
    )
  }

  return (
    <ul className="divide-y divide-[var(--color-border-secondary)]">
      {entries.map((entry) => (
        <li key={entry.id}>
          <ArticlePreviewRow entry={entry} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  )
}

interface ArticlePreviewRowProps {
  entry: Entry
  onSelect: (entry: Entry) => void
}

function ArticlePreviewRow({ entry, onSelect }: ArticlePreviewRowProps) {
  const { t } = useTranslation()
  const [thumbErrored, setThumbErrored] = useState(false)

  const timeLabel = useMemo(() => {
    if (!entry.publishedAt) return ''
    const diffMs = Date.now() - entry.publishedAt
    const diffH = Math.floor(diffMs / 3_600_000)
    if (diffH < 1) {
      const diffMin = Math.max(1, Math.floor(diffMs / 60_000))
      return t('time.minutesAgo', { minutes: diffMin })
    }
    if (diffH < 24) return t('time.hoursAgo', { hours: diffH })
    const diffD = Math.floor(diffH / 24)
    if (diffD < 30) return t('time.daysAgo', { days: diffD })
    return new Date(entry.publishedAt).toLocaleDateString()
  }, [entry.publishedAt, t])

  const summary = useMemo(() => {
    const raw = entry.summary || entry.content || ''
    // Drop simple tags so the preview is plain text. Full sanitisation lives
    // in ArticleDetail / EntryContent.
    const text = raw.replace(/<[^>]*>/g, '').trim()
    return text.length > 120 ? `${text.slice(0, 120)}...` : text
  }, [entry.summary, entry.content])

  const thumbnail =
    entry.imageUrl ||
    entry.media?.[0]?.previewUrl ||
    entry.media?.[0]?.url ||
    ''

  const handleClick = () => onSelect(entry)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(entry)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="flex w-full items-start gap-3 px-6 py-3 text-left transition-colors hover:bg-[var(--color-bg-secondary)]"
    >
      {thumbnail && !thumbErrored ? (
        <img
          src={thumbnail}
          alt=""
          loading="lazy"
          onError={() => setThumbErrored(true)}
          className="h-12 w-12 flex-shrink-0 rounded-lg bg-[var(--color-bg-tertiary)] object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)]"
        >
          <Rss size={14} className="text-[var(--color-text-tertiary)]" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h3
          className={[
            'line-clamp-2 text-sm font-medium leading-snug',
            entry.isRead
              ? 'text-[var(--color-text-secondary)]'
              : 'text-[var(--color-text-primary)]',
          ].join(' ')}
        >
          {/* Author is a better fallback than a hardcoded "Untitled" for social
              feeds where the author is the meaningful identifier. */}
          {entry.title || entry.author?.trim() || entry.url || ''}
        </h3>
        {summary && (
          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-text-tertiary)]">
            {summary}
          </p>
        )}
      </div>

      <span className="mt-0.5 flex-shrink-0 text-xs tabular-nums text-[var(--color-text-tertiary)]">
        {timeLabel}
      </span>
    </button>
  )
}
