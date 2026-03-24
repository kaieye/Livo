import { session } from 'electron'

interface BilibiliCardResponse {
  code?: number
  data?: {
    card?: {
      name?: string
    }
  }
}

function extractBilibiliUidFromFeedUrl(feedUrl: string): string | null {
  try {
    const parsed = new URL(feedUrl)
    const m = parsed.pathname.match(
      /\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i,
    )
    if (m?.[1]) return m[1]
  } catch {
    // Ignore malformed URL
  }
  return null
}

async function fetchJson(
  url: string,
  headers?: Record<string, string>,
): Promise<unknown> {
  const response = await session.defaultSession.fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      ...headers,
    },
  })
  if (!response.ok) {
    throw new Error(`request failed: ${response.status}`)
  }
  return response.json()
}

async function resolveBilibiliNameByUid(
  uid: string,
): Promise<string | undefined> {
  try {
    const json = (await fetchJson(
      `https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(uid)}`,
      {
        Referer: `https://space.bilibili.com/${uid}`,
      },
    )) as BilibiliCardResponse
    if (json?.code !== 0) return undefined
    const name = json?.data?.card?.name?.trim()
    if (!name) return undefined
    return name
  } catch {
    return undefined
  }
}

export async function resolveFeedTitleFallback(
  feedUrl: string,
): Promise<string | undefined> {
  const bilibiliUid = extractBilibiliUidFromFeedUrl(feedUrl)
  if (bilibiliUid) {
    const name = await resolveBilibiliNameByUid(bilibiliUid)
    if (name) return `${name} (Bilibili)`
  }
  return undefined
}
