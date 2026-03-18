import { ipcMain, dialog, BrowserWindow, session } from "electron"
import { v4 as uuidv4 } from "uuid"
import { readFileSync, writeFileSync } from "fs"
import { IPC, FeedViewType, type Feed, type FeedWithCount } from "../../shared/types"
import { fetchAndParseFeed } from "../services/rss-parser"
import { refreshSingleFeed } from "../services/feed-refresh"
import { getSettings } from "./settings-handlers"
import { DEFAULT_RSSHUB_INSTANCE } from "../../shared/discover-data"
import { parseOPML, generateOPML } from "../services/opml-parser"
import { extractMedia, deriveImageUrl, extractContent, extractAuthorAvatar } from "../services/feed-utils"
import { queueVideoDurationEnrich } from "../services/video-duration"
import {
  canonicalizeInstagramFeedUrl,
  ensureInstagramUserFeedLimit,
  ensureTwitterUserFeedLimit,
  normalizeRsshubProtocolUrl,
  toRsshubProtocolUrl,
} from "../services/rsshub-url"
import { resolveFeedAvatar } from "../services/feed-avatar"
import { formatFeedTitle } from "../services/feed-title"
import { buildEntriesFromParsedItems } from "../services/entry-builder"
import {
  getAllFeeds,
  getFeedById,
  getFeedByUrl,
  insertFeed,
  deleteFeed,
  updateFeed,
  insertEntries,
  getUnreadCountMap,
  cleanupEntries,
  getDatabaseStats,
  getEntries,
} from "../database"

const RECOMMENDED_CATEGORY = "Recommended"

function toRendererFeed(feed: Feed): Feed {
  const folder = feed.folder ?? (feed.category === RECOMMENDED_CATEGORY ? "" : (feed.category || ""))
  return { ...feed, folder }
}

export function registerFeedHandlers(): void {
  // Add a new feed
  ipcMain.handle(IPC.FEED_ADD, async (_event, url: string, category?: string, view?: FeedViewType, title?: string) => {
    try {
      const id = uuidv4()
      const now = Date.now()
      const rawProtocolUrl = toRsshubProtocolUrl(url.trim())
      const limitedProtocolUrl = ensureTwitterUserFeedLimit(ensureInstagramUserFeedLimit(rawProtocolUrl, 100), 120)
      const storedUrl = canonicalizeInstagramFeedUrl(limitedProtocolUrl)
      const legacyStoredUrl = canonicalizeInstagramFeedUrl(rawProtocolUrl)
      const rsshubInstance = getSettings().general.rsshubInstance?.trim() || DEFAULT_RSSHUB_INSTANCE
      const normalizedUrl = normalizeRsshubProtocolUrl(storedUrl, rsshubInstance)
      const normalizedLegacyUrl = normalizeRsshubProtocolUrl(legacyStoredUrl, rsshubInstance)
      const existingFeed =
        getFeedByUrl(storedUrl) ||
        getFeedByUrl(normalizedUrl) ||
        getFeedByUrl(toRsshubProtocolUrl(normalizedUrl)) ||
        getFeedByUrl(legacyStoredUrl) ||
        getFeedByUrl(normalizedLegacyUrl) ||
        getFeedByUrl(toRsshubProtocolUrl(normalizedLegacyUrl))
      if (existingFeed) {
        const wantsRecommended = (category || "") === RECOMMENDED_CATEGORY
        const updates: Partial<Feed> = {}

        // If user subscribes a feed that already exists in Recommended,
        // promote it into normal subscriptions so it appears in the sidebar list.
        if (existingFeed.category === RECOMMENDED_CATEGORY && !wantsRecommended) {
          updates.category = category || ""
          updates.folder = category || ""
        }

        // Respect explicit view/title from caller when reusing an existing feed.
        if (typeof view === "number" && existingFeed.view !== view) {
          updates.view = view
        }
        if (title?.trim()) {
          updates.title = formatFeedTitle(storedUrl, undefined, title.trim())
        }

        // Upgrade legacy RSSHub user feeds to include explicit high-enough limits.
        const upgradedUrl = ensureTwitterUserFeedLimit(ensureInstagramUserFeedLimit(existingFeed.url, 100), 120)
        if (upgradedUrl !== existingFeed.url) {
          updates.url = upgradedUrl
        }

        if (Object.keys(updates).length > 0) {
          updateFeed(existingFeed.id, updates)
          const mergedFeed = { ...existingFeed, ...updates }
          // Existing subscriptions (especially promoted from Recommended) may have no data yet.
          // For social feeds, do a short blocking refresh first to improve "subscribe -> has entries"
          // responsiveness, then continue in background if still empty.
          if (shouldDeferBootstrap(normalizedUrl, mergedFeed.view)) {
            await bootstrapFeedEntriesQuick(mergedFeed, normalizedUrl, mergedFeed.view)
            if (!hasAnyEntries(mergedFeed.id)) void bootstrapFeedEntries(mergedFeed, normalizedUrl, mergedFeed.view)
          } else {
            await bootstrapFeedEntries(mergedFeed, normalizedUrl, mergedFeed.view)
          }
          const refreshed = getFeedById(existingFeed.id)
          return { success: true, feed: refreshed ? toRendererFeed(refreshed) : mergedFeed }
        }

        if (shouldDeferBootstrap(normalizedUrl, existingFeed.view)) {
          await bootstrapFeedEntriesQuick(existingFeed, normalizedUrl, existingFeed.view)
          if (!hasAnyEntries(existingFeed.id)) void bootstrapFeedEntries(existingFeed, normalizedUrl, existingFeed.view)
        } else {
          await bootstrapFeedEntries(existingFeed, normalizedUrl, existingFeed.view)
        }
        const refreshed = getFeedById(existingFeed.id)
        if (refreshed) return { success: true, feed: toRendererFeed(refreshed) }
        return { success: true, feed: existingFeed }
      }

      let parsed: Awaited<ReturnType<typeof fetchAndParseFeed>>['data'] | null = null
      try {
        const initialFetchTimeoutMs = getInitialFetchTimeoutMs(normalizedUrl, view)
        const result = await withTimeout(fetchAndParseFeed(normalizedUrl), initialFetchTimeoutMs)
        parsed = result.data
      } catch {
        // Feed fetch failed/slow (e.g. RSSHub timeout) — still create the feed entry
        // so users can subscribe and it will be fetched on next refresh
      }

      // Auto-detect view type from route/content.
      // For explicit platform video routes, enforce the route view to avoid UI default overriding.
      const routeView = detectRouteViewFromUrl(normalizedUrl)
      const detectedView =
        routeView ??
        (view ?? detectViewTypeFromUrlOrContent(normalizedUrl, parsed))
      const feedImageUrl = await resolveFeedAvatar(
        normalizedUrl,
        parsed ? getFeedImageUrl(parsed) : undefined,
      )

      const isRecommended = (category || "") === RECOMMENDED_CATEGORY
      const userFolder = isRecommended ? "" : (category || "")
      const feed: Feed = {
        id,
        title: formatFeedTitle(storedUrl, parsed?.title, title || storedUrl),
        url: storedUrl,
        siteUrl: parsed?.link,
        description: parsed?.description,
        imageUrl: feedImageUrl,
        folder: userFolder,
        category: isRecommended ? RECOMMENDED_CATEGORY : userFolder,
        view: detectedView,
        showInAll: true,
        lastFetched: parsed ? now : 0,
        errorCount: parsed ? 0 : 1,
        createdAt: now,
      }

      insertFeed(feed)

      // Insert entries if fetch was successful
      if (parsed) {
        const entriesToInsert = await buildEntriesFromParsedItems(
          id,
          (parsed.items || []) as Array<Record<string, any>>,
          feedImageUrl,
          detectedView,
          now,
        )
        insertEntries(entriesToInsert)
      }

      // Fire-and-forget: enrich video entries with duration from YouTube/Bilibili
      if (
        parsed
        && getSettings().data?.enrichVideoDuration
        && (feed.view === FeedViewType.Videos)
      ) {
        queueVideoDurationEnrich(id).then((count) => {
          if (count > 0) {
            const win = BrowserWindow.getAllWindows()[0]
            if (win && !win.isDestroyed()) win.webContents.send("entries:enriched")
          }
        }).catch(() => {})
      }

      // If quick add skipped/failed parsing, force a synchronous refresh once so
      // newly added subscriptions can show entries immediately.
      if (!parsed) {
        if (shouldDeferBootstrap(normalizedUrl, detectedView)) {
          await bootstrapFeedEntriesQuick(feed, normalizedUrl, detectedView)
          if (!hasAnyEntries(feed.id)) void bootstrapFeedEntries(feed, normalizedUrl, detectedView)
        } else {
          await bootstrapFeedEntries(feed, normalizedUrl, detectedView)
        }
        const refreshed = getFeedById(feed.id)
        return { success: true, feed: refreshed ? toRendererFeed(refreshed) : feed }
      }

      return { success: true, feed }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Remove a feed
  ipcMain.handle(IPC.FEED_REMOVE, (_event, feedId: string) => {
    deleteFeed(feedId)
    return { success: true }
  })

  // List all feeds with unread counts
  ipcMain.handle(IPC.FEED_LIST, () => {
    const feeds = getAllFeeds()
    const unreadCountMap = getUnreadCountMap()
    const result: FeedWithCount[] = feeds
      .map((f) => ({
        ...toRendererFeed(f),
        unreadCount: unreadCountMap.get(f.id) || 0,
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
    return result
  })

  // Refresh a single feed
  ipcMain.handle(IPC.FEED_REFRESH, async (_event, feedId: string) => {
    const feeds = getAllFeeds()
    const feed = feeds.find((f) => f.id === feedId)
    if (!feed) return { success: false, error: "Feed not found" }

    try {
      const newCount = await refreshSingleFeed(feed, { force: true })
      const refreshedFeed = getFeedById(feedId)
      const unreadCount = getUnreadCountMap().get(feedId) || 0
      return {
        success: true,
        newEntries: newCount,
        feed: refreshedFeed ? toRendererFeed(refreshedFeed) : undefined,
        unreadCount,
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Refresh all feeds (concurrent, with conditional GET)
  ipcMain.handle(IPC.FEED_REFRESH_ALL, async (event) => {
    const receiveRecommended = !!getSettings().general.showRecommended
    const feeds = receiveRecommended
      ? getAllFeeds()
      : getAllFeeds().filter((f) => f.category !== RECOMMENDED_CATEGORY)
    const results: Array<{ feedId: string; success: boolean; newEntries?: number }> = []
    const CONCURRENCY = 8
    const total = feeds.length
    let completed = 0

    event.sender.send("feeds:refresh-progress", {
      total,
      completed: 0,
      percent: 0,
      done: total === 0,
    })

    if (total === 0) return results

    const queue = [...feeds]
    const runWorker = async () => {
      while (queue.length > 0) {
        const feed = queue.shift()!
        try {
          const newCount = await refreshSingleFeed(feed, { force: true })
          const refreshedFeed = getFeedById(feed.id)
          results.push({ feedId: feed.id, success: true, newEntries: newCount })
          completed++
          event.sender.send("feeds:refresh-progress", {
            total,
            completed,
            percent: Math.round((completed / total) * 100),
            feedId: feed.id,
            feedTitle: feed.title,
            success: true,
            newEntries: newCount,
            feed: refreshedFeed ? toRendererFeed(refreshedFeed) : undefined,
            done: completed >= total,
          })
        } catch {
          results.push({ feedId: feed.id, success: false })
          completed++
          event.sender.send("feeds:refresh-progress", {
            total,
            completed,
            percent: Math.round((completed / total) * 100),
            feedId: feed.id,
            feedTitle: feed.title,
            success: false,
            done: completed >= total,
          })
        }
      }
    }
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => runWorker())
    await Promise.all(workers)

    return results
  })

  // Update feed
  ipcMain.handle(IPC.FEED_UPDATE, (_event, feedId: string, updates: Partial<Feed>) => {
    const next = { ...updates }
    if (typeof next.folder === "string") {
      if (next.category !== RECOMMENDED_CATEGORY) {
        next.category = next.folder
      }
    } else if (typeof next.category === "string" && next.category !== RECOMMENDED_CATEGORY) {
      next.folder = next.category
    }
    if (next.category === RECOMMENDED_CATEGORY) {
      next.folder = ""
    }
    updateFeed(feedId, next)
    return { success: true }
  })

  // Import OPML
  ipcMain.handle(IPC.FEED_IMPORT_OPML, async () => {
    const result = await dialog.showOpenDialog({
      title: "瀵煎叆 OPML 鏂囦欢",
      filters: [
        { name: "OPML Files", extensions: ["opml", "xml"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    })

    if (result.canceled || !result.filePaths[0]) {
      return { success: false, canceled: true }
    }

    try {
      const content = readFileSync(result.filePaths[0], "utf-8")
      const opmlFeeds = parseOPML(content)

      if (opmlFeeds.length === 0) {
        return { success: false, error: "OPML 鏂囦欢涓病鏈夋壘鍒拌闃呮簮" }
      }

      let imported = 0
      let skipped = 0
      let completed = 0
      const errors: string[] = []
      const total = opmlFeeds.length
      const CONCURRENCY = 10

      const sendProgress = (current: number, title: string, status: string) => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win && !win.isDestroyed()) {
          win.webContents.send("import:progress", { current, total, title, status })
        }
      }

      // Filter out already-existing feeds first
      const toImport: typeof opmlFeeds = []
      for (const opmlFeed of opmlFeeds) {
        const rsshubInstance = getSettings().general.rsshubInstance?.trim() || DEFAULT_RSSHUB_INSTANCE
        const storedXmlUrl = canonicalizeInstagramFeedUrl(toRsshubProtocolUrl(opmlFeed.xmlUrl))
        const normalizedXmlUrl = normalizeRsshubProtocolUrl(storedXmlUrl, rsshubInstance)
        const existingFeed =
          getFeedByUrl(storedXmlUrl)
          || getFeedByUrl(normalizedXmlUrl)
          || getFeedByUrl(toRsshubProtocolUrl(normalizedXmlUrl))
        if (existingFeed) {
          skipped++
          completed++
        } else {
          toImport.push({ ...opmlFeed, xmlUrl: storedXmlUrl })
        }
      }

      // Process a single feed (fetch + insert)
      const processFeed = async (opmlFeed: (typeof opmlFeeds)[0]) => {
        const label = opmlFeed.title || opmlFeed.xmlUrl
        try {
          const id = uuidv4()
          const now = Date.now()

          let parsed: Awaited<ReturnType<typeof fetchAndParseFeed>>['data'] | null = null
          try {
            const fetchUrl = normalizeRsshubProtocolUrl(canonicalizeInstagramFeedUrl(opmlFeed.xmlUrl), getSettings().general.rsshubInstance?.trim() || DEFAULT_RSSHUB_INSTANCE)
            const result = await fetchAndParseFeed(fetchUrl, { skipFallback: true })
            parsed = result.data
          } catch {
            // Feed fetch failed 鈥?still import with OPML metadata
          }

          const feed: Feed = {
            id,
            title: formatFeedTitle(opmlFeed.xmlUrl, parsed?.title, opmlFeed.title || opmlFeed.xmlUrl),
            url: opmlFeed.xmlUrl,
            siteUrl: opmlFeed.htmlUrl || parsed?.link,
            description: parsed?.description,
            imageUrl: await resolveFeedAvatar(opmlFeed.xmlUrl, parsed ? getFeedImageUrl(parsed) : undefined),
            folder: opmlFeed.category || "",
            category: opmlFeed.category || "",
            view: parsed ? detectViewType(parsed) : 0,
            showInAll: true,
            lastFetched: parsed ? now : 0,
            errorCount: parsed ? 0 : 1,
            createdAt: now,
          }

          insertFeed(feed)

          if (parsed) {
            const entriesToInsert = await buildEntriesFromParsedItems(
              id,
              (parsed.items || []) as Array<Record<string, any>>,
              parsed ? getFeedImageUrl(parsed) : undefined,
              feed.view,
              now,
            )
            insertEntries(entriesToInsert)
          }

          imported++
        } catch (err) {
          errors.push(`${label}: ${String(err).slice(0, 100)}`)
        }
        completed++
        sendProgress(completed, label, "processing")
      }

      // Concurrent execution with concurrency limit
      const queue = [...toImport]
      const runWorker = async () => {
        while (queue.length > 0) {
          const item = queue.shift()!
          await processFeed(item)
        }
      }
      const workers = Array.from({ length: Math.min(CONCURRENCY, toImport.length) }, () => runWorker())
      await Promise.all(workers)

      sendProgress(total, "", "done")

      return {
        success: true,
        total: opmlFeeds.length,
        imported,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      }
    } catch (err) {
      return { success: false, error: `璇诲彇鏂囦欢澶辫触: ${String(err)}` }
    }
  })

  // Export OPML
  ipcMain.handle(IPC.FEED_EXPORT_OPML, async () => {
    const feeds = getAllFeeds()
    if (feeds.length === 0) {
      return { success: false, error: "No feeds to export" }
    }

    const result = await dialog.showSaveDialog({
      title: "瀵煎嚭 OPML 鏂囦欢",
      defaultPath: "livo-subscriptions.opml",
      filters: [
        { name: "OPML Files", extensions: ["opml"] },
        { name: "XML Files", extensions: ["xml"] },
      ],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    try {
      const opml = generateOPML(feeds)
      writeFileSync(result.filePath, opml, "utf-8")
      return { success: true, count: feeds.length }
    } catch (err) {
      return { success: false, error: `淇濆瓨鏂囦欢澶辫触: ${String(err)}` }
    }
  })

  // ---- Data maintenance handlers ----

  // Manual data cleanup
  ipcMain.handle(IPC.DATA_CLEANUP, (_event, options?: { entriesPerFeed?: number; maxEntryAgeDays?: number }) => {
    const stats = cleanupEntries({
      entriesPerFeed: options?.entriesPerFeed ?? 128,
      maxEntryAgeDays: options?.maxEntryAgeDays ?? 90,
    })
    return stats
  })

  // Get database statistics
  ipcMain.handle(IPC.DATA_STATS, () => {
    return getDatabaseStats()
  })
}

async function bootstrapFeedEntries(feed: Feed, normalizedUrl: string, view?: FeedViewType): Promise<void> {
  const bootstrapTimeoutMs = getBootstrapRefreshTimeoutMs(normalizedUrl, view)

  await withTimeout(refreshSingleFeed(feed, { force: true }), bootstrapTimeoutMs).catch(() => {})
  const hasEntriesAfterFirstTry = getEntries({
    feedId: feed.id,
    limit: 1,
    skipDedupe: true,
  }).length > 0
  if (hasEntriesAfterFirstTry) return

  // One extra retry for unstable social routes/instances.
  await withTimeout(refreshSingleFeed(feed, { force: true }), bootstrapTimeoutMs).catch(() => {})
}

async function bootstrapFeedEntriesQuick(feed: Feed, normalizedUrl: string, view?: FeedViewType): Promise<void> {
  const quickTimeoutMs = Math.min(7000, getBootstrapRefreshTimeoutMs(normalizedUrl, view))
  await withTimeout(refreshSingleFeed(feed, { force: true }), quickTimeoutMs).catch(() => {})
}

function hasAnyEntries(feedId: string): boolean {
  return getEntries({
    feedId,
    limit: 1,
    skipDedupe: true,
  }).length > 0
}

// ---- Helper functions ----

/** Detect view type from parsed feed content */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectViewType(parsed: any): FeedViewType {
  const items = (parsed as { items?: Array<Record<string, unknown>> }).items || []

  let videoCount = 0
  let imageCount = 0

  for (const item of items.slice(0, 10)) {
    const enclosure = item.enclosure as { type?: string; url?: string } | undefined
    const content = String(item.content || item["content:encoded"] || "")

    if (enclosure?.type?.startsWith("video/") || content.includes("<video") || content.includes("youtube.com/embed")) {
      videoCount++
    } else if (enclosure?.type?.startsWith("image/") || content.includes("<img")) {
      // Check if image-heavy (multiple images)
      const imgCount = (content.match(/<img/g) || []).length
      if (imgCount >= 3) imageCount++
    }
  }

  const total = items.length || 1
  if (videoCount / total > 0.5) return FeedViewType.Videos
  if (imageCount / total > 0.5) return FeedViewType.SocialMedia

  return FeedViewType.Articles
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

function getInitialFetchTimeoutMs(url: string, view?: FeedViewType): number {
  const raw = (url || "").toLowerCase()
  const isSocialRoute =
    /\/(?:twitter|x)\/user\//i.test(raw) ||
    /\/instagram\/user\//i.test(raw) ||
    /\/picnob(?:\.info)?\/user\//i.test(raw) ||
    /\/pixnoy\/user\//i.test(raw) ||
    /\/piokok\/user\//i.test(raw)
  if (isSocialRoute || view === FeedViewType.SocialMedia || view === FeedViewType.Pictures) {
    return 18000
  }
  return 6000
}

function getBootstrapRefreshTimeoutMs(url: string, view?: FeedViewType): number {
  const raw = (url || "").toLowerCase()
  const isSocialRoute =
    /\/(?:twitter|x)\/user\//i.test(raw) ||
    /\/instagram\/user\//i.test(raw) ||
    /\/picnob(?:\.info)?\/user\//i.test(raw) ||
    /\/pixnoy\/user\//i.test(raw) ||
    /\/piokok\/user\//i.test(raw)

  if (isSocialRoute || view === FeedViewType.SocialMedia || view === FeedViewType.Pictures) {
    return 45000
  }
  return 18000
}

function shouldDeferBootstrap(url: string, view?: FeedViewType): boolean {
  const raw = (url || "").toLowerCase()
  const isSocialRoute =
    /\/(?:twitter|x)\/user\//i.test(raw) ||
    /\/instagram\/user\//i.test(raw) ||
    /\/picnob(?:\.info)?\/user\//i.test(raw) ||
    /\/pixnoy\/user\//i.test(raw) ||
    /\/piokok\/user\//i.test(raw)
  return isSocialRoute || view === FeedViewType.SocialMedia || view === FeedViewType.Pictures
}

function getFeedImageUrl(parsed: any): string | undefined {
  const imageUrl =
    (parsed["image"] as { url?: string } | undefined)?.url ||
    (parsed["itunes"] as { image?: string } | undefined)?.image
  if (imageUrl) return imageUrl

  const items = (parsed["items"] as Array<Record<string, unknown>> | undefined) || []
  for (const item of items.slice(0, 3)) {
    const image = deriveImageUrl(item)
    if (image) return image
  }
  return undefined
}

function detectViewTypeFromUrlOrContent(url: string, parsed: any): FeedViewType {
  const routeView = detectRouteViewFromUrl(url)
  if (routeView !== null) return routeView
  return parsed ? detectViewType(parsed) : FeedViewType.Articles
}

function detectRouteViewFromUrl(url: string): FeedViewType | null {
  try {
    const u = new URL(url)
    const path = u.pathname.toLowerCase()
    if (/\/bilibili\/user\/video\//.test(path)) return FeedViewType.Videos
    if (/\/youtube\//.test(path)) return FeedViewType.Videos
    if (/\/instagram\//.test(path)) return FeedViewType.SocialMedia
  } catch {
    // Ignore malformed URL.
  }
  // rsshub:// protocol URLs
  try {
    if (/^rsshub:\/\/instagram\//i.test(url)) return FeedViewType.SocialMedia
  } catch {
    // Ignore
  }
  return null
}



