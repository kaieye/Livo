/**
 * Quick Search panel — Cmd+K global search overlay.
 * Searches across feeds and entries with type filtering.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useFeedStore } from "../../store/feed-store"
import { useEntryStore } from "../../store/entry-store"
import {
  Search,
  X,
  Rss,
  FileText,
  Star,
  Loader2,
  ArrowRight,
  Command,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { getDateLocale } from "../../lib/date-locale"
import { FeedViewType, type Entry, type FeedWithCount } from "../../../../shared/types"
import { create } from "zustand"
import { useOverlayHotkeyScope } from "../../hooks/useHotkeyScope"

// ====== Quick Search Store ======
interface QuickSearchState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useQuickSearchStore = create<QuickSearchState>((set, get) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set({ isOpen: !get().isOpen }),
}))

// ====== Component ======
type SearchType = "all" | "feed" | "entry"

export function QuickSearchPanel() {
  const { isOpen, close } = useQuickSearchStore()
  useOverlayHotkeyScope("quick-search", isOpen)
  const { t } = useTranslation()
  const { feeds, activeView, setSelectedFeed, setActiveView } = useFeedStore()
  const { loadEntries, selectEntry } = useEntryStore()

  const [query, setQuery] = useState("")
  const [searchType, setSearchType] = useState<SearchType>("all")
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
    ...feedResults.map((f) => ({ type: "feed" as const, data: f })),
    ...entryResults.map((e) => ({ type: "entry" as const, data: e })),
  ]

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("")
      setFeedResults([])
      setEntryResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Perform search with debounce
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setFeedResults([])
      setEntryResults([])
      return
    }
    setIsSearching(true)

    const qLower = q.toLowerCase()

    // Search feeds
    if (searchType === "all" || searchType === "feed") {
      const matchedFeeds = scopedFeeds.filter(
        (f) =>
          f.title.toLowerCase().includes(qLower) ||
          f.url.toLowerCase().includes(qLower) ||
          (f.siteUrl || "").toLowerCase().includes(qLower) ||
          (f.category || "").toLowerCase().includes(qLower) ||
          (f.description || "").toLowerCase().includes(qLower)
      ).slice(0, 5)
      setFeedResults(matchedFeeds)
    } else {
      setFeedResults([])
    }

    // Search entries
    if (searchType === "all" || searchType === "entry") {
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
  }, [scopedFeeds, searchType])

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => doSearch(query), 200)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [query, doSearch])

  const handleSelect = (item: typeof allItems[number]) => {
    if (item.type === "feed") {
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
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        break
      case "Enter":
        e.preventDefault()
        if (allItems[selectedIndex]) handleSelect(allItems[selectedIndex])
        break
      case "Escape":
        e.preventDefault()
        close()
        break
      case "Tab":
        e.preventDefault()
        // Cycle search type
        setSearchType((t) => t === "all" ? "feed" : t === "feed" ? "entry" : "all")
        break
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={close}>
      <div
        className="w-[560px] max-w-[90vw] bg-white dark:bg-surface-dark-secondary rounded-2xl shadow-2xl border overflow-hidden animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search size={18} className="text-text-tertiary flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("quickSearch.placeholder")}
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-text-tertiary"
            autoFocus
          />
          {isSearching && <Loader2 size={16} className="animate-spin text-accent" />}

          {/* Type filter */}
          <div className="flex gap-0.5 bg-surface-secondary dark:bg-surface-dark-tertiary rounded-lg p-0.5">
            {(["all", "feed", "entry"] as SearchType[]).map((st) => (
              <button
                key={st}
                onClick={() => setSearchType(st)}
                className={`px-2 py-0.5 rounded-md text-xs transition-colors ${
                  searchType === st ? "bg-white dark:bg-surface-dark shadow-sm text-accent font-medium" : "text-text-secondary dark:text-text-dark-secondary"
                }`}
              >
                {st === "all" ? t("quickSearch.all") : st === "feed" ? t("quickSearch.feeds") : t("quickSearch.articles")}
              </button>
            ))}
          </div>

          <button
            onClick={close}
            className="p-1 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
          >
            <X size={16} className="text-text-tertiary" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {!query.trim() ? (
            <div className="py-12 text-center text-text-tertiary">
              <Command size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t("quickSearch.typeToSearch")}</p>
              <p className="text-xs mt-1 opacity-60">{t("quickSearch.searchHint")}</p>
            </div>
          ) : allItems.length === 0 && !isSearching ? (
            <div className="py-12 text-center text-text-tertiary">
              <Search size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t("quickSearch.noResults")}</p>
            </div>
          ) : (
            <div className="py-1">
              {/* Feed results */}
              {feedResults.length > 0 && (
                <>
                  <div className="px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                    {t("quickSearch.feedsSection")}
                  </div>
                  {feedResults.map((feed, i) => {
                    const globalIndex = i
                    return (
                      <button
                        key={feed.id}
                        onClick={() => handleSelect({ type: "feed", data: feed })}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${
                          selectedIndex === globalIndex ? "bg-accent/10" : "hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
                        }`}
                      >
                        {feed.imageUrl ? (
                          <img src={feed.imageUrl} alt="" className="w-6 h-6 rounded object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center">
                            <Rss size={12} className="text-accent" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{feed.title}</div>
                          {feed.description && <div className="text-xs text-text-tertiary truncate">{feed.description}</div>}
                        </div>
                        {feed.unreadCount > 0 && (
                          <span className="text-xs text-text-tertiary bg-surface-tertiary dark:bg-surface-dark-tertiary rounded-full px-2 py-0.5">
                            {feed.unreadCount}
                          </span>
                        )}
                        <ArrowRight size={14} className="text-text-tertiary opacity-0 group-hover:opacity-100" />
                      </button>
                    )
                  })}
                </>
              )}

              {/* Entry results */}
              {entryResults.length > 0 && (
                <>
                  <div className="px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                    {t("quickSearch.articlesSection")}
                  </div>
                  {entryResults.map((entry, i) => {
                    const globalIndex = feedResults.length + i
                    const timeAgo = formatDistanceToNow(new Date(entry.publishedAt), { addSuffix: true, locale: getDateLocale() })
                    const feedTitle = feeds.find((f) => f.id === entry.feedId)?.title || ""
                    return (
                      <button
                        key={entry.id}
                        onClick={() => handleSelect({ type: "entry", data: entry })}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${
                          selectedIndex === globalIndex ? "bg-accent/10" : "hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
                        }`}
                      >
                        <FileText size={16} className="text-text-tertiary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{entry.title}</div>
                          <div className="flex items-center gap-2 text-xs text-text-tertiary mt-0.5">
                            {feedTitle && <span className="truncate max-w-[140px]">{feedTitle}</span>}
                            <span className="flex-shrink-0">{timeAgo}</span>
                            {entry.isStarred && <Star size={10} className="text-yellow-500 fill-yellow-500" />}
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
          <div className="border-t px-4 py-2 flex items-center gap-4 text-[10px] text-text-tertiary">
            <span>{t("quickSearch.navHint")}</span>
            <span>{t("quickSearch.openHint")}</span>
            <span>{t("quickSearch.switchTypeHint")}</span>
            <span>{t("quickSearch.closeHint")}</span>
          </div>
        )}
      </div>
    </div>
  )
}
