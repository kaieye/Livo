import { ipcMain, dialog, BrowserWindow, session as _session } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { readFileSync, writeFileSync } from 'fs'
import {
  IPC,
  FeedViewType,
  type Feed,
  type FeedWithCount,
} from '../../shared/types'
import { fetchAndParseFeed } from '../services/rss-parser'
import { refreshAllFeeds, refreshSingleFeed } from '../services/feed-refresh'
import { getSettings } from './settings-handlers'
import { DEFAULT_RSSHUB_INSTANCE } from '../../shared/discover-data'
import { parseOPML, generateOPML } from '../services/opml-parser'
import { deriveImageUrl } from '../services/feed-utils'
import { queueVideoDurationEnrich } from '../services/video-duration'
import {
  getAppCacheDirectoryPath,
  getDirectorySize,
} from '../services/app-shell'
import {
  canonicalizeInstagramFeedUrl,
  ensureInstagramUserFeedLimit,
  ensureTwitterUserFeedLimit,
  normalizeRsshubProtocolUrl,
  toRsshubProtocolUrl,
} from '../services/rsshub-url'
import { resolveFeedAvatar } from '../services/feed-avatar'
import {
  loadRefreshLogs,
  clearRefreshLogs,
} from '../services/refresh-log-store'
import { formatFeedTitle } from '../services/feed-title'
import { buildEntriesFromParsedItems } from '../services/entry-builder'
import { detectRouteViewFromUrl } from '../services/feed-view'
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
} from '../database'

const RECOMMENDED_CATEGORY = 'Recommended'

function toRendererFeed(feed: Feed): Feed {
  const folder =
    feed.folder ??
    (feed.category === RECOMMENDED_CATEGORY ? '' : feed.category || '')
  return { ...feed, folder }
}

export function registerFeedHandlers(): void {
  // Add a new feed
  ipcMain.handle(
    IPC.FEED_ADD,
    async (
      _event,
      url: string,
      category?: string,
      view?: FeedViewType,
      title?: string,
    ) => {
      try {
        const id = uuidv4()
        const now = Date.now()
        const rawProtocolUrl = toRsshubProtocolUrl(url.trim())
        const limitedProtocolUrl = ensureTwitterUserFeedLimit(
          ensureInstagramUserFeedLimit(rawProtocolUrl, 100),
          120,
        )
        const storedUrl = canonicalizeInstagramFeedUrl(limitedProtocolUrl)
        const legacyStoredUrl = canonicalizeInstagramFeedUrl(rawProtocolUrl)
        const rsshubInstance =
          getSettings().general.rsshubInstance?.trim() ||
          DEFAULT_RSSHUB_INSTANCE
        const normalizedUrl = normalizeRsshubProtocolUrl(
          storedUrl,
          rsshubInstance,
        )
        const normalizedLegacyUrl = normalizeRsshubProtocolUrl(
          legacyStoredUrl,
          rsshubInstance,
        )
        const deferBootstrap = shouldDeferBootstrap(normalizedUrl, view)
        const existingFeed =
          getFeedByUrl(storedUrl) ||
          getFeedByUrl(normalizedUrl) ||
          getFeedByUrl(toRsshubProtocolUrl(normalizedUrl)) ||
          getFeedByUrl(legacyStoredUrl) ||
          getFeedByUrl(normalizedLegacyUrl) ||
          getFeedByUrl(toRsshubProtocolUrl(normalizedLegacyUrl))
        if (existingFeed) {
          const wantsRecommended = (category || '') === RECOMMENDED_CATEGORY
          const updates: Partial<Feed> = {}
          const routeView = detectRouteViewFromUrl(normalizedUrl)

          // If user subscribes a feed that already exists in Recommended,
          // promote it into normal subscriptions so it appears in the sidebar list.
          if (
            existingFeed.category === RECOMMENDED_CATEGORY &&
            !wantsRecommended
          ) {
            updates.category = category || ''
            updates.folder = category || ''
          }

          // Route-specific feeds should always use the matching view, even if an
          // older caller passes a stale explicit view.
          if (routeView !== null && existingFeed.view !== routeView) {
            updates.view = routeView
          } else if (typeof view === 'number' && existingFeed.view !== view) {
            updates.view = view
          }
          if (title?.trim()) {
            updates.title = formatFeedTitle(storedUrl, undefined, title.trim())
          }

          // Upgrade legacy RSSHub user feeds to include explicit high-enough limits.
          const upgradedUrl = ensureTwitterUserFeedLimit(
            ensureInstagramUserFeedLimit(existingFeed.url, 100),
            120,
          )
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
              queueBootstrapRefresh(mergedFeed, normalizedUrl, mergedFeed.view)
            } else {
              await bootstrapFeedEntries(
                mergedFeed,
                normalizedUrl,
                mergedFeed.view,
              )
            }
            const refreshed = getFeedById(existingFeed.id)
            return {
              success: true,
              feed: refreshed ? toRendererFeed(refreshed) : mergedFeed,
            }
          }

          if (shouldDeferBootstrap(normalizedUrl, existingFeed.view)) {
            queueBootstrapRefresh(
              existingFeed,
              normalizedUrl,
              existingFeed.view,
            )
          } else {
            await bootstrapFeedEntries(
              existingFeed,
              normalizedUrl,
              existingFeed.view,
            )
          }
          const refreshed = getFeedById(existingFeed.id)
          if (refreshed)
            return { success: true, feed: toRendererFeed(refreshed) }
          return { success: true, feed: existingFeed }
        }

        let parsed:
          | Awaited<ReturnType<typeof fetchAndParseFeed>>['data']
          | null = null
        if (!deferBootstrap) {
          try {
            const initialFetchTimeoutMs = getInitialFetchTimeoutMs(
              normalizedUrl,
              view,
            )
            const result = await withTimeout(
              fetchAndParseFeed(normalizedUrl),
              initialFetchTimeoutMs,
            )
            parsed = result.data
          } catch {
            // Feed fetch failed/slow (e.g. RSSHub timeout) — still create the feed entry
            // so users can subscribe and it will be fetched on next refresh
          }
        }
        // Auto-detect view type from route/content.
        // Route-derived view wins over any stale explicit selection.
        const routeView = detectRouteViewFromUrl(normalizedUrl)
        const detectedView =
          routeView ??
          view ??
          detectViewTypeFromUrlOrContent(normalizedUrl, parsed)
        const feedImageUrl =
          deferBootstrap && !parsed
            ? getImmediateFeedAvatar(normalizedUrl)
            : await resolveFeedAvatar(
                normalizedUrl,
                parsed ? getFeedImageUrl(parsed) : undefined,
              )

        const isRecommended = (category || '') === RECOMMENDED_CATEGORY
        const userFolder = isRecommended ? '' : category || ''
        const feed: Feed = {
          id,
          title: formatFeedTitle(storedUrl, parsed?.title, title || storedUrl),
          url: storedUrl,
          upstreamUrl: url.trim(),
          siteUrl: parsed?.link,
          description: parsed?.description,
          imageUrl: feedImageUrl,
          folder: userFolder,
          category: isRecommended ? RECOMMENDED_CATEGORY : userFolder,
          view: detectedView,
          fetchSource: 'auto',
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
          parsed &&
          getSettings().data?.enrichVideoDuration &&
          feed.view === FeedViewType.Videos
        ) {
          queueVideoDurationEnrich(id)
            .then((count) => {
              if (count > 0) {
                const win = BrowserWindow.getAllWindows()[0]
                if (win && !win.isDestroyed())
                  win.webContents.send('entries:enriched')
              }
            })
            .catch(() => {})
        }

        // If quick add skipped/failed parsing, force a synchronous refresh once so
        // newly added subscriptions can show entries immediately.
        if (!parsed) {
          if (shouldDeferBootstrap(normalizedUrl, detectedView)) {
            queueBootstrapRefresh(feed, normalizedUrl, detectedView)
          } else {
            await bootstrapFeedEntries(feed, normalizedUrl, detectedView)
          }
          const refreshed = getFeedById(feed.id)
          return {
            success: true,
            feed: refreshed ? toRendererFeed(refreshed) : feed,
          }
        }

        return { success: true, feed }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  )

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
    if (!feed) return { success: false, error: 'Feed not found' }

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

  // Refresh all feeds (concurrent, with conditional GET).
  // Delegates to the deep `refreshAllFeeds` module; the IPC handler's only
  // job is to translate per-feed progress into renderer events.
  ipcMain.handle(IPC.FEED_REFRESH_ALL, async (event) => {
    return refreshAllFeeds({
      force: true,
      onProgress: (progress) => {
        const refreshedFeed = progress.feedId
          ? getFeedById(progress.feedId)
          : undefined
        event.sender.send('feeds:refresh-progress', {
          total: progress.total,
          completed: progress.completed,
          percent:
            progress.total > 0
              ? Math.round((progress.completed / progress.total) * 100)
              : 0,
          feedId: progress.feedId || undefined,
          feedTitle: progress.feedTitle || undefined,
          success: progress.success,
          newEntries: progress.success ? progress.newEntries : undefined,
          feed: refreshedFeed ? toRendererFeed(refreshedFeed) : undefined,
          done: progress.done,
        })
      },
    })
  })

  // Update feed
  ipcMain.handle(
    IPC.FEED_UPDATE,
    (_event, feedId: string, updates: Partial<Feed>) => {
      const next = { ...updates }
      if (typeof next.folder === 'string') {
        if (next.category !== RECOMMENDED_CATEGORY) {
          next.category = next.folder
        }
      } else if (
        typeof next.category === 'string' &&
        next.category !== RECOMMENDED_CATEGORY
      ) {
        next.folder = next.category
      }
      if (next.category === RECOMMENDED_CATEGORY) {
        next.folder = ''
      }
      updateFeed(feedId, next)
      return { success: true }
    },
  )

  // Import OPML
  ipcMain.handle(IPC.FEED_IMPORT_OPML, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import OPML file',
      filters: [
        { name: 'OPML Files', extensions: ['opml', 'xml'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })

    if (result.canceled || !result.filePaths[0]) {
      return { success: false, canceled: true }
    }

    try {
      const content = readFileSync(result.filePaths[0], 'utf-8')
      const opmlFeeds = parseOPML(content)

      if (opmlFeeds.length === 0) {
        return { success: false, error: 'No valid feeds found in OPML file' }
      }

      let imported = 0
      let skipped = 0
      let completed = 0
      const importedFeedIds: string[] = []
      const errors: string[] = []
      const total = opmlFeeds.length
      const CONCURRENCY = 10

      const sendProgress = (current: number, title: string, status: string) => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win && !win.isDestroyed()) {
          win.webContents.send('import:progress', {
            current,
            total,
            title,
            status,
          })
        }
      }

      // Filter out already-existing feeds first
      const toImport: typeof opmlFeeds = []
      for (const opmlFeed of opmlFeeds) {
        const rsshubInstance =
          getSettings().general.rsshubInstance?.trim() ||
          DEFAULT_RSSHUB_INSTANCE
        const storedXmlUrl = canonicalizeInstagramFeedUrl(
          toRsshubProtocolUrl(opmlFeed.xmlUrl),
        )
        const normalizedXmlUrl = normalizeRsshubProtocolUrl(
          storedXmlUrl,
          rsshubInstance,
        )
        const existingFeed =
          getFeedByUrl(storedXmlUrl) ||
          getFeedByUrl(normalizedXmlUrl) ||
          getFeedByUrl(toRsshubProtocolUrl(normalizedXmlUrl))
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

          let parsed:
            | Awaited<ReturnType<typeof fetchAndParseFeed>>['data']
            | null = null
          try {
            const fetchUrl = normalizeRsshubProtocolUrl(
              canonicalizeInstagramFeedUrl(opmlFeed.xmlUrl),
              getSettings().general.rsshubInstance?.trim() ||
                DEFAULT_RSSHUB_INSTANCE,
            )
            const result = await fetchAndParseFeed(fetchUrl, {
              skipFallback: true,
            })
            parsed = result.data
          } catch {
            // Feed fetch failed — still import with OPML metadata
          }

          const feed: Feed = {
            id,
            title: formatFeedTitle(
              opmlFeed.xmlUrl,
              parsed?.title,
              opmlFeed.title || opmlFeed.xmlUrl,
            ),
            url: opmlFeed.xmlUrl,
            upstreamUrl: opmlFeed.xmlUrl,
            siteUrl: opmlFeed.htmlUrl || parsed?.link,
            description: parsed?.description,
            imageUrl: await resolveFeedAvatar(
              opmlFeed.xmlUrl,
              parsed ? getFeedImageUrl(parsed) : undefined,
            ),
            folder: opmlFeed.category || '',
            category: opmlFeed.category || '',
            view: parsed ? detectViewType(parsed) : 0,
            fetchSource: 'auto',
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

          importedFeedIds.push(id)
          imported++
        } catch (err) {
          errors.push(`${label}: ${String(err).slice(0, 100)}`)
        }
        completed++
        sendProgress(completed, label, 'processing')
      }

      // Concurrent execution with concurrency limit
      const queue = [...toImport]
      const runWorker = async () => {
        while (queue.length > 0) {
          const item = queue.shift()!
          await processFeed(item)
        }
      }
      const workers = Array.from(
        { length: Math.min(CONCURRENCY, toImport.length) },
        () => runWorker(),
      )
      await Promise.all(workers)

      sendProgress(total, '', 'done')

      return {
        success: true,
        total: opmlFeeds.length,
        imported,
        skipped,
        importedFeedIds,
        errors: errors.length > 0 ? errors : undefined,
      }
    } catch (err) {
      return {
        success: false,
        error: `鐠囪褰囬弬鍥︽婢惰精瑙? ${String(err)}`,
      }
    }
  })

  // Export OPML
  ipcMain.handle(IPC.FEED_EXPORT_OPML, async () => {
    const feeds = getAllFeeds()
    if (feeds.length === 0) {
      return { success: false, error: 'No feeds to export' }
    }

    const result = await dialog.showSaveDialog({
      title: 'Export OPML file',
      defaultPath: 'livo-subscriptions.opml',
      filters: [
        { name: 'OPML Files', extensions: ['opml'] },
        { name: 'XML Files', extensions: ['xml'] },
      ],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    try {
      const opml = generateOPML(feeds)
      writeFileSync(result.filePath, opml, 'utf-8')
      return { success: true, count: feeds.length }
    } catch (err) {
      return { success: false, error: `Failed to export OPML: ${String(err)}` }
    }
  })

  // Batch refresh imported feeds with progress events.
  // Mirrors Harmony's SubscriptionOpmlService.refreshImportedFeedsInBackground.
  const OPML_REFRESH_GAP_MS = 180
  const OPML_REFRESH_CONCURRENCY = 3

  ipcMain.handle(
    IPC.FEED_REFRESH_IMPORTED,
    async (_event, feedIds: string[]) => {
      const deduped = Array.from(new Set(feedIds.filter(Boolean)))
      if (deduped.length === 0) {
        return { success: true, total: 0, refreshed: 0, failed: 0 }
      }

      const win = BrowserWindow.getAllWindows()[0]
      const sendProgress = (
        completed: number,
        total: number,
        success: number,
        failed: number,
        currentTitle?: string,
      ) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('import:refresh-progress', {
            completed,
            total,
            success,
            failed,
            currentTitle,
          })
        }
      }

      sendProgress(0, deduped.length, 0, 0)

      let refreshed = 0
      let failed = 0
      const queue = [...deduped]

      const worker = async () => {
        while (queue.length > 0) {
          const feedId = queue.shift()!
          const feed = getFeedById(feedId)
          const label = feed?.title || feedId

          if (!feed) {
            failed++
            sendProgress(
              refreshed + failed,
              deduped.length,
              refreshed,
              failed,
              label,
            )
          } else {
            try {
              await refreshSingleFeed(feed)
              refreshed++
            } catch {
              failed++
            }
          }

          sendProgress(
            refreshed + failed,
            deduped.length,
            refreshed,
            failed,
            label,
          )

          // Small gap between refreshes to avoid hammering servers
          if (queue.length > 0) {
            await new Promise((r) => setTimeout(r, OPML_REFRESH_GAP_MS))
          }
        }
      }

      const workers = Array.from(
        { length: Math.min(OPML_REFRESH_CONCURRENCY, deduped.length) },
        () => worker(),
      )
      await Promise.all(workers)

      return {
        success: true,
        total: deduped.length,
        refreshed,
        failed,
      }
    },
  )

  // ---- Data maintenance handlers ----

  // Manual data cleanup
  ipcMain.handle(
    IPC.DATA_CLEANUP,
    (
      _event,
      options?: { entriesPerFeed?: number; maxEntryAgeDays?: number },
    ) => {
      const stats = cleanupEntries({
        entriesPerFeed: options?.entriesPerFeed ?? 128,
        maxEntryAgeDays: options?.maxEntryAgeDays ?? 90,
      })
      return stats
    },
  )

  // Get database statistics
  ipcMain.handle(IPC.DATA_STATS, () => {
    const stats = getDatabaseStats()
    return {
      ...stats,
      cacheSizeBytes: getDirectorySize(getAppCacheDirectoryPath()),
    }
  })

  // Refresh log handlers
  ipcMain.handle(IPC.REFRESH_LOG_LIST, () => {
    return loadRefreshLogs()
  })

  ipcMain.handle(IPC.REFRESH_LOG_CLEAR, () => {
    clearRefreshLogs()
    return { success: true }
  })
}

async function bootstrapFeedEntries(
  feed: Feed,
  normalizedUrl: string,
  view?: FeedViewType,
): Promise<void> {
  const bootstrapTimeoutMs = getBootstrapRefreshTimeoutMs(normalizedUrl, view)

  await withTimeout(
    refreshSingleFeed(feed, { force: true }),
    bootstrapTimeoutMs,
  ).catch(() => {})
  const hasEntriesAfterFirstTry =
    getEntries({
      feedId: feed.id,
      limit: 1,
      skipDedupe: true,
    }).entries.length > 0
  if (hasEntriesAfterFirstTry) return

  // One extra retry for unstable social routes/instances.
  await withTimeout(
    refreshSingleFeed(feed, { force: true }),
    bootstrapTimeoutMs,
  ).catch(() => {})
}

async function bootstrapFeedEntriesQuick(
  feed: Feed,
  normalizedUrl: string,
  view?: FeedViewType,
): Promise<void> {
  const quickTimeoutMs = Math.min(
    7000,
    getBootstrapRefreshTimeoutMs(normalizedUrl, view),
  )
  await withTimeout(
    refreshSingleFeed(feed, { force: true }),
    quickTimeoutMs,
  ).catch(() => {})
}

function hasAnyEntries(feedId: string): boolean {
  return (
    getEntries({
      feedId,
      limit: 1,
      skipDedupe: true,
    }).entries.length > 0
  )
}

function queueBootstrapRefresh(
  feed: Feed,
  normalizedUrl: string,
  view?: FeedViewType,
): void {
  void (async () => {
    // Retry a few rounds in background for unstable social upstreams so users
    // don't have to manually click refresh after subscribing.
    for (let round = 0; round < 3; round++) {
      if (round === 0) {
        await bootstrapFeedEntriesQuick(feed, normalizedUrl, view).catch(
          () => {},
        )
      } else {
        await bootstrapFeedEntries(feed, normalizedUrl, view).catch(() => {})
      }

      const refreshed = getFeedById(feed.id)
      const hasEntries = hasAnyEntries(feed.id)
      const hasAvatar = !!(refreshed?.imageUrl || '').trim()

      const win = BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('feeds:updated', {
          feedId: feed.id,
          background: true,
          round: round + 1,
          hasEntries,
          hasAvatar,
        })
      }

      if (hasEntries && hasAvatar) break
      await delayMs(2000 * (round + 1))
    }
  })().catch(() => {})
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---- Helper functions ----

/** Detect view type from parsed feed content */
function detectViewType(parsed: any): FeedViewType {
  const items =
    (parsed as { items?: Array<Record<string, unknown>> }).items || []

  let videoCount = 0
  let imageCount = 0

  for (const item of items.slice(0, 10)) {
    const enclosure = item.enclosure as
      | { type?: string; url?: string }
      | undefined
    const content = String(item.content || item['content:encoded'] || '')

    if (
      enclosure?.type?.startsWith('video/') ||
      content.includes('<video') ||
      content.includes('youtube.com/embed')
    ) {
      videoCount++
    } else if (
      enclosure?.type?.startsWith('image/') ||
      content.includes('<img')
    ) {
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

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
      timeoutMs,
    )
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
  const raw = (url || '').toLowerCase()
  const isSocialRoute =
    /\/(?:twitter|x)\/user\//i.test(raw) ||
    /\/instagram\/user\//i.test(raw) ||
    /\/picnob(?:\.info)?\/user\//i.test(raw) ||
    /\/pixnoy\/user\//i.test(raw) ||
    /\/piokok\/user\//i.test(raw) ||
    /\/bilibili\/user\/dynamic\//i.test(raw)
  const isBilibiliVideoRoute = /\/bilibili\/user\/video\//i.test(raw)
  if (
    isSocialRoute ||
    view === FeedViewType.SocialMedia ||
    view === FeedViewType.Pictures
  ) {
    return 18000
  }
  if (isBilibiliVideoRoute || view === FeedViewType.Videos) {
    return 45000
  }
  return 6000
}

function getBootstrapRefreshTimeoutMs(
  url: string,
  view?: FeedViewType,
): number {
  const raw = (url || '').toLowerCase()
  const isSocialRoute =
    /\/(?:twitter|x)\/user\//i.test(raw) ||
    /\/instagram\/user\//i.test(raw) ||
    /\/picnob(?:\.info)?\/user\//i.test(raw) ||
    /\/pixnoy\/user\//i.test(raw) ||
    /\/piokok\/user\//i.test(raw) ||
    /\/bilibili\/user\/dynamic\//i.test(raw)
  const isBilibiliVideoRoute = /\/bilibili\/user\/video\//i.test(raw)

  if (
    isSocialRoute ||
    view === FeedViewType.SocialMedia ||
    view === FeedViewType.Pictures
  ) {
    return 45000
  }
  if (isBilibiliVideoRoute || view === FeedViewType.Videos) {
    return 120000
  }
  return 18000
}

function shouldDeferBootstrap(url: string, view?: FeedViewType): boolean {
  const raw = (url || '').toLowerCase()
  const isSocialRoute =
    /\/(?:twitter|x)\/user\//i.test(raw) ||
    /\/instagram\/user\//i.test(raw) ||
    /\/picnob(?:\.info)?\/user\//i.test(raw) ||
    /\/pixnoy\/user\//i.test(raw) ||
    /\/piokok\/user\//i.test(raw) ||
    /\/bilibili\/user\/dynamic\//i.test(raw)
  return (
    isSocialRoute ||
    view === FeedViewType.SocialMedia ||
    view === FeedViewType.Pictures
  )
}

function getImmediateFeedAvatar(url: string): string | undefined {
  const raw = (url || '').trim()
  if (!raw) return undefined
  const ig =
    raw.match(/\/instagram\/user\/([^/?#]+)/i) ||
    raw.match(/\/picnob(?:\.info)?\/user\/([^/?#]+)/i) ||
    raw.match(/\/pixnoy\/user\/([^/?#]+)/i) ||
    raw.match(/\/piokok\/user\/([^/?#]+)/i)
  const username = ig?.[1] ? decodeURIComponent(ig[1]).replace(/^@+/, '') : ''
  if (!username) return undefined
  const initial = username.charAt(0).toUpperCase()
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#833AB4"/><stop offset="50%" stop-color="#E1306C"/><stop offset="100%" stop-color="#F77737"/></linearGradient></defs><rect width="128" height="128" rx="32" fill="url(#ig)"/><text x="64" y="82" text-anchor="middle" fill="white" font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif" font-size="56" font-weight="700">${initial}</text></svg>`)}`
}

function getFeedImageUrl(parsed: any): string | undefined {
  const imageUrl =
    (parsed['image'] as { url?: string } | undefined)?.url ||
    (parsed['itunes'] as { image?: string } | undefined)?.image
  if (imageUrl) return imageUrl

  const items =
    (parsed['items'] as Array<Record<string, unknown>> | undefined) || []
  for (const item of items.slice(0, 3)) {
    const image = deriveImageUrl(item)
    if (image) return image
  }
  return undefined
}

function detectViewTypeFromUrlOrContent(
  url: string,
  parsed: any,
): FeedViewType {
  const routeView = detectRouteViewFromUrl(url)
  if (routeView !== null) return routeView
  return parsed ? detectViewType(parsed) : FeedViewType.Articles
}
