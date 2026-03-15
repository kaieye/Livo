import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useDiscoverStore } from "../../store/discover-store"
import { useFeedStore } from "../../store/feed-store"
import { TRENDING_FEEDS, FEED_BUNDLES } from "../../../../shared/discover-data"
import {
  Search,
  X,
  ArrowLeft,
  Loader2,
  Plus,
  Check,
  ExternalLink,
  Rss,
  Globe,
  Cpu,
  Code,
  Newspaper,
  Palette,
  PenLine,
  TrendingUp,
  Radio,
  Gamepad2,
  FlaskConical,
  Users,
  BookOpen,
  Sparkles,
  Zap,
} from "lucide-react"

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  tech: <Cpu size={20} />,
  programming: <Code size={20} />,
  news: <Newspaper size={20} />,
  design: <Palette size={20} />,
  blog: <PenLine size={20} />,
  finance: <TrendingUp size={20} />,
  media: <Radio size={20} />,
  acg: <Gamepad2 size={20} />,
  science: <FlaskConical size={20} />,
  social: <Users size={20} />,
  reading: <BookOpen size={20} />,
}

const CATEGORY_COLORS: Record<string, string> = {
  tech: "from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400",
  programming: "from-emerald-500/20 to-green-500/20 text-emerald-600 dark:text-emerald-400",
  news: "from-red-500/20 to-orange-500/20 text-red-600 dark:text-red-400",
  design: "from-pink-500/20 to-fuchsia-500/20 text-pink-600 dark:text-pink-400",
  blog: "from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-400",
  finance: "from-amber-500/20 to-yellow-500/20 text-amber-600 dark:text-amber-400",
  media: "from-indigo-500/20 to-blue-500/20 text-indigo-600 dark:text-indigo-400",
  acg: "from-rose-500/20 to-pink-500/20 text-rose-600 dark:text-rose-400",
  science: "from-teal-500/20 to-cyan-500/20 text-teal-600 dark:text-teal-400",
  social: "from-sky-500/20 to-blue-500/20 text-sky-600 dark:text-sky-400",
  reading: "from-stone-500/20 to-zinc-500/20 text-stone-600 dark:text-stone-400",
}

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
    categories,
    selectedCategory,
    feeds,
    rsshubRoutes,
    searchQuery,
    searchResults,
    isSearching,
    isLoading,
    subscribingUrls,
    setOpen,
    selectCategory,
    search,
    setSearchQuery,
    setSubscribing,
  } = useDiscoverStore()

  const { addFeed, feeds: userFeeds, removeFeed } = useFeedStore()
  const { t } = useTranslation()
  const [subscribedUrls, setSubscribedUrls] = useState<Set<string>>(new Set())
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Sync subscribedUrls with existing user feeds
  useEffect(() => {
    const urls = new Set(userFeeds.map((f) => f.url))
    setSubscribedUrls(urls)
  }, [userFeeds])

  useEffect(() => {
    // Load initial data
    if (!selectedCategory && categories.length > 0) {
      selectCategory(null)
    }
  }, [categories.length])

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query)
      if (searchTimer) clearTimeout(searchTimer)
      const timer = setTimeout(() => {
        search(query)
      }, 400)
      setSearchTimer(timer)
    },
    [search, setSearchQuery, searchTimer]
  )

  const handleSubscribe = async (url: string, title: string) => {
    setSubscribing(url, true)
    try {
      const result = await addFeed(url, undefined, undefined, title)
      if (result.success) {
        setSubscribedUrls((prev) => new Set(prev).add(url))
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
      handleSubscribe(url, title)
    }
  }

  const isSubscribed = (url: string) => subscribedUrls.has(url)
  const isSubscribing = (url: string) => subscribingUrls.has(url)

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-surface-dark overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white/80 dark:bg-surface-dark/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-6 py-3">
          {selectedCategory && (
            <button
              onClick={() => selectCategory(null)}
              className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-accent" />
            <h2 className="text-lg font-semibold">
              {selectedCategory
                ? categories.find((c) => c.id === selectedCategory)?.name || t("discover.title")
                : t("discover.title")}
            </h2>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-6 pb-3">
          <div className="relative">
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
            {isSearching && (
              <Loader2
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-accent"
              />
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Search results */}
        {searchQuery.trim() ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary">
              {t("discover.searchResults")} {searchResults.length > 0 && `(${searchResults.length})`}
            </h3>
            {searchResults.length === 0 && !isSearching ? (
              <div className="text-center py-12 text-text-tertiary">
                <Search size={36} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">{t("discover.noSearchResults")}</p>
                <p className="text-xs mt-1">{t("discover.tryFullLink")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <FeedCard
                    key={result.url}
                    title={getDisplayTitle(result)}
                    url={result.url}
                    description={result.description}
                    badge={
                      result.source === "rsshub"
                        ? "RSSHub"
                        : result.source === "url"
                          ? "URL"
                          : undefined
                    }
                    subscribed={isSubscribed(result.url)}
                    subscribing={isSubscribing(result.url)}
                    onSubscribe={() => handleToggleSubscribe(result.url, result.title)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : !selectedCategory ? (
          /* Category grid */
          <div>
            {/* 🔥 Trending / Recommended */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-3 flex items-center gap-1.5">
                <Sparkles size={14} className="text-accent" />
                {t("discover.recommended")}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {TRENDING_FEEDS.map((feed) => (
                  <div
                    key={feed.url}
                    className="flex items-start gap-3 p-3 rounded-xl border bg-gradient-to-br from-accent/[0.03] to-transparent hover:border-accent/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-accent mb-0.5">{feed.reason}</div>
                      <div className="font-medium text-sm truncate">{feed.title}</div>
                      <div className="text-xs text-text-tertiary line-clamp-1 mt-0.5">{feed.description}</div>
                    </div>
                    <button
                      onClick={() => handleToggleSubscribe(feed.url, feed.title)}
                      disabled={isSubscribing(feed.url)}
                      className={`flex-shrink-0 p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        isSubscribed(feed.url)
                          ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400"
                          : "bg-accent/10 text-accent hover:bg-accent/20"
                      }`}
                    >
                      {isSubscribing(feed.url) ? <Loader2 size={14} className="animate-spin" /> : isSubscribed(feed.url) ? <Check size={14} /> : <Plus size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick-start bundles */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-3 flex items-center gap-1.5">
                <Zap size={14} className="text-amber-500" />
                {t("discover.quickBundles")}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {FEED_BUNDLES.map((bundle) => (
                  <button
                    key={bundle.id}
                    onClick={async () => {
                      for (const f of bundle.feeds) {
                        if (!isSubscribed(f.url) && !isSubscribing(f.url)) {
                          await handleSubscribe(f.url, f.title)
                        }
                      }
                    }}
                    className="text-left p-3 rounded-xl border hover:border-accent/30 hover:bg-accent/[0.02] transition-colors"
                  >
                    <div className="font-medium text-sm">{bundle.name}</div>
                    <div className="text-xs text-text-tertiary mt-0.5">{bundle.description}</div>
                    <div className="text-[10px] text-accent mt-1.5">{t("discover.feedCount", { count: bundle.feeds.length })}</div>
                  </button>
                ))}
              </div>
            </div>

            <h3 className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-4">
              {t("discover.browseCategories")}
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => selectCategory(cat.id)}
                  className={`flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br ${CATEGORY_COLORS[cat.id] || "from-gray-500/20 to-gray-500/20 text-gray-600"} hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-left`}
                >
                  <div className="flex-shrink-0">
                    {CATEGORY_ICONS[cat.id] || <Globe size={20} />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{cat.name}</div>
                    <div className="text-xs opacity-70 truncate">{cat.description}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Popular RSSHub routes */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} className="text-accent" />
                <h3 className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary">
                  {t("discover.rsshubRoutes")}
                </h3>
                <span className="text-xs text-text-tertiary">{t("discover.rsshubRoutesHint")}</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {rsshubRoutes.slice(0, 12).map((route) => (
                  <FeedCard
                    key={route.url}
                    title={route.name}
                    url={route.url}
                    description={route.description}
                    badge="RSSHub"
                    compact
                    subscribed={isSubscribed(route.url)}
                    subscribing={isSubscribing(route.url)}
                    onSubscribe={() => handleToggleSubscribe(route.url, route.name)}
                  />
                ))}
              </div>
            </div>

            {/* Featured feeds */}
            <div>
              <h3 className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-4">
                {t("discover.featuredFeeds")}
              </h3>
              <div className="space-y-2">
                {feeds.slice(0, 10).map((feed) => (
                  <FeedCard
                    key={feed.url}
                    title={feed.title}
                    url={feed.url}
                    description={feed.description}
                    language={feed.language}
                    subscribed={isSubscribed(feed.url)}
                    subscribing={isSubscribing(feed.url)}
                    onSubscribe={() => handleToggleSubscribe(feed.url, feed.title)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Category detail */
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-accent" />
              </div>
            ) : (
              <>
                {/* Curated feeds for category */}
                <div className="space-y-2 mb-8">
                  <h3 className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-3">
                    {t("discover.curatedFeeds")} ({feeds.length})
                  </h3>
                  {feeds.map((feed) => (
                    <FeedCard
                      key={feed.url}
                      title={feed.title}
                      url={feed.url}
                      description={feed.description}
                      language={feed.language}
                      subscribed={isSubscribed(feed.url)}
                      subscribing={isSubscribing(feed.url)}
                      onSubscribe={() => handleToggleSubscribe(feed.url, feed.title)}
                    />
                  ))}
                  {feeds.length === 0 && (
                    <p className="text-sm text-text-tertiary text-center py-8">{t("discover.noCategoryFeeds")}</p>
                  )}
                </div>

                {/* RSSHub routes for category */}
                {rsshubRoutes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Zap size={14} className="text-accent" />
                      <h3 className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary">
                        {t("discover.rsshubCategory")}
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {rsshubRoutes.map((route) => (
                        <FeedCard
                          key={route.url}
                          title={route.name}
                          url={route.url}
                          description={route.description}
                          badge="RSSHub"
                          subscribed={isSubscribed(route.url)}
                          subscribing={isSubscribing(route.url)}
                          onSubscribe={() => handleToggleSubscribe(route.url, route.name)}
                        />
                      ))}
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

/** Individual feed card component */
function FeedCard({
  title,
  url,
  description,
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
      <div
        className={`flex-shrink-0 rounded-lg bg-accent/10 flex items-center justify-center ${
          compact ? "w-8 h-8" : "w-10 h-10"
        }`}
      >
        <Rss size={compact ? 14 : 16} className="text-accent" />
      </div>

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
