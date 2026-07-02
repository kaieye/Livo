import { dialog } from 'electron'
import { getEventBus } from '../services/system/event-bus'
import { v4 as uuidv4 } from 'uuid'
import { readFileSync } from 'fs'
import {
  IPC,
  FeedViewType,
  type Feed,
  type FeedWithCount,
} from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import { toHandlerError } from '../ipc/handler-error'
import { fetchAndParseFeed } from '../services/feed/rss-parser'
import { refreshSingleFeed } from '../services/feed/feed-refresh'
import { getSettings } from './settings-handlers'
import { DEFAULT_RSSHUB_INSTANCE } from '../../shared/discover-data'
import { parseOPML } from '../services/feed/opml-parser'
import { getFeedImageUrl } from '../services/feed/feed-utils'
import {
  getAppCacheDirectoryPath,
  getDirectorySize,
} from '../services/system/app-shell'
import {
  normalizeRsshubProtocolUrl,
  toRsshubProtocolUrl,
} from '../services/feed/rsshub-url'
import { resolveFeedAvatar } from '../services/feed/feed-avatar'
import {
  loadRefreshLogs,
  clearRefreshLogs,
} from '../services/system/refresh-log-store'
import { formatFeedTitle } from '../services/feed/feed-title'
import { buildEntriesFromParsedItems } from '../services/entry/entry-builder'
import { detectViewType } from '../services/feed/feed-view'
import { getDb } from '../database'
import {
  addFeed,
  refreshAllFeeds,
  refreshFeed,
  removeFeed as removeFeedOperation,
} from '../operations/feed-operations'
import { exportOPML } from '../operations/data-operations'

const RECOMMENDED_CATEGORY = 'Recommended'

function toRendererFeed(feed: Feed): Feed {
  const folder =
    feed.folder ??
    (feed.category === RECOMMENDED_CATEGORY ? '' : feed.category || '')
  return { ...feed, folder }
}

export function registerFeedHandlers(): void {
  // Add a new feed
  registerChannel(
    IPC.FEED_ADD,
    async (
      _event,
      url: string,
      category?: string,
      view?: FeedViewType,
      title?: string,
    ) => {
      try {
        const result = await addFeed({
          url,
          title,
          category,
          view,
          deferInitialFetch: false,
        })
        return {
          success: true,
          feed: toRendererFeed(result.feed),
        }
      } catch (error) {
        return toHandlerError(error)
      }
    },
  )

  // Remove a feed
  registerChannel(IPC.FEED_REMOVE, (_event, feedId: string) => {
    const result = removeFeedOperation(feedId)
    return { success: !!result }
  })

  // List all feeds with unread counts
  registerChannel(IPC.FEED_LIST, () => {
    const feeds = getDb().feeds.getAllFeeds()
    const unreadCountMap = getDb().entries.getUnreadCountMap()
    const result: FeedWithCount[] = feeds
      .map((f) => ({
        ...toRendererFeed(f),
        unreadCount: unreadCountMap.get(f.id) || 0,
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
    return result
  })

  // Refresh a single feed
  registerChannel(IPC.FEED_REFRESH, async (_event, feedId: string) => {
    try {
      const result = await refreshFeed(feedId)
      if (!result) return { success: false, error: 'Feed not found' }
      return {
        success: true,
        newEntries: result.newEntries,
        feed: toRendererFeed(result.feed),
        unreadCount: result.unreadCount,
      }
    } catch (error) {
      return toHandlerError(error)
    }
  })

  // Refresh all feeds (concurrent, with conditional GET).
  // Delegates to the deep `refreshAllFeeds` module; the IPC handler's only
  // job is to translate per-feed progress into renderer events.
  registerChannel(IPC.FEED_REFRESH_ALL, async (event) => {
    return refreshAllFeeds({
      force: true,
      onProgress: (progress) => {
        const refreshedFeed = progress.feedId
          ? getDb().feeds.getFeedById(progress.feedId)
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
  registerChannel(
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
      getDb().feeds.updateFeed(feedId, next)
      return { success: true }
    },
  )

  // Import OPML
  registerChannel(IPC.FEED_IMPORT_OPML, async () => {
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
        getEventBus().send('import:progress', {
          current,
          total,
          title,
          status,
        })
      }

      // Filter out already-existing feeds first
      const toImport: typeof opmlFeeds = []
      for (const opmlFeed of opmlFeeds) {
        const rsshubInstance =
          getSettings().general.rsshubInstance?.trim() ||
          DEFAULT_RSSHUB_INSTANCE
        const storedXmlUrl = toRsshubProtocolUrl(opmlFeed.xmlUrl)
        const normalizedXmlUrl = normalizeRsshubProtocolUrl(
          storedXmlUrl,
          rsshubInstance,
        )
        const existingFeed =
          getDb().feeds.getFeedByUrl(storedXmlUrl) ||
          getDb().feeds.getFeedByUrl(normalizedXmlUrl) ||
          getDb().feeds.getFeedByUrl(toRsshubProtocolUrl(normalizedXmlUrl))
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
              opmlFeed.xmlUrl,
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
              undefined,
              opmlFeed.htmlUrl || parsed?.link,
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

          getDb().feeds.insertFeed(feed)

          if (parsed) {
            const entriesToInsert = await buildEntriesFromParsedItems(
              id,
              (parsed.items || []) as Array<Record<string, any>>,
              parsed ? getFeedImageUrl(parsed) : undefined,
              feed.view,
              now,
            )
            getDb().entries.insertEntries(entriesToInsert)
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
      return toHandlerError(err, 'OPML import failed')
    }
  })

  // Export OPML
  registerChannel(IPC.FEED_EXPORT_OPML, async () => {
    const result = await exportOPML()
    if (!result.success) {
      if (result.cancelled) return { success: false, canceled: true }
      if (result.error === 'no_feeds')
        return { success: false, error: 'No feeds to export' }
      return toHandlerError(new Error(result.error ?? 'Failed to export OPML'))
    }
    return { success: true, count: result.feedCount }
  })

  // Batch refresh imported feeds with progress events.
  // Mirrors Harmony's SubscriptionOpmlService.refreshImportedFeedsInBackground.
  const OPML_REFRESH_GAP_MS = 180
  const OPML_REFRESH_CONCURRENCY = 3

  registerChannel(
    IPC.FEED_REFRESH_IMPORTED,
    async (_event, feedIds: string[]) => {
      const deduped = Array.from(new Set(feedIds.filter(Boolean)))
      if (deduped.length === 0) {
        return { success: true, total: 0, refreshed: 0, failed: 0 }
      }

      const sendProgress = (
        completed: number,
        total: number,
        success: number,
        failed: number,
        currentTitle?: string,
      ) => {
        getEventBus().send('import:refresh-progress', {
          completed,
          total,
          success,
          failed,
          currentTitle,
        })
      }

      sendProgress(0, deduped.length, 0, 0)

      let refreshed = 0
      let failed = 0
      const queue = [...deduped]

      const worker = async () => {
        while (queue.length > 0) {
          const feedId = queue.shift()!
          const feed = getDb().feeds.getFeedById(feedId)
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
  registerChannel(
    IPC.DATA_CLEANUP,
    (
      _event,
      options?: { entriesPerFeed?: number; maxEntryAgeDays?: number },
    ) => {
      const stats = getDb().maintenance.cleanupEntries({
        entriesPerFeed: options?.entriesPerFeed ?? 128,
        maxEntryAgeDays: options?.maxEntryAgeDays ?? 90,
      })
      return stats
    },
  )

  // Get database statistics
  registerChannel(IPC.DATA_STATS, () => {
    const stats = getDb().maintenance.getDatabaseStats()
    return {
      ...stats,
      cacheSizeBytes: getDirectorySize(getAppCacheDirectoryPath()),
    }
  })

  // Refresh log handlers
  registerChannel(IPC.REFRESH_LOG_LIST, () => {
    return loadRefreshLogs()
  })

  registerChannel(IPC.REFRESH_LOG_CLEAR, () => {
    clearRefreshLogs()
    return { success: true }
  })
}
