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
import type {
  AIDigestCandidate,
  AIDigestPreset,
  AIDigestRun,
  Entry,
  Feed,
} from '../shared/types'
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
import {
  buildEntryIndexes,
  buildFeedByUrlIndex,
  makeEntryUrlKey,
} from './database/indexes'

export type { CleanupOptions, CleanupStats } from './database/cleanup'

interface DatabaseData {
  feeds: Feed[]
  entries: Entry[]
  aiDigestRuns?: AIDigestRun[]
}

let data: DatabaseData = { feeds: [], entries: [], aiDigestRuns: [] }
let dbPath = ''
let saveTimer: ReturnType<typeof setTimeout> | null = null
let feedByUrlIndex = new Map<string, Feed>()
let entryByFeedUrlIndex = new Map<string, Entry>()
let entryByFeedIdentityIndex = new Map<string, Entry>()
let entriesByFeedIdPublishedDesc = new Map<string, Entry[]>()
let unreadEntriesByPublishedDesc: Entry[] = []
let starredEntriesByPublishedDesc: Entry[] = []
let unreadCountByFeedId = new Map<string, number>()
let entryQueryIndexesDirty = true
let entriesByPublishedDesc: Entry[] = []
let entriesOrderDirty = true

function markEntriesOrderDirty(): void {
  entriesOrderDirty = true
}

function markEntryQueryIndexesDirty(): void {
  entryQueryIndexesDirty = true
  markEntriesOrderDirty()
}

function getEntriesByPublishedDesc(): Entry[] {
  if (!entriesOrderDirty) return entriesByPublishedDesc
  entriesByPublishedDesc = [...data.entries].sort(
    (a, b) => (b.publishedAt || 0) - (a.publishedAt || 0),
  )
  entriesOrderDirty = false
  return entriesByPublishedDesc
}

function ensureEntryQueryIndexes(): void {
  if (!entryQueryIndexesDirty) return
  const entryIndexes = buildEntryIndexes(data.entries, makeEntryIdentityKey)
  entryByFeedUrlIndex = entryIndexes.entryByFeedUrlIndex
  entryByFeedIdentityIndex = entryIndexes.entryByFeedIdentityIndex
  entriesByFeedIdPublishedDesc = entryIndexes.entriesByFeedIdPublishedDesc
  unreadEntriesByPublishedDesc = entryIndexes.unreadEntriesByPublishedDesc
  starredEntriesByPublishedDesc = entryIndexes.starredEntriesByPublishedDesc
  unreadCountByFeedId = entryIndexes.unreadCountByFeedId
  entryQueryIndexesDirty = false
}

function rebuildIndexes(): void {
  feedByUrlIndex = buildFeedByUrlIndex(data.feeds)
  const entryIndexes = buildEntryIndexes(data.entries, makeEntryIdentityKey)
  entryByFeedUrlIndex = entryIndexes.entryByFeedUrlIndex
  entryByFeedIdentityIndex = entryIndexes.entryByFeedIdentityIndex
  entriesByFeedIdPublishedDesc = entryIndexes.entriesByFeedIdPublishedDesc
  unreadEntriesByPublishedDesc = entryIndexes.unreadEntriesByPublishedDesc
  starredEntriesByPublishedDesc = entryIndexes.starredEntriesByPublishedDesc
  unreadCountByFeedId = entryIndexes.unreadCountByFeedId
  entryQueryIndexesDirty = false
  markEntriesOrderDirty()
}

function normalizeDatabaseShape(): void {
  if (!data.feeds) data.feeds = []
  if (!data.entries) data.entries = []
  if (!Array.isArray(data.aiDigestRuns)) data.aiDigestRuns = []
}

function getAIDigestRuns(): AIDigestRun[] {
  if (!Array.isArray(data.aiDigestRuns)) data.aiDigestRuns = []
  return data.aiDigestRuns
}

function stripDigestText(value: string | undefined): string {
  return (value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
      normalizeDatabaseShape()

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
        markEntriesOrderDirty: markEntryQueryIndexesDirty,
      })
      if (dedupeResult.changed) {
        data.entries = dedupeResult.entries
        markEntryQueryIndexesDirty()
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
          ) || /\/bilibili\/user\/(?:dynamic|video|article)\//i.test(rawFeedUrl)
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
      data = { feeds: [], entries: [], aiDigestRuns: [] }
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

export interface EntryListResult {
  entries: Entry[]
  hasMore: boolean
}

function getFilteredEntries(options: {
  feedId?: string
  feedIds?: string[]
  starred?: boolean
  unreadOnly?: boolean
  limit?: number
  offset?: number
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
  ensureEntryQueryIndexes()
  const orderedEntries = options.feedId
    ? entriesByFeedIdPublishedDesc.get(options.feedId) || []
    : options.unreadOnly && !requestedFeedIds
      ? unreadEntriesByPublishedDesc
      : options.starred && !requestedFeedIds
        ? starredEntriesByPublishedDesc
        : getEntriesByPublishedDesc()

  let result: Entry[] = []
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
  return result
}

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
}): EntryListResult {
  const offset = options.offset || 0
  const limit = options.limit || 1000
  const filteredEntries = getFilteredEntries(options)
  const pageEntries = filteredEntries.slice(offset, offset + limit)
  const hasMore = filteredEntries.length > offset + limit
  if (!options.compact) return { entries: pageEntries, hasMore }

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
  return {
    entries: pageEntries.map((entry) => ({
      ...entry,
      content: trimCompactContent(entry.content, maxContentLength),
      summary: trimCompactContent(entry.summary, maxSummaryLength),
      media: entry.media || [],
    })),
    hasMore,
  }
}

export function getOrphanEntries(): Entry[] {
  const validFeedIds = new Set(data.feeds.map((feed) => feed.id))
  return data.entries.filter((entry) => !validFeedIds.has(entry.feedId))
}

export function reassignEntriesToFeed(
  fromFeedId: string,
  toFeedId: string,
): number {
  if (!fromFeedId || !toFeedId || fromFeedId === toFeedId) return 0
  let changed = 0
  data.entries = data.entries.map((entry) => {
    if (entry.feedId !== fromFeedId) return entry
    changed += 1
    return { ...entry, feedId: toFeedId }
  })
  if (changed > 0) {
    rebuildIndexes()
    scheduleSave()
  }
  return changed
}

export function getEntryById(id: string): Entry | undefined {
  return data.entries.find((e) => e.id === id)
}

export function insertEntry(entry: Entry): boolean {
  const result = upsertEntry(entry)
  if (result.changed) scheduleSave()
  return result.added
}

export interface EntryWriteResult {
  addedCount: number
  addedEntries: Entry[]
}

export function insertEntriesWithResult(entries: Entry[]): EntryWriteResult {
  let added = 0
  let changed = false
  const addedEntries: Entry[] = []
  for (const entry of entries) {
    const result = upsertEntry(entry)
    if (result.added) {
      added++
      addedEntries.push(entry)
    }
    if (result.changed) changed = true
  }
  if (changed) scheduleSave()
  return { addedCount: added, addedEntries }
}

export function insertEntries(entries: Entry[]): number {
  return insertEntriesWithResult(entries).addedCount
}

export function replaceEntriesForFeedWithResult(
  feedId: string,
  entries: Entry[],
): EntryWriteResult {
  const stateByKey = new Map<
    string,
    { isRead: boolean; isStarred: boolean; readProgress?: number }
  >()
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
        readProgress: entry.readProgress,
      })
      continue
    }
    existing.isRead = existing.isRead || !!entry.isRead
    existing.isStarred = existing.isStarred || !!entry.isStarred
    if (
      entry.readProgress !== undefined &&
      (existing.readProgress === undefined ||
        entry.readProgress > existing.readProgress)
    ) {
      existing.readProgress = entry.readProgress
    }
  }

  data.entries = data.entries.filter((entry) => entry.feedId !== feedId)
  markEntryQueryIndexesDirty()
  rebuildIndexes()

  let added = 0
  const addedEntries: Entry[] = []
  for (const entry of entries) {
    const keep = stateByKey.get(makeKeepKey(entry))
    const incoming: Entry = keep
      ? {
          ...entry,
          isRead: entry.isRead || keep.isRead,
          isStarred: entry.isStarred || keep.isStarred,
          readProgress: keep.readProgress,
        }
      : entry
    const result = upsertEntry(incoming)
    if (!keep && result.added) {
      added += 1
      addedEntries.push(incoming)
    }
  }
  scheduleSave()
  return { addedCount: added, addedEntries }
}

export function replaceEntriesForFeed(
  feedId: string,
  entries: Entry[],
): number {
  return replaceEntriesForFeedWithResult(feedId, entries).addedCount
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
      return {
        added: false,
        changed: mergeEntryData(existing, entry, {
          onPublishedAtAdvanced: markEntryQueryIndexesDirty,
        }),
      }
    }
  }
  data.entries.push(entry)
  markEntryQueryIndexesDirty()
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

  if (
    previous.url &&
    (previous.url !== next.url || previous.feedId !== next.feedId)
  ) {
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

  if (
    updates.feedId !== undefined ||
    updates.publishedAt !== undefined ||
    updates.isRead !== undefined ||
    updates.isStarred !== undefined
  ) {
    markEntryQueryIndexesDirty()
  }
  scheduleSave()
}

export function markAllRead(feedId?: string): void {
  let changed = false
  for (const entry of data.entries) {
    if ((!feedId || entry.feedId === feedId) && !entry.isRead) {
      entry.isRead = true
      changed = true
    }
  }
  if (changed) markEntryQueryIndexesDirty()
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

export function getDigestWindow(
  preset: AIDigestPreset,
  now = Date.now(),
): { windowStartAt: number; windowEndAt: number } {
  const date = new Date(now)
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  if (preset === 'week') {
    const day = start.getDay()
    const diffToMonday = (day + 6) % 7
    start.setDate(start.getDate() - diffToMonday)
  }
  return { windowStartAt: start.getTime(), windowEndAt: now }
}

export function listDigestCandidates(options: {
  preset: AIDigestPreset
  feedId?: string
  limit?: number
  now?: number
}): AIDigestCandidate[] {
  const { windowStartAt, windowEndAt } = getDigestWindow(
    options.preset,
    options.now,
  )
  const feedsById = new Map(data.feeds.map((feed) => [feed.id, feed]))
  const limit = Math.max(1, Math.min(options.limit ?? 80, 200))
  const candidates: AIDigestCandidate[] = []

  for (const entry of getEntriesByPublishedDesc()) {
    if (candidates.length >= limit) break
    if (options.feedId && entry.feedId !== options.feedId) continue
    if (entry.publishedAt < windowStartAt || entry.publishedAt > windowEndAt)
      continue
    const feed = feedsById.get(entry.feedId)
    if (!feed || feed.showInAll === false) continue
    const content = stripDigestText(
      entry.readabilityContent || entry.content || entry.summary,
    )
    const summary = stripDigestText(entry.aiSummary || entry.summary)
    if (!entry.title && !content && !summary) continue
    candidates.push({
      id: entry.id,
      title: entry.title || summary.slice(0, 80) || content.slice(0, 80),
      summary,
      content,
      feedTitle: feed.title,
      url: entry.url,
      publishedAt: entry.publishedAt,
    })
  }

  return candidates
}

export function listAIDigestRuns(limit = 20): AIDigestRun[] {
  return [...getAIDigestRuns()]
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    .slice(0, Math.max(1, Math.min(limit, 100)))
}

export function upsertAIDigestRun(
  input: Omit<AIDigestRun, 'id' | 'createdAt' | 'updatedAt'>,
): AIDigestRun {
  const runs = getAIDigestRuns()
  const now = Date.now()
  const existing = runs.find(
    (run) =>
      run.preset === input.preset &&
      run.feedId === input.feedId &&
      run.windowStartAt === input.windowStartAt,
  )
  if (existing) {
    Object.assign(existing, {
      ...input,
      updatedAt: now,
    })
    scheduleSave()
    return existing
  }

  const run: AIDigestRun = {
    ...input,
    id: `digest-${now}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  }
  runs.push(run)
  scheduleSave()
  return run
}

export function updateAIDigestRun(
  id: string,
  updates: Partial<Omit<AIDigestRun, 'id' | 'createdAt'>>,
): AIDigestRun | null {
  const run = getAIDigestRuns().find((item) => item.id === id)
  if (!run) return null
  Object.assign(run, updates, { updatedAt: Date.now() })
  scheduleSave()
  return run
}

export function getUnreadCount(feedId: string): number {
  if (!data.feeds.some((f) => f.id === feedId)) return 0
  ensureEntryQueryIndexes()
  return unreadCountByFeedId.get(feedId) || 0
}

export function getUnreadCountMap(): Map<string, number> {
  ensureEntryQueryIndexes()
  const validFeedIds = new Set(data.feeds.map((f) => f.id))
  const unreadByFeed = new Map<string, number>()
  for (const [feedId, unreadCount] of unreadCountByFeedId) {
    if (validFeedIds.has(feedId)) {
      unreadByFeed.set(feedId, unreadCount)
    }
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
