/**
 * JSON-based local database for Livo.
 * Uses simple JSON files - no native compilation needed.
 */
import { app } from 'electron'
import { join } from 'path'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
} from 'fs'
import type { Feed, Entry } from '../shared/types'
import { FeedViewType } from '../shared/types'
import {
  cleanupDatabaseEntries,
  type CleanupOptions,
  type CleanupStats,
} from './database/cleanup'
import {
  dedupeEntriesForRead,
  dedupeEntriesInPlace,
  isBrokenScraperEntry,
  mergeEntryData,
  mergeTextFromEntry,
} from './database/entry-dedupe'
import {
  makeEntryIdentityKey,
  normalizeIdentityText,
  titlesLikelySameForRead,
} from './database/entry-identity'
import { normalizeExistingFeedTitles } from './database/feed-normalization'
import { buildEntryIndexes, buildFeedByUrlIndex } from './database/indexes'

export type { CleanupOptions, CleanupStats } from './database/cleanup'

interface DatabaseData {
  feeds: Feed[]
  entries: Entry[]
}

let data: DatabaseData = { feeds: [], entries: [] }
let dbPath = ''
let saveTimer: ReturnType<typeof setTimeout> | null = null
let feedByUrlIndex = new Map<string, Feed>()
let entryByFeedUrlIndex = new Map<string, Entry>()
let entryByFeedIdentityIndex = new Map<string, Entry>()
let entriesByPublishedDesc: Entry[] = []
let entriesOrderDirty = true

function markEntriesOrderDirty(): void {
  entriesOrderDirty = true
}

function getEntriesByPublishedDesc(): Entry[] {
  if (!entriesOrderDirty) return entriesByPublishedDesc
  entriesByPublishedDesc = [...data.entries].sort(
    (a, b) => (b.publishedAt || 0) - (a.publishedAt || 0),
  )
  entriesOrderDirty = false
  return entriesByPublishedDesc
}

function makeEntryUrlKey(feedId: string, url: string): string {
  return `${feedId}\n${url}`
}

function rebuildIndexes(): void {
  feedByUrlIndex = buildFeedByUrlIndex(data.feeds)
  const entryIndexes = buildEntryIndexes(data.entries, makeEntryIdentityKey)
  entryByFeedUrlIndex = entryIndexes.entryByFeedUrlIndex
  entryByFeedIdentityIndex = entryIndexes.entryByFeedIdentityIndex
  markEntriesOrderDirty()
}

function getDbDir(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'data')
}

export async function initDatabase(): Promise<void> {
  const dir = getDbDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const nextDbPath = join(dir, 'livo-data.json')
  const legacyDbPath = join(dir, `${['for', 'ss', '-data.json'].join('')}`)
  dbPath = nextDbPath

  const sourceDbPath = existsSync(nextDbPath)
    ? nextDbPath
    : existsSync(legacyDbPath)
      ? legacyDbPath
      : nextDbPath

  if (existsSync(sourceDbPath)) {
    try {
      const raw = readFileSync(sourceDbPath, 'utf-8')
      data = JSON.parse(raw)
      if (sourceDbPath !== dbPath && !existsSync(dbPath)) {
        writeFileSync(dbPath, raw)
      }
      if (!data.feeds) data.feeds = []
      if (!data.entries) data.entries = []

      // Migration: ensure all feeds have a view field
      for (const feed of data.feeds) {
        if ((feed as unknown as Record<string, unknown>).view === undefined) {
          ;(feed as unknown as Record<string, unknown>).view =
            FeedViewType.Articles
        }
        if (
          (feed as unknown as Record<string, unknown>).showInAll === undefined
        ) {
          ;(feed as unknown as Record<string, unknown>).showInAll = true
        }
        // Migration: Instagram feeds should use Pictures view.
        // Handle both Articles (0), SocialMedia (1) and legacy view values.
        const feedView = (feed as unknown as Record<string, unknown>)
          .view as number
        if (
          feedView !== FeedViewType.Pictures &&
          /(?:^|\/)(?:instagram|picnob(?:\.info)?|pixnoy|piokok)\/user\//i.test(
            feed.url || '',
          )
        ) {
          ;(feed as unknown as Record<string, unknown>).view =
            FeedViewType.Pictures
        }
      }
      const normalizedFeedTitlesChanged = normalizeExistingFeedTitles(
        data.feeds,
      )
      // Migration: fix entry titles.
      // 1. "Untitled" or empty → adopt summary/content text, or ""
      // 2. Truncated title → adopt longer summary that starts with the title
      for (const entry of data.entries) {
        const sp = (entry.summary || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        const cp = (entry.content || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        const bestText = sp.length >= cp.length ? sp : cp
        const tn = (entry.title || '').replace(/\s+/g, ' ').trim()

        if (!tn || tn === 'Untitled') {
          // Rule 1: use best available text, or ""
          entry.title = bestText || ''
        } else if (sp.length > tn.length && sp.startsWith(tn)) {
          // Rule 2: truncated title → adopt longer summary
          entry.title = sp
        }
      }

      const dedupeResult = dedupeEntriesInPlace(data.entries, {
        markEntriesOrderDirty,
      })
      if (dedupeResult.changed) {
        data.entries = dedupeResult.entries
        markEntriesOrderDirty()
      }

      // Migration: remove entries injected by FeedBurner from unrelated domains.
      // When a feed has a siteUrl, drop entries whose hostname doesn't match.
      let foreignRemoved = 0
      const feedSiteHosts = new Map<string, string>()
      for (const feed of data.feeds) {
        if (!feed.siteUrl) continue
        const rawFeedUrl = (feed.url || '').toLowerCase()
        const isSocialMirrorFeed =
          /\/(?:twitter|x|instagram|picnob(?:\.info)?|pixnoy|piokok)\/user\//i.test(
            rawFeedUrl,
          )
        if (isSocialMirrorFeed) continue
        try {
          const host = new URL(feed.siteUrl).hostname.replace(/^www\./, '')
          if (host) feedSiteHosts.set(feed.id, host)
        } catch {
          /* ignore */
        }
      }
      if (feedSiteHosts.size > 0) {
        const beforeLen = data.entries.length
        data.entries = data.entries.filter((e) => {
          const siteHost = feedSiteHosts.get(e.feedId)
          if (!siteHost) return true
          if (!e.url) return true
          try {
            const entryHost = new URL(e.url).hostname.replace(/^www\./, '')
            return (
              entryHost === siteHost ||
              entryHost.endsWith('.' + siteHost) ||
              siteHost.endsWith('.' + entryHost)
            )
          } catch {
            return true
          }
        })
        foreignRemoved = beforeLen - data.entries.length
      }

      if (
        normalizedFeedTitlesChanged ||
        dedupeResult.changed ||
        foreignRemoved > 0
      ) {
        try {
          writeFileSync(dbPath, JSON.stringify(data), 'utf-8')
        } catch {
          // Ignore write failure during startup dedupe.
        }
      }
    } catch {
      data = { feeds: [], entries: [] }
    }
  }

  rebuildIndexes()
}

/** Debounced save to disk */
function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      writeFileSync(dbPath, JSON.stringify(data), 'utf-8')
    } catch (e) {
      console.error('Failed to save database:', e)
    }
  }, 500)
}

export function forceSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  try {
    writeFileSync(dbPath, JSON.stringify(data), 'utf-8')
  } catch (e) {
    console.error('Failed to save database:', e)
  }
}

// ---- Feed operations ----

export function getAllFeeds(): Feed[] {
  return data.feeds
}

export function getFeedById(id: string): Feed | undefined {
  return data.feeds.find((f) => f.id === id)
}

export function getFeedByUrl(url: string): Feed | undefined {
  return feedByUrlIndex.get(url)
}

export function insertFeed(feed: Feed): void {
  if (feedByUrlIndex.has(feed.url)) return
  const normalizedFeed: Feed = {
    ...feed,
    showInAll: feed.showInAll ?? true,
  }
  data.feeds.push(normalizedFeed)
  feedByUrlIndex.set(normalizedFeed.url, normalizedFeed)
  scheduleSave()
}

export function updateFeed(id: string, updates: Partial<Feed>): void {
  const idx = data.feeds.findIndex((f) => f.id === id)
  if (idx === -1) return
  const prev = data.feeds[idx]
  data.feeds[idx] = { ...prev, ...updates }
  if (prev.url !== data.feeds[idx].url) {
    feedByUrlIndex.delete(prev.url)
    feedByUrlIndex.set(data.feeds[idx].url, data.feeds[idx])
  } else {
    feedByUrlIndex.set(data.feeds[idx].url, data.feeds[idx])
  }
  scheduleSave()
}

export function deleteFeed(id: string): void {
  const removed = data.feeds.find((f) => f.id === id)
  data.feeds = data.feeds.filter((f) => f.id !== id)
  data.entries = data.entries.filter((e) => e.feedId !== id)
  if (removed) feedByUrlIndex.delete(removed.url)
  rebuildIndexes()
  scheduleSave()
}

// ---- Entry operations ----

export function getEntries(options: {
  feedId?: string
  feedIds?: string[]
  starred?: boolean
  unreadOnly?: boolean
  limit?: number
  offset?: number
  compact?: boolean
  maxContentLength?: number
  skipDedupe?: boolean
}): Entry[] {
  const offset = options.offset || 0
  const limit = options.limit || 1000
  const skipDedupe = !!options.skipDedupe
  const preDedupeWindow = Math.max((offset + limit) * 6, 1200)
  const preWindow = skipDedupe
    ? Math.max((offset + limit) * 2, 800)
    : preDedupeWindow
  const validFeedIds = new Set(data.feeds.map((f) => f.id))
  const requestedFeedIds =
    !options.feedId && options.feedIds && options.feedIds.length > 0
      ? new Set(options.feedIds)
      : null

  let result: Entry[] = []
  const orderedEntries = getEntriesByPublishedDesc()
  for (const entry of orderedEntries) {
    if (!validFeedIds.has(entry.feedId)) continue
    if (options.feedId && entry.feedId !== options.feedId) continue
    if (requestedFeedIds && !requestedFeedIds.has(entry.feedId)) continue
    if (options.starred && !entry.isStarred) continue
    if (options.unreadOnly && entry.isRead) continue
    result.push(entry)
    if (result.length >= preWindow) break
  }
  if (!skipDedupe) {
    result = dedupeEntriesForRead(result, markEntriesOrderDirty)
    result.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
  }
  const page = result.slice(offset, offset + limit)
  if (!options.compact) return page

  const trimCompactContent = (
    value: string | undefined,
    maxLen: number,
  ): string => {
    const raw = value || ''
    if (!raw) return ''
    let next = raw
      .replace(
        /&lt;\s*(img|video|iframe|audio|picture|source)\b[\s\S]*?(?:&gt;|$)/gi,
        ' ',
      )
      .replace(
        /<\s*(img|video|iframe|audio|picture|source)\b[^>]*(?:>|$)/gi,
        ' ',
      )
    if (next.length <= maxLen) return next

    let sliced = next.slice(0, maxLen)
    const lastLt = sliced.lastIndexOf('<')
    const lastGt = sliced.lastIndexOf('>')
    if (lastLt > lastGt) {
      const nextGt = next.indexOf('>', maxLen)
      if (nextGt !== -1 && nextGt - maxLen <= 240) {
        sliced = next.slice(0, nextGt + 1)
      } else {
        sliced = sliced.slice(0, lastLt)
      }
    }
    return sliced
  }

  const maxContentLength = Math.max(
    160,
    Math.min(options.maxContentLength ?? 1600, 10000),
  )
  const maxSummaryLength = Math.max(
    120,
    Math.min(Math.floor(maxContentLength / 2), 2400),
  )
  return page.map((entry) => ({
    ...entry,
    content: trimCompactContent(entry.content, maxContentLength),
    summary: trimCompactContent(entry.summary, maxSummaryLength),
    media: entry.media || [],
  }))
}

export function getEntryById(id: string): Entry | undefined {
  return data.entries.find((e) => e.id === id)
}

export function insertEntry(entry: Entry): boolean {
  const result = upsertEntry(entry)
  if (result.changed) scheduleSave()
  return result.added
}

export function insertEntries(entries: Entry[]): number {
  let added = 0
  let changed = false
  for (const entry of entries) {
    const result = upsertEntry(entry)
    if (result.added) added++
    if (result.changed) changed = true
  }
  if (changed) scheduleSave()
  return added
}

export function replaceEntriesForFeed(
  feedId: string,
  entries: Entry[],
): number {
  const stateByKey = new Map<string, { isRead: boolean; isStarred: boolean }>()
  const makeKeepKey = (entry: Entry): string => {
    const title = normalizeIdentityText(entry.title).slice(0, 140)
    const bucket = Math.floor((entry.publishedAt || 0) / (60 * 60 * 1000))
    return `${title}|${bucket}`
  }

  for (const entry of data.entries) {
    if (entry.feedId !== feedId) continue
    const key = makeKeepKey(entry)
    const existing = stateByKey.get(key)
    if (!existing) {
      stateByKey.set(key, {
        isRead: !!entry.isRead,
        isStarred: !!entry.isStarred,
      })
      continue
    }
    existing.isRead = existing.isRead || !!entry.isRead
    existing.isStarred = existing.isStarred || !!entry.isStarred
  }

  data.entries = data.entries.filter((entry) => entry.feedId !== feedId)
  markEntriesOrderDirty()
  rebuildIndexes()

  let added = 0
  for (const entry of entries) {
    const keep = stateByKey.get(makeKeepKey(entry))
    const incoming: Entry = keep
      ? {
          ...entry,
          isRead: entry.isRead || keep.isRead,
          isStarred: entry.isStarred || keep.isStarred,
        }
      : entry
    const result = upsertEntry(incoming)
    if (result.added) added += 1
  }
  scheduleSave()
  return added
}

function upsertEntry(entry: Entry): { added: boolean; changed: boolean } {
  // Broken scraper entries (invalid numeric Instagram URLs) are not inserted,
  // but their text is merged into the closest matching good entry if possible.
  if (isBrokenScraperEntry(entry)) {
    let bestMatch: Entry | null = null
    let bestDelta = Infinity
    for (const e of data.entries) {
      if (e.feedId !== entry.feedId) continue
      if (!titlesLikelySameForRead(e.title, entry.title)) continue
      const delta = Math.abs((e.publishedAt || 0) - (entry.publishedAt || 0))
      if (delta < bestDelta) {
        bestDelta = delta
        bestMatch = e
      }
    }
    if (bestMatch && bestDelta <= 48 * 60 * 60 * 1000) {
      return { added: false, changed: mergeTextFromEntry(bestMatch, entry) }
    }
    return { added: false, changed: false }
  }
  // Deduplicate by URL when available; otherwise by a content fingerprint per feed.
  const identityKey = makeEntryIdentityKey(entry)
  if (identityKey) {
    const existing = entryByFeedIdentityIndex.get(identityKey)
    if (existing) {
      return { added: false, changed: mergeEntryData(existing, entry) }
    }
  }
  data.entries.push(entry)
  markEntriesOrderDirty()
  if (entry.url) {
    entryByFeedUrlIndex.set(makeEntryUrlKey(entry.feedId, entry.url), entry)
  }
  if (identityKey) {
    entryByFeedIdentityIndex.set(identityKey, entry)
  }
  return { added: true, changed: true }
}

export function updateEntry(id: string, updates: Partial<Entry>): void {
  const idx = data.entries.findIndex((e) => e.id === id)
  if (idx === -1) return
  const previous = data.entries[idx]
  const next = { ...previous, ...updates }
  data.entries[idx] = next

  if (previous.url && previous.url !== next.url) {
    entryByFeedUrlIndex.delete(makeEntryUrlKey(previous.feedId, previous.url))
  }
  if (next.url) {
    entryByFeedUrlIndex.set(makeEntryUrlKey(next.feedId, next.url), next)
  }

  const previousIdentityKey = makeEntryIdentityKey(previous)
  const nextIdentityKey = makeEntryIdentityKey(next)
  if (previousIdentityKey && previousIdentityKey !== nextIdentityKey) {
    entryByFeedIdentityIndex.delete(previousIdentityKey)
  }
  if (nextIdentityKey) {
    entryByFeedIdentityIndex.set(nextIdentityKey, next)
  }

  if (updates.publishedAt !== undefined) markEntriesOrderDirty()
  scheduleSave()
}

export function markAllRead(feedId?: string): void {
  for (const entry of data.entries) {
    if (!feedId || entry.feedId === feedId) {
      entry.isRead = true
    }
  }
  scheduleSave()
}

export function searchEntries(query: string, limit = 50): Entry[] {
  const q = query.toLowerCase()
  const validFeedIds = new Set(data.feeds.map((f) => f.id))
  const result = data.entries
    .filter((e) => validFeedIds.has(e.feedId))
    .filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.content && e.content.toLowerCase().includes(q)) ||
        (e.summary && e.summary.toLowerCase().includes(q)),
    )
  return dedupeEntriesForRead(result, markEntriesOrderDirty)
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, limit)
}

export function getUnreadCount(feedId: string): number {
  if (!data.feeds.some((f) => f.id === feedId)) return 0
  return data.entries.filter((e) => e.feedId === feedId && !e.isRead).length
}

export function getUnreadCountMap(): Map<string, number> {
  const validFeedIds = new Set(data.feeds.map((f) => f.id))
  const unreadByFeed = new Map<string, number>()

  for (const entry of data.entries) {
    if (entry.isRead) continue
    if (!validFeedIds.has(entry.feedId)) continue
    unreadByFeed.set(entry.feedId, (unreadByFeed.get(entry.feedId) || 0) + 1)
  }

  return unreadByFeed
}

// ---- Data maintenance / cleanup ----

/**
 * Clean up old/excess entries with combined retention:
 * - Entries are removed only when BOTH conditions are true:
 *   1) the entry is older than maxEntryAgeDays
 *   2) the feed has more than entriesPerFeed entries (and this entry is outside newest N)
 */
export function cleanupEntries(options: CleanupOptions): CleanupStats {
  const result = cleanupDatabaseEntries(data.feeds, data.entries, options)
  if (result.stats.removed > 0) {
    data.entries = result.entries
    rebuildIndexes()
    scheduleSave()
  }
  return result.stats
}

/** Get database statistics */
export function getDatabaseStats(): {
  totalFeeds: number
  totalEntries: number
  readEntries: number
  starredEntries: number
  dataSizeBytes: number
} {
  let dataSizeBytes = 0
  try {
    if (dbPath && existsSync(dbPath)) {
      dataSizeBytes = statSync(dbPath).size
    } else {
      dataSizeBytes = Buffer.byteLength(JSON.stringify(data), 'utf-8')
    }
  } catch {
    dataSizeBytes = Buffer.byteLength(JSON.stringify(data), 'utf-8')
  }
  return {
    totalFeeds: data.feeds.length,
    totalEntries: data.entries.length,
    readEntries: data.entries.filter((e) => e.isRead).length,
    starredEntries: data.entries.filter((e) => e.isStarred).length,
    dataSizeBytes,
  }
}

export function getDatabase(): { close: () => void } {
  return {
    close: () => {
      forceSave()
    },
  }
}
