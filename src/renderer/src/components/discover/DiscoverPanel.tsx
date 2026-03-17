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
  Youtube,
} from "lucide-react"

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

  const { addFeed, feeds: userFeeds, removeFeed } = useFeedStore()
  const { t } = useTranslation()
  const [subscribedUrls, setSubscribedUrls] = useState<Set<string>>(new Set())
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [subscribeHint, setSubscribeHint] = useState<string>("")
  const [pendingSubscribe, setPendingSubscribe] = useState<{
    url: string
    title: string
    preferredView: FeedViewType
  } | null>(null)
  const [searchPage, setSearchPage] = useState(1)
  const searchResultsTopRef = useRef<HTMLDivElement | null>(null)
  const subscribeHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Platform selector options
  const platformOptions: { value: DiscoverSearchPlatform; label: string; icon: React.ReactNode }[] = [
    { value: "all", label: t("common.all"), icon: <Globe size={14} /> },
    { value: "youtube", label: "YouTube", icon: <Youtube size={14} /> },
    { value: "bilibili", label: "Bilibili", icon: <span className="text-xs font-bold">B</span> },
    { value: "x", label: "X", icon: <span className="text-xs font-bold">X</span> },
  ]

  // Sync subscribedUrls with existing user feeds
  useEffect(() => {
    const urls = new Set(userFeeds.map((f) => f.url))
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

  const inferViewFromUrl = useCallback((targetUrl: string): FeedViewType => {
    const lower = (targetUrl || "").toLowerCase()
    if (/\/twitter\/user\//i.test(lower) || /\/bilibili\/user\/dynamic\//i.test(lower)) return FeedViewType.SocialMedia
    if (/\/youtube\//i.test(lower) || /\/bilibili\/user\/video\//i.test(lower)) return FeedViewType.Videos
    if (/\/instagram\//i.test(lower) || /\/picnob\//i.test(lower) || /\/pixnoy\//i.test(lower) || /\/piokok\//i.test(lower)) return FeedViewType.Pictures
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
        setSubscribedUrls((prev) => new Set(prev).add(url))
        showSubscribedToHint(url, result.feed)
      }
    } finally {
      setSubscribing(url, false)
    }
  }

  const handleUnsubscribe = async (url: string) => {
    const feed = userFeeds.find((f) => f.url === url)
    if (!feed) return
    setSubscribing(url, true)
    try {
      await removeFeed(feed.id)
      setSubscribedUrls((prev) => {
        const next = new Set(prev)
        next.delete(url)
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
        <div className="flex items-center gap-1 text-[11px]">
          {platformOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSearchPlatform(option.value)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full transition-colors ${
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
            className="w-[420px] max-w-[92vw] rounded-2xl border bg-white dark:bg-surface-dark-secondary shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">{t("discover.chooseColumnTitle")}</h3>
              <button
                onClick={() => setPendingSubscribe(null)}
                className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary mb-3">
              {t("discover.chooseColumnDesc", { title: pendingSubscribe.title })}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([FeedViewType.Articles, FeedViewType.SocialMedia, FeedViewType.Videos, FeedViewType.Pictures] as const).map((viewId) => {
                const isPreferred = pendingSubscribe.preferredView === viewId
                return (
                  <button
                    key={viewId}
                    onClick={async () => {
                      const payload = pendingSubscribe
                      setPendingSubscribe(null)
                      await handleSubscribe(payload.url, payload.title, viewId)
                    }}
                    className={`text-left rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                      isPreferred
                        ? "border-accent bg-accent/10"
                        : "hover:border-accent/40 hover:bg-accent/[0.03]"
                    }`}
                  >
                    <div className="font-medium">{t(VIEW_TYPE_I18N_KEYS[viewId] || "viewTypes.articles")}</div>
                    <div className="text-[11px] text-text-tertiary mt-0.5">
                      {isPreferred ? t("discover.recommendedColumn") : t("discover.tapToAdd")}
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setPendingSubscribe(null)}
                className="px-3 py-1.5 rounded-lg text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              >
                {t("common.cancel")}
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
}) {
  const { t } = useTranslation()
  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border bg-white dark:bg-surface-dark-secondary hover:border-accent/30 transition-all duration-200 ${
        compact ? "p-2.5" : "p-3.5"
      }`}
    >
      {/* Icon */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className={`flex-shrink-0 rounded-lg object-cover ${compact ? "w-8 h-8" : "w-10 h-10"}`}
          loading="lazy"
        />
      ) : (
        <div
          className={`flex-shrink-0 rounded-lg bg-accent/10 flex items-center justify-center ${
            compact ? "w-8 h-8" : "w-10 h-10"
          }`}
        >
          <Rss size={compact ? 14 : 16} className="text-accent" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium truncate ${compact ? "text-xs" : "text-sm"}`}>
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
          {description}
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
