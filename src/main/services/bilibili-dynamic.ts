import { session } from 'electron'
import type RssParser from 'rss-parser'

type ParsedFeed = RssParser.Output<Record<string, any>>

interface BilibiliDynamicApiResponse {
  code?: number
  message?: string
  data?: {
    items?: BilibiliDynamicItem[]
  }
}

interface BilibiliDynamicItem {
  id_str?: string
  type?: string
  modules?: {
    module_author?: {
      name?: string
      face?: string
      pub_ts?: number
    }
    module_dynamic?: {
      desc?: {
        text?: string
        rich_text_nodes?: Array<{
          text?: string
          jump_url?: string
        }>
      }
      major?: Record<string, unknown> & {
        type?: string
        archive?: {
          title?: string
          desc?: string
          cover?: string
          bvid?: string
          jump_url?: string
        }
        opus?: {
          title?: string
          summary?: { text?: string }
          pics?: Array<{
            url?: string
            width?: number
            height?: number
          }>
          jump_url?: string
        }
        draw?: {
          id?: number | string
          items?: Array<{
            src?: string
            width?: number
            height?: number
          }>
        }
        article?: {
          title?: string
          desc?: string
          covers?: string[]
          jump_url?: string
        }
        common?: {
          title?: string
          desc?: string
          cover?: string
          jump_url?: string
        }
      }
      additional?: {
        type?: string
      }
    }
  }
}

type BilibiliDynamicDesc = NonNullable<
  NonNullable<BilibiliDynamicItem['modules']>['module_dynamic']
>['desc']
type BilibiliDynamicMajor = NonNullable<
  NonNullable<BilibiliDynamicItem['modules']>['module_dynamic']
>['major']
type BilibiliDynamicRichTextNode = {
  text?: string
  jump_url?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function extractUid(feedUrl: string): string | null {
  try {
    const parsed = new URL(feedUrl)
    const route = `${parsed.hostname}${parsed.pathname}`
    return route.match(/(?:^|\/)bilibili\/user\/dynamic\/(\d+)/i)?.[1] || null
  } catch {
    return feedUrl.match(/(?:^|\/)bilibili\/user\/dynamic\/(\d+)/i)?.[1] || null
  }
}

function toTextFromDesc(desc?: BilibiliDynamicDesc): string {
  const direct = String(desc?.text || '').trim()
  if (direct) return direct
  const joined = (desc?.rich_text_nodes || [])
    .map((node: BilibiliDynamicRichTextNode) => String(node?.text || '').trim())
    .filter(Boolean)
    .join('')
    .trim()
  return joined
}

function resolveDynamicLink(item: BilibiliDynamicItem): string {
  const id = String(item.id_str || '').trim()
  return id ? `https://t.bilibili.com/${id}` : 'https://t.bilibili.com/'
}

function buildImageTag(url: string): string {
  const clean = String(url || '').trim()
  if (!clean) return ''
  return `<img src="${escapeHtml(clean)}" referrerpolicy="no-referrer">`
}

function collectMajorImages(major?: BilibiliDynamicMajor): string[] {
  const images: string[] = []
  const push = (value: string | undefined) => {
    const normalized = String(value || '').trim()
    if (normalized && !images.includes(normalized)) images.push(normalized)
  }

  push(major?.archive?.cover)
  for (const pic of major?.opus?.pics || []) push(pic?.url)
  for (const pic of major?.draw?.items || []) push(pic?.src)
  for (const cover of major?.article?.covers || []) push(cover)
  push(major?.common?.cover)

  return images
}

function resolveMajorJumpUrl(major?: BilibiliDynamicMajor): string {
  const archiveJump = String(major?.archive?.jump_url || '').trim()
  if (archiveJump) return archiveJump
  const bvid = String(major?.archive?.bvid || '').trim()
  if (bvid) return `https://www.bilibili.com/video/${bvid}`
  const opusJump = String(major?.opus?.jump_url || '').trim()
  if (opusJump) return opusJump
  const articleJump = String(major?.article?.jump_url || '').trim()
  if (articleJump) return articleJump
  const commonJump = String(major?.common?.jump_url || '').trim()
  if (commonJump) return commonJump
  return ''
}

function buildMajorText(major?: BilibiliDynamicMajor): string[] {
  const chunks: string[] = []
  const push = (value: string | undefined) => {
    const normalized = String(value || '').trim()
    if (normalized) chunks.push(normalized)
  }

  push(major?.archive?.title)
  push(major?.archive?.desc)
  push(major?.opus?.title)
  push(major?.opus?.summary?.text)
  push(major?.article?.title)
  push(major?.article?.desc)
  push(major?.common?.title)
  push(major?.common?.desc)

  const jump = resolveMajorJumpUrl(major)
  if (jump) chunks.push(jump)
  return chunks
}

export function mapBilibiliDynamicResponseToFeed(
  uid: string,
  response: BilibiliDynamicApiResponse,
): ParsedFeed | null {
  if (response.code !== 0 || !response.data?.items?.length) return null

  const items = response.data.items
    .map((item) => {
      const author = item.modules?.module_author
      const dynamic = item.modules?.module_dynamic
      const descText = toTextFromDesc(dynamic?.desc)
      const major = dynamic?.major
      const majorText = buildMajorText(major)
      const contentParts = [descText, ...majorText].filter(Boolean)
      const images = collectMajorImages(major)
      const link = resolveDynamicLink(item)
      const textContent = contentParts.join('\n').trim()
      const htmlParts = contentParts
        .map((part) => `<p>${escapeHtml(part)}</p>`)
        .concat(images.map((image) => buildImageTag(image)))

      return {
        creator: author?.name || '',
        author: author?.name || '',
        title:
          descText ||
          major?.archive?.title ||
          major?.opus?.title ||
          major?.article?.title ||
          major?.common?.title ||
          'Bilibili 动态',
        link,
        guid: link,
        pubDate: author?.pub_ts
          ? new Date(author.pub_ts * 1000).toUTCString()
          : undefined,
        isoDate: author?.pub_ts
          ? new Date(author.pub_ts * 1000).toISOString()
          : undefined,
        description: htmlParts.join(''),
        content: htmlParts.join(''),
        contentSnippet: textContent,
      }
    })
    .filter((item) => item.link)

  if (!items.length) return null

  const firstAuthor = response.data.items[0]?.modules?.module_author
  const authorName = String(firstAuthor?.name || `UID ${uid}`).trim()
  const face = String(firstAuthor?.face || '').trim()

  return {
    items,
    title: `${authorName} 的 bilibili 动态`,
    description: `${authorName} 的 bilibili 动态 - Powered by Livo`,
    link: `https://space.bilibili.com/${uid}/dynamic`,
    image: face
      ? {
          url: face,
          title: `${authorName} 的 bilibili 动态`,
          link: `https://space.bilibili.com/${uid}/dynamic`,
        }
      : undefined,
  } as ParsedFeed
}

export async function fetchBilibiliDynamicFeedFromOfficialApi(
  feedUrl: string,
): Promise<ParsedFeed | null> {
  const uid = extractUid(feedUrl)
  if (!uid) return null

  const apiUrl = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${encodeURIComponent(uid)}`
  const response = await session.defaultSession.fetch(apiUrl, {
    method: 'GET',
    headers: {
      Referer: `https://space.bilibili.com/${uid}/dynamic`,
      Origin: 'https://www.bilibili.com',
      Accept: 'application/json, text/plain, */*',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(20000),
  })

  if (!response.ok) {
    throw new Error(`Bilibili dynamic API HTTP ${response.status}`)
  }

  const data = (await response.json()) as BilibiliDynamicApiResponse
  return mapBilibiliDynamicResponseToFeed(uid, data)
}
