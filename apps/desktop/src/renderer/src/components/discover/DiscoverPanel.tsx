import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useDiscoverSearchQuery } from '../../hooks/useDiscoverSearchQuery'
import { useAccountStatusQuery } from '../../hooks/useAccountStatusQuery'
import type {
  DiscoverFeedPreview,
  DiscoverFeedPreviewEntry,
} from '../../../../shared/types'
import { FeedViewType } from '../../../../shared/types'
import {
  type DiscoverSearchResult,
  type DiscoverSearchPlatform,
  getDiscoverSearchDebounceMs,
  shouldImmediatelySubmitDiscoverSearch,
} from '../../lib/discover-search'
import { inferDiscoverFeedViewFromUrl } from '../../lib/discover-feed'
import { canonicalizeDiscoverRoute } from '../../lib/discover-subscribe-config'
import { inferDiscoverPlatform } from '../../lib/discover-platform-presentation'
import { useDiscoverStore } from '../../store/discover-store'
import { useFeedStore } from '../../store/feed-store'
import { useEntryStore } from '../../store/entry-store'
import { useStoreShallow } from '../../store/helpers'
import { EntryContent } from '../entry/EntryContent'
import { SocialDetailView } from '../entry/SocialDetailView'
import { ROUTES } from '../../router/route-paths'
import {
  DiscoverResultRow,
  getDiscoverResultDisplayTitle,
} from './DiscoverResultRow'
import { DiscoverCenteredState } from './DiscoverCenteredState'
import { FeedAvatar } from '../feed/FeedAvatar'
import { splitHtmlIntoParagraphs } from '../../lib/entry-text'
import { getDateLocale } from '../../lib/date-locale'
import { useGeneralSettingsShallowSelector } from '../../store/settings-store'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Globe,
  LogIn,
  Search,
  Sparkles,
  User,
  X,
  Check,
  Plus,
  Rss,
  ExternalLink,
  Loader2,
} from 'lucide-react'

// Platform icon SVGs (chip rail)
const platformIcons: Record<string, React.ReactNode> = {
  youtube: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  bilibili: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373z" />
    </svg>
  ),
  x: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  instagram: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  ),
}

const SEARCH_RESULTS_PAGE_SIZE = 6

export function DiscoverPanel() {
  const navigate = useNavigate()
  const {
    searchQuery,
    submittedSearchQuery,
    searchPlatform,
    subscribingUrls,
    setOpen,
    submitSearch,
    clearSearch,
    setSearchQuery,
    setSearchPlatform,
    setSubscribing,
  } = useStoreShallow(useDiscoverStore, (state) => ({
    searchQuery: state.searchQuery,
    submittedSearchQuery: state.submittedSearchQuery,
    searchPlatform: state.searchPlatform,
    subscribingUrls: state.subscribingUrls,
    setOpen: state.setOpen,
    submitSearch: state.submitSearch,
    clearSearch: state.clearSearch,
    setSearchQuery: state.setSearchQuery,
    setSearchPlatform: state.setSearchPlatform,
    setSubscribing: state.setSubscribing,
  }))

  const { feeds: userFeeds, removeFeed } = useFeedStore()
  const { t } = useTranslation()

  // Account status for the only platform whose backend handler today gates
  // results on login (YouTube). We use the linked state to:
  // 1) Show per-row "sign in required" hint badges on YouTube rows.
  // 2) Show a platform-level banner when a YouTube-scoped search returns 0
  //    results and the user is not signed in.
  const youtubeAccount = useAccountStatusQuery('youtube')
  const youtubeNeedsLogin = !youtubeAccount.data?.linked

  const [subscribedUrls, setSubscribedUrls] = useState<Set<string>>(new Set())
  const [searchPage, setSearchPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Inline preview state — replaces full-screen DiscoverPreviewPage navigation
  const [previewTarget, setPreviewTarget] = useState<{
    url: string
    title?: string
    siteUrl?: string
    imageUrl?: string
    description?: string
    view?: FeedViewType
  } | null>(null)
  const [previewData, setPreviewData] = useState<DiscoverFeedPreview | null>(
    null,
  )
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [previewReloadKey, setPreviewReloadKey] = useState(0)

  // Inline entry detail — when set, EntryContent renders inside the preview
  // instead of navigating to the full-screen ArticleDetailPage
  const [inlineEntryId, setInlineEntryId] = useState<string | null>(null)

  // Open a preview entry inline using EntryContent — stays within the
  // discover panel instead of navigating to the full-screen detail page.
  // Pre-populates the entry store so EntryContent renders immediately.
  const handleOpenPreviewEntry = useCallback(
    (entry: DiscoverFeedPreviewEntry) => {
      // Construct a minimal Entry so EntryContent can render it
      const previewEntry = {
        id: entry.id,
        feedId: '',
        title: entry.title,
        url: entry.url,
        content: entry.content || entry.summary || '',
        summary: entry.summary,
        author: entry.author,
        imageUrl: entry.imageUrl,
        publishedAt: entry.publishedAt,
        isRead: true,
        isStarred: false,
        createdAt: Date.now(),
      }
      // Pre-populate store so EntryContent finds the entry
      void useEntryStore.getState().selectEntry(previewEntry)
      // Switch to inline detail view
      setInlineEntryId(entry.id)
    },
    [],
  )

  // SocialDetailView rendering support — read selectedEntry & compute props
  const general = useGeneralSettingsShallowSelector((s) => ({
    fontSize: s.fontSize,
    language: s.language,
  }))

  const selectedEntry = useEntryStore((s) => s.selectedEntry)

  const paragraphs = useMemo(() => {
    if (!selectedEntry?.content) return []
    return splitHtmlIntoParagraphs(selectedEntry.content)
  }, [selectedEntry?.content])

  const plainContent = useMemo(
    () => (selectedEntry?.content ?? '').replace(/<[^>]*>/g, '').trim(),
    [selectedEntry?.content],
  )

  const socialAuthorName = selectedEntry?.author ?? ''
  const [avatarFailed, setAvatarFailed] = useState(false)
  const avatarLetter = socialAuthorName
    ? socialAuthorName.charAt(0).toUpperCase()
    : '?'

  const timeAgo = useMemo(() => {
    if (!selectedEntry?.publishedAt) return ''
    try {
      return formatDistanceToNow(selectedEntry.publishedAt, {
        addSuffix: true,
        locale: getDateLocale(),
      })
    } catch {
      return ''
    }
  }, [selectedEntry?.publishedAt, general.language])

  // ── Preview fetch effect ──
  useEffect(() => {
    if (!previewTarget) return
    let cancelled = false
    setPreviewData(null)
    setPreviewError('')
    setPreviewLoading(true)

    window.api.discover
      .previewFeed(previewTarget.url)
      .then((result) => {
        if (cancelled) return
        if (result.success) {
          setPreviewData(result.preview)
        } else {
          setPreviewError(result.error)
        }
      })
      .catch((e) => {
        if (!cancelled) setPreviewError(String(e))
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [previewTarget, previewReloadKey])

  const isPreviewing = previewTarget !== null

  // Curated categories & popular feeds — shown when no search is active
  const categoriesQuery = useQuery({
    queryKey: ['discover:categories'],
    queryFn: () => window.api.discover.categories(),
    staleTime: 5 * 60 * 1000,
  })
  const categories: Array<{
    id: string
    name: string
    nameEn: string
    icon: string
    description: string
  }> = categoriesQuery.data ?? []

  const popularFeedsQuery = useQuery({
    queryKey: ['discover:popular', selectedCategory],
    queryFn: () => window.api.discover.popular(selectedCategory ?? undefined),
    staleTime: 5 * 60 * 1000,
  })
  const popularFeeds: Array<{
    title: string
    url: string
    siteUrl: string
    description: string
    category: string
    language: string
    imageUrl?: string
  }> = popularFeedsQuery.data ?? []
  const isLoadingPopular = popularFeedsQuery.isPending

  const searchResultsTopRef = useRef<HTMLDivElement | null>(null)
  const previousPlatformRef = useRef<DiscoverSearchPlatform>(searchPlatform)
  const debouncedSearchQuery = useDebouncedValue(
    searchQuery.trim(),
    getDiscoverSearchDebounceMs(searchPlatform),
  )
  const searchQueryResult = useDiscoverSearchQuery(
    submittedSearchQuery,
    searchPlatform,
  )
  const searchResults = useMemo<DiscoverSearchResult[]>(
    () => (searchQuery.trim() ? (searchQueryResult.data ?? []) : []),
    [searchQuery, searchQueryResult.data],
  )
  const isSearching =
    searchQuery.trim().length > 0 &&
    (searchQueryResult.isPending || searchQueryResult.isFetching)
  const searchErrorMessage =
    searchQueryResult.error instanceof Error
      ? searchQueryResult.error.message
      : searchQueryResult.error
        ? String(searchQueryResult.error)
        : null
  const hasSearchError = Boolean(
    searchQuery.trim() && !isSearching && searchQueryResult.isError,
  )

  // Platform selector options
  const platformOptions: {
    value: DiscoverSearchPlatform
    label: string
    icon: React.ReactNode
  }[] = [
    { value: 'all', label: t('common.all'), icon: <Globe size={16} /> },
    { value: 'youtube', label: 'YouTube', icon: platformIcons.youtube },
    { value: 'bilibili', label: 'Bilibili', icon: platformIcons.bilibili },
    { value: 'x', label: 'X', icon: platformIcons.x },
    { value: 'instagram', label: 'Instagram', icon: platformIcons.instagram },
  ]

  // Sync subscribedUrls with existing user feeds
  useEffect(() => {
    const urls = new Set<string>()
    for (const feed of userFeeds) {
      urls.add(feed.url)
      const canonical = canonicalizeDiscoverRoute(feed.url)
      if (canonical) urls.add(`route:${canonical}`)
    }
    setSubscribedUrls(urls)
  }, [userFeeds])

  useEffect(() => {
    setSearchPage(1)
  }, [searchQuery])

  useEffect(() => {
    if (
      !shouldImmediatelySubmitDiscoverSearch({
        previousPlatform: previousPlatformRef.current,
        nextPlatform: searchPlatform,
        query: searchQuery,
      })
    ) {
      previousPlatformRef.current = searchPlatform
      return
    }
    submitSearch(searchQuery)
    setSearchPage(1)
    previousPlatformRef.current = searchPlatform
  }, [searchPlatform, searchQuery, submitSearch])

  useEffect(() => {
    if (debouncedSearchQuery) {
      submitSearch(debouncedSearchQuery)
      return
    }
    clearSearch()
  }, [clearSearch, debouncedSearchQuery, submitSearch])

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query)
    },
    [setSearchQuery],
  )

  const handleSearchNow = useCallback(() => {
    submitSearch(searchQuery)
  }, [searchQuery, submitSearch])

  const handleRetrySearch = useCallback(() => {
    searchQueryResult.refetch()
  }, [searchQueryResult])

  const handleUnsubscribe = async (url: string) => {
    const targetCanonical = canonicalizeDiscoverRoute(url)
    const feed = userFeeds.find((f) => {
      if (f.url === url) return true
      if (!targetCanonical) return false
      return canonicalizeDiscoverRoute(f.url) === targetCanonical
    })
    if (!feed) return
    setSubscribing(url, true)
    try {
      await removeFeed(feed.id)
      setSubscribedUrls((prev) => {
        const next = new Set(prev)
        next.delete(url)
        const canonical = canonicalizeDiscoverRoute(url)
        if (canonical) next.delete(`route:${canonical}`)
        return next
      })
    } finally {
      setSubscribing(url, false)
    }
  }

  const buildPreviewTarget = useCallback(
    (result: DiscoverSearchResult) => ({
      url: result.url,
      title: getDiscoverResultDisplayTitle(result),
      siteUrl: result.siteUrl,
      imageUrl: result.image,
      description: result.description,
      view: inferDiscoverFeedViewFromUrl(result.url),
    }),
    [],
  )

  const openPreview = useCallback(
    (result: DiscoverSearchResult) => {
      setPreviewTarget(buildPreviewTarget(result))
    },
    [buildPreviewTarget],
  )

  const handleToggleSubscribe = (result: DiscoverSearchResult) => {
    if (isSubscribed(result.url)) {
      handleUnsubscribe(result.url)
    } else {
      openPreview(result)
    }
  }

  const isSubscribed = (url: string) =>
    subscribedUrls.has(url) ||
    subscribedUrls.has(`route:${canonicalizeDiscoverRoute(url)}`)
  const isSubscribing = (url: string) => subscribingUrls.has(url)
  const hasSearchQuery = searchQuery.trim().length > 0
  const totalSearchPages = Math.max(
    1,
    Math.ceil(searchResults.length / SEARCH_RESULTS_PAGE_SIZE),
  )

  useEffect(() => {
    setSearchPage((prev) => Math.min(prev, totalSearchPages))
  }, [totalSearchPages])

  useEffect(() => {
    if (!hasSearchQuery) return
    searchResultsTopRef.current?.scrollIntoView({
      block: 'start',
      behavior: 'smooth',
    })
  }, [searchPage, hasSearchQuery])

  const pagedSearchResults = useMemo(() => {
    const start = (searchPage - 1) * SEARCH_RESULTS_PAGE_SIZE
    return searchResults.slice(start, start + SEARCH_RESULTS_PAGE_SIZE)
  }, [searchPage, searchResults])

  /** Whether a result should display the inline "sign in required" hint. */
  const resultRequiresSignIn = useCallback(
    (result: DiscoverSearchResult) => {
      // Today only YouTube is gated; extend when backend adds requiresAccount to discover:search.
      const platform = inferDiscoverPlatform(result.url)
      if (platform.id !== 'youtube') return false
      return youtubeNeedsLogin
    },
    [youtubeNeedsLogin],
  )

  /**
   * Show a one-line affordance above the empty state when a platform-scoped
   * search yielded zero results AND that platform requires sign-in. Only
   * YouTube is account-gated today (per `discover-handlers.ts`).
   */
  const platformLoginBanner = useMemo(() => {
    if (!hasSearchQuery) return null
    if (isSearching || hasSearchError) return null
    if (searchResults.length > 0) return null
    if (searchPlatform !== 'youtube') return null
    if (!youtubeNeedsLogin) return null
    return {
      platformLabel: 'YouTube',
      provider: 'youtube' as const,
    }
  }, [
    hasSearchError,
    hasSearchQuery,
    isSearching,
    searchPlatform,
    searchResults.length,
    youtubeNeedsLogin,
  ])

  const searchBar = (
    <div className="mx-auto max-w-2xl space-y-2.5">
      <div className="flex items-center gap-2">
        {/* Platform selector */}
        <div className="flex items-center gap-1.5 text-[11px]">
          {platformOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                if (searchPlatform === option.value) return
                setSearchPlatform(option.value)
              }}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors ${
                searchPlatform === option.value
                  ? 'bg-accent font-medium text-white'
                  : 'bg-surface-secondary text-text-secondary hover:bg-accent/10 dark:bg-surface-dark-secondary dark:text-text-dark-secondary'
              }`}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSearchNow()
              }
            }}
            placeholder={t('discover.searchPlaceholder')}
            className="w-full rounded-xl border bg-surface-secondary py-2.5 pl-9 pr-4 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-surface-dark-secondary"
          />
          {isSearching && hasSearchQuery && (
            <div className="absolute -bottom-1 left-3 right-3 h-0.5 overflow-hidden rounded-full bg-accent/10">
              <div className="search-progress-slide h-full w-1/3 bg-accent/70" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleSearchNow}
          disabled={!searchQuery.trim() || isSearching}
          className="h-[42px] rounded-xl bg-accent px-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('common.search')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-surface-dark">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white/80 backdrop-blur-sm dark:bg-surface-dark/80">
        <div className="flex items-center gap-3 px-6 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-accent" />
            <h2 className="text-lg font-semibold">{t('discover.title')}</h2>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className={`w-full ${hasSearchQuery ? '' : 'pt-[12vh]'}`}>
          {searchBar}
        </div>

        {/* Featured feeds — category rail + curated feed list when no search active */}
        {!hasSearchQuery && !isPreviewing && categories.length > 0 && (
          <div className="mx-auto mt-6 max-w-2xl">
            <div className="mb-4">
              <h3 className="mb-3 text-sm font-medium text-text-secondary dark:text-text-dark-secondary">
                {t('discover.browseCategories')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() =>
                      setSelectedCategory(
                        selectedCategory === cat.id ? null : cat.id,
                      )
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-accent text-white'
                        : 'bg-surface-secondary text-text-secondary hover:bg-accent/10 dark:bg-surface-dark-secondary dark:text-text-dark-secondary'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-medium text-text-secondary dark:text-text-dark-secondary">
                {t('discover.featuredFeeds')}
                {selectedCategory &&
                categories.find((c) => c.id === selectedCategory)
                  ? ` — ${categories.find((c) => c.id === selectedCategory)!.name}`
                  : ''}
              </h3>

              {isLoadingPopular ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-[66px] animate-pulse rounded-xl border bg-white dark:bg-surface-dark-secondary"
                    />
                  ))}
                </div>
              ) : popularFeeds.length === 0 ? (
                <p className="text-xs text-text-tertiary">
                  {t('discover.noCategoryFeeds')}
                </p>
              ) : (
                <div className="space-y-2">
                  {popularFeeds.map((feed) => (
                    <CuratedFeedRow
                      key={feed.url}
                      feed={feed}
                      subscribed={isSubscribed(feed.url)}
                      subscribing={isSubscribing(feed.url)}
                      onPreview={() => {
                        setPreviewTarget({
                          url: feed.url,
                          title: feed.title,
                          siteUrl: feed.siteUrl,
                          imageUrl: feed.imageUrl,
                          description: feed.description,
                          view: inferDiscoverFeedViewFromUrl(feed.url),
                        })
                      }}
                      onToggleSubscribe={() => {
                        if (isSubscribed(feed.url)) {
                          handleUnsubscribe(feed.url)
                        } else {
                          setPreviewTarget({
                            url: feed.url,
                            title: feed.title,
                            siteUrl: feed.siteUrl,
                            imageUrl: feed.imageUrl,
                            description: feed.description,
                            view: inferDiscoverFeedViewFromUrl(feed.url),
                          })
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Inline preview — replaces full-screen DiscoverPreviewPage */}
        {!hasSearchQuery && isPreviewing && previewTarget && (
          <div className="mx-auto mt-6 max-w-2xl">
            {/* Preview header */}
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPreviewTarget(null)
                  setPreviewData(null)
                  setPreviewError('')
                  setInlineEntryId(null)
                  useEntryStore.getState().selectEntry(null)
                }}
                className="hover:text-text-primary rounded-md p-1 text-text-secondary transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                title={t('discoverPreview.back')}
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold">
                  {previewData?.feedTitle ||
                    previewTarget.title ||
                    previewTarget.url}
                </h3>
              </div>
              {previewTarget.siteUrl && (
                <a
                  href={previewTarget.siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-text-primary rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-secondary"
                  title={t('discoverPreview.openSource')}
                >
                  <ExternalLink size={16} />
                </a>
              )}
            </div>

            {/* Preview content — or inline entry detail when an entry is selected */}
            {inlineEntryId ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-white dark:bg-surface-dark-secondary">
                {/* Inline back button from entry detail to entry list */}
                <div className="flex flex-shrink-0 items-center gap-2 border-b px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      useEntryStore.getState().selectEntry(null)
                      setInlineEntryId(null)
                    }}
                    className="hover:text-text-primary rounded-md p-1 text-text-secondary transition-colors hover:bg-surface-secondary"
                    title={t('common.back')}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <span className="text-xs text-text-tertiary">
                    {t('discoverPreview.backToEntries')}
                  </span>
                </div>
                {previewTarget?.view === FeedViewType.SocialMedia ? (
                  <div className="flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-[680px] px-4 py-6">
                      <SocialDetailView
                        entryId={inlineEntryId}
                        paragraphs={paragraphs}
                        fullContent={selectedEntry?.content ?? ''}
                        plainContent={plainContent}
                        avatarUrl={selectedEntry?.authorAvatar ?? ''}
                        avatarImageFailed={avatarFailed}
                        avatarLetter={avatarLetter}
                        authorName={socialAuthorName}
                        timeAgo={timeAgo}
                        onAvatarError={() => setAvatarFailed(true)}
                        showTranslation={false}
                        translatedParagraphs={[]}
                        isTranslating={false}
                        isSummarizing={false}
                        showSummary={false}
                        summary={null}
                        fontSize={general.fontSize}
                      />
                    </div>
                  </div>
                ) : (
                  <EntryContent />
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border bg-white dark:bg-surface-dark-secondary">
                {previewLoading ? (
                  <DiscoverCenteredState
                    icon={<Loader2 size={28} className="animate-spin" />}
                    title={t('discoverPreview.loadingTitle')}
                    hint={t('discoverPreview.loadingHint')}
                  />
                ) : previewError ? (
                  <DiscoverCenteredState
                    icon={
                      <AlertTriangle size={28} className="text-amber-500" />
                    }
                    title={t('discoverPreview.errorTitle')}
                    hint={previewError}
                    action={
                      <button
                        type="button"
                        onClick={() => setPreviewReloadKey((k) => k + 1)}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
                      >
                        {t('discoverPreview.retry')}
                      </button>
                    }
                  />
                ) : previewData ? (
                  <>
                    {/* Feed info */}
                    <div className="border-b bg-surface-secondary/30 px-4 py-4 dark:bg-surface-dark-tertiary/30">
                      <div className="flex items-start gap-3">
                        <FeedAvatar
                          imageUrl={
                            previewData.imageUrl || previewTarget.imageUrl
                          }
                          size="lg"
                          className="shadow-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="min-w-0 truncate text-sm font-semibold">
                              {previewData.feedTitle ||
                                previewTarget.title ||
                                previewTarget.url}
                            </h3>
                          </div>
                          {(() => {
                            try {
                              const host = new URL(
                                previewData.siteUrl ||
                                  previewTarget.siteUrl ||
                                  previewTarget.url,
                              ).hostname.replace(/^www\./i, '')
                              if (host) {
                                return (
                                  <p className="mt-1 truncate text-xs text-text-tertiary">
                                    {host}
                                  </p>
                                )
                              }
                            } catch {
                              /* ignore */
                            }
                            return null
                          })()}
                          {(previewData.description ||
                            previewTarget.description) && (
                            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-text-tertiary">
                              {previewData.description ||
                                previewTarget.description}
                            </p>
                          )}
                          <p className="mt-3 text-[11px] text-text-tertiary">
                            {t('discoverPreview.itemCount', {
                              count: previewData.itemCount,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Entry list */}
                    <div className="px-4 py-3">
                      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        {t('discoverPreview.entriesTitle')}
                      </h4>
                      {previewData.entries.length > 0 ? (
                        <ul className="divide-y divide-[var(--color-border-secondary)] overflow-hidden rounded-md border">
                          {previewData.entries.map((entry) => (
                            <li key={entry.id}>
                              <PreviewEntryInline
                                entry={entry}
                                onSelect={handleOpenPreviewEntry}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[var(--color-border-secondary)] px-4 py-12 text-center">
                          <Rss
                            size={28}
                            className="mb-2 text-text-tertiary opacity-40"
                          />
                          <p className="text-xs text-text-secondary">
                            {t('discoverPreview.noEntries')}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {/* Footer — only when not viewing inline entry detail */}
            {!inlineEntryId && (
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewTarget(null)
                    setPreviewData(null)
                    setPreviewError('')
                    setInlineEntryId(null)
                    useEntryStore.getState().selectEntry(null)
                  }}
                  className="hover:text-text-primary rounded-md px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!previewTarget?.url) return
                    navigate(
                      ROUTES.discoverSubscribe({
                        url: previewData?.targetUrl || previewTarget.url,
                        title: previewData?.feedTitle || previewTarget.title,
                        siteUrl: previewData?.siteUrl || previewTarget.siteUrl,
                        imageUrl:
                          previewData?.imageUrl || previewTarget.imageUrl,
                        description:
                          previewData?.description || previewTarget.description,
                        view:
                          previewTarget.view ??
                          inferDiscoverFeedViewFromUrl(previewTarget.url),
                      }),
                    )
                  }}
                  disabled={!previewData || previewLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('discoverPreview.continue')}
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Search results */}
        {hasSearchQuery && (
          <div className="mx-auto mt-4 max-w-2xl space-y-3">
            <div ref={searchResultsTopRef} />
            <h3 className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary">
              {t('discover.searchResults')}{' '}
              {searchResults.length > 0 && `(${searchResults.length})`}
            </h3>

            {hasSearchError ? (
              <DiscoverCenteredState
                icon={<AlertTriangle size={20} className="text-amber-500" />}
                title={t('discover.searchErrorTitle')}
                hint={searchErrorMessage || t('discover.searchErrorHint')}
                action={
                  <button
                    type="button"
                    onClick={handleRetrySearch}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
                  >
                    {t('discover.retry')}
                  </button>
                }
              />
            ) : isSearching && searchResults.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-[68px] animate-pulse rounded-xl border bg-white px-3.5 py-3 dark:bg-surface-dark-secondary"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-surface-secondary dark:bg-surface-dark-tertiary" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 h-3.5 w-1/3 rounded bg-surface-secondary dark:bg-surface-dark-tertiary" />
                        <div className="h-3 w-1/2 rounded bg-surface-secondary dark:bg-surface-dark-tertiary" />
                      </div>
                      <div className="h-7 w-14 rounded-lg bg-surface-secondary dark:bg-surface-dark-tertiary" />
                    </div>
                  </div>
                ))}
              </div>
            ) : searchResults.length === 0 && !isSearching ? (
              <>
                {platformLoginBanner && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300">
                    <span>
                      {t('discover.signInForMoreResults', {
                        platform: platformLoginBanner.platformLabel,
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(ROUTES.login(platformLoginBanner.provider))
                      }
                      className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-amber-500/15 px-2.5 py-1 font-medium text-amber-700 transition-colors hover:bg-amber-500/25 dark:text-amber-200"
                    >
                      <LogIn size={12} />
                      {t('discover.signInCta')}
                    </button>
                  </div>
                )}
                <DiscoverCenteredState
                  icon={<Search size={20} />}
                  title={t('discover.noSearchResults')}
                  hint={t('discover.noResultsHint')}
                />
              </>
            ) : (
              <>
                {/* Results - single column with fixed height */}
                <div
                  className="space-y-2"
                  style={{ minHeight: `${SEARCH_RESULTS_PAGE_SIZE * 70}px` }}
                >
                  {pagedSearchResults.map((result) => (
                    <DiscoverResultRow
                      key={result.url}
                      result={result}
                      subscribed={isSubscribed(result.url)}
                      subscribing={isSubscribing(result.url)}
                      requiresSignIn={resultRequiresSignIn(result)}
                      subscribeLabel={t('discover.previewAction')}
                      onOpenPreview={() => openPreview(result)}
                      onToggleSubscribe={() => handleToggleSubscribe(result)}
                    />
                  ))}
                  {/* Placeholders to maintain fixed height */}
                  {pagedSearchResults.length < SEARCH_RESULTS_PAGE_SIZE &&
                    Array.from({
                      length:
                        SEARCH_RESULTS_PAGE_SIZE - pagedSearchResults.length,
                    }).map((_, idx) => (
                      <div key={`placeholder-${idx}`} className="h-[66px]" />
                    ))}
                </div>

                {/* Pagination - always visible at fixed position */}
                {searchResults.length > SEARCH_RESULTS_PAGE_SIZE && (
                  <div className="pb-2 pt-4">
                    <div className="flex items-center justify-center gap-3 text-xs text-text-secondary dark:text-text-dark-secondary">
                      <button
                        type="button"
                        disabled={searchPage <= 1}
                        onClick={() =>
                          setSearchPage((prev) => Math.max(1, prev - 1))
                        }
                        className="flex items-center gap-1 rounded-lg border px-3 py-1.5 transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-surface-dark-secondary"
                      >
                        {t('common.prevPage')}
                      </button>
                      <span className="min-w-[60px] text-center font-medium tabular-nums">
                        {searchPage} / {totalSearchPages}
                      </span>
                      <button
                        type="button"
                        disabled={searchPage >= totalSearchPages}
                        onClick={() =>
                          setSearchPage((prev) =>
                            Math.min(totalSearchPages, prev + 1),
                          )
                        }
                        className="flex items-center gap-1 rounded-lg border px-3 py-1.5 transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-surface-dark-secondary"
                      >
                        {t('common.nextPage')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** ====== Preview entry row — inline version for the embedded preview ====== */

function formatPublishedAt(value: number): string {
  if (!value) return ''
  return new Date(value).toLocaleDateString()
}

function PreviewEntryInline({
  entry,
  onSelect,
}: {
  entry: DiscoverFeedPreviewEntry
  onSelect: (entry: DiscoverFeedPreviewEntry) => void
}) {
  const hasImage = !!entry.imageUrl

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(entry)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(entry)
        }
      }}
      className="group flex min-h-[64px] cursor-pointer items-start gap-3 bg-[var(--color-bg-primary)] px-3 py-2.5 transition-colors hover:bg-[var(--color-bg-secondary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/40"
    >
      {hasImage ? (
        <img
          src={entry.imageUrl}
          alt=""
          loading="lazy"
          className="h-10 w-10 flex-shrink-0 rounded-lg bg-[var(--color-bg-tertiary)] object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)]"
        >
          <Rss size={12} className="text-[var(--color-text-tertiary)]" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h4 className="line-clamp-2 text-xs font-medium leading-snug text-[var(--color-text-primary)] group-hover:text-accent">
          {entry.title || entry.url}
        </h4>
        {entry.summary && (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
            {entry.summary}
          </p>
        )}
        {(entry.author || formatPublishedAt(entry.publishedAt)) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-text-tertiary)]">
            {entry.author && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <User size={10} aria-hidden="true" />
                <span className="truncate">{entry.author}</span>
              </span>
            )}
            {formatPublishedAt(entry.publishedAt) && (
              <span className="inline-flex items-center gap-1">
                <Calendar size={10} aria-hidden="true" />
                {formatPublishedAt(entry.publishedAt)}
              </span>
            )}
          </div>
        )}
      </div>

      <ExternalLink
        size={12}
        className="mt-1 flex-shrink-0 text-[var(--color-text-tertiary)] opacity-0 transition-opacity group-hover:opacity-60"
        aria-hidden="true"
      />
    </div>
  )
}

/** ====== Curated feed row — simpler variant for recommended feeds ====== */

interface CuratedFeedInfo {
  title: string
  url: string
  siteUrl: string
  description: string
  category: string
  language: string
  imageUrl?: string
}

function CuratedFeedRow({
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
      className="group flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-3.5 transition-all duration-200 hover:border-accent/30 hover:bg-surface-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary/50"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10">
        <Rss size={16} className="text-accent" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="block min-w-0 truncate text-sm font-medium">
            {feed.title}
          </span>
          <span className="flex-shrink-0 rounded-full bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary dark:bg-surface-dark-tertiary">
            {feed.language === 'Chinese' ? '中' : 'EN'}
          </span>
        </div>
        {feed.description && (
          <p className="mt-0.5 truncate text-xs text-text-secondary dark:text-text-dark-secondary">
            {feed.description}
          </p>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        <a
          href={feed.siteUrl || feed.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="rounded-lg p-1.5 text-text-tertiary opacity-0 transition-colors hover:bg-surface-secondary hover:text-text-secondary focus:opacity-100 group-hover:opacity-100 dark:hover:bg-surface-dark-tertiary"
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
              : 'bg-accent text-white hover:bg-accent-hover active:scale-95'
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
              <span>{t('discover.previewAction')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
