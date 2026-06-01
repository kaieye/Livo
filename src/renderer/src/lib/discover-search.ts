export type DiscoverSearchPlatform =
  | 'all'
  | 'youtube'
  | 'bilibili'
  | 'x'
  | 'instagram'

export const DISCOVER_SEARCH_DEBOUNCE_MS = 150
export const X_DISCOVER_SEARCH_DEBOUNCE_MS = 500

export interface DiscoverSearchResult {
  title: string
  url: string
  siteUrl: string
  description: string
  source: 'curated' | 'url' | 'rsshub'
  image?: string
  followers?: string
}

export function hasDiscoverSearchQuery(query: string): boolean {
  return query.trim().length > 0
}

export function hasDiscoverSearchQueryForPlatform(
  query: string,
  platform: DiscoverSearchPlatform,
): boolean {
  const normalized = query.trim()
  if (!normalized) return false
  if (platform !== 'x') return true
  if (/^https?:\/\/\S+/i.test(normalized)) return true
  const withoutAt = normalized.replace(/^@+/, '')
  return withoutAt.length >= 3
}

export function getDiscoverSearchDebounceMs(
  platform: DiscoverSearchPlatform,
): number {
  if (platform === 'x') return X_DISCOVER_SEARCH_DEBOUNCE_MS
  return DISCOVER_SEARCH_DEBOUNCE_MS
}

export function shouldImmediatelySubmitDiscoverSearch(params: {
  previousPlatform: DiscoverSearchPlatform
  nextPlatform: DiscoverSearchPlatform
  query: string
}): boolean {
  const { previousPlatform, nextPlatform, query } = params
  return previousPlatform !== nextPlatform && hasDiscoverSearchQuery(query)
}

export function shouldPreserveExplicitDiscoverView(params: {
  requestedView: number
  persistedView?: number
}): boolean {
  const { requestedView, persistedView } = params
  return typeof persistedView === 'number' && requestedView !== persistedView
}

export function shouldEnrichDiscoverResultsInForeground(
  _platform: DiscoverSearchPlatform,
): boolean {
  return false
}

export function extractXUsernameFromFeedUrl(url: string): string | null {
  const matched = url.match(/\/(?:x|twitter)\/user\/([^/?#]+)/i)
  if (!matched?.[1]) return null
  try {
    return (
      decodeURIComponent(matched[1]).replace(/^@+/, '').trim().toLowerCase() ||
      null
    )
  } catch {
    return matched[1].replace(/^@+/, '').trim().toLowerCase() || null
  }
}

export function parseFollowersFromMirrorText(raw: string): string | undefined {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  const numberFirst = text.match(/([\d][\d.,]*\s*[KMB]?)\s*followers?/i)
  if (numberFirst?.[1]) return `${numberFirst[1].trim()} followers`
  const wordFirst = text.match(/followers?\s*[:：]?\s*([\d][\d.,]*\s*[KMB]?)/i)
  if (wordFirst?.[1]) return `${wordFirst[1].trim()} followers`
  return undefined
}

async function fetchXFollowersFromMirror(
  username: string,
): Promise<string | undefined> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(
      `https://r.jina.ai/http://x.com/${encodeURIComponent(username)}`,
      {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'text/plain,text/html;q=0.9,*/*;q=0.8',
        },
      },
    )
    if (!res.ok) return undefined
    const text = await res.text()
    return parseFollowersFromMirrorText(text)
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

export async function enrichDiscoverSearchResults(
  results: DiscoverSearchResult[],
  platform: DiscoverSearchPlatform,
): Promise<DiscoverSearchResult[]> {
  if (platform !== 'x') return results

  const indexes = results
    .map((result, index) => ({ result, index }))
    .filter(
      ({ result }) =>
        !result.followers && extractXUsernameFromFeedUrl(result.url),
    )
    .slice(0, 6)

  if (indexes.length === 0) return results

  const enriched = [...results]
  await Promise.all(
    indexes.map(async ({ result, index }) => {
      const username = extractXUsernameFromFeedUrl(result.url)
      if (!username) return
      const followers = await fetchXFollowersFromMirror(username)
      if (!followers) return
      enriched[index] = {
        ...result,
        followers,
        description:
          !result.description ||
          /x user|rsshub x\/twitter user route/i.test(result.description)
            ? followers
            : result.description,
      }
    }),
  )
  return enriched
}
