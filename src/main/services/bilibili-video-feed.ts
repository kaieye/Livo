import { BrowserWindow, session } from 'electron'
import type RssParser from 'rss-parser'

type ParsedFeed = RssParser.Output<Record<string, any>>
let bilibiliVideoScrapeQueue: Promise<void> = Promise.resolve()

interface BilibiliVideoCard {
  index: number
  title: string
  link: string
  cover?: string
  publishedText?: string
  durationText?: string
  descriptionText?: string
  authorName?: string
  authorAvatar?: string
  publishedAtMs?: number
}

interface ScrapedBilibiliVideoPage {
  authorName: string
  authorAvatar?: string
  cards: BilibiliVideoCard[]
}

function normalizeBilibiliAuthorName(
  value: string | undefined,
  uid: string,
): string {
  const raw = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!raw) return `UID ${uid}`

  const collapseRepeatedName = (input: string): string => {
    const normalized = String(input || '').trim()
    if (!normalized) return normalized
    const length = normalized.length
    if (length % 2 !== 0) return normalized
    const half = normalized.slice(0, length / 2)
    return half && half === normalized.slice(length / 2) ? half : normalized
  }

  const fullTitlePattern = raw.match(
    /^(.+?)投稿视频\s*-\s*(.+?)视频分享\s*-\s*哔哩哔哩视频$/i,
  )
  if (fullTitlePattern?.[1]) {
    const lead = fullTitlePattern[1].trim()
    const repeated = fullTitlePattern[2]?.trim()
    if (lead && (!repeated || repeated === lead))
      return collapseRepeatedName(lead)
  }

  const cleaned = raw
    .replace(/\s*投稿视频\s*$/i, '')
    .replace(/\s*视频分享\s*$/i, '')
    .replace(/\s*-\s*哔哩哔哩视频\s*$/i, '')
    .replace(/\s*投稿视频\s*-\s*/gi, '')
    .replace(/\s*视频分享\s*-\s*/gi, '')
    .trim()

  return collapseRepeatedName(cleaned) || `UID ${uid}`
}

function extractUid(feedUrl: string): string | null {
  try {
    const parsed = new URL(feedUrl)
    const route = `${parsed.hostname}${parsed.pathname}`
    return route.match(/(?:^|\/)bilibili\/user\/video\/(\d+)/i)?.[1] || null
  } catch {
    return feedUrl.match(/(?:^|\/)bilibili\/user\/video\/(\d+)/i)?.[1] || null
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function toAbsoluteUrl(value: string | undefined): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  if (raw.startsWith('/')) return `https://www.bilibili.com${raw}`
  return raw
}

function toUtcStringFromRelativeLabel(
  label: string | undefined,
  index = 0,
): string | undefined {
  const raw = String(label || '').trim()
  const now = Date.now()
  if (!raw) {
    return new Date(now - index * 60_000).toUTCString()
  }
  const direct = new Date(raw)
  if (Number.isFinite(direct.getTime())) return direct.toUTCString()

  const minuteMatch = raw.match(/^(\d+)\s*分钟前$/)
  if (minuteMatch?.[1]) {
    return new Date(now - Number(minuteMatch[1]) * 60_000).toUTCString()
  }

  const hourMatch = raw.match(/^(\d+)\s*小时前$/)
  if (hourMatch?.[1]) {
    return new Date(now - Number(hourMatch[1]) * 60 * 60_000).toUTCString()
  }

  const dayMatch = raw.match(/^(\d+)\s*天前$/)
  if (dayMatch?.[1]) {
    return new Date(now - Number(dayMatch[1]) * 24 * 60 * 60_000).toUTCString()
  }

  if (raw === '刚刚') {
    return new Date(now - index * 1_000).toUTCString()
  }

  if (raw === '昨天') {
    return new Date(now - 24 * 60 * 60_000 - index * 60_000).toUTCString()
  }

  const monthDay = raw.match(/^(\d{1,2})-(\d{1,2})$/)
  if (monthDay?.[1] && monthDay[2]) {
    const current = new Date(now)
    let year = current.getFullYear()
    const month = Number(monthDay[1]) - 1
    const day = Number(monthDay[2])
    let candidate = new Date(year, month, day, 12, 0, 0, 0)
    if (candidate.getTime() > now + 24 * 60 * 60_000) {
      year -= 1
      candidate = new Date(year, month, day, 12, 0, 0, 0)
    }
    return candidate.toUTCString()
  }

  const fullDate = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (fullDate?.[1] && fullDate[2] && fullDate[3]) {
    const candidate = new Date(
      Number(fullDate[1]),
      Number(fullDate[2]) - 1,
      Number(fullDate[3]),
      12,
      0,
      0,
      0,
    )
    if (Number.isFinite(candidate.getTime())) return candidate.toUTCString()
  }

  return new Date(now - index * 60_000).toUTCString()
}

function extractBvid(videoUrl: string): string | null {
  const raw = String(videoUrl || '').trim()
  if (!raw) return null
  return raw.match(/\/video\/(BV[0-9A-Za-z]+)/i)?.[1] || null
}

function formatDuration(totalSeconds: number | undefined): string | undefined {
  if (!Number.isFinite(totalSeconds) || !totalSeconds || totalSeconds <= 0) {
    return undefined
  }
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remain = seconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`
  }
  return `${minutes}:${String(remain).padStart(2, '0')}`
}

interface BilibiliVideoApiResponse {
  code: number
  data?: {
    title?: string
    pubdate?: number
    desc?: string
    duration?: number
    pic?: string
    owner?: {
      name?: string
      face?: string
    }
  }
}

function trimBilibiliMetaDescription(value: string | undefined): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw
    .replace(/,\s*视频播放量[\s\S]*$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchBilibiliVideoMetadataFromPage(
  videoUrl: string,
): Promise<Partial<BilibiliVideoCard> | null> {
  try {
    const response = await session.defaultSession.fetch(videoUrl, {
      method: 'GET',
      headers: {
        Referer: 'https://www.bilibili.com/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) return null
    const html = await response.text()
    const stateMatch = html.match(
      /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/u,
    )
    let videoData: Record<string, any> | null = null
    if (stateMatch?.[1]) {
      try {
        const state = JSON.parse(stateMatch[1]) as Record<string, any>
        if (state?.videoData && typeof state.videoData === 'object') {
          videoData = state.videoData as Record<string, any>
        }
      } catch {
        // Ignore malformed inline state.
      }
    }

    const metaTitle =
      html.match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      )?.[1] ||
      html.match(/<title>([^<]+)<\/title>/i)?.[1] ||
      ''
    const metaDescription =
      html.match(
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      )?.[1] ||
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      )?.[1] ||
      ''
    const metaImage =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      )?.[1] || ''

    return {
      title:
        String(videoData?.title || '').trim() ||
        String(metaTitle || '')
          .replace(/_哔哩哔哩_bilibili$/i, '')
          .trim() ||
        undefined,
      descriptionText:
        String(videoData?.desc || '').trim() ||
        trimBilibiliMetaDescription(metaDescription) ||
        undefined,
      publishedAtMs:
        Number.isFinite(videoData?.pubdate) && (videoData?.pubdate || 0) > 0
          ? Number(videoData?.pubdate) * 1000
          : undefined,
      durationText: formatDuration(
        Number.isFinite(videoData?.duration)
          ? Number(videoData?.duration)
          : undefined,
      ),
      cover: toAbsoluteUrl(String(videoData?.pic || metaImage || '')),
      authorName: String(videoData?.owner?.name || '').trim() || undefined,
      authorAvatar: toAbsoluteUrl(String(videoData?.owner?.face || '')),
    }
  } catch {
    return null
  }
}

async function fetchBilibiliVideoMetadataByBvid(
  bvid: string,
  videoUrl?: string,
): Promise<Partial<BilibiliVideoCard> | null> {
  try {
    const response = await session.defaultSession.fetch(
      `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
      {
        method: 'GET',
        headers: {
          Referer: `https://www.bilibili.com/video/${bvid}`,
          Origin: 'https://www.bilibili.com',
          Accept: 'application/json, text/plain, */*',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(15000),
      },
    )
    if (!response.ok) {
      return videoUrl ? fetchBilibiliVideoMetadataFromPage(videoUrl) : null
    }
    const payload = (await response.json()) as BilibiliVideoApiResponse
    if (payload.code !== 0 || !payload.data) {
      return videoUrl ? fetchBilibiliVideoMetadataFromPage(videoUrl) : null
    }
    const data = payload.data
    return {
      title: String(data.title || '').trim() || undefined,
      descriptionText: String(data.desc || '').trim() || undefined,
      publishedAtMs:
        Number.isFinite(data.pubdate) && (data.pubdate || 0) > 0
          ? Number(data.pubdate) * 1000
          : undefined,
      durationText: formatDuration(data.duration),
      cover: toAbsoluteUrl(data.pic),
      authorName: String(data.owner?.name || '').trim() || undefined,
      authorAvatar: toAbsoluteUrl(data.owner?.face),
    }
  } catch {
    return videoUrl ? fetchBilibiliVideoMetadataFromPage(videoUrl) : null
  }
}

async function enrichBilibiliVideoCards(
  cards: BilibiliVideoCard[],
): Promise<BilibiliVideoCard[]> {
  if (cards.length === 0) return cards

  const results = [...cards]
  const concurrency = 4
  let cursor = 0
  const worker = async () => {
    while (cursor < results.length) {
      const currentIndex = cursor
      cursor += 1
      const card = results[currentIndex]
      const bvid = extractBvid(card.link)
      if (!bvid) continue
      const metadata = await fetchBilibiliVideoMetadataByBvid(bvid, card.link)
      if (!metadata) continue
      results[currentIndex] = {
        ...card,
        ...metadata,
        title: metadata.title || card.title,
        durationText: metadata.durationText || card.durationText,
        cover: metadata.cover || card.cover,
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, results.length) }, () =>
      worker(),
    ),
  )
  return results
}

export function mapBilibiliVideoCardsToFeed(
  uid: string,
  page: ScrapedBilibiliVideoPage,
): ParsedFeed | null {
  if (!page.cards.length) return null

  const fallbackAuthorName = normalizeBilibiliAuthorName(page.authorName, uid)
  const authorName = normalizeBilibiliAuthorName(
    page.cards.find((card) => card.authorName)?.authorName ||
      fallbackAuthorName,
    uid,
  )
  const authorAvatar = toAbsoluteUrl(
    page.cards.find((card) => card.authorAvatar)?.authorAvatar ||
      page.authorAvatar,
  )
  const items = page.cards
    .map((card) => {
      const link = toAbsoluteUrl(card.link)
      const cover = toAbsoluteUrl(card.cover)
      if (!link) return null
      const descriptionParts = [
        cover
          ? `<img src="${escapeHtml(cover)}" referrerpolicy="no-referrer">`
          : '',
        card.descriptionText
          ? `<p>${escapeHtml(card.descriptionText).replace(/\n+/g, '</p><p>')}</p>`
          : '',
        card.durationText
          ? `<p>时长：${escapeHtml(card.durationText)}</p>`
          : '',
        `<p>视频地址：<a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
      ].filter(Boolean)

      const itemAuthorName = normalizeBilibiliAuthorName(
        card.authorName || authorName,
        uid,
      )
      const publishedAtMs = card.publishedAtMs
      const summaryText = String(card.descriptionText || '').trim()

      return {
        title: String(card.title || '').trim() || 'Bilibili 视频',
        link,
        guid: link,
        description: descriptionParts.join(''),
        content: descriptionParts.join(''),
        contentSnippet: summaryText || String(card.title || '').trim(),
        author: itemAuthorName,
        creator: itemAuthorName,
        pubDate: publishedAtMs
          ? new Date(publishedAtMs).toUTCString()
          : toUtcStringFromRelativeLabel(card.publishedText, card.index),
      }
    })
    .filter((item): item is NonNullable<typeof item> => !!item)

  if (!items.length) return null

  return {
    title: `${authorName} - Bilibili`,
    description: `${authorName} 的 bilibili 视频 - Powered by Livo`,
    link: `https://space.bilibili.com/${uid}/video`,
    image: authorAvatar
      ? {
          url: authorAvatar,
          title: `${authorName} - Bilibili`,
          link: `https://space.bilibili.com/${uid}/video`,
        }
      : undefined,
    items,
  } as ParsedFeed
}

export function mapParsedDynamicFeedToVideoFeed(
  uid: string,
  feed: ParsedFeed | null,
): ParsedFeed | null {
  if (!feed?.items?.length) return null

  const items = feed.items
    .map((item) => {
      const textBlob = [
        String(item.link || ''),
        String(item.description || ''),
        String(item.content || ''),
        String(item.contentSnippet || ''),
        String(item.title || ''),
      ].join('\n')
      const videoUrl =
        textBlob.match(
          /https?:\/\/www\.bilibili\.com\/video\/BV[0-9A-Za-z]+\/?/i,
        )?.[0] || ''
      if (!videoUrl) return null
      return {
        ...item,
        link: videoUrl,
        guid: videoUrl,
      }
    })
    .filter((item): item is NonNullable<typeof item> => !!item)

  if (!items.length) return null

  return {
    ...feed,
    title: String(feed.title || `UID ${uid} - Bilibili`).replace(
      /动态/i,
      '视频',
    ),
    description: String(feed.description || '').replace(/动态/gi, '视频'),
    link: `https://space.bilibili.com/${uid}/video`,
    items,
  } as ParsedFeed
}

async function runBilibiliVideoScrape<T>(task: () => Promise<T>): Promise<T> {
  const next = bilibiliVideoScrapeQueue.then(task, task)
  bilibiliVideoScrapeQueue = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

async function scrapeBilibiliVideoPage(
  uid: string,
): Promise<ScrapedBilibiliVideoPage | null> {
  return runBilibiliVideoScrape(async () => {
    const win = new BrowserWindow({
      show: false,
      width: 1440,
      height: 960,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        javascript: true,
        partition: undefined,
      },
    })

    try {
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      win.webContents.setUserAgent(userAgent)
      await win.loadURL(
        `https://space.bilibili.com/${encodeURIComponent(uid)}/video`,
        {
          userAgent,
          httpReferrer: 'https://www.bilibili.com/',
        },
      )

      const page = (await win.webContents.executeJavaScript(
        `(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

        const text = (value) => String(value || '').replace(/\\s+/g, ' ').trim()
        const abs = (value) => {
          const raw = String(value || '').trim()
          if (!raw) return ''
          if (/^https?:\\/\\//i.test(raw)) return raw
          if (raw.startsWith('//')) return 'https:' + raw
          if (raw.startsWith('/')) return 'https://www.bilibili.com' + raw
          return raw
        }

        const isStatLikeTitle = (value) => {
          const raw = text(value)
          if (!raw) return true
          if (/[\\u4e00-\\u9fa5a-z]/i.test(raw)) return false
          return /^(?:\\d+(?:\\.\\d+)?(?:万|亿)?)+(?::\\d{1,2}){1,2}$/.test(raw)
        }

        const titleScore = (value) => {
          const raw = text(value)
          if (!raw) return -1000
          let score = Math.min(raw.length, 160)
          const letterCount = (raw.match(/[\\u4e00-\\u9fa5a-z]/gi) || []).length
          const digitCount = (raw.match(/\\d/g) || []).length
          score += letterCount * 8
          score -= digitCount
          if (isStatLikeTitle(raw)) score -= 120
          if (/[:：]/.test(raw) && letterCount === 0) score -= 40
          if (/播放|观看|弹幕|点赞/.test(raw)) score -= 25
          return score
        }

        const pickBetterTitle = (...values) => {
          let best = ''
          let bestScore = -1000
          for (const value of values) {
            const candidate = text(value)
            const score = titleScore(candidate)
            if (score > bestScore) {
              best = candidate
              bestScore = score
            }
          }
          return best
        }

        const extract = () => {
          const authorName =
            text(document.querySelector('.up-name, .h-name, .username')?.textContent) ||
            text(document.querySelector('title')?.textContent).replace(/\\s*-\\s*哔哩哔哩.*$/i, '')
          const authorAvatar =
            abs(document.querySelector('.bili-avatar img, .header-face img, .up-avatar img')?.getAttribute('src')) ||
            abs(document.querySelector('meta[property=\"og:image\"]')?.getAttribute('content'))

          const anchors = Array.from(document.querySelectorAll('a[href*=\"/video/BV\"]'))
          const cardsByLink = new Map()

          for (const anchor of anchors) {
            const link = abs(anchor.href || anchor.getAttribute('href'))
            if (!link) continue
            const root =
              anchor.closest('.bili-video-card, .small-item, .list-item, .v-card, .video-card, li, .feed-card') ||
              anchor.parentElement
            const title = pickBetterTitle(
              root?.querySelector('.bili-video-card__info--tit')?.textContent,
              root?.querySelector('.bili-video-card__info--title')?.textContent,
              root?.querySelector('.bili-cover-card__title')?.textContent,
              root?.querySelector('.video-name')?.textContent,
              root?.querySelector('[title]')?.getAttribute('title'),
              anchor.getAttribute('title'),
              anchor.querySelector('[title]')?.getAttribute('title'),
              anchor.textContent,
            )
            if (!title) continue
            const cover =
              abs(root?.querySelector('img')?.getAttribute('src')) ||
              abs(root?.querySelector('img')?.getAttribute('data-src')) ||
              abs(anchor.querySelector('img')?.getAttribute('src'))
            const publishedText =
              text(root?.querySelector('.bili-video-card__stats__time, .bili-video-card__stats--time, .bili-video-card__info--date, .time, .meta, .pubdate, .publish-time')?.textContent)
            const durationText =
              text(root?.querySelector('.bili-video-card__stats__duration, .duration, .length')?.textContent)
            const existing = cardsByLink.get(link)
            const nextCard = existing || {
              index: cardsByLink.size,
              title: '',
              link,
              cover: '',
              publishedText: '',
              durationText: '',
            }
            if (!existing || titleScore(title) > titleScore(existing.title)) {
              nextCard.title = title
            }
            if (!nextCard.cover && cover) nextCard.cover = cover
            if (!nextCard.publishedText && publishedText) nextCard.publishedText = publishedText
            if (!nextCard.durationText && durationText) nextCard.durationText = durationText
            cardsByLink.set(link, nextCard)
            if (cardsByLink.size >= 30) break
          }

          const cards = Array.from(cardsByLink.values())
          return { authorName, authorAvatar, cards }
        }

        let result = extract()
        for (let i = 0; i < 8; i += 1) {
          if (result.cards.length > 0) return result
          window.scrollTo(0, document.body.scrollHeight)
          await wait(1000)
          result = extract()
        }
        return result
      })()`,
        true,
      )) as ScrapedBilibiliVideoPage

      return page.cards?.length ? page : null
    } finally {
      if (!win.isDestroyed()) win.destroy()
      await new Promise((resolve) => setTimeout(resolve, 800))
    }
  })
}

export async function fetchBilibiliVideoFeedFromSpacePage(
  feedUrl: string,
): Promise<ParsedFeed | null> {
  const uid = extractUid(feedUrl)
  if (!uid) return null
  const page = await scrapeBilibiliVideoPage(uid)
  if (!page) return null
  const enrichedCards = await enrichBilibiliVideoCards(page.cards)
  return mapBilibiliVideoCardsToFeed(uid, { ...page, cards: enrichedCards })
}
