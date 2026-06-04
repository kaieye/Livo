import { session } from 'electron'
import { normalizeNameForMatch } from './discover-helpers'

export type VideoProbeCandidate = {
  platform: 'youtube' | 'bilibili'
  title: string
  description: string
  image: string
  feedUrl: string
  followers?: string
}

const YOUTUBE_SUBSCRIBER_CACHE_TTL = 10 * 60 * 1000
const YOUTUBE_SUBSCRIBER_MISS_CACHE_TTL = 30 * 1000
const youtubeSubscriberCache = new Map<
  string,
  { expiresAt: number; followers?: string }
>()

function isUsernameMatch(query: string, candidateName: string): boolean {
  const q = normalizeNameForMatch(query)
  const c = normalizeNameForMatch(candidateName)
  if (!q || !c) return false
  return c.includes(q)
}

function flattenTextRuns(node: any): string {
  if (!node) return ''
  if (typeof node.simpleText === 'string') return node.simpleText
  if (Array.isArray(node.runs))
    return node.runs
      .map((r: any) => r?.text || '')
      .join('')
      .trim()
  return ''
}

function parseYouTubeSubscriberLabel(raw: string): string | undefined {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text || text.startsWith('@')) return undefined

  // Keep full matched phrase so we preserve locale style (e.g. "1.2M subscribers", "3.4万位订阅者", "3.4萬位訂閱者").
  const patterns = [
    /([\d.,]+(?:\s*[KMB])?)\s*subscribers?/i,
    /([\d.,]+(?:\s*[KMB])?)\s*subscriber/i,
    /([\d.,]+(?:\s*[万亿萬億])?)\s*(?:位)?(?:订阅者|訂閱者)/i,
    /(?:订阅者|訂閱者)(?:数|數)?\s*([\d.,]+(?:\s*[万亿萬億])?)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const phrase = match[0].trim()
      const hasNumber = /\d/.test(phrase)
      if (hasNumber) return phrase
    }
  }

  return undefined
}

function extractYouTubeSubscriberText(renderer: any): string {
  const candidates = [
    flattenTextRuns(renderer?.subscriberCountText),
    String(
      renderer?.subscriberCountText?.accessibility?.accessibilityData?.label ||
        '',
    ),
    flattenTextRuns(renderer?.longBylineText),
  ]

  for (const candidate of candidates) {
    const parsed = parseYouTubeSubscriberLabel(candidate || '')
    if (parsed) return parsed
  }

  return ''
}

function collectChannelRenderers(node: any, out: any[]): void {
  if (!node) return
  if (Array.isArray(node)) {
    for (const n of node) collectChannelRenderers(n, out)
    return
  }
  if (typeof node !== 'object') return
  if (node.channelRenderer) out.push(node.channelRenderer)
  for (const key of Object.keys(node)) {
    collectChannelRenderers(node[key], out)
  }
}

function extractYouTubeHandleFromChannelRenderer(renderer: any): string {
  const canonical =
    renderer?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ||
    renderer?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url ||
    ''
  const matched = String(canonical).match(/\/@([^/?#]+)/)
  return matched?.[1] ? decodeURIComponent(matched[1]).trim() : ''
}

function extractYouTubeUserRouteFromChannelRenderer(
  renderer: any,
): string | null {
  const canonical =
    renderer?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ||
    renderer?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url ||
    ''
  const path = String(canonical).trim()
  if (!path.startsWith('/')) return null
  const atMatch = path.match(/^\/@([^/?#]+)/)
  if (atMatch?.[1])
    return `/youtube/user/@${encodeURIComponent(decodeURIComponent(atMatch[1]).trim())}`
  const userMatch = path.match(/^\/(?:user|c)\/([^/?#]+)/i)
  if (userMatch?.[1])
    return `/youtube/user/${encodeURIComponent(decodeURIComponent(userMatch[1]).trim())}`
  return null
}

function extractYouTubeChannelPathFromChannelRenderer(
  renderer: any,
): string | null {
  const canonical =
    renderer?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ||
    renderer?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url ||
    ''
  let path = String(canonical).trim()
  if (!path) return null
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname
    } catch {
      return null
    }
  }
  if (!path.startsWith('/')) return null
  const atMatch = path.match(/^\/@[^/?#]+/i)
  if (atMatch?.[0]) return atMatch[0]
  const channelMatch = path.match(/^\/channel\/[^/?#]+/i)
  if (channelMatch?.[0]) return channelMatch[0]
  const userMatch = path.match(/^\/(?:user|c)\/[^/?#]+/i)
  if (userMatch?.[0]) return userMatch[0]
  return null
}

function decodeEscapedUnicode(input: string): string {
  return input
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/\\x([0-9a-fA-F]{2})/g, (_m, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"')
}

async function fetchYouTubeFollowersByChannelPath(
  path: string,
): Promise<string | undefined> {
  const normalizedPath = path.trim()
  if (!normalizedPath.startsWith('/')) return undefined
  const key = normalizedPath.toLowerCase()
  const now = Date.now()
  const cached = youtubeSubscriberCache.get(key)
  if (cached && cached.expiresAt > now) return cached.followers

  try {
    const pathsToTry = [
      normalizedPath,
      `${normalizedPath.replace(/\/+$/, '')}/about`,
    ]
    for (const pagePath of pathsToTry) {
      const res = await session.defaultSession.fetch(
        `https://www.youtube.com${pagePath}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            Cookie: 'CONSENT=YES+',
          },
        },
      )
      if (!res.ok) continue
      const html = await res.text()
      const rawCandidates: string[] = []

      const patterns = [
        /"subscriberCountText"\s*:\s*\{"simpleText"\s*:\s*"([^"]+)"/i,
        /"subscriberCountText"\s*:\s*\{"runs"\s*:\s*\[\s*\{"text"\s*:\s*"([^"]+)"/i,
        /"accessibilityData"\s*:\s*\{"label"\s*:\s*"([^"]*subscribers?[^"]*)"/i,
        /\\\"subscriberCountText\\\"\s*:\s*\\\{\\\"simpleText\\\"\s*:\s*\\\"([^\\\"]+)\\\"/i,
        /\\\"subscriberCountText\\\"\s*:\s*\\\{\\\"runs\\\"\s*:\s*\\\[\s*\\\{\\\"text\\\"\s*:\s*\\\"([^\\\"]+)\\\"/i,
      ]

      for (const pattern of patterns) {
        const m = html.match(pattern)
        if (m?.[1]) rawCandidates.push(m[1].trim())
      }

      // Generic extraction from decoded page source for structural variations.
      const decodedHtml = decodeEscapedUnicode(html)
      const genericPatterns = [
        /([\d][\d.,]*\s*[KMB]?)\s*subscribers?/i,
        /([\d][\d.,]*\s*[万亿萬億]?)\s*(?:位)?(?:订阅者|訂閱者)/i,
        /(?:订阅者|訂閱者)(?:数|數)?\s*[:：]?\s*([\d][\d.,]*\s*[万亿萬億]?)/i,
      ]
      for (const pattern of genericPatterns) {
        const m = decodedHtml.match(pattern)
        if (m?.[0]) rawCandidates.push(m[0].trim())
      }

      for (const raw of rawCandidates) {
        const parsed = parseYouTubeSubscriberLabel(decodeEscapedUnicode(raw))
        if (parsed) {
          youtubeSubscriberCache.set(key, {
            expiresAt: now + YOUTUBE_SUBSCRIBER_CACHE_TTL,
            followers: parsed,
          })
          return parsed
        }
      }
    }
  } catch {
    // Ignore network failures; fall back to description text.
  }

  youtubeSubscriberCache.set(key, {
    expiresAt: now + YOUTUBE_SUBSCRIBER_MISS_CACHE_TTL,
  })
  return undefined
}

export function looksLikeYouTubeChannelId(input: string): boolean {
  return /^UC[a-zA-Z0-9_-]{20,}$/.test(input.trim())
}

export async function searchYouTubeChannelsByKeyword(
  query: string,
  rsshubInstance: string,
): Promise<VideoProbeCandidate[]> {
  if (looksLikeYouTubeChannelId(query)) return []
  const endpoint = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%253D%253D`
  try {
    // Use Electron session fetch to respect system proxy settings
    const res = await session.defaultSession.fetch(endpoint, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })
    if (!res.ok) return []
    const html = await res.text()
    const m =
      html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/) ||
      html.match(/window\["ytInitialData"\] = (\{[\s\S]*?\});<\/script>/)
    if (!m?.[1]) return []

    const data = JSON.parse(m[1])
    const renderers: any[] = []
    collectChannelRenderers(data, renderers)

    const seen = new Set<string>()
    const out: VideoProbeCandidate[] = []
    const pendingFollowerFetches: Array<{
      index: number
      channelPath: string
    }> = []
    for (const r of renderers) {
      const channelId = (r.channelId || '').trim()
      if (!channelId || seen.has(channelId)) continue
      seen.add(channelId)
      const name = flattenTextRuns(r.title) || channelId
      const handle = extractYouTubeHandleFromChannelRenderer(r)
      const route = extractYouTubeUserRouteFromChannelRenderer(r)
      const channelPath = extractYouTubeChannelPathFromChannelRenderer(r)
      if (!route) continue
      // Username-only search: channel ID is not used as a search key.
      // Keep the filter soft to avoid dropping relevant candidates for CJK names.
      const searchable = [name, handle, flattenTextRuns(r.descriptionSnippet)]
        .filter(Boolean)
        .join(' ')
      if (!isUsernameMatch(query, searchable) && out.length >= 30) continue
      const description =
        flattenTextRuns(r.descriptionSnippet) || 'YouTube channel'
      const subscriberText = extractYouTubeSubscriberText(r)
      const followers = subscriberText || undefined
      const thumbs = r.thumbnail?.thumbnails as
        | Array<{ url?: string }>
        | undefined
      const image =
        (thumbs && thumbs.length > 0 ? thumbs[thumbs.length - 1]?.url : '') ||
        ''
      out.push({
        platform: 'youtube',
        title: `${name} - YouTube`,
        description: handle ? `${description} (@${handle})` : description,
        image,
        feedUrl: `${rsshubInstance}${route}`,
        followers,
      })
      if (!followers && channelPath && pendingFollowerFetches.length < 12) {
        pendingFollowerFetches.push({ index: out.length - 1, channelPath })
      }
      if (out.length >= 120) break
    }

    if (pendingFollowerFetches.length > 0) {
      await Promise.all(
        pendingFollowerFetches.map(async ({ index, channelPath }) => {
          const followers =
            await fetchYouTubeFollowersByChannelPath(channelPath)
          if (followers && out[index]) out[index].followers = followers
        }),
      )
    }
    return out
  } catch {
    return []
  }
}
