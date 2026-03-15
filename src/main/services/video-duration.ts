/**
 * Fetch video duration from supported platforms (YouTube, Bilibili).
 * Used during feed parsing to enrich video MediaItems with duration info.
 */
import https from "https"
import http from "http"
import { BrowserWindow } from "electron"
import { getEntries, updateEntry, getAllFeeds } from "../database"
import { FeedViewType } from "../../shared/types"

/** Simple in-memory cache: videoId 鈫?duration in seconds */
const durationCache = new Map<string, number>()
const enrichQueue: string[] = []
const pendingResolvers = new Map<string, Array<(count: number) => void>>()
const inFlightFeeds = new Set<string>()
const lastEnrichedAt = new Map<string, number>()
let isQueueRunning = false
let lastAllEnrichedAt = 0

const PER_FEED_COOLDOWN_MS = 30 * 60 * 1000
const MAX_FETCH_PER_FEED = 12
const STARTUP_BACKFILL_MAX_FEEDS = 3
const STARTUP_BACKFILL_COOLDOWN_MS = 12 * 60 * 60 * 1000

/**
 * Extract YouTube video ID from various URL formats.
 */
function extractYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  )
  return m ? m[1] : null
}

/**
 * Extract Bilibili video BV ID from URL.
 */
function extractBilibiliId(url: string): string | null {
  const m = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/)
  return m ? m[1] : null
}

/**
 * Fetch a URL and return the response body as string.
 */
function fetchText(url: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const transport = parsedUrl.protocol === "https:" ? https : http

    const req = transport.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: timeoutMs,
      },
      (res) => {
        // Follow redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchText(res.headers.location, timeoutMs).then(resolve, reject)
          return
        }
        const chunks: Buffer[] = []
        res.on("data", (chunk: Buffer) => chunks.push(chunk))
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
        res.on("error", reject)
      },
    )
    req.on("error", reject)
    req.on("timeout", () => {
      req.destroy()
      reject(new Error("timeout"))
    })
  })
}

/**
 * Fetch YouTube video duration by scraping the watch page for `lengthSeconds`.
 */
async function fetchYouTubeDuration(videoId: string): Promise<number | undefined> {
  if (durationCache.has(videoId)) return durationCache.get(videoId)

  try {
    const html = await fetchText(`https://www.youtube.com/watch?v=${videoId}`)
    const match = html.match(/"lengthSeconds"\s*:\s*"(\d+)"/)
    if (match) {
      const seconds = parseInt(match[1], 10)
      if (seconds > 0) {
        durationCache.set(videoId, seconds)
        return seconds
      }
    }
  } catch {
    // Silently fail 鈥?duration is optional
  }
  return undefined
}

/**
 * Fetch Bilibili video duration by using its API.
 */
async function fetchBilibiliDuration(bvid: string): Promise<number | undefined> {
  if (durationCache.has(bvid)) return durationCache.get(bvid)

  try {
    const json = await fetchText(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`)
    const data = JSON.parse(json)
    const seconds = data?.data?.duration
    if (typeof seconds === "number" && seconds > 0) {
      durationCache.set(bvid, seconds)
      return seconds
    }
  } catch {
    // Silently fail
  }
  return undefined
}

/**
 * Try to fetch video duration for a given URL.
 * Supports YouTube and Bilibili. Returns undefined for unsupported URLs.
 */
export async function fetchVideoDuration(url: string): Promise<number | undefined> {
  const ytId = extractYouTubeId(url)
  if (ytId) return fetchYouTubeDuration(ytId)

  const bvId = extractBilibiliId(url)
  if (bvId) return fetchBilibiliDuration(bvId)

  return undefined
}

/**
 * Batch fetch durations for multiple URLs (with concurrency limit).
 * Returns a Map of url 鈫?duration in seconds.
 */
export async function fetchVideoDurations(
  urls: string[],
  concurrency = 3,
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  const unique = [...new Set(urls)]

  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency)
    await Promise.allSettled(
      batch.map(async (url) => {
        const d = await fetchVideoDuration(url)
        if (d) result.set(url, d)
      }),
    )
  }

  return result
}

/**
 * Enrich video entries for a given feed with duration data.
 * Finds video media items lacking duration, fetches from YouTube/Bilibili,
 * and updates entries in the database. Fire-and-forget 鈥?errors are silenced.
 */
export async function enrichVideoDurations(feedId: string): Promise<number> {
  const now = Date.now()
  const lastAt = lastEnrichedAt.get(feedId) || 0
  if (now - lastAt < PER_FEED_COOLDOWN_MS) {
    return 0
  }

  if (inFlightFeeds.has(feedId)) {
    return 0
  }

  inFlightFeeds.add(feedId)
  let enriched = 0
  try {
    const entries = getEntries({ feedId, limit: 50 })
    // Collect video URLs that need duration
    const toFetch: Array<{ entryId: string; mediaIndex: number; url: string }> = []
    for (const entry of entries) {
      if (!entry.media) continue
      for (let i = 0; i < entry.media.length; i++) {
        const m = entry.media[i]
        if ((m.type === "video" || m.type === "audio") && !m.duration) {
          // Try media URL first, then entry URL for YouTube/Bilibili
          const candidateUrls = [m.url, entry.url].filter(Boolean)
          for (const url of candidateUrls) {
            if (extractYouTubeId(url) || extractBilibiliId(url)) {
              toFetch.push({ entryId: entry.id, mediaIndex: i, url })
              break // Found a fetchable URL, no need to try others
            }
          }
        }
      }
    }

    if (toFetch.length === 0) return 0

    const boundedToFetch = toFetch.slice(0, MAX_FETCH_PER_FEED)

    // Fetch durations in batches of 3
    for (let i = 0; i < boundedToFetch.length; i += 3) {
      const batch = boundedToFetch.slice(i, i + 3)
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const duration = await fetchVideoDuration(item.url)
          return { ...item, duration }
        }),
      )

      for (const r of results) {
        if (r.status === "fulfilled" && r.value.duration) {
          const entry = entries.find((e) => e.id === r.value.entryId)
          if (entry?.media?.[r.value.mediaIndex]) {
            entry.media[r.value.mediaIndex].duration = r.value.duration
            updateEntry(entry.id, { media: entry.media })
            enriched++
          }
        }
      }
    }

    lastEnrichedAt.set(feedId, Date.now())
  } catch {
    // Ignore errors
  } finally {
    inFlightFeeds.delete(feedId)
  }
  return enriched
}

async function drainEnrichQueue(): Promise<void> {
  if (isQueueRunning) return
  isQueueRunning = true
  try {
    while (enrichQueue.length > 0) {
      const feedId = enrichQueue.shift()!
      const count = await enrichVideoDurations(feedId)
      const resolvers = pendingResolvers.get(feedId) || []
      pendingResolvers.delete(feedId)
      for (const resolve of resolvers) {
        try {
          resolve(count)
        } catch {
          // ignore resolve errors
        }
      }
    }
  } finally {
    isQueueRunning = false
  }
}

export function queueVideoDurationEnrich(feedId: string): Promise<number> {
  return new Promise<number>((resolve) => {
    const existingResolvers = pendingResolvers.get(feedId) || []
    existingResolvers.push(resolve)
    pendingResolvers.set(feedId, existingResolvers)

    if (!enrichQueue.includes(feedId) && !inFlightFeeds.has(feedId)) {
      enrichQueue.push(feedId)
    }

    void drainEnrichQueue()
  })
}

/**
 * Enrich all video/audio feeds with duration data.
 * Called once on startup to backfill durations for existing entries.
 * Notifies the renderer to re-fetch entries when done.
 */
export async function enrichAllVideoFeeds(): Promise<void> {
  const now = Date.now()
  if (now - lastAllEnrichedAt < STARTUP_BACKFILL_COOLDOWN_MS) {
    return
  }
  lastAllEnrichedAt = now

  try {
    const feeds = getAllFeeds()
    const videoFeeds = feeds
      .filter(
      (f) => f.view === FeedViewType.Videos,
      )
      .slice(0, STARTUP_BACKFILL_MAX_FEEDS)

    let totalEnriched = 0
    for (const feed of videoFeeds) {
      totalEnriched += await queueVideoDurationEnrich(feed.id)
    }
    // Notify the renderer to re-fetch entries if any were enriched
    if (totalEnriched > 0) {
      notifyRenderer()
    }
  } catch {
    // Silently fail
  }
}

/** Send IPC to renderer to trigger entry re-fetch */
function notifyRenderer(): void {
  try {
    const win = BrowserWindow.getAllWindows()[0]
    if (win && !win.isDestroyed()) {
      win.webContents.send("entries:enriched")
    }
  } catch {
    // Ignore
  }
}

