import { useEffect, useRef } from "react"
import { useFeedStore } from "../store/feed-store"
import { useGeneralSettingKey } from "../store/settings-store"
import { FeedViewType } from "../../../shared/types"
import {
  RECOMMENDED_ARTICLE_FEEDS,
  RECOMMENDED_SOCIAL_FEEDS,
  RECOMMENDED_VIDEO_FEEDS,
  DEFAULT_RSSHUB_INSTANCE,
  type RecommendedFeed,
} from "../../../shared/discover-data"

/** Internal category name used for recommended feeds (not displayed directly) */
export const RECOMMENDED_CATEGORY = "Recommended"

/**
 * Bump this version whenever the recommended feed lists change.
 * On version change the hook will remove stale recommended feeds
 * and add the new ones.
 */
const RECOMMENDED_VERSION = 11
const STORAGE_KEY = "recommended_feeds_version"

const PLATFORM_TITLE_SUFFIX: Record<"X" | "instagram" | "bilibili" | "youtube", string> = {
  X: "X",
  instagram: "Instagram",
  bilibili: "Bilibili",
  youtube: "YouTube",
}

const VIEW_RECOMMENDED_MAP: Record<FeedViewType, RecommendedFeed[]> = {
  [FeedViewType.Articles]: RECOMMENDED_ARTICLE_FEEDS,
  [FeedViewType.SocialMedia]: RECOMMENDED_SOCIAL_FEEDS,
  [FeedViewType.Videos]: RECOMMENDED_VIDEO_FEEDS as unknown as RecommendedFeed[],
  [FeedViewType.Pictures]: [],
}

/** Build the set of canonical URLs for all current recommended feeds */
function getRecommendedUrls(rsshubInstance: string): Set<string> {
  const urls = new Set<string>()
  for (const recFeeds of Object.values(VIEW_RECOMMENDED_MAP)) {
    for (const feed of recFeeds) {
      const url = feed.isRSSHub
        ? `${rsshubInstance}${feed.url}`
        : feed.url
      urls.add(url)
    }
  }
  return urls
}

function getRecommendedTitleMap(rsshubInstance: string): Map<string, string> {
  const titles = new Map<string, string>()
  for (const recFeeds of Object.values(VIEW_RECOMMENDED_MAP)) {
    for (const feed of recFeeds) {
      const url = feed.isRSSHub
        ? `${rsshubInstance}${feed.url}`
        : feed.url
      titles.set(url, normalizePlatformFeedTitle(url, feed.title))
    }
  }
  return titles
}

function normalizePlatformFeedTitle(url: string, rawTitle: string): string {
  const title = (rawTitle || "").trim()
  const parsed = (() => {
    try {
      return new URL(url)
    } catch {
      return null
    }
  })()
  const pathname = parsed?.pathname || url
  const host = (parsed?.hostname || "").toLowerCase()

  const withPlatform = (platform: "X" | "instagram" | "bilibili" | "youtube", user: string): string =>
    `${user.replace(/^@/, "").trim()} - ${PLATFORM_TITLE_SUFFIX[platform]}`
  const withPlatformTitle = (platform: "X" | "instagram" | "bilibili" | "youtube", fallbackUser: string): string => {
    const suffix = PLATFORM_TITLE_SUFFIX[platform]
    const cleaned = title.replace(new RegExp(`\\s*-\\s*${suffix}\\s*$`, "i"), "").trim()
    if (cleaned) return `${cleaned} - ${suffix}`
    return withPlatform(platform, fallbackUser)
  }

  const xRoute = pathname.match(/\/twitter\/user\/([^/?#]+)/i)
  if (xRoute?.[1]) return withPlatformTitle("X", decodeURIComponent(xRoute[1]))
  if (host === "x.com") {
    const user = pathname.split("/").filter(Boolean)[0]
    if (user) return withPlatformTitle("X", decodeURIComponent(user))
  }

  const igRoute = pathname.match(/\/instagram\/user\/([^/?#]+)/i)
  if (igRoute?.[1]) return withPlatform("instagram", decodeURIComponent(igRoute[1]))
  if (host === "www.instagram.com" || host === "instagram.com") {
    const user = pathname.split("/").filter(Boolean)[0]
    if (user) return withPlatform("instagram", decodeURIComponent(user))
  }

  const biliRoute = pathname.match(/\/bilibili\/user\/(?:video|dynamic|article)\/([^/?#]+)/i)
  if (biliRoute?.[1]) return withPlatform("bilibili", decodeURIComponent(biliRoute[1]))
  if (/\/bilibili\//i.test(pathname) && title) {
    return `${title.replace(/\s*-\s*Bilibili$/i, "").trim()} - Bilibili`
  }

  const ytRoute = pathname.match(/\/youtube\/(?:user|channel)\/([^/?#]+)/i)
  if (ytRoute?.[1]) return withPlatform("youtube", decodeURIComponent(ytRoute[1]))
  if (/youtube\.com\/feeds\/videos\.xml/i.test(url)) {
    const base = title || "YouTube"
    return `${base.replace(/\s*-\s*YouTube$/i, "").trim()} - YouTube`
  }

  return title
}

/**
 * Auto-subscribes recommended feeds on first launch (or when the
 * recommended list is updated). Feeds are added with category
 * "Recommended" so the sidebar shows them in a separate section.
 */
export function useInitRecommendedFeeds(): void {
  const loadFeeds = useFeedStore((s) => s.loadFeeds)
  const feeds = useFeedStore((s) => s.feeds)
  const showRecommended = useGeneralSettingKey("showRecommended")
  const rsshubInstance = useGeneralSettingKey("rsshubInstance")
  const initialized = useRef(false)
  const titlesSynced = useRef(false)

  useEffect(() => {
    if (!showRecommended) return
    const normalizedRsshubInstance = (rsshubInstance?.trim() || DEFAULT_RSSHUB_INSTANCE).replace(/\/+$/, "")
    const syncRecommendedTitles = async (): Promise<boolean> => {
      const titleMap = getRecommendedTitleMap(normalizedRsshubInstance)
      const currentFeeds = useFeedStore.getState().feeds
      let changed = false
      for (const feed of currentFeeds) {
        if (feed.category !== RECOMMENDED_CATEGORY) continue
        const desiredTitle = titleMap.get(feed.url) || normalizePlatformFeedTitle(feed.url, feed.title)
        if (desiredTitle && desiredTitle !== feed.title) {
          await window.api.feeds.update(feed.id, { title: desiredTitle })
          changed = true
        }
      }
      if (changed) {
        await loadFeeds()
      }
      return true
    }

    const storedVersion = Number(localStorage.getItem(STORAGE_KEY) || "0")
    if (storedVersion >= RECOMMENDED_VERSION && titlesSynced.current) return

    const init = async () => {
      const recommendedUrls = getRecommendedUrls(normalizedRsshubInstance)
      const titleMap = getRecommendedTitleMap(normalizedRsshubInstance)

      // Remove stale recommended feeds that are no longer in the list
      const feedsAfterMigration = useFeedStore.getState().feeds
      for (const feed of feedsAfterMigration) {
        if (feed.category === RECOMMENDED_CATEGORY && !recommendedUrls.has(feed.url)) {
          await window.api.feeds.remove(feed.id)
        }
      }
      // Normalize platform-feed titles: "username - platform".
      for (const feed of feedsAfterMigration) {
        if (feed.category !== RECOMMENDED_CATEGORY) continue
        const desiredTitle = titleMap.get(feed.url) || normalizePlatformFeedTitle(feed.url, feed.title)
        if (desiredTitle && desiredTitle !== feed.title) {
          await window.api.feeds.update(feed.id, { title: desiredTitle })
        }
      }

      // Collect feeds that need to be added
      const existingUrls = new Set(feedsAfterMigration.map((f) => f.url))
      const toAdd: Array<{ url: string; title: string; view: FeedViewType }> = []

      for (const [viewStr, recFeeds] of Object.entries(VIEW_RECOMMENDED_MAP)) {
        const view = Number(viewStr) as FeedViewType
        for (const feed of recFeeds) {
          const url = feed.isRSSHub
            ? `${rsshubInstance}${feed.url}`
            : feed.url
          if (!existingUrls.has(url)) {
            toAdd.push({ url, title: titleMap.get(url) || normalizePlatformFeedTitle(url, feed.title), view })
          }
        }
      }

      // Repair existing Instagram recommended feeds: switch to an actually working instance URL.
      const currentAfterCollect = useFeedStore.getState().feeds
      for (const feed of currentAfterCollect) {
        if (feed.category !== RECOMMENDED_CATEGORY) continue
        const m = feed.url.match(/\/instagram\/user\/([^/?#]+)/i)
        if (!m) continue
        try {
          const username = decodeURIComponent(m[1])
          const result = await window.api.discover.probeInstagramUser(username)
          if (result.valid && result.feedUrl && result.feedUrl !== feed.url) {
            await window.api.feeds.update(feed.id, { url: result.feedUrl })
          }
        } catch {
          // Keep the existing URL if probing fails.
        }
      }

      // Subscribe in batches
      const batchSize = 4
      for (let i = 0; i < toAdd.length; i += batchSize) {
        const batch = toAdd.slice(i, i + batchSize)
        await Promise.allSettled(
          batch.map(({ url, title, view }) =>
            window.api.feeds.add(url, RECOMMENDED_CATEGORY, view, title)
          )
        )
        await loadFeeds()
      }

      localStorage.setItem(STORAGE_KEY, String(RECOMMENDED_VERSION))
      await loadFeeds()

      // Retry fetching feeds that failed during initial add
      const updatedFeeds = useFeedStore.getState().feeds
      const failedFeeds = updatedFeeds.filter(
        (f) => f.category === RECOMMENDED_CATEGORY && (!f.lastFetched || f.errorCount > 0)
      )
      if (failedFeeds.length > 0) {
        for (let i = 0; i < failedFeeds.length; i += batchSize) {
          const batch = failedFeeds.slice(i, i + batchSize)
          await Promise.allSettled(
            batch.map((f) => window.api.feeds.refresh(f.id))
          )
        }
        await loadFeeds()
      }
    }
    ;(async () => {
      try {
        // Ensure feeds are loaded before syncing titles.
        if (useFeedStore.getState().feeds.length === 0) {
          await loadFeeds()
        }

        if (!titlesSynced.current) {
          titlesSynced.current = await syncRecommendedTitles()
        }

        // Always reconcile recommended catalog on startup so data-file changes
        // (title/url additions/removals) are applied without manual version bumps.
        if (initialized.current) return
        initialized.current = true

        await init()
        titlesSynced.current = false
      } catch (e) {
        console.error(e)
      }
    })()
  }, [feeds, loadFeeds, rsshubInstance, showRecommended])
}
