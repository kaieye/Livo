import type RssParser from 'rss-parser'
import type { Feed } from '../../../shared/types/index'
import { DEFAULT_RSSHUB_INSTANCE } from '../../../shared/discover-data'
import { settingsProvider } from '../system/settings-provider'
import { fetchAndParseFeed, type FetchFeedOptions } from './rss-parser'
import { normalizeFeedUrl } from './rsshub-url'
import {
  getAggregatorSnapshot,
  pruneAggregatorSnapshots,
  setAggregatorSnapshot,
  touchAggregatorFailure,
  type AggregatorDiagnostics,
} from './aggregator-store'
import { isInstagramUserFeedUrl } from '../../../shared/url-detect'
import {
  queryServerFeedCache,
  shouldUseServerFeedCache,
  type FeedCacheEntry,
  type FeedCacheHit,
} from './feed-cache-client'

type ParsedFeed = RssParser.Output<Record<string, any>>

export interface AggregatedFeedPayload {
  source: 'direct' | 'local-agent' | 'private-aggregator' | 'server-cache'
  fetchedAt: number
  notModified: boolean
  etag?: string
  lastModified?: string
  parsed: ParsedFeed | null
  diagnostics?: AggregatorDiagnostics
}

function isHighRiskFeed(feedUrl: string | undefined): boolean {
  const raw = (feedUrl || '').toLowerCase()
  return (
    isInstagramUserFeedUrl(raw) ||
    /(?:^|\/)(?:twitter|x)\/user\//.test(raw) ||
    /\/bilibili\/user\/dynamic\//.test(raw)
  )
}

function getFeedKey(feed: Feed, normalizedUrl: string): string {
  const raw = normalizedUrl.toLowerCase()
  const instagramUser = raw.match(
    /\/(?:instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox)\/user\/([^/?#]+)/i,
  )?.[1]
  if (instagramUser)
    return `instagram:user:${decodeURIComponent(instagramUser).replace(/^@/, '')}`

  const twitterUser = raw.match(/\/(?:twitter|x)\/user\/([^/?#]+)/i)?.[1]
  if (twitterUser)
    return `twitter:user:${decodeURIComponent(twitterUser).replace(/^@/, '').toLowerCase()}`

  const bilibiliDynamic = raw.match(
    /\/bilibili\/user\/dynamic\/([^/?#]+)/i,
  )?.[1]
  if (bilibiliDynamic)
    return `bilibili:dynamic:${decodeURIComponent(bilibiliDynamic)}`

  return `feed:${feed.id}:${normalizedUrl}`
}

function getNormalizedFeedUrl(feed: Feed): string {
  if (feed.upstreamUrl && /^https?:\/\//i.test(feed.upstreamUrl)) {
    return feed.upstreamUrl
  }
  const rsshubInstance =
    settingsProvider.get().general.rsshubInstance?.trim() ||
    DEFAULT_RSSHUB_INSTANCE
  return normalizeFeedUrl(feed.url, rsshubInstance)
}

function getDesiredSource(feed: Feed): AggregatedFeedPayload['source'] {
  const explicit = feed.fetchSource
  if (
    explicit === 'direct' ||
    explicit === 'local-agent' ||
    explicit === 'private-aggregator'
  ) {
    return explicit
  }

  const settings = settingsProvider.get().aggregator
  if (!isHighRiskFeed(feed.url)) return 'direct'
  if (settings.mode === 'disabled') return 'direct'
  if (settings.mode === 'prefer-remote' || settings.mode === 'remote-only') {
    // Remote aggregator is not wired yet; keep the abstraction but route through
    // the local agent cache path so high-risk feeds still benefit immediately.
    return 'local-agent'
  }
  return 'local-agent'
}

async function fetchDirectPayload(
  feed: Feed,
  options?: { force?: boolean },
): Promise<AggregatedFeedPayload> {
  const normalizedUrl = getNormalizedFeedUrl(feed)
  const fetchOptions: FetchFeedOptions | undefined = options?.force
    ? undefined
    : {
        etag: feed.etag,
        lastModified: feed.lastModified,
      }

  const result = await fetchAndParseFeed(normalizedUrl, fetchOptions)
  if (result.notModified) {
    return {
      source: 'direct',
      fetchedAt: Date.now(),
      notModified: true,
      etag: result.etag,
      lastModified: result.lastModified,
      parsed: null,
      diagnostics: {
        upstreamsTried: [normalizedUrl],
        cacheHit: false,
      },
    }
  }
  if (!result.data)
    throw new Error(`Direct provider returned empty data for ${normalizedUrl}`)

  return {
    source: 'direct',
    fetchedAt: Date.now(),
    notModified: false,
    etag: result.etag,
    lastModified: result.lastModified,
    parsed: result.data,
    diagnostics: {
      upstreamsTried: [normalizedUrl],
      cacheHit: false,
      freshnessMs: 0,
    },
  }
}

async function fetchLocalAgentPayload(
  feed: Feed,
  options?: { force?: boolean },
): Promise<AggregatedFeedPayload> {
  const normalizedUrl = getNormalizedFeedUrl(feed)
  const key = getFeedKey(feed, normalizedUrl)
  const settings = settingsProvider.get().aggregator
  pruneAggregatorSnapshots(
    Math.max(1, settings.cacheRetentionDays) * 24 * 60 * 60 * 1000,
  )

  const snapshot = getAggregatorSnapshot(key)
  const now = Date.now()
  const pollIntervalMs =
    Math.max(60, settings.pollIntervalSeconds || 900) * 1000

  if (snapshot && !options?.force) {
    const ageMs = now - (snapshot.lastSuccessAt || snapshot.fetchedAt || 0)
    if (ageMs <= pollIntervalMs) {
      return {
        source: 'local-agent',
        fetchedAt: snapshot.fetchedAt,
        notModified: false,
        etag: snapshot.etag,
        lastModified: snapshot.lastModified,
        parsed: snapshot.parsed,
        diagnostics: {
          ...(snapshot.diagnostics || {}),
          cacheHit: true,
          freshnessMs: ageMs,
        },
      }
    }
  }

  try {
    const fetchOptions: FetchFeedOptions | undefined = options?.force
      ? undefined
      : {
          etag: snapshot?.etag || feed.etag,
          lastModified: snapshot?.lastModified || feed.lastModified,
        }

    const result = await fetchAndParseFeed(normalizedUrl, fetchOptions)
    if (result.notModified) {
      if (snapshot) {
        const ageMs = now - (snapshot.lastSuccessAt || snapshot.fetchedAt || 0)
        setAggregatorSnapshot({
          ...snapshot,
          source: 'local-agent',
          refreshedAt: now,
          diagnostics: {
            ...(snapshot.diagnostics || {}),
            cacheHit: true,
            freshnessMs: ageMs,
          },
          etag: result.etag || snapshot.etag,
          lastModified: result.lastModified || snapshot.lastModified,
        })
        return {
          source: 'local-agent',
          fetchedAt: snapshot.fetchedAt,
          notModified: false,
          etag: result.etag || snapshot.etag,
          lastModified: result.lastModified || snapshot.lastModified,
          parsed: snapshot.parsed,
          diagnostics: {
            ...(snapshot.diagnostics || {}),
            cacheHit: true,
            freshnessMs: ageMs,
          },
        }
      }
      throw new Error(
        `Local agent got 304 before snapshot was initialized for ${normalizedUrl}`,
      )
    }

    if (!result.data)
      throw new Error(
        `Local agent fetch returned empty data for ${normalizedUrl}`,
      )
    setAggregatorSnapshot({
      key,
      source: 'local-agent',
      fetchedAt: now,
      refreshedAt: now,
      lastSuccessAt: now,
      failureCount: 0,
      etag: result.etag,
      lastModified: result.lastModified,
      diagnostics: {
        upstreamsTried: [normalizedUrl],
        cacheHit: false,
        freshnessMs: 0,
      },
      parsed: result.data,
    })
    return {
      source: 'local-agent',
      fetchedAt: now,
      notModified: false,
      etag: result.etag,
      lastModified: result.lastModified,
      parsed: result.data,
      diagnostics: {
        upstreamsTried: [normalizedUrl],
        cacheHit: false,
        freshnessMs: 0,
      },
    }
  } catch (error) {
    touchAggregatorFailure(key, 'local-agent', error)
    if (snapshot) {
      return {
        source: 'local-agent',
        fetchedAt: snapshot.fetchedAt,
        notModified: false,
        etag: snapshot.etag,
        lastModified: snapshot.lastModified,
        parsed: snapshot.parsed,
        diagnostics: {
          ...(snapshot.diagnostics || {}),
          cacheHit: true,
          freshnessMs:
            now - (snapshot.lastSuccessAt || snapshot.fetchedAt || 0),
          lastError: String(error || ''),
        },
      }
    }
    throw error
  }
}

export async function resolveFeedPayload(
  feed: Feed,
  options?: {
    force?: boolean
    serverCacheHit?: FeedCacheHit
  },
): Promise<AggregatedFeedPayload> {
  // server-cache 优先级最高：admin/vip 用户的拉取优先吃后端缓存。
  // 如果调用方已经预取（批量刷新），直接用；否则自己问一次后端。
  // miss 时静默退回到原有 direct/local-agent 路径。
  if (shouldUseServerFeedCache()) {
    const normalizedUrl = getNormalizedFeedUrl(feed)
    const hit =
      options?.serverCacheHit ??
      (await maybeFetchSingleServerCacheHit(normalizedUrl))
    if (hit) {
      return buildServerCachePayload(hit, normalizedUrl)
    }
  }

  const source = getDesiredSource(feed)
  if (source === 'local-agent') return fetchLocalAgentPayload(feed, options)
  return fetchDirectPayload(feed, options)
}

async function maybeFetchSingleServerCacheHit(
  normalizedUrl: string,
): Promise<FeedCacheHit | null> {
  try {
    const { hits } = await queryServerFeedCache([normalizedUrl])
    return hits[0] ?? null
  } catch {
    // 后端不可用时静默回退到本地路径。
    return null
  }
}

function feedCacheEntryToParsedItem(
  entry: FeedCacheEntry,
): Record<string, any> {
  // 把后端的结构化条目伪装成 rss-parser 的 item，下游 buildSingleEntry 能直接消费。
  return {
    guid: entry.guid,
    title: entry.title,
    link: entry.link ?? undefined,
    creator: entry.author ?? undefined,
    author: entry.author ?? undefined,
    pubDate: entry.publishedAt ?? undefined,
    isoDate: entry.publishedAt ?? undefined,
    content: entry.contentHtml ?? undefined,
    'content:encoded': entry.contentHtml ?? undefined,
    contentSnippet: entry.summary ?? undefined,
    summary: entry.summary ?? undefined,
    description: entry.contentHtml ?? entry.summary ?? undefined,
  }
}

function buildServerCachePayload(
  hit: FeedCacheHit,
  normalizedUrl: string,
): AggregatedFeedPayload {
  const parsed = {
    items: hit.entries.map(feedCacheEntryToParsedItem),
  } as unknown as ParsedFeed

  const fetchedAt = Date.parse(hit.lastFetchedAt)
  return {
    source: 'server-cache',
    fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : Date.now(),
    notModified: false,
    parsed,
    diagnostics: {
      upstreamsTried: [normalizedUrl],
      cacheHit: true,
      freshnessMs: Number.isFinite(fetchedAt) ? Date.now() - fetchedAt : 0,
    },
  }
}

export async function warmAggregatorForFeeds(feeds: Feed[]): Promise<void> {
  const tasks = feeds
    .filter((feed) => getDesiredSource(feed) === 'local-agent')
    .map(async (feed) => {
      try {
        await fetchLocalAgentPayload(feed, { force: false })
      } catch {
        // Keep warm-up best-effort.
      }
    })
  await Promise.all(tasks)
}

/**
 * 批量预取后端缓存：返回 url → hit 的映射。
 * 仅当 admin/vip 用户登录时才会真正打后端，其他情况直接返回空 Map。
 * 调用方把命中结果通过 resolveFeedPayload 的 serverCacheHit 参数注入。
 */
export async function prefetchServerFeedCache(
  feeds: Feed[],
): Promise<Map<string, FeedCacheHit>> {
  const result = new Map<string, FeedCacheHit>()
  if (!shouldUseServerFeedCache() || feeds.length === 0) return result

  // 用 normalize 后的 url 去问，和后端 BuiltinFeedSource.url 对齐。
  const urlByFeedId = new Map<string, string>()
  const uniqueUrls = new Set<string>()
  for (const feed of feeds) {
    const url = getNormalizedFeedUrl(feed)
    urlByFeedId.set(feed.id, url)
    uniqueUrls.add(url)
  }

  try {
    const { hits } = await queryServerFeedCache(Array.from(uniqueUrls))
    for (const hit of hits) {
      result.set(hit.url, hit)
    }
  } catch {
    // 静默失败：批量预取失败不应阻塞整体刷新流程。
  }
  return result
}

export function getNormalizedFeedUrlForCache(feed: Feed): string {
  return getNormalizedFeedUrl(feed)
}
