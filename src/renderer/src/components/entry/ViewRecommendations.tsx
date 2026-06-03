import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  FileText,
  Inbox,
  Loader2,
  Play,
  Plus,
  Users,
} from 'lucide-react'
import { useFeedStore } from '../../store/feed-store'
import { useDiscoverStore } from '../../store/discover-store'
import { useGeneralSettingKey } from '../../store/settings-store'
import { RECOMMENDED_CATEGORY } from '../../hooks/useInitRecommendedFeeds'
import { FeedViewType } from '../../../../shared/types'
import {
  DEFAULT_RSSHUB_INSTANCE,
  RECOMMENDED_ARTICLE_FEEDS,
  RECOMMENDED_SOCIAL_FEEDS,
  RECOMMENDED_VIDEO_FEEDS,
  type RecommendedFeed,
} from '../../../../shared/discover-data'

const VIEW_RECOMMENDATIONS_CONFIG: Record<
  number,
  {
    feeds: RecommendedFeed[]
    icon: ReactNode
    headerIcon: ReactNode
    iconBg: string
    cardGradient: string
    discoverKey: string
    subscribeKey: string
  }
> = {
  [FeedViewType.Articles]: {
    feeds: RECOMMENDED_ARTICLE_FEEDS,
    icon: <FileText size={16} className="text-blue-500" />,
    headerIcon: <FileText size={28} className="text-blue-500" />,
    iconBg: 'bg-blue-500/10',
    cardGradient: 'from-blue-500/[0.03] to-cyan-500/[0.03]',
    discoverKey: 'recommendations.discoverContent',
    subscribeKey: 'recommendations.subscribeToStart',
  },
  [FeedViewType.Videos]: {
    feeds: RECOMMENDED_VIDEO_FEEDS as RecommendedFeed[],
    icon: <Play size={16} className="ml-0.5 text-rose-500" />,
    headerIcon: <Play size={28} className="ml-0.5 text-rose-500" />,
    iconBg: 'bg-rose-500/10',
    cardGradient: 'from-rose-500/[0.03] to-purple-500/[0.03]',
    discoverKey: 'recommendations.discoverVideos',
    subscribeKey: 'recommendations.subscribeVideos',
  },
  [FeedViewType.SocialMedia]: {
    feeds: RECOMMENDED_SOCIAL_FEEDS,
    icon: <Users size={16} className="text-sky-500" />,
    headerIcon: <Users size={28} className="text-sky-500" />,
    iconBg: 'bg-sky-500/10',
    cardGradient: 'from-sky-500/[0.03] to-blue-500/[0.03]',
    discoverKey: 'recommendations.discoverSocial',
    subscribeKey: 'recommendations.subscribeSocial',
  },
}

export function ViewRecommendations({ viewType }: { viewType: FeedViewType }) {
  const { addFeed, updateFeed, feeds: userFeeds } = useFeedStore()
  const { setOpen } = useDiscoverStore()
  const { t } = useTranslation()
  const rsshubInstance =
    useGeneralSettingKey('rsshubInstance') || DEFAULT_RSSHUB_INSTANCE
  const [subscribingUrls, setSubscribingUrls] = useState<Set<string>>(new Set())
  const [subscribedUrls, setSubscribedUrls] = useState<Set<string>>(new Set())
  const rsshubBase = rsshubInstance.replace(/\/+$/, '')

  const config = VIEW_RECOMMENDATIONS_CONFIG[viewType]

  useEffect(() => {
    setSubscribedUrls(
      new Set(
        userFeeds
          .filter((feed) => feed.category !== RECOMMENDED_CATEGORY)
          .map((feed) => feed.url),
      ),
    )
  }, [userFeeds])

  const getFullUrl = useCallback(
    (feed: RecommendedFeed) =>
      feed.isRSSHub ? `${rsshubBase}${feed.url}` : feed.url,
    [rsshubBase],
  )

  const resolveRecommendedUrl = useCallback(
    async (feed: RecommendedFeed) => {
      const fullUrl = getFullUrl(feed)
      if (!feed.isRSSHub) return fullUrl
      const instagramMatch = feed.url.match(/^\/instagram\/user\/([^/?#]+)/i)
      if (!instagramMatch) return fullUrl
      try {
        const username = decodeURIComponent(instagramMatch[1])
        const result = await window.api.discover.probeInstagramUser(username)
        if (result.valid && result.feedUrl) return result.feedUrl
      } catch {
        // Fall back to the configured RSSHub URL when probing fails.
      }
      return fullUrl
    },
    [getFullUrl],
  )

  const handleSubscribe = async (feed: RecommendedFeed) => {
    const fullUrl = getFullUrl(feed)
    setSubscribingUrls((prev) => new Set(prev).add(fullUrl))
    try {
      const resolvedUrl = await resolveRecommendedUrl(feed)
      const instagramMatch = feed.url.match(/^\/instagram\/user\/([^/?#]+)/i)
      const existing = userFeeds.find((userFeed) => {
        if (userFeed.url === fullUrl || userFeed.url === resolvedUrl)
          return true
        if (!instagramMatch) return false
        const match = userFeed.url.match(/\/instagram\/user\/([^/?#]+)/i)
        return !!(
          match &&
          decodeURIComponent(match[1]).toLowerCase() ===
            decodeURIComponent(instagramMatch[1]).toLowerCase()
        )
      })
      if (existing) {
        const updates: { category: string; url?: string } = { category: '' }
        if (existing.url !== resolvedUrl) updates.url = resolvedUrl
        await updateFeed(existing.id, updates)
        setSubscribedUrls((prev) => new Set(prev).add(resolvedUrl))
      } else {
        const result = await addFeed(resolvedUrl, '', viewType, feed.title)
        if (result.success) {
          setSubscribedUrls((prev) => new Set(prev).add(resolvedUrl))
        }
      }
    } finally {
      setSubscribingUrls((prev) => {
        const next = new Set(prev)
        next.delete(fullUrl)
        return next
      })
    }
  }

  if (!config) {
    return (
      <div className="text-text-secondary dark:text-text-dark-secondary flex flex-col items-center justify-center py-12">
        <Inbox size={40} className="text-text-tertiary mb-3" />
        <p className="text-sm">{t('entryList.noArticles')}</p>
        <p className="mt-1 text-xs">{t('entryList.addFeedToStart')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col items-center pb-2 pt-4 text-center">
        <div
          className={`h-14 w-14 rounded-2xl ${config.iconBg} mb-3 flex items-center justify-center`}
        >
          {config.headerIcon}
        </div>
        <p className="text-sm font-medium">{t(config.discoverKey)}</p>
        <p className="text-text-tertiary mt-1 text-xs">
          {t(config.subscribeKey)}
        </p>
      </div>

      <div className="space-y-2">
        {config.feeds.map((feed) => {
          const fullUrl = getFullUrl(feed)
          const instagramMatch = feed.url.match(
            /^\/instagram\/user\/([^/?#]+)/i,
          )
          const isSubscribed =
            subscribedUrls.has(fullUrl) ||
            (!!instagramMatch &&
              userFeeds.some((userFeed) => {
                if (userFeed.category === RECOMMENDED_CATEGORY) return false
                const match = userFeed.url.match(
                  /\/instagram\/user\/([^/?#]+)/i,
                )
                return !!(
                  match &&
                  decodeURIComponent(match[1]).toLowerCase() ===
                    decodeURIComponent(instagramMatch[1]).toLowerCase()
                )
              }))
          const isCurrentlySubscribing = subscribingUrls.has(fullUrl)

          return (
            <div
              key={feed.url}
              className={`flex items-center gap-3 rounded-xl border bg-gradient-to-r p-3 ${config.cardGradient} hover:border-accent/30 transition-colors`}
            >
              <div
                className={`h-9 w-9 flex-shrink-0 rounded-lg ${config.iconBg} flex items-center justify-center`}
              >
                {config.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">
                    {feed.title}
                  </span>
                  {feed.isRSSHub && (
                    <span className="bg-accent/10 text-accent flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-medium">
                      RSSHub
                    </span>
                  )}
                </div>
                <p className="text-text-tertiary mt-0.5 truncate text-[11px]">
                  {feed.description}
                </p>
              </div>
              <button
                onClick={() => handleSubscribe(feed)}
                disabled={isCurrentlySubscribing}
                className={`flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
                  isSubscribed
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-accent hover:bg-accent-hover text-white active:scale-95'
                } disabled:opacity-60`}
              >
                {isCurrentlySubscribing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : isSubscribed ? (
                  <>
                    <Check size={12} />
                    <span>{t('common.subscribed')}</span>
                  </>
                ) : (
                  <>
                    <Plus size={12} />
                    <span>{t('common.subscribe')}</span>
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => setOpen(true)}
        className="text-text-secondary hover:border-accent hover:text-accent w-full rounded-xl border border-dashed py-2.5 text-sm transition-colors"
      >
        {t('recommendations.browseMore')}
      </button>
    </div>
  )
}
