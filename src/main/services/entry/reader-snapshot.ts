import { getDb } from '../../database'
import type {
  Feed,
  FeedWithCount,
  ReaderSnapshot,
  ReaderSnapshotEntry,
  ReaderSnapshotRequest,
  ReaderSnapshotScope,
} from '../../../shared/types/index'
import { deriveEntryTaskSnapshot } from '../../../shared/entry-task-status'
import type { EntryTaskSnapshot } from '../../../shared/types/index'
import type { TaskRunRecord } from '../system/task-runner'
import { getLocalTaskRunner } from '../system/task-runner-service'

const DEFAULT_SNAPSHOT_LIMIT = 10
const MAX_SNAPSHOT_LIMIT = 1000
const RECOMMENDED_CATEGORY = 'Recommended'

interface SnapshotCursorPayloadV1 {
  v: 1
  offset: number
  queryKey: string
}

interface SnapshotCursorPayloadV2 {
  v: 2
  publishedAt: number
  id: string
  queryKey: string
}

type SnapshotCursorPayload = SnapshotCursorPayloadV1 | SnapshotCursorPayloadV2

function toRendererFeed(feed: Feed): Feed {
  const folder =
    feed.folder ??
    (feed.category === RECOMMENDED_CATEGORY ? '' : feed.category || '')
  return { ...feed, folder }
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return DEFAULT_SNAPSHOT_LIMIT
  }
  return Math.max(1, Math.min(Math.floor(limit), MAX_SNAPSHOT_LIMIT))
}

function normalizeScope(
  scope: ReaderSnapshotRequest['scope'],
): ReaderSnapshotScope {
  if (!scope) return { type: 'all' }
  if (scope.type === 'feed') return { type: 'feed', feedId: scope.feedId }
  if (scope.type === 'starred') return { type: 'starred' }
  return {
    type: 'all',
    feedIds: Array.from(new Set((scope.feedIds || []).filter(Boolean))).sort(),
  }
}

function buildQueryKey(input: {
  scope: ReaderSnapshotScope
  unreadOnly: boolean
  limit: number
}): string {
  return JSON.stringify({
    scope: input.scope,
    unreadOnly: input.unreadOnly,
    limit: input.limit,
  })
}

function decodeCursor(
  cursor: string | null | undefined,
  queryKey: string,
): SnapshotCursorPayloadV2 | null {
  if (!cursor) return null
  try {
    const payload = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<SnapshotCursorPayload>
    if (
      payload.v !== 2 ||
      payload.queryKey !== queryKey ||
      typeof payload.publishedAt !== 'number' ||
      !Number.isFinite(payload.publishedAt) ||
      typeof payload.id !== 'string' ||
      !payload.id
    ) {
      return null
    }
    return {
      v: 2,
      publishedAt: Math.floor(payload.publishedAt),
      id: payload.id,
      queryKey,
    }
  } catch {
    return null
  }
}

function encodeCursor(payload: SnapshotCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function toEntryOptions(input: {
  scope: ReaderSnapshotScope
  unreadOnly: boolean
}): {
  feedId?: string
  feedIds?: string[]
  starred?: boolean
  unreadOnly?: boolean
} {
  const base = input.unreadOnly ? { unreadOnly: true } : {}
  switch (input.scope.type) {
    case 'feed':
      return { ...base, feedId: input.scope.feedId }
    case 'starred':
      return { ...base, starred: true }
    case 'all':
      return input.scope.feedIds?.length
        ? { ...base, feedIds: input.scope.feedIds }
        : base
    default:
      return base
  }
}

function buildUnreadCountMapObject(
  unreadCountMap: Map<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [feedId, count] of unreadCountMap) result[feedId] = count
  return result
}

function getScopeUnreadCount(input: {
  scope: ReaderSnapshotScope
  unreadCountMap: Map<string, number>
}): number {
  if (input.scope.type === 'feed') {
    return input.unreadCountMap.get(input.scope.feedId) || 0
  }
  if (input.scope.type === 'all' && input.scope.feedIds?.length) {
    return input.scope.feedIds.reduce(
      (total, feedId) => total + (input.unreadCountMap.get(feedId) || 0),
      0,
    )
  }
  return Array.from(input.unreadCountMap.values()).reduce(
    (total, count) => total + count,
    0,
  )
}

function sortFeedsForRenderer(feeds: FeedWithCount[]): FeedWithCount[] {
  return feeds.sort((a, b) => a.title.localeCompare(b.title))
}

function normalizeAvatarComparisonKey(value: string | undefined): string {
  return (value || '').trim()
}

function collectEntryImageKeys(entry: ReaderSnapshotEntry): Set<string> {
  const keys = new Set<string>()
  const push = (value: string | undefined): void => {
    const key = normalizeAvatarComparisonKey(value)
    if (key) keys.add(key)
  }

  push(entry.imageUrl)
  for (const media of entry.media || []) {
    if (media.type !== 'photo') continue
    push(media.url)
    push(media.previewUrl)
  }

  return keys
}

function findPollutedFeedAvatarKeys(
  feeds: FeedWithCount[],
  entries: ReaderSnapshotEntry[],
): Map<string, string> {
  const entryImageKeysByFeedId = new Map<string, Set<string>>()
  for (const entry of entries) {
    const current = entryImageKeysByFeedId.get(entry.feedId) || new Set()
    for (const key of collectEntryImageKeys(entry)) current.add(key)
    entryImageKeysByFeedId.set(entry.feedId, current)
  }

  const polluted = new Map<string, string>()
  for (const feed of feeds) {
    const feedImageKey = normalizeAvatarComparisonKey(feed.imageUrl)
    if (!feedImageKey) continue
    if (entryImageKeysByFeedId.get(feed.id)?.has(feedImageKey)) {
      polluted.set(feed.id, feedImageKey)
    }
  }
  return polluted
}

function sanitizeSnapshotFeed(
  feed: FeedWithCount,
  pollutedFeedAvatarKeys: Map<string, string>,
): FeedWithCount {
  if (!pollutedFeedAvatarKeys.has(feed.id)) return feed
  // 历史版本可能把文章封面保存为订阅源头像；快照层避免继续展示。
  return { ...feed, imageUrl: undefined }
}

function sanitizeSnapshotEntry(
  entry: ReaderSnapshotEntry,
  pollutedFeedAvatarKeys: Map<string, string>,
): ReaderSnapshotEntry {
  const authorAvatarKey = normalizeAvatarComparisonKey(entry.authorAvatar)
  if (!authorAvatarKey) return entry

  const pollutedFeedAvatarKey = pollutedFeedAvatarKeys.get(entry.feedId)
  if (
    authorAvatarKey === pollutedFeedAvatarKey ||
    collectEntryImageKeys(entry).has(authorAvatarKey)
  ) {
    return { ...entry, authorAvatar: '' }
  }
  return entry
}

function getActiveEntryTaskSnapshots(
  entryIds: string[],
): Map<string, Partial<Record<keyof EntryTaskSnapshot, TaskRunRecord>>> {
  const entryIdSet = new Set(entryIds)
  const result = new Map<
    string,
    Partial<Record<keyof EntryTaskSnapshot, TaskRunRecord>>
  >()
  const records = getLocalTaskRunner().listRecentRuns()

  for (const record of records) {
    if (record.status !== 'queued' && record.status !== 'running') continue
    const entryId = record.metadata?.entryId
    const taskKind = record.metadata?.entryTaskKind
    if (typeof entryId !== 'string' || !entryIdSet.has(entryId)) continue
    if (
      taskKind !== 'fulltext' &&
      taskKind !== 'aiSummary' &&
      taskKind !== 'aiTranslate'
    ) {
      continue
    }
    const current = result.get(entryId) ?? {}
    current[taskKind] = record
    result.set(entryId, current)
  }

  return result
}

export function getReaderSnapshot(
  input: ReaderSnapshotRequest = {},
): ReaderSnapshot {
  const scope = normalizeScope(input.scope)
  const limit = normalizeLimit(input.limit)
  const unreadOnly = !!input.unreadOnly
  const queryKey = buildQueryKey({ scope, unreadOnly, limit })
  const cursor = decodeCursor(input.cursor, queryKey)
  const unreadCountMap = getDb().entries.getUnreadCountMap()
  const baseFeeds = sortFeedsForRenderer(
    getDb()
      .feeds.getAllFeeds()
      .map((feed) => ({
        ...toRendererFeed(feed),
        unreadCount: unreadCountMap.get(feed.id) || 0,
      })),
  )
  const entryOptions = toEntryOptions({ scope, unreadOnly })
  const result = getDb().entries.getEntries({
    ...entryOptions,
    limit,
    beforePublishedAt: cursor?.publishedAt,
    beforeId: cursor?.id,
    compact: input.compact ?? true,
    maxContentLength: input.maxContentLength ?? 520,
    skipDedupe: false,
  })
  const activeTaskSnapshots = getActiveEntryTaskSnapshots(
    result.entries.map((entry) => entry.id),
  )
  const baseEntries: ReaderSnapshotEntry[] = result.entries.map((entry) => ({
    ...entry,
    taskSnapshot: deriveEntryTaskSnapshot(entry, {
      activeTasks: activeTaskSnapshots.get(entry.id),
    }),
  }))
  const pollutedFeedAvatarKeys = findPollutedFeedAvatarKeys(
    baseFeeds,
    baseEntries,
  )
  const feeds = baseFeeds.map((feed) =>
    sanitizeSnapshotFeed(feed, pollutedFeedAvatarKeys),
  )
  const entries = baseEntries.map((entry) =>
    sanitizeSnapshotEntry(entry, pollutedFeedAvatarKeys),
  )
  const nextCursor =
    result.hasMore && result.nextCursorEntry
      ? encodeCursor({
          v: 2,
          publishedAt: result.nextCursorEntry.publishedAt,
          id: result.nextCursorEntry.id,
          queryKey,
        })
      : null

  return {
    feeds,
    entries,
    counts: {
      totalFeeds: feeds.length,
      totalUnread: Array.from(unreadCountMap.values()).reduce(
        (total, count) => total + count,
        0,
      ),
      unreadByFeedId: buildUnreadCountMapObject(unreadCountMap),
      scopeUnread: getScopeUnreadCount({ scope, unreadCountMap }),
    },
    nextCursor,
  }
}
