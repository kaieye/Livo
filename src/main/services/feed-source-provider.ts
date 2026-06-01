import type RssParser from 'rss-parser'
import type { Feed } from '../../shared/types'
import { DEFAULT_RSSHUB_INSTANCE } from '../../shared/discover-data'
import { getSettings } from '../handlers/settings-handlers'
import { fetchAndParseFeed, type FetchFeedOptions } from './rss-parser'
import {
  canonicalizeInstagramFeedUrl,
  ensureInstagramUserFeedLimit,
  ensureTwitterUserFeedLimit,
  normalizeRsshubProtocolUrl,
} from './rsshub-url'
import {
  getAggregatorSnapshot,
  pruneAggregatorSnapshots,
  setAggregatorSnapshot,
  touchAggregatorFailure,
  type AggregatorDiagnostics,
} from './aggregator-store'

type ParsedFeed = RssParser.Output<Record<string, any>>

export interface AggregatedFeedPayload {
  source: 'direct' | 'local-agent' | 'private-aggregator'
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
    /(?:^|\/)(?:instagram|picnob(?:\.info)?|pixnoy|piokok)\/user\//.test(raw) ||
    /(?:^|\/)(?:twitter|x)\/user\//.test(raw) ||
    /\/bilibili\/user\/dynamic\//.test(raw)
  )
}

function getFeedKey(feed: Feed, normalizedUrl: string): string {
  const raw = normalizedUrl.toLowerCase()
  const instagramUser = raw.match(
    /\/(?:instagram|picnob(?:\.info)?|pixnoy|piokok)\/user\/([^/?#]+)/i,
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
  const rsshubInstance =
    getSettings().general.rsshubInstance?.trim() || DEFAULT_RSSHUB_INSTANCE
  const canonicalFeedUrl = canonicalizeInstagramFeedUrl(
    feed.upstreamUrl || feed.url,
  )
  const limitedUrl = ensureTwitterUserFeedLimit(
    ensureInstagramUserFeedLimit(canonicalFeedUrl, 100),
    120,
  )
  return normalizeRsshubProtocolUrl(limitedUrl, rsshubInstance)
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

  const settings = getSettings().aggregator
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
  const settings = getSettings().aggregator
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
  options?: { force?: boolean },
): Promise<AggregatedFeedPayload> {
  const source = getDesiredSource(feed)
  if (source === 'local-agent') return fetchLocalAgentPayload(feed, options)
  return fetchDirectPayload(feed, options)
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
