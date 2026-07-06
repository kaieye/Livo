import { session } from 'electron'
import { assertNetworkFetchUrl } from '../system/network-url-policy'

const TITLE_FETCH_TIMEOUT_MS = 8000
const MAX_TITLE_REDIRECTS = 5
const MAX_TITLE_TEXT_BYTES = 1024 * 1024
const MAX_TITLE_JSON_BYTES = 512 * 1024

interface BilibiliCardResponse {
  code?: number
  data?: {
    card?: {
      name?: string
    }
  }
}

async function fetchTitleResource(
  url: string,
  headers: Record<string, string>,
  redirectsRemaining = MAX_TITLE_REDIRECTS,
): Promise<Response | undefined> {
  try {
    const safeUrl = await assertNetworkFetchUrl(url)
    const response = await session.defaultSession.fetch(safeUrl, {
      method: 'GET',
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(TITLE_FETCH_TIMEOUT_MS),
    })

    if (response.status >= 300 && response.status < 400) {
      if (redirectsRemaining <= 0) return undefined
      const location = response.headers.get('location')
      if (!location) return response
      const redirectUrl = new URL(location, safeUrl).href
      return fetchTitleResource(redirectUrl, headers, redirectsRemaining - 1)
    }

    return response
  } catch {
    return undefined
  }
}

async function readResponseText(
  response: Response,
  maxBytes: number,
): Promise<string | undefined> {
  const contentLength = Number.parseInt(
    response.headers.get('content-length') || '',
    10,
  )
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return undefined
  }

  const reader = response.body?.getReader()
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer())
    return buffer.length > maxBytes ? undefined : buffer.toString('utf8')
  }

  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        return undefined
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    total,
  ).toString('utf8')
}

function titleRequestHeaders(
  accept: string,
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: accept,
    ...overrides,
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

function extractTwitterUsernameFromFeedUrl(feedUrl: string): string | null {
  try {
    const parsed = new URL(feedUrl)
    const m = parsed.pathname.match(/\/(?:twitter|x)\/user\/([^/?#]+)/i)
    if (m?.[1]) return decodeURIComponent(m[1]).replace(/^@/, '')
  } catch {
    // Ignore malformed URL
  }
  return null
}

function extractInstagramUsernameFromFeedUrl(feedUrl: string): string | null {
  try {
    const parsed = new URL(feedUrl)
    const m = parsed.pathname.match(
      /\/(?:instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox)\/user\/([^/?#]+)/i,
    )
    if (m?.[1]) return decodeURIComponent(m[1]).replace(/^@/, '')
  } catch {
    // Ignore malformed URL
  }
  return null
}

/**
 * 将 rsshub:// 协议 URL 转换为实际的 HTTP URL。
 * 如果 URL 已经是 http/https 协议则直接返回。
 */
function toHttpUrl(feedUrl: string, rsshubBase?: string): string | null {
  try {
    const parsed = new URL(feedUrl)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return feedUrl
    }
    if (parsed.protocol === 'rsshub:') {
      const base = (rsshubBase || 'https://rsshub.app').replace(/\/+$/, '')
      const path = `/${parsed.hostname}${parsed.pathname}${parsed.search}`
      return `${base}${path}`
    }
    return null
  } catch {
    return null
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetchTitleResource(
      url,
      titleRequestHeaders(
        'application/xml, application/rss+xml, text/xml, */*',
      ),
    )
    if (!response?.ok) return null
    return (await readResponseText(response, MAX_TITLE_TEXT_BYTES)) || null
  } catch {
    return null
  }
}

/**
 * 从 RSS XML 中提取 <title> 标签内容
 */
function extractTitleFromXml(xml: string): string | null {
  const m = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!m?.[1]) return null
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

async function fetchJson(
  url: string,
  headers?: Record<string, string>,
): Promise<unknown> {
  const response = await fetchTitleResource(
    url,
    titleRequestHeaders('application/json, text/plain, */*', headers),
  )
  if (!response?.ok) {
    throw new Error(`request failed: ${response?.status ?? 'blocked'}`)
  }
  const text = await readResponseText(response, MAX_TITLE_JSON_BYTES)
  if (!text) throw new Error('empty response')
  return JSON.parse(text)
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

/**
 * 通过 RSSHub 获取 Twitter 用户的显示名称。
 * RSSHub 返回的 feed <title> 通常为 "{displayName} 的 Twitter" 格式。
 */
async function resolveTwitterNameByUsername(
  username: string,
  rsshubBase?: string,
): Promise<string | undefined> {
  const bases = rsshubBase
    ? [rsshubBase]
    : ['https://rsshub.app', 'https://rsshub.rssforever.com']

  for (const base of bases) {
    const url = `${base.replace(/\/+$/, '')}/twitter/user/${encodeURIComponent(username)}`
    const xml = await fetchText(url)
    if (!xml) continue
    const title = extractTitleFromXml(xml)
    if (!title) continue

    // RSSHub 格式: "displayName 的 Twitter" 或 "displayName ( @handle )"
    const m1 = title.match(/^(.+?)\s+的\s+(?:twitter|x)\s*$/i)
    if (m1?.[1]?.trim()) return m1[1].trim()

    const m2 = title.match(/^(.+?)\s*\(\s*@[a-zA-Z0-9_]+\s*\)/)
    if (m2?.[1]?.trim()) return m2[1].trim()

    // Nitter 格式: "displayName / @handle" 或 "displayName (@handle)"
    const m3 = title.match(/^(.+?)\s*\/\s*@[a-zA-Z0-9_]+/)
    if (m3?.[1]?.trim()) return m3[1].trim()

    // 如果标题不是 URL 且不等于用户名，直接使用
    if (
      title &&
      !/^https?:\/\//i.test(title) &&
      title.toLowerCase() !== username.toLowerCase()
    ) {
      return title
    }
  }
  return undefined
}

/**
 * 通过 Picnob/RSSHub 获取 Instagram 用户的显示名称。
 */
async function resolveInstagramNameByUsername(
  username: string,
  rsshubBase?: string,
): Promise<string | undefined> {
  const bases = rsshubBase
    ? [rsshubBase]
    : ['https://rsshub.app', 'https://rsshub.rssforever.com']

  for (const base of bases) {
    // 尝试 RSSHub picnob 路由
    const url = `${base.replace(/\/+$/, '')}/picnob/user/${encodeURIComponent(username)}`
    const xml = await fetchText(url)
    if (!xml) continue
    const title = extractTitleFromXml(xml)
    if (!title) continue

    // Picnob 格式: "displayName (@username) public posts - Picnob"
    const m1 = title.match(/@([a-zA-Z0-9._]+)/)
    if (m1?.[1]) return m1[1]

    // RSSHub 格式: "displayName 的 Instagram"
    const m2 = title.match(/^(.+?)\s+的\s+instagram\s*$/i)
    if (m2?.[1]?.trim()) return m2[1].trim()

    // 如果标题不是 URL 且不等于用户名，直接使用
    if (
      title &&
      !/^https?:\/\//i.test(title) &&
      title.toLowerCase() !== username.toLowerCase()
    ) {
      return title
    }
  }
  return undefined
}

export async function resolveFeedTitleFallback(
  feedUrl: string,
  rsshubBase?: string,
): Promise<string | undefined> {
  // Bilibili
  const bilibiliUid = extractBilibiliUidFromFeedUrl(feedUrl)
  if (bilibiliUid) {
    const name = await resolveBilibiliNameByUid(bilibiliUid)
    if (name) return `${name} (Bilibili)`
  }

  // Twitter
  const twitterUser = extractTwitterUsernameFromFeedUrl(feedUrl)
  if (twitterUser) {
    const name = await resolveTwitterNameByUsername(twitterUser, rsshubBase)
    if (name) return `${name} - X`
  }

  // Instagram
  const instagramUser = extractInstagramUsernameFromFeedUrl(feedUrl)
  if (instagramUser) {
    const name = await resolveInstagramNameByUsername(instagramUser, rsshubBase)
    if (name) return `${name} - Ins`
  }

  // Generic RSS/Atom feed: fetch the feed and extract <title> from the XML.
  // This handles feeds synced from the server (which only stores URLs, not titles).
  const httpUrl = toHttpUrl(feedUrl, rsshubBase)
  if (httpUrl) {
    const xml = await fetchText(httpUrl)
    if (xml) {
      const rssTitle = extractTitleFromXml(xml)
      if (rssTitle && !/^https?:\/\//i.test(rssTitle) && rssTitle.length > 1) {
        return rssTitle
      }
    }
  }

  return undefined
}
