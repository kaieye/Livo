/**
 * Deep shared core for per-platform discovery probes (YouTube / X / Bilibili /
 * Instagram). Each platform module is a thin adapter that supplies only the
 * platform-specific bits (search endpoint, how to read username/uid/title/etc.
 * out of that platform's response). Everything that used to be copy-pasted
 * across the four probes lives here:
 *
 *   - the Chrome User-Agent + request headers,
 *   - the `assertPublicDiscoveryUrl` SSRF guard around every fetch,
 *   - the injectable fetch function (so the core is unit-testable without
 *     Electron / the network),
 *   - generic dedupe by a candidate key,
 *   - scoring + stable sort + slice,
 *   - follower-label normalization (KMB / 万亿萬億),
 *   - og:image / og:title / og:description meta-tag scraping.
 */
import { session } from 'electron'
import { formatFollowerCount } from '../../../shared/discover-helpers'
import { assertPublicDiscoveryUrl } from './discover-url-policy'

/** Chrome desktop User-Agent shared by every discovery probe. */
export const DISCOVERY_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** Default HTML request headers used by HTML-scraping probes. */
export const DISCOVERY_HTML_HEADERS: Record<string, string> = {
  'User-Agent': DISCOVERY_CHROME_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
}

/**
 * Minimal shape of the response we consume from the injected fetch. Matches the
 * subset of the WHATWG `Response` (and Electron's `session.fetch`) that the
 * probes actually use, so fakes only need to implement this much.
 */
export interface DiscoveryFetchResponse {
  ok: boolean
  status: number
  text(): Promise<string>
  json(): Promise<unknown>
}

/**
 * Injectable fetch. Defaults to Electron's session fetch (which respects the
 * system proxy) but can be replaced with a fake in tests. Access to
 * `session.defaultSession` is lazy so this module stays importable in plain
 * Node test environments.
 */
export type DiscoveryFetch = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<DiscoveryFetchResponse>

/** The default fetch: Electron session fetch, resolved lazily per call. */
export const defaultDiscoveryFetch: DiscoveryFetch = (url, init) =>
  session.defaultSession.fetch(
    url,
    init as RequestInit,
  ) as unknown as Promise<DiscoveryFetchResponse>

/**
 * Run an SSRF-guarded fetch with the shared Chrome UA headers. Header overrides
 * are merged on top of the defaults. Returns `undefined` (instead of throwing)
 * when the URL is rejected by the policy or the network call fails, matching the
 * "swallow and fall through" behavior every probe relied on.
 */
export async function discoveryFetch(
  url: string,
  options: {
    fetchImpl?: DiscoveryFetch
    headers?: Record<string, string>
    signal?: AbortSignal
  } = {},
): Promise<DiscoveryFetchResponse | undefined> {
  const fetchImpl = options.fetchImpl || defaultDiscoveryFetch
  try {
    const safeUrl = await assertPublicDiscoveryUrl(url)
    return await fetchImpl(safeUrl, {
      headers: { ...DISCOVERY_HTML_HEADERS, ...options.headers },
      signal: options.signal,
    })
  } catch {
    return undefined
  }
}

// ── og-meta scraping ──────────────────────────────────────────────────────

/**
 * Read a single `<meta property="og:*" content="...">` (or the attribute-order
 * flipped variant) out of raw HTML. `prop` is matched literally (e.g.
 * "og:image", "og:title", "og:description"). Also accepts `name="og:*"`.
 */
export function extractOgMeta(html: string, prop: string): string {
  const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["']`,
      'i',
    ),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1]
  }
  return ''
}

// ── follower-label normalization ──────────────────────────────────────────

/**
 * Parse an English follower label like "1.2M followers" / "Followers: 219.3M"
 * and re-emit it in the canonical "<value> followers" form. Returns undefined
 * when no positive count is present. (Mirrors `normalizeXFollowersLabel` but is
 * exposed here as the shared KMB parser.)
 */
export function normalizeFollowerLabel(raw: string): string | undefined {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  const numberFirst = text.match(/([\d][\d.,]*\s*[KMB]?)\s*followers?/i)
  if (numberFirst?.[1]) {
    const value = Number(
      numberFirst[1].replace(/[, ]/g, '').replace(/[KMB]$/i, ''),
    )
    if (Number.isFinite(value) && value <= 0) return undefined
    return `${numberFirst[1].trim()} followers`
  }
  const wordFirst = text.match(/followers?\s*[:：]?\s*([\d][\d.,]*\s*[KMB]?)/i)
  if (wordFirst?.[1]) {
    const value = Number(
      wordFirst[1].replace(/[, ]/g, '').replace(/[KMB]$/i, ''),
    )
    if (Number.isFinite(value) && value <= 0) return undefined
    return `${wordFirst[1].trim()} followers`
  }
  return undefined
}

/**
 * Format a raw follower count into a localized suffix label, e.g.
 * `formatFollowerLabel(1200000, ' followers')` -> "1.2M followers" and
 * `formatFollowerLabel(34000, ' 粉丝')` -> "34K 粉丝". Returns undefined for
 * non-finite or negative counts.
 */
export function formatFollowerLabel(
  count: number | string | undefined,
  suffix: string,
): string | undefined {
  const numeric = typeof count === 'string' ? Number(count) : count
  if (typeof numeric !== 'number' || !Number.isFinite(numeric) || numeric < 0) {
    return undefined
  }
  return `${formatFollowerCount(numeric)}${suffix}`
}

// ── canonical candidate + generic dedupe / score / sort ───────────────────

/**
 * Canonical discovery candidate. Every platform maps into this exact shape;
 * the only platform-specific identity field (`platform`/`username`/`uid`) is
 * carried in `identity` and re-attached by the adapter on the way out.
 */
export interface PlatformCandidate {
  title: string
  description: string
  image: string
  feedUrl: string
  followers?: string
}

/** A scored candidate with the dedupe key the core uses internally. */
export interface ScoredCandidate extends PlatformCandidate {
  /** Stable key used to dedupe (channelId / mid / lowercased username …). */
  dedupeKey: string
  /** Higher sorts first. */
  score: number
}

/**
 * Generic dedupe + sort + slice shared by the probes. Keeps the first
 * occurrence of each `dedupeKey`, sorts by descending `score` (stable for ties,
 * preserving input order like the per-platform `Array.sort` did), trims to
 * `limit`, and drops the internal `dedupeKey`/`score` fields.
 */
export function dedupeScoreAndSort(
  candidates: ScoredCandidate[],
  limit: number,
): PlatformCandidate[] {
  const seen = new Set<string>()
  const unique: ScoredCandidate[] = []
  for (const candidate of candidates) {
    if (seen.has(candidate.dedupeKey)) continue
    seen.add(candidate.dedupeKey)
    unique.push(candidate)
  }
  return unique
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => {
      if (b.candidate.score !== a.candidate.score)
        return b.candidate.score - a.candidate.score
      return a.index - b.index
    })
    .slice(0, limit)
    .map(({ candidate }) => {
      const { dedupeKey: _key, score: _score, ...rest } = candidate
      return rest
    })
}
