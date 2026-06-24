import {
  isAbortError,
  scopedSignalWithTimeout,
  throwIfAborted,
} from '../../utils/abort-signal'
import type { WebSearchProviderId } from '../../../shared/settings-schema'

/**
 * Minimal DuckDuckGo HTML search (no API key required), used by the agent's
 * web_search tool to fetch fresh information not present in local feeds.
 */
export interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

export interface WebSearchAttempt {
  provider: WebSearchProviderId
  status: 'success' | 'empty' | 'failed' | 'cache_hit'
  resultCount: number
  elapsedMs: number
  error?: string
}

export interface WebSearchResponse {
  results: WebSearchResult[]
  provider?: WebSearchProviderId
  fromCache: boolean
  attempts: WebSearchAttempt[]
}

interface WebSearchProvider {
  id: WebSearchProviderId
  search: (
    query: string,
    options: Required<Pick<WebSearchOptions, 'locale'>> & {
      signal: AbortSignal
    },
  ) => Promise<WebSearchResult[]>
}

const DUCKDUCKGO_ENDPOINT = 'https://html.duckduckgo.com/html/'
const BING_ENDPOINT = 'https://www.bing.com/search'
const BRAVE_ENDPOINT = 'https://search.brave.com/search'
const MAX_RESULTS = 8
const REQUEST_TIMEOUT_MS = 12000
const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX_ENTRIES = 64
const DEFAULT_PROVIDER_ORDER: WebSearchProviderId[] = [
  'duckduckgo',
  'bing',
  'brave',
]
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const PROMPT_LIKE_TEXT =
  /\b(ignore (all )?(previous|above|prior) (instructions|messages|rules)|you are now|system prompt|developer message|act as|disregard (the )?(previous|above|prior))\b/gi
const PROMPT_LIKE_TEXT_START =
  /^\s*(ignore (all )?(previous|above|prior) (instructions|messages|rules)|you are now|system prompt|developer message|act as|disregard (the )?(previous|above|prior))/i

export interface WebSearchOptions {
  signal?: AbortSignal
  providers?: WebSearchProviderId[]
  locale?: string
  now?: () => number
}

interface CacheEntry {
  results: WebSearchResult[]
  expiresAt: number
}

const resultCache = new Map<string, CacheEntry>()

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripPromptLikeSearchText(input: string): string {
  if (PROMPT_LIKE_TEXT_START.test(input)) {
    return '[已移除疑似提示注入文本]'
  }
  return input.replace(PROMPT_LIKE_TEXT, '[已移除疑似提示注入文本]')
}

export function sanitizeWebSearchResult(
  result: WebSearchResult,
): WebSearchResult {
  return {
    title: stripPromptLikeSearchText(result.title),
    url: result.url,
    snippet: stripPromptLikeSearchText(result.snippet),
  }
}

/**
 * DuckDuckGo wraps outbound links in a redirect like
 * `//duckduckgo.com/l/?uddg=<encoded-url>`. Unwrap it back to the real target.
 */
function normalizeResultUrl(raw: string): string {
  const trimmed = raw.trim()
  try {
    const url = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed)
    const uddg = url.searchParams.get('uddg')
    if (uddg) return decodeURIComponent(uddg)
    return url.toString()
  } catch {
    return trimmed
  }
}

function cacheKey(
  provider: WebSearchProviderId,
  query: string,
  locale: string,
): string {
  return `${provider}:${locale}:${query.trim().toLowerCase()}`
}

function readCache(key: string, now: number): WebSearchResult[] | undefined {
  const cached = resultCache.get(key)
  if (!cached) return undefined
  if (cached.expiresAt <= now) {
    resultCache.delete(key)
    return undefined
  }
  resultCache.delete(key)
  resultCache.set(key, cached)
  return cached.results.map((result) => ({ ...result }))
}

function writeCache(
  key: string,
  results: WebSearchResult[],
  now: number,
): void {
  if (results.length === 0) return
  resultCache.set(key, {
    results: results.map((result) => ({ ...result })),
    expiresAt: now + CACHE_TTL_MS,
  })
  while (resultCache.size > CACHE_MAX_ENTRIES) {
    const oldest = resultCache.keys().next().value as string | undefined
    if (!oldest) break
    resultCache.delete(oldest)
  }
}

function normalizeProviderOrder(
  providers: WebSearchOptions['providers'],
): WebSearchProviderId[] {
  const valid = new Set<WebSearchProviderId>(DEFAULT_PROVIDER_ORDER)
  const requested = Array.isArray(providers)
    ? providers
    : DEFAULT_PROVIDER_ORDER
  const normalized = Array.from(
    new Set(
      requested.filter((provider): provider is WebSearchProviderId =>
        valid.has(provider),
      ),
    ),
  )
  return normalized.length > 0 ? normalized : DEFAULT_PROVIDER_ORDER
}

function normalizeLocale(locale: string | undefined): string {
  const trimmed = (locale || '').trim()
  return trimmed || 'wt-wt'
}

async function fetchText(
  url: string,
  init: RequestInit,
): Promise<string | null> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.text()
}

const webSearchProviders: Record<WebSearchProviderId, WebSearchProvider> = {
  duckduckgo: {
    id: 'duckduckgo',
    search: async (query, options) => {
      const body = new URLSearchParams({
        q: query,
        kl: options.locale || 'wt-wt',
      }).toString()
      const html = await fetchText(DUCKDUCKGO_ENDPOINT, {
        method: 'POST',
        signal: options.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body,
      })
      return html ? parseDuckDuckGoResults(html) : []
    },
  },
  bing: {
    id: 'bing',
    search: async (query, options) => {
      const url = new URL(BING_ENDPOINT)
      url.searchParams.set('q', query)
      if (options.locale && options.locale !== 'wt-wt') {
        url.searchParams.set('setlang', options.locale)
      }
      const html = await fetchText(url.toString(), {
        method: 'GET',
        signal: options.signal,
        headers: { 'User-Agent': USER_AGENT },
      })
      return html ? parseBingResults(html) : []
    },
  },
  brave: {
    id: 'brave',
    search: async (query, options) => {
      const url = new URL(BRAVE_ENDPOINT)
      url.searchParams.set('q', query)
      if (options.locale && options.locale !== 'wt-wt') {
        url.searchParams.set('source', 'web')
      }
      const html = await fetchText(url.toString(), {
        method: 'GET',
        signal: options.signal,
        headers: { 'User-Agent': USER_AGENT },
      })
      return html ? parseBraveResults(html) : []
    },
  },
}

export function clearWebSearchCacheForTests(): void {
  resultCache.clear()
}

export async function webSearchWithMetadata(
  query: string,
  options: WebSearchOptions = {},
): Promise<WebSearchResponse> {
  const trimmed = query.trim()
  if (!trimmed) {
    return { results: [], fromCache: false, attempts: [] }
  }
  throwIfAborted(options.signal)

  const locale = normalizeLocale(options.locale)
  const now = options.now?.() ?? Date.now()
  const attempts: WebSearchAttempt[] = []

  for (const providerId of normalizeProviderOrder(options.providers)) {
    const startedAt = Date.now()
    const key = cacheKey(providerId, trimmed, locale)
    const cached = readCache(key, now)
    if (cached) {
      attempts.push({
        provider: providerId,
        status: 'cache_hit',
        resultCount: cached.length,
        elapsedMs: Date.now() - startedAt,
      })
      return {
        results: cached,
        provider: providerId,
        fromCache: true,
        attempts,
      }
    }

    const scoped = scopedSignalWithTimeout(REQUEST_TIMEOUT_MS, options.signal)
    try {
      const results = await webSearchProviders[providerId].search(trimmed, {
        locale,
        signal: scoped.signal,
      })
      throwIfAborted(scoped.signal)
      const limited = results.slice(0, MAX_RESULTS)
      attempts.push({
        provider: providerId,
        status: limited.length > 0 ? 'success' : 'empty',
        resultCount: limited.length,
        elapsedMs: Date.now() - startedAt,
      })
      if (limited.length > 0) {
        writeCache(key, limited, now)
        return {
          results: limited,
          provider: providerId,
          fromCache: false,
          attempts,
        }
      }
    } catch (error) {
      if (isAbortError(error)) throw error
      attempts.push({
        provider: providerId,
        status: 'failed',
        resultCount: 0,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      scoped.dispose()
    }
  }

  return { results: [], fromCache: false, attempts }
}

export async function webSearch(
  query: string,
  options: WebSearchOptions = {},
): Promise<WebSearchResult[]> {
  const response = await webSearchWithMetadata(query, options)
  return response.results
}

function parseDuckDuckGoResults(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = []
  const linkRegex =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g

  const snippets: string[] = []
  let snippetMatch = snippetRegex.exec(html)
  while (snippetMatch) {
    snippets.push(stripTags(snippetMatch[1]))
    snippetMatch = snippetRegex.exec(html)
  }

  let index = 0
  let match = linkRegex.exec(html)
  while (match && results.length < MAX_RESULTS) {
    const url = normalizeResultUrl(match[1])
    const title = stripTags(match[2])
    if (title && url) {
      results.push({ title, url, snippet: snippets[index] || '' })
    }
    index += 1
    match = linkRegex.exec(html)
  }

  return results
}

function parseBingResults(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = []
  const itemRegex = /<li[^>]+class="b_algo"[^>]*>([\s\S]*?)<\/li>/g
  let itemMatch = itemRegex.exec(html)
  while (itemMatch && results.length < MAX_RESULTS) {
    const item = itemMatch[1]
    const linkMatch = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(item)
    if (linkMatch) {
      const title = stripTags(linkMatch[2])
      const url = normalizeResultUrl(linkMatch[1])
      const snippetMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(item)
      const snippet = snippetMatch ? stripTags(snippetMatch[1]) : ''
      if (title && url) results.push({ title, url, snippet })
    }
    itemMatch = itemRegex.exec(html)
  }
  return results
}

function parseBraveResults(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = []
  const itemRegex =
    /<(?:div|section)[^>]+class="[^"]*(?:snippet|web-result)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/g
  let itemMatch = itemRegex.exec(html)
  while (itemMatch && results.length < MAX_RESULTS) {
    const item = itemMatch[1]
    const linkMatch = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(item)
    if (linkMatch) {
      const title = stripTags(linkMatch[2])
      const url = normalizeResultUrl(linkMatch[1])
      const descriptionMatch =
        /<(?:p|div)[^>]+class="[^"]*(?:description|snippet-description)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div)>/i.exec(
          item,
        )
      const snippet = descriptionMatch ? stripTags(descriptionMatch[1]) : ''
      if (title && url) results.push({ title, url, snippet })
    }
    itemMatch = itemRegex.exec(html)
  }

  if (results.length > 0) return results

  const linkRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  let linkMatch = linkRegex.exec(html)
  while (linkMatch && results.length < MAX_RESULTS) {
    const title = stripTags(linkMatch[2])
    const url = normalizeResultUrl(linkMatch[1])
    if (title && url && !url.includes('search.brave.com')) {
      results.push({ title, url, snippet: '' })
    }
    linkMatch = linkRegex.exec(html)
  }
  return results
}

export function formatWebSearchResultsForAI(
  results: WebSearchResult[],
  query: string,
): string {
  const safeResults = results.map(sanitizeWebSearchResult)
  if (safeResults.length === 0) {
    return `没有找到关于「${query}」的网络搜索结果。`
  }
  let text = `「${query}」的网络搜索结果（共 ${safeResults.length} 条）：\n\n`
  for (let i = 0; i < safeResults.length; i += 1) {
    const r = safeResults[i]
    text += `[${i + 1}] ${r.title}\n`
    if (r.snippet) text += `   摘要: ${r.snippet}\n`
    text += `   链接: ${r.url}\n\n`
  }
  return text.trim()
}
