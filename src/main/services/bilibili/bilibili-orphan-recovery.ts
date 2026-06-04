import { session } from 'electron'
import { v4 as uuidv4 } from 'uuid'

import { FeedViewType, type Entry, type Feed } from '../../../shared/types'
import { getDb } from '../../database'
import { formatFeedTitle } from '../feed/feed-title'
import { logInfo, logWarn } from '../system/logger'

const BILIBILI_VIDEO_URL_RE =
  /https?:\/\/www\.bilibili\.com\/video\/(BV[0-9A-Za-z]{10})\/?/gi
const BILIBILI_OPUS_URL_RE = /https?:\/\/www\.bilibili\.com\/opus\/(\d+)/gi
const BILIBILI_DYNAMIC_ENTRY_URL_RE = /^https?:\/\/t\.bilibili\.com\/\d+/i
const BILIBILI_UID_HINT_RE =
  /https?:\/\/i\d?\.hdslb\.com\/bfs\/new_dyn\/[^"'\\s>]*?(\d{4,})(?:\.(?:png|jpe?g|webp|gif))/gi

function collectMatches(text: string | undefined, re: RegExp): string[] {
  if (!text) return []
  const values = new Set<string>()
  re.lastIndex = 0
  for (const match of text.matchAll(re)) {
    const value = String(match[1] || '').trim()
    if (value) values.add(value)
  }
  return [...values]
}

function collectEntryStrings(entry: Entry): string[] {
  const mediaUrls = (entry.media || []).map((item) => item.url)
  return [
    entry.url,
    entry.title,
    entry.summary,
    entry.content,
    entry.imageUrl,
    entry.authorAvatar,
    ...mediaUrls,
  ].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )
}

function extractUidHintFromEntries(entries: Entry[]): string | null {
  for (const entry of entries) {
    for (const text of collectEntryStrings(entry)) {
      const hints = collectMatches(text, BILIBILI_UID_HINT_RE)
      if (hints.length > 0) return hints[0]
    }
  }
  return null
}

function extractVideoIdsFromEntries(entries: Entry[]): string[] {
  const values = new Set<string>()
  for (const entry of entries) {
    for (const text of collectEntryStrings(entry)) {
      for (const value of collectMatches(text, BILIBILI_VIDEO_URL_RE)) {
        values.add(value)
      }
    }
  }
  return [...values]
}

function extractOpusIdsFromEntries(entries: Entry[]): string[] {
  const values = new Set<string>()
  for (const entry of entries) {
    for (const text of collectEntryStrings(entry)) {
      for (const value of collectMatches(text, BILIBILI_OPUS_URL_RE)) {
        values.add(value)
      }
    }
  }
  return [...values]
}

function parseUidFromHtml(html: string): string | null {
  const patterns = [
    /"owner"\s*:\s*\{[^}]*"mid"\s*:\s*(\d{3,})/i,
    /"mid"\s*:\s*(\d{3,})/i,
    /"uid"\s*:\s*(\d{3,})/i,
    /space\.bilibili\.com\/(\d{3,})/i,
  ]
  for (const pattern of patterns) {
    const matched = html.match(pattern)
    if (matched?.[1]) return matched[1]
  }
  return null
}

async function fetchText(url: string, referer: string): Promise<string | null> {
  try {
    const response = await session.defaultSession.fetch(url, {
      method: 'GET',
      headers: {
        Referer: referer,
        Origin: 'https://www.bilibili.com',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

async function inferUidFromVideoIds(
  videoIds: string[],
): Promise<string | null> {
  for (const bvid of videoIds) {
    const html = await fetchText(
      `https://www.bilibili.com/video/${encodeURIComponent(bvid)}/`,
      'https://www.bilibili.com/',
    )
    const uid = html ? parseUidFromHtml(html) : null
    if (uid) return uid
  }
  return null
}

async function inferUidFromOpusIds(opusIds: string[]): Promise<string | null> {
  for (const opusId of opusIds) {
    const html = await fetchText(
      `https://www.bilibili.com/opus/${encodeURIComponent(opusId)}`,
      'https://www.bilibili.com/',
    )
    const uid = html ? parseUidFromHtml(html) : null
    if (uid) return uid
  }
  return null
}

async function inferUidForOrphanEntries(
  entries: Entry[],
): Promise<string | null> {
  const uidHint = extractUidHintFromEntries(entries)
  if (uidHint) return uidHint

  const videoIds = extractVideoIdsFromEntries(entries)
  const videoUid = await inferUidFromVideoIds(videoIds)
  if (videoUid) return videoUid

  const opusIds = extractOpusIdsFromEntries(entries)
  return inferUidFromOpusIds(opusIds)
}

function buildRecoveredFeed(uid: string, entries: Entry[]): Feed {
  const latestEntry = [...entries].sort(
    (a, b) => (b.publishedAt || 0) - (a.publishedAt || 0),
  )[0]
  const titleBase = (latestEntry?.author || '').trim() || `UID ${uid}`
  const routeUrl = `rsshub://bilibili/user/dynamic/${uid}`
  return {
    id: uuidv4(),
    title: formatFeedTitle(routeUrl, undefined, `${titleBase} - Bilibili`),
    url: routeUrl,
    siteUrl: `https://space.bilibili.com/${uid}/dynamic`,
    description: `${titleBase} 的 bilibili 动态 - Recovered by Livo`,
    imageUrl: latestEntry?.authorAvatar,
    folder: '',
    category: '',
    view: FeedViewType.SocialMedia,
    fetchSource: 'auto',
    showInAll: true,
    lastFetched: latestEntry?.createdAt || Date.now(),
    errorCount: 0,
    createdAt: Date.now(),
  }
}

export async function recoverOrphanBilibiliDynamicFeeds(): Promise<{
  recoveredFeeds: number
  reassignedEntries: number
}> {
  const orphanEntries = getDb()
    .entries.getOrphanEntries()
    .filter((entry) => BILIBILI_DYNAMIC_ENTRY_URL_RE.test(entry.url || ''))
  if (orphanEntries.length === 0) {
    return { recoveredFeeds: 0, reassignedEntries: 0 }
  }

  const grouped = new Map<string, Entry[]>()
  for (const entry of orphanEntries) {
    const list = grouped.get(entry.feedId) || []
    list.push(entry)
    grouped.set(entry.feedId, list)
  }

  let recoveredFeeds = 0
  let reassignedEntries = 0

  for (const [orphanFeedId, entries] of grouped) {
    const uid = await inferUidForOrphanEntries(entries)
    if (!uid) {
      logWarn(
        '[bilibili-recovery] failed to infer uid for orphan feed',
        orphanFeedId,
      )
      continue
    }

    const routeUrl = `rsshub://bilibili/user/dynamic/${uid}`
    let targetFeed = getDb().feeds.getFeedByUrl(routeUrl)
    if (!targetFeed) {
      targetFeed = buildRecoveredFeed(uid, entries)
      getDb().feeds.insertFeed(targetFeed)
      recoveredFeeds += 1
    }

    reassignedEntries += getDb().entries.reassignEntriesToFeed(
      orphanFeedId,
      targetFeed.id,
    )
  }

  if (recoveredFeeds > 0 || reassignedEntries > 0) {
    logInfo(
      '[bilibili-recovery] restored orphan dynamic entries',
      `feeds=${recoveredFeeds}`,
      `entries=${reassignedEntries}`,
    )
  }

  return { recoveredFeeds, reassignedEntries }
}
