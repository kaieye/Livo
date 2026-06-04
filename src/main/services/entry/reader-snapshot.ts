import { getDb } from '../../database'
import type {
  Entry,
  Feed,
  FeedWithCount,
  ReaderSnapshot,
  ReaderSnapshotRequest,
  ReaderSnapshotScope,
} from '../../../shared/types/index'

const DEFAULT_SNAPSHOT_LIMIT = 10
const MAX_SNAPSHOT_LIMIT = 1000
const RECOMMENDED_CATEGORY = 'Recommended'

interface SnapshotCursorPayload {
  v: 1
  offset: number
  queryKey: string
}

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
): number {
  if (!cursor) return 0
  try {
    const payload = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<SnapshotCursorPayload>
    if (
      payload.v !== 1 ||
      payload.queryKey !== queryKey ||
      typeof payload.offset !== 'number' ||
      !Number.isFinite(payload.offset)
    ) {
      return 0
    }
    return Math.max(0, Math.floor(payload.offset))
  } catch {
    return 0
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

export function getReaderSnapshot(
  input: ReaderSnapshotRequest = {},
): ReaderSnapshot {
  const scope = normalizeScope(input.scope)
  const limit = normalizeLimit(input.limit)
  const unreadOnly = !!input.unreadOnly
  const queryKey = buildQueryKey({ scope, unreadOnly, limit })
  const offset = decodeCursor(input.cursor, queryKey)
  const unreadCountMap = getDb().entries.getUnreadCountMap()
  const feeds = sortFeedsForRenderer(
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
    offset,
    compact: input.compact ?? true,
    maxContentLength: input.maxContentLength ?? 520,
    skipDedupe: false,
  })
  const entries: Entry[] = result.entries
  const nextCursor = result.hasMore
    ? encodeCursor({ v: 1, offset: offset + limit, queryKey })
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
