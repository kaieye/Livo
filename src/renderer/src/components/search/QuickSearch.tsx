/**
 * Quick Search panel — Cmd+K global search overlay.
 * Searches across feeds and entries with type filtering.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useFeedStore } from '../../store/feed-store'
import { useEntryStore } from '../../store/entry-store'
import {
  Search,
  X,
  Rss,
  FileText,
  Star,
  Loader2,
  ArrowRight,
  Command,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { getDateLocale } from '../../lib/date-locale'
import {
  FeedViewType,
  type Entry,
  type FeedWithCount,
} from '../../../../shared/types'
import { create } from 'zustand'
import { useOverlayHotkeyScope } from '../../hooks/useHotkeyScope'
import {
  useOverlayStackItem,
  useOverlayStackStore,
} from '../../store/overlay-stack-store'

// ====== Quick Search Store ======
interface QuickSearchState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useQuickSearchStore = create<QuickSearchState>((set, get) => ({
  isOpen: false,
  open: () => {
    useOverlayStackStore.getState().open('quick-search')
    set({ isOpen: true })
  },
  close: () => {
    useOverlayStackStore.getState().close('quick-search')
    set({ isOpen: false })
  },
  toggle: () => {
    const next = !get().isOpen
    if (next) {
      useOverlayStackStore.getState().open('quick-search')
    } else {
      useOverlayStackStore.getState().close('quick-search')
    }
    set({ isOpen: next })
  },
}))

// ====== Component ======
type SearchType = 'all' | 'feed' | 'entry'

export function QuickSearchPanel() {
  const { isOpen, close } = useQuickSearchStore()
  useOverlayHotkeyScope('quick-search', isOpen)
  const { zIndex, isTop } = useOverlayStackItem('quick-search', isOpen)
  const { t } = useTranslation()
  const { feeds, activeView, setSelectedFeed, setActiveView } = useFeedStore()
  const { loadEntries, selectEntry } = useEntryStore()

  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState<SearchType>('all')
  const [feedResults, setFeedResults] = useState<FeedWithCount[]>([])
  const [entryResults, setEntryResults] = useState<Entry[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scopedFeeds = useMemo(
    () =>
      activeView === null
        ? feeds
        : feeds.filter((f) => (f.view ?? FeedViewType.Articles) === activeView),
    [feeds, activeView],
  )

  // Total items for keyboard navigation
  const allItems = [
    ...feedResults.map((f) => ({ type: 'feed' as const, data: f })),
    ...entryResults.map((e) => ({ type: 'entry' as const, data: e })),
  ]

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setFeedResults([])
      setEntryResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Perform search with debounce
  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setFeedResults([])
        setEntryResults([])
        return
      }
      setIsSearching(true)

      const qLower = q.toLowerCase()

      // Search feeds
      if (searchType === 'all' || searchType === 'feed') {
        const matchedFeeds = scopedFeeds
          .filter(
            (f) =>
              f.title.toLowerCase().includes(qLower) ||
              f.url.toLowerCase().includes(qLower) ||
              (f.siteUrl || '').toLowerCase().includes(qLower) ||
              (f.category || '').toLowerCase().includes(qLower) ||
              (f.description || '').toLowerCase().includes(qLower),
          )
          .slice(0, 5)
        setFeedResults(matchedFeeds)
      } else {
        setFeedResults([])
      }

      // Search entries
      if (searchType === 'all' || searchType === 'entry') {
        try {
          const entries = await window.api.entries.search(q, 10)
          setEntryResults(entries)
        } catch {
          setEntryResults([])
        }
      } else {
        setEntryResults([])
      }

      setIsSearching(false)
      setSelectedIndex(0)
    },
    [scopedFeeds, searchType],
  )

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => doSearch(query), 200)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [query, doSearch])

  const handleSelect = (item: (typeof allItems)[number]) => {
    if (item.type === 'feed') {
      const feed = item.data as FeedWithCount
      setSelectedFeed(feed.id)
      setActiveView(null)
      loadEntries({ feedId: feed.id })
    } else {
      const entry = item.data as Entry
      // Find the feed and load its entries, then select this one
      setSelectedFeed(entry.feedId)
      loadEntries({ feedId: entry.feedId }).then(() => {
        selectEntry(entry)
      })
    }
    close()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (allItems[selectedIndex]) handleSelect(allItems[selectedIndex])
        break
      case 'Escape':
        e.preventDefault()
        if (!isTop) return
        close()
        break
      case 'Tab':
        e.preventDefault()
        // Cycle search type
        setSearchType((t) =>
          t === 'all' ? 'feed' : t === 'feed' ? 'entry' : 'all',
        )
        break
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex }}
      onClick={close}
    >
      <div
        className="animate-in dark:bg-surface-dark-secondary w-[560px] max-w-[90vw] overflow-hidden rounded-2xl border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search size={18} className="text-text-tertiary flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('quickSearch.placeholder')}
            className="placeholder:text-text-tertiary flex-1 bg-transparent text-sm focus:outline-none"
            autoFocus
          />
          {isSearching && (
            <Loader2 size={16} className="text-accent animate-spin" />
          )}

          {/* Type filter */}
          <div className="bg-surface-secondary dark:bg-surface-dark-tertiary flex gap-0.5 rounded-lg p-0.5">
            {(['all', 'feed', 'entry'] as SearchType[]).map((st) => (
              <button
                key={st}
                onClick={() => setSearchType(st)}
                className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                  searchType === st
                    ? 'text-accent dark:bg-surface-dark bg-white font-medium shadow-sm'
                    : 'text-text-secondary dark:text-text-dark-secondary'
                }`}
              >
                {st === 'all'
                  ? t('quickSearch.all')
                  : st === 'feed'
                    ? t('quickSearch.feeds')
                    : t('quickSearch.articles')}
              </button>
            ))}
          </div>

          <button
            onClick={close}
            className="hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-lg p-1"
          >
            <X size={16} className="text-text-tertiary" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {!query.trim() ? (
            <div className="text-text-tertiary py-12 text-center">
              <Command size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('quickSearch.typeToSearch')}</p>
              <p className="mt-1 text-xs opacity-60">
                {t('quickSearch.searchHint')}
              </p>
            </div>
          ) : allItems.length === 0 && !isSearching ? (
            <div className="text-text-tertiary py-12 text-center">
              <Search size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('quickSearch.noResults')}</p>
            </div>
          ) : (
            <div className="py-1">
              {/* Feed results */}
              {feedResults.length > 0 && (
                <>
                  <div className="text-text-tertiary px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider">
                    {t('quickSearch.feedsSection')}
                  </div>
                  {feedResults.map((feed, i) => {
                    const globalIndex = i
                    return (
                      <button
                        key={feed.id}
                        onClick={() =>
                          handleSelect({ type: 'feed', data: feed })
                        }
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                          selectedIndex === globalIndex
                            ? 'bg-accent/10'
                            : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary'
                        }`}
                      >
                        {feed.imageUrl ? (
                          <img
                            src={feed.imageUrl}
                            alt=""
                            className="h-6 w-6 rounded object-cover"
                          />
                        ) : (
                          <div className="bg-accent/20 flex h-6 w-6 items-center justify-center rounded">
                            <Rss size={12} className="text-accent" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {feed.title}
                          </div>
                          {feed.description && (
                            <div className="text-text-tertiary truncate text-xs">
                              {feed.description}
                            </div>
                          )}
                        </div>
                        {feed.unreadCount > 0 && (
                          <span className="bg-surface-tertiary text-text-tertiary dark:bg-surface-dark-tertiary rounded-full px-2 py-0.5 text-xs">
                            {feed.unreadCount}
                          </span>
                        )}
                        <ArrowRight
                          size={14}
                          className="text-text-tertiary opacity-0 group-hover:opacity-100"
                        />
                      </button>
                    )
                  })}
                </>
              )}

              {/* Entry results */}
              {entryResults.length > 0 && (
                <>
                  <div className="text-text-tertiary px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider">
                    {t('quickSearch.articlesSection')}
                  </div>
                  {entryResults.map((entry, i) => {
                    const globalIndex = feedResults.length + i
                    const timeAgo = formatDistanceToNow(
                      new Date(entry.publishedAt),
                      { addSuffix: true, locale: getDateLocale() },
                    )
                    const feedTitle =
                      feeds.find((f) => f.id === entry.feedId)?.title || ''
                    return (
                      <button
                        key={entry.id}
                        onClick={() =>
                          handleSelect({ type: 'entry', data: entry })
                        }
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                          selectedIndex === globalIndex
                            ? 'bg-accent/10'
                            : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary'
                        }`}
                      >
                        <FileText
                          size={16}
                          className="text-text-tertiary flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{entry.title}</div>
                          <div className="text-text-tertiary mt-0.5 flex items-center gap-2 text-xs">
                            {feedTitle && (
                              <span className="max-w-[140px] truncate">
                                {feedTitle}
                              </span>
                            )}
                            <span className="flex-shrink-0">{timeAgo}</span>
                            {entry.isStarred && (
                              <Star
                                size={10}
                                className="fill-yellow-500 text-yellow-500"
                              />
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {query.trim() && allItems.length > 0 && (
          <div className="text-text-tertiary flex items-center gap-4 border-t px-4 py-2 text-[10px]">
            <span>{t('quickSearch.navHint')}</span>
            <span>{t('quickSearch.openHint')}</span>
            <span>{t('quickSearch.switchTypeHint')}</span>
            <span>{t('quickSearch.closeHint')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
