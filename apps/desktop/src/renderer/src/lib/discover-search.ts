export type DiscoverSearchPlatform = "all" | "youtube" | "bilibili" | "x" | "instagram"

export interface DiscoverSearchResult {
  title: string
  url: string
  siteUrl: string
  description: string
  source: "curated" | "url" | "rsshub"
  image?: string
  followers?: string
}

export function hasDiscoverSearchQuery(query: string): boolean {
  return query.trim().length > 0
}

export function extractXUsernameFromFeedUrl(url: string): string | null {
  const matched = url.match(/\/(?:x|twitter)\/user\/([^/?#]+)/i)
  if (!matched?.[1]) return null
  try {
    return decodeURIComponent(matched[1]).replace(/^@+/, "").trim().toLowerCase() || null
  } catch {
    return matched[1].replace(/^@+/, "").trim().toLowerCase() || null
  }
}

export function parseFollowersFromMirrorText(raw: string): string | undefined {
  const text = raw.replace(/\s+/g, " ").trim()
  if (!text) return undefined
  const numberFirst = text.match(/([\d][\d.,]*\s*[KMB]?)\s*followers?/i)
  if (numberFirst?.[1]) return `${numberFirst[1].trim()} followers`
  const wordFirst = text.match(/followers?\s*[:：]?\s*([\d][\d.,]*\s*[KMB]?)/i)
  if (wordFirst?.[1]) return `${wordFirst[1].trim()} followers`
  return undefined
}

async function fetchXFollowersFromMirror(username: string): Promise<string | undefined> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`https://r.jina.ai/http://x.com/${encodeURIComponent(username)}`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "text/plain,text/html;q=0.9,*/*;q=0.8",
      },
    })
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
  if (platform !== "x") return results

  const indexes = results
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => !result.followers && extractXUsernameFromFeedUrl(result.url))
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
          !result.description || /x user|rsshub x\/twitter user route/i.test(result.description)
            ? followers
            : result.description,
      }
    }),
  )
  return enriched
}
