import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useDiscoverStore, DiscoverSearchPlatform } from "../../store/discover-store"
import { useFeedStore } from "../../store/feed-store"
import { FeedViewType } from "../../../../shared/types"
import { VIEW_TYPE_I18N_KEYS } from "../../lib/view-type-keys"
import {
  Search,
  X,
  Loader2,
  Plus,
  Check,
  ExternalLink,
  Rss,
  Globe,
  Sparkles,
} from "lucide-react"

// Platform icon SVGs
const platformIcons: Record<string, React.ReactNode> = {
  youtube: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  bilibili: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373z"/>
    </svg>
  ),
  x: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  instagram: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  ),
}

const SEARCH_RESULTS_PAGE_SIZE = 6

function inferResultTitleFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname

    const bili = path.match(/\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i)
    if (bili?.[1]) return `UID ${bili[1]} - Bilibili`

    const x = path.match(/\/twitter\/user\/([a-zA-Z0-9_]+)/i)
    if (x?.[1]) return `@${x[1]} - X`

    const ig = path.match(/\/instagram\/user\/([^/?#]+)/i)
    if (ig?.[1]) return `@${decodeURIComponent(ig[1])} - Instagram`

    const host = u.hostname.replace(/^www\./i, "")
    return `${host} - RSS`
  } catch {
    return url
  }
}

function getDisplayTitle(result: { title: string; url: string }): string {
  const title = (result.title || "").trim()
  if (title && title !== result.url) return title
  return inferResultTitleFromUrl(result.url)
}

function extractInstagramUsernameFromFeedUrl(feedUrl: string): string | null {
  try {
    const u = new URL(feedUrl)
    const m = u.pathname.match(/\/instagram\/user\/([^/?#]+)/i)
    if (m?.[1]) return decodeURIComponent(m[1]).replace(/^@+/, "")
  } catch {
    // Ignore malformed URL.
  }
  return null
}

function buildDiscoverAvatarFallbacks(imageUrl: string | undefined, feedUrl: string): string[] {
  const out: string[] = []
  if (imageUrl) out.push(imageUrl)

  const igUser = extractInstagramUsernameFromFeedUrl(feedUrl)
  if (igUser) {
    out.push(`https://unavatar.io/instagram/${encodeURIComponent(igUser)}?fallback=false`)
    out.push(`https://unavatar.io/${encodeURIComponent(`instagram.com/${igUser}`)}?fallback=false`)
  }

  const seen = new Set<string>()
  return out.filter((x) => {
    const key = x.trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function canonicalizeDiscoverRoute(inputUrl: string): string {
  const raw = (inputUrl || "").trim()
  if (!raw) return ""

  let routeWithQuery = ""
  const rsshubMatch = raw.match(/^rsshub:\/\/+(.+)$/i)
  if (rsshubMatch?.[1]) {
    routeWithQuery = rsshubMatch[1].replace(/^\/+/, "")
  } else {
    try {
      const u = new URL(raw)
      routeWithQuery = `${u.pathname.replace(/^\/+/, "")}${u.search || ""}`
    } catch {
      return raw.toLowerCase()
    }
  }

  const [pathPart = "", queryPart = ""] = routeWithQuery.split("?", 2)
  let path = pathPart.toLowerCase()
  path = path.replace(/^(picnob(?:\.info)?|pixnoy|piokok)\/user\//i, "instagram/user/")
  path = path.replace(/^(?:x|twitter)\/user\/([^/?#]+)/i, (_m, user: string) => `twitter/user/${decodeURIComponent(user).replace(/^@/, "").toLowerCase()}`)

  if (/^instagram\/user\//i.test(path) || /^twitter\/user\//i.test(path)) {
    const search = new URLSearchParams(queryPart || "")
    search.delete("limit")
    const q = search.toString()
    return `${path}${q ? `?${q}` : ""}`
  }
  return `${path}${queryPart ? `?${queryPart}` : ""}`
}

export function DiscoverPanel() {
  const {
    searchQuery,
    searchPlatform,
    searchResults,
    isSearching,
    subscribingUrls,
    setOpen,
    search,
    setSearchQuery,
    setSearchPlatform,
    setSubscribing,
  } = useDiscoverStore()

  const { addFeed, feeds: userFeeds, removeFeed, refreshFeed } = useFeedStore()
  const { t } = useTranslation()
  const [subscribedUrls, setSubscribedUrls] = useState<Set<string>>(new Set())
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [subscribeHint, setSubscribeHint] = useState<string>("")
  const [pendingSubscribe, setPendingSubscribe] = useState<{
    url: string
    title: string
    preferredView: FeedViewType
  } | null>(null)
  const [selectedSubscribeView, setSelectedSubscribeView] = useState<FeedViewType | null>(null)
  const [searchPage, setSearchPage] = useState(1)
  const searchResultsTopRef = useRef<HTMLDivElement | null>(null)
  const subscribeHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Platform selector options
  const platformOptions: { value: DiscoverSearchPlatform; label: string; icon: React.ReactNode }[] = [
    { value: "all", label: t("common.all"), icon: <Globe size={16} /> },
    { value: "youtube", label: "YouTube", icon: platformIcons.youtube },
    { value: "bilibili", label: "Bilibili", icon: platformIcons.bilibili },
    { value: "x", label: "X", icon: platformIcons.x },
    { value: "instagram", label: "Instagram", icon: platformIcons.instagram },
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
    return () => {
      if (subscribeHintTimerRef.current) clearTimeout(subscribeHintTimerRef.current)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  useEffect(() => {
    setSearchPage(1)
  }, [searchQuery])

  useEffect(() => {
    if (pendingSubscribe) {
      setSelectedSubscribeView(pendingSubscribe.preferredView)
    } else {
      setSelectedSubscribeView(null)
    }
  }, [pendingSubscribe])

  const inferViewFromUrl = useCallback((targetUrl: string): FeedViewType => {
    const lower = (targetUrl || "").toLowerCase()
    if (/\/twitter\/user\//i.test(lower) || /\/bilibili\/user\/dynamic\//i.test(lower)) return FeedViewType.SocialMedia
    if (/\/youtube\//i.test(lower) || /\/bilibili\/user\/video\//i.test(lower)) return FeedViewType.Videos
    if (/\/instagram\//i.test(lower) || /\/picnob\//i.test(lower) || /\/pixnoy\//i.test(lower) || /\/piokok\//i.test(lower) || /\/imginn\//i.test(lower)) return FeedViewType.Pictures
    return FeedViewType.Articles
  }, [])

  const showSubscribedToHint = useCallback((url: string, feed?: { view?: number; category?: string; folder?: string }) => {
    const resolvedView = typeof feed?.view === "number" ? feed.view as FeedViewType : inferViewFromUrl(url)
    const columnName = t(VIEW_TYPE_I18N_KEYS[resolvedView] || "viewTypes.articles")
    const folder = (feed?.folder || feed?.category || "").trim()
    const isNormalFolder = !!folder && folder.toLowerCase() !== "recommended"
    const text = isNormalFolder
      ? t("discover.subscribedAddedToWithFolder", { column: columnName, folder })
      : t("discover.subscribedAddedTo", { column: columnName })
    setSubscribeHint(text)
    if (subscribeHintTimerRef.current) clearTimeout(subscribeHintTimerRef.current)
    subscribeHintTimerRef.current = setTimeout(() => setSubscribeHint(""), 2800)
  }, [inferViewFromUrl, t])

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      searchTimerRef.current = setTimeout(() => {
        search(query)
      }, 180)
    },
    [search, setSearchQuery]
  )

  const handleSubscribe = async (url: string, title: string, targetView?: FeedViewType) => {
    setSubscribing(url, true)
    try {
      const result = await addFeed(url, undefined, targetView, title)
      if (result.success) {
        setSubscribedUrls((prev) => {
          const next = new Set(prev)
          next.add(url)
          const canonical = canonicalizeDiscoverRoute(url)
          if (canonical) next.add(`route:${canonical}`)
          return next
        })
        showSubscribedToHint(url, result.feed)
        const feedId = result.feed?.id
        if (feedId) {
          // Run the same path as manual "refresh feed" so users don't need extra clicks.
          void (async () => {
            await new Promise((r) => setTimeout(r, 1200))
            await refreshFeed(feedId)
            await new Promise((r) => setTimeout(r, 2500))
            await refreshFeed(feedId)
          })()
        }
      }
    } finally {
      setSubscribing(url, false)
    }
  }

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

  const handleToggleSubscribe = (url: string, title: string) => {
    if (isSubscribed(url)) {
      handleUnsubscribe(url)
    } else {
      setPendingSubscribe({
        url,
        title,
        preferredView: inferViewFromUrl(url),
      })
    }
  }

  const isSubscribed = (url: string) => subscribedUrls.has(url)
    || subscribedUrls.has(`route:${canonicalizeDiscoverRoute(url)}`)
  const isSubscribing = (url: string) => subscribingUrls.has(url)
  const hasSearchQuery = searchQuery.trim().length > 0
  const totalSearchPages = Math.max(1, Math.ceil(searchResults.length / SEARCH_RESULTS_PAGE_SIZE))

  useEffect(() => {
    setSearchPage((prev) => Math.min(prev, totalSearchPages))
  }, [totalSearchPages])

  useEffect(() => {
    if (!hasSearchQuery) return
    searchResultsTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })
  }, [searchPage, hasSearchQuery])

  const pagedSearchResults = useMemo(() => {
    const start = (searchPage - 1) * SEARCH_RESULTS_PAGE_SIZE
    return searchResults.slice(start, start + SEARCH_RESULTS_PAGE_SIZE)
  }, [searchPage, searchResults])

  const searchBar = (
    <div className="space-y-2.5 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        {/* Platform selector */}
        <div className="flex items-center gap-1.5 text-[11px]">
          {platformOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSearchPlatform(option.value)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-colors ${
                searchPlatform === option.value
                  ? "bg-accent text-white font-medium"
                  : "bg-surface-secondary dark:bg-surface-dark-secondary text-text-secondary dark:text-text-dark-secondary hover:bg-accent/10"
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
            placeholder={t("discover.searchPlaceholder")}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-surface-secondary dark:bg-surface-dark-secondary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 placeholder:text-text-tertiary"
          />
          {isSearching && hasSearchQuery && (
            <div className="absolute left-3 right-3 -bottom-1 h-0.5 overflow-hidden rounded-full bg-accent/10">
              <div className="h-full w-1/3 bg-accent/70 search-progress-slide" />
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative flex-1 flex flex-col min-w-0 bg-white dark:bg-surface-dark overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white/80 dark:bg-surface-dark/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-6 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-accent" />
            <h2 className="text-lg font-semibold">{t("discover.title")}</h2>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="w-full pt-[18vh]">{searchBar}</div>

        {subscribeHint && (
          <div className="w-full mt-2 mb-3 rounded-lg border border-emerald-300/60 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {subscribeHint}
          </div>
        )}

        {/* Search results */}
        {hasSearchQuery && (
          <div className="space-y-3 mt-4 max-w-2xl mx-auto">
            <div ref={searchResultsTopRef} />
            <h3 className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary">
              {t("discover.searchResults")} {searchResults.length > 0 && `(${searchResults.length})`}
            </h3>
            {isSearching && searchResults.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-[68px] rounded-xl border bg-white dark:bg-surface-dark-secondary px-3.5 py-3 animate-pulse"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-secondary dark:bg-surface-dark-tertiary" />
                      <div className="flex-1 min-w-0">
                        <div className="h-3.5 w-1/3 rounded bg-surface-secondary dark:bg-surface-dark-tertiary mb-2" />
                        <div className="h-3 w-1/2 rounded bg-surface-secondary dark:bg-surface-dark-tertiary" />
                      </div>
                      <div className="h-7 w-14 rounded-lg bg-surface-secondary dark:bg-surface-dark-tertiary" />
                    </div>
                  </div>
                ))}
              </div>
            ) : searchResults.length === 0 && !isSearching ? (
              <div className="text-center py-12 text-text-tertiary">
                <Search size={36} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">{t("discover.noSearchResults")}</p>
                <p className="text-xs mt-1">{t("discover.tryFullLink")}</p>
              </div>
            ) : (
              <>
                {/* Results - single column with fixed height */}
                <div className="space-y-2" style={{ minHeight: `${SEARCH_RESULTS_PAGE_SIZE * 70}px` }}>
                  {pagedSearchResults.map((result) => (
                    <FeedCard
                      key={result.url}
                      title={getDisplayTitle(result)}
                      url={result.url}
                      description={result.description}
                      imageUrl={result.image}
                      followers={result.followers}
                      subscribed={isSubscribed(result.url)}
                      subscribing={isSubscribing(result.url)}
                      onSubscribe={() => handleToggleSubscribe(result.url, result.title)}
                    />
                  ))}
                  {/* Placeholders to maintain fixed height */}
                  {pagedSearchResults.length < SEARCH_RESULTS_PAGE_SIZE &&
                    Array.from({ length: SEARCH_RESULTS_PAGE_SIZE - pagedSearchResults.length }).map((_, idx) => (
                      <div key={`placeholder-${idx}`} className="h-[66px]" />
                    ))}
                </div>

                {/* Pagination - always visible at fixed position */}
                {searchResults.length > SEARCH_RESULTS_PAGE_SIZE && (
                  <div className="pt-4 pb-2">
                    <div className="flex items-center justify-center gap-3 text-xs text-text-secondary dark:text-text-dark-secondary">
                      <button
                        type="button"
                        disabled={searchPage <= 1}
                        onClick={() => setSearchPage((prev) => Math.max(1, prev - 1))}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors"
                      >
                        {t("common.prevPage")}
                      </button>
                      <span className="tabular-nums font-medium min-w-[60px] text-center">
                        {searchPage} / {totalSearchPages}
                      </span>
                      <button
                        type="button"
                        disabled={searchPage >= totalSearchPages}
                        onClick={() => setSearchPage((prev) => Math.min(totalSearchPages, prev + 1))}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors"
                      >
                        {t("common.nextPage")}
                      </button>
                    </div>
                  </div>
                )}

                {/* Additional content below pagination */}
                <div className="pt-4 pb-8">
                  {/* Add more content here */}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {pendingSubscribe && (
        <div
          className="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center"
          onClick={() => setPendingSubscribe(null)}
        >
          <div
            className="w-[460px] max-w-[94vw] rounded-2xl border border-black/5 bg-white dark:bg-surface-dark-secondary shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold">{t("discover.chooseColumnTitle")}</h3>
              <button
                onClick={() => setPendingSubscribe(null)}
                className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary mb-4">
              {t("discover.chooseColumnDesc", { title: pendingSubscribe.title })}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {([FeedViewType.Articles, FeedViewType.SocialMedia, FeedViewType.Videos, FeedViewType.Pictures] as const).map((viewId) => {
                const isPreferred = pendingSubscribe.preferredView === viewId
                const isSelected = selectedSubscribeView === viewId
                return (
                  <button
                    key={viewId}
                    onClick={() => setSelectedSubscribeView(viewId)}
                    className={`text-left rounded-xl border px-3 py-3 text-sm transition-all ${
                      isSelected
                        ? "border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(255,106,0,0.2)]"
                        : "hover:border-accent/40 hover:bg-accent/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{t(VIEW_TYPE_I18N_KEYS[viewId] || "viewTypes.articles")}</div>
                    </div>
                    <div className="text-[11px] text-text-tertiary mt-1">
                      {isPreferred ? t("discover.recommendedColumn") : t("discover.tapToAdd")}
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingSubscribe(null)}
                className="px-3 py-1.5 rounded-lg text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={async () => {
                  if (!pendingSubscribe) return
                  const payload = pendingSubscribe
                  const selectedView = selectedSubscribeView ?? payload.preferredView
                  setPendingSubscribe(null)
                  await handleSubscribe(payload.url, payload.title, selectedView)
                }}
                className="px-3.5 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover active:scale-[0.99] transition-all"
              >
                {t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
  )
}

/** Individual feed card component */
function FeedCard({
  title,
  url,
  description,
  imageUrl,
  badge,
  language,
  compact,
  subscribed,
  subscribing,
  onSubscribe,
  followers,
}: {
  title: string
  url: string
  description: string
  imageUrl?: string
  badge?: string
  language?: string
  compact?: boolean
  subscribed: boolean
  subscribing: boolean
  onSubscribe: () => void
  followers?: string
}) {
  const { t } = useTranslation()
  const avatarCandidates = useMemo(() => buildDiscoverAvatarFallbacks(imageUrl, url), [imageUrl, url])
  const [avatarSrc, setAvatarSrc] = useState<string>(avatarCandidates[0] || "")

  useEffect(() => {
    setAvatarSrc(avatarCandidates[0] || "")
  }, [avatarCandidates])

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border bg-white dark:bg-surface-dark-secondary hover:border-accent/30 transition-all duration-200 ${
        compact ? "p-2.5" : "p-3.5"
      }`}
    >
      {/* Icon */}
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt=""
          className={`flex-shrink-0 rounded-lg object-cover ${compact ? "w-8 h-8" : "w-10 h-10"}`}
          loading="lazy"
          onError={(e) => {
            const current = e.currentTarget.currentSrc || e.currentTarget.src
            const idx = avatarCandidates.findIndex((candidate) => candidate === current)
            const next = idx >= 0 ? avatarCandidates[idx + 1] : avatarCandidates[1]
            if (next) {
              setAvatarSrc(next)
              return
            }
            setAvatarSrc("")
          }}
        />
      ) : null}
      <div
        className={`flex-shrink-0 rounded-lg bg-accent/10 flex items-center justify-center ${
          compact ? "w-8 h-8" : "w-10 h-10"
        }`}
        style={{ display: avatarSrc ? "none" : "flex" }}
      >
        <Rss size={compact ? 14 : 16} className="text-accent" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`block min-w-0 font-medium truncate ${compact ? "text-xs" : "text-sm"}`}>
            {title}
          </span>
          {badge && (
            <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent">
              {badge}
            </span>
          )}
          {language && (
            <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-tertiary dark:bg-surface-dark-tertiary text-text-tertiary">
              {language === "zh" ? "中" : language === "en" ? "EN" : language.toUpperCase()}
            </span>
          )}
        </div>
        <p
          className={`text-text-secondary dark:text-text-dark-secondary truncate mt-0.5 ${
            compact ? "text-[10px]" : "text-xs"
          }`}
        >
          {followers || description}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.preventDefault()
            window.open(url, "_blank")
          }}
          className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary transition-colors opacity-0 group-hover:opacity-100"
          title={t("discover.viewSource")}
        >
          <ExternalLink size={14} />
        </a>
        <button
          onClick={onSubscribe}
          disabled={subscribing}
          className={`group/btn flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            subscribed
              ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400"
              : "bg-accent text-white hover:bg-accent-hover active:scale-95"
          } disabled:opacity-70 disabled:cursor-default`}
        >
          {subscribing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : subscribed ? (
            <>
              <Check size={12} className="group-hover/btn:hidden" />
              <X size={12} className="hidden group-hover/btn:block" />
              <span className="group-hover/btn:hidden">{t("common.subscribed")}</span>
              <span className="hidden group-hover/btn:block">{t("discover.unsubscribeAction")}</span>
            </>
          ) : (
            <>
              <Plus size={12} />
              <span>{t("common.subscribe")}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
