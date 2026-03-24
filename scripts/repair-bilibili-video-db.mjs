import fs from 'node:fs'
import crypto from 'node:crypto'
import { app, BrowserWindow } from 'electron'

const DB_PATH = 'C:/Users/Chos1nz/AppData/Roaming/livo/data/livo-data.json'

function text(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function collapseRepeatedName(input) {
  const normalized = text(input)
  if (!normalized) return normalized
  if (normalized.length % 2 !== 0) return normalized
  const half = normalized.slice(0, normalized.length / 2)
  return half && half === normalized.slice(normalized.length / 2)
    ? half
    : normalized
}

function normalizeAuthorName(value, uid) {
  const raw = text(value)
  if (!raw) return `UID ${uid}`

  const fullTitlePattern = raw.match(
    /^(.+?)投稿视频\s*-\s*(.+?)视频分享\s*-\s*哔哩哔哩视频$/i,
  )
  if (fullTitlePattern?.[1]) {
    const lead = fullTitlePattern[1].trim()
    const repeated = fullTitlePattern[2]?.trim()
    if (lead && (!repeated || repeated === lead)) {
      return collapseRepeatedName(lead)
    }
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

function toUtcStringFromRelativeLabel(label, index = 0) {
  const raw = text(label)
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
  if (raw === '刚刚') return new Date(now - index * 1_000).toUTCString()
  if (raw === '昨天')
    return new Date(now - 24 * 60 * 60_000 - index * 60_000).toUTCString()

  return new Date(now - index * 60_000).toUTCString()
}

async function scrapeVideoPage(uid) {
  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 960,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
    },
  })

  try {
    const userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    win.webContents.setUserAgent(userAgent)
    try {
      await win.loadURL(
        `https://space.bilibili.com/${encodeURIComponent(uid)}/video`,
        {
          userAgent,
          httpReferrer: 'https://www.bilibili.com/',
        },
      )
    } catch {
      return null
    }

    const result = await win.webContents.executeJavaScript(
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
            abs(document.querySelector('meta[property="og:image"]')?.getAttribute('content'))
          const anchors = Array.from(document.querySelectorAll('a[href*="/video/BV"]'))
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
            if (!existing || titleScore(title) > titleScore(existing.title)) nextCard.title = title
            if (!nextCard.cover && cover) nextCard.cover = cover
            if (!nextCard.publishedText && publishedText) nextCard.publishedText = publishedText
            if (!nextCard.durationText && durationText) nextCard.durationText = durationText
            cardsByLink.set(link, nextCard)
            if (cardsByLink.size >= 30) break
          }
          return { authorName, authorAvatar, cards: Array.from(cardsByLink.values()) }
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
    )

    return result
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

function buildEntriesForFeed(feed, page, oldEntries) {
  const authorName = normalizeAuthorName(
    page.authorName,
    String(feed.url).match(/\/video\/(\d+)/i)?.[1] || '',
  )
  const stateByUrl = new Map(
    oldEntries.map((entry) => [
      entry.url,
      { isRead: !!entry.isRead, isStarred: !!entry.isStarred },
    ]),
  )
  const now = Date.now()
  return page.cards.map((card, index) => {
    const url = card.link
    const keep = stateByUrl.get(url) || { isRead: false, isStarred: false }
    const descriptionParts = []
    if (card.cover) {
      descriptionParts.push(
        `<img src="${escapeHtml(card.cover)}" referrerpolicy="no-referrer">`,
      )
    }
    if (card.durationText) {
      descriptionParts.push(`<p>时长：${escapeHtml(card.durationText)}</p>`)
    }
    descriptionParts.push(
      `<p>视频地址：<a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
    )
    return {
      id: crypto.randomUUID(),
      feedId: feed.id,
      title: text(card.title) || 'Bilibili 视频',
      url,
      content: descriptionParts.join(''),
      summary: text(card.title) || 'Bilibili 视频',
      author: authorName,
      authorAvatar: page.authorAvatar || '',
      imageUrl: card.cover || '',
      media: card.cover
        ? [
            {
              type: 'photo',
              url: card.cover,
              previewUrl: card.cover,
            },
          ]
        : [],
      publishedAt:
        new Date(
          toUtcStringFromRelativeLabel(card.publishedText, index),
        ).getTime() || now - index * 60_000,
      isRead: keep.isRead,
      isStarred: keep.isStarred,
      createdAt: now,
    }
  })
}

async function main() {
  const raw = fs.readFileSync(DB_PATH, 'utf8')
  const backupPath = `${DB_PATH}.bak-bilibili-video-repair`
  fs.writeFileSync(backupPath, raw, 'utf8')
  const data = JSON.parse(raw)
  let repairedFeeds = 0
  let repairedEntries = 0

  for (const feed of data.feeds || []) {
    const uid = String(feed.url || '').match(
      /\/bilibili\/user\/video\/(\d+)/i,
    )?.[1]
    if (!uid) continue
    const page = await scrapeVideoPage(uid)
    if (!page?.cards?.length) continue
    const oldEntries = (data.entries || []).filter(
      (entry) => entry.feedId === feed.id,
    )
    const nextEntries = buildEntriesForFeed(feed, page, oldEntries)
    data.entries = (data.entries || []).filter(
      (entry) => entry.feedId !== feed.id,
    )
    data.entries.push(...nextEntries)
    const normalizedAuthor = normalizeAuthorName(page.authorName, uid)
    feed.title = `${normalizedAuthor} - Bilibili`
    feed.lastFetched = Date.now()
    feed.errorCount = 0
    repairedFeeds += 1
    repairedEntries += nextEntries.length
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8')
  console.log(
    JSON.stringify({ backupPath, repairedFeeds, repairedEntries }, null, 2),
  )
  app.quit()
}

app
  .whenReady()
  .then(main)
  .catch((error) => {
    console.error(error)
    app.quit()
  })
