/**
 * Video Proxy Service
 *
 * Resolves YouTube URLs to direct .mp4 stream URLs via Invidious API,
 * bypassing YouTube iframe bot detection in Electron.
 *
 * Flow:
 *   1. Extract video ID from YouTube URL
 *   2. Query Invidious API for direct streaming URLs
 *   3. Pick the best quality combined (audio+video) mp4 stream
 *   4. Return the direct URL for native <video> playback
 *   5. Falls back gracefully 鈥?caller opens browser if resolution fails
 */

import { net } from "electron"

// 鈹€鈹€ Invidious instances (tried in order, skips to next on failure) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
const INVIDIOUS_INSTANCES = [
  "https://inv.tux.pizza",
  "https://invidious.privacyredirect.com",
  "https://invidious.nerdvpn.de",
  "https://iv.nbooo.com",
  "https://invidious.protokolla.fi",
]

// 鈹€鈹€ Piped instances as secondary fallback 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://piped-api.privacy.com.de",
  "https://api.piped.projectsegfau.lt",
]

// YouTube video ID regex
const YOUTUBE_ID_RE =
  /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/

/**
 * Extract a YouTube video ID from a URL. Returns `null` for non-YouTube URLs.
 */
export function extractYouTubeId(url: string): string | null {
  const m = url.match(YOUTUBE_ID_RE)
  return m ? m[1] : null
}

// 鈹€鈹€ Types 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

interface InvidiousFormatStream {
  url: string
  itag: string
  type: string       // e.g. "video/mp4; codecs=\"avc1.64001F, mp4a.40.2\""
  quality: string    // e.g. "720p", "360p"
  container: string  // "mp4", "webm"
  /** Resolution height in pixels (e.g. 720) 鈥?present on some instances */
  resolution?: string
}

interface InvidiousVideoResponse {
  formatStreams?: InvidiousFormatStream[]
  adaptiveFormats?: InvidiousFormatStream[]
  title?: string
}

interface PipedStream {
  url: string
  format: string
  quality: string
  mimeType: string
  videoOnly: boolean
}

interface PipedVideoResponse {
  audioStreams?: PipedStream[]
  videoStreams?: PipedStream[]
  title?: string
  /** HLS manifest URL 鈥?usable by <video> directly */
  hls?: string
}

export interface VideoResolveResult {
  success: boolean
  /** Direct video URL playable in <video> tag */
  url?: string
  /** Quality label, e.g. "720p" */
  quality?: string
  /** Video title from the platform */
  title?: string
  error?: string
}

// 鈹€鈹€ Helpers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

/**
 * Fetch JSON using Electron's `net` module (no CORS restrictions).
 * Has a timeout to avoid hanging on unresponsive instances.
 */
function fetchJSON<T>(url: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = net.request(url)
    let data = ""
    let settled = false

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        request.abort()
        reject(new Error(`Timeout after ${timeoutMs}ms`))
      }
    }, timeoutMs)

    request.on("response", (response) => {
      if (response.statusCode !== 200) {
        clearTimeout(timer)
        settled = true
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }
      response.on("data", (chunk) => { data += chunk.toString() })
      response.on("end", () => {
        clearTimeout(timer)
        if (!settled) {
          settled = true
          try { resolve(JSON.parse(data) as T) }
          catch (e) { reject(e) }
        }
      })
    })

    request.on("error", (err) => {
      clearTimeout(timer)
      if (!settled) {
        settled = true
        reject(err)
      }
    })

    request.end()
  })
}

/**
 * Parse a quality string like "720p" into a numeric height for comparison.
 */
function qualityToNumber(q: string): number {
  const m = q.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

// 鈹€鈹€ Invidious strategy 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

async function resolveViaInvidious(videoId: string): Promise<VideoResolveResult> {
  const errors: string[] = []

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const apiUrl = `${instance}/api/v1/videos/${videoId}?fields=formatStreams,title`
      const data = await fetchJSON<InvidiousVideoResponse>(apiUrl)

      const streams = data.formatStreams || []
      if (streams.length === 0) {
        errors.push(`${instance}: no formatStreams`)
        continue
      }

      // Prefer mp4 container, then pick highest quality
      const mp4Streams = streams
        .filter((s) => s.container === "mp4" || s.type?.includes("video/mp4"))
        .sort((a, b) => qualityToNumber(b.quality) - qualityToNumber(a.quality))

      const best = mp4Streams[0] || streams[0]

      return {
        success: true,
        url: best.url,
        quality: best.quality || best.resolution || "unknown",
        title: data.title,
      }
    } catch (err) {
      errors.push(`${instance}: ${(err as Error).message}`)
    }
  }

  return { success: false, error: `All Invidious instances failed: ${errors.join("; ")}` }
}

// 鈹€鈹€ Piped strategy (secondary fallback) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

async function resolveViaPiped(videoId: string): Promise<VideoResolveResult> {
  const errors: string[] = []

  for (const instance of PIPED_INSTANCES) {
    try {
      const apiUrl = `${instance}/streams/${videoId}`
      const data = await fetchJSON<PipedVideoResponse>(apiUrl)

      // Piped videoStreams are video-only; combined streams are less common.
      // Prefer HLS manifest which includes both audio and video.
      if (data.hls) {
        return {
          success: true,
          url: data.hls,
          quality: "auto (HLS)",
          title: data.title,
        }
      }

      // Fallback to videoStreams that are NOT video-only (combined)
      const combined = (data.videoStreams || [])
        .filter((s) => !s.videoOnly && s.mimeType?.includes("video/mp4"))
        .sort((a, b) => qualityToNumber(b.quality) - qualityToNumber(a.quality))

      if (combined.length > 0) {
        return {
          success: true,
          url: combined[0].url,
          quality: combined[0].quality,
          title: data.title,
        }
      }

      errors.push(`${instance}: no usable streams`)
    } catch (err) {
      errors.push(`${instance}: ${(err as Error).message}`)
    }
  }

  return { success: false, error: `All Piped instances failed: ${errors.join("; ")}` }
}

// 鈹€鈹€ Public API 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

/**
 * Resolve a YouTube URL to a direct video stream URL.
 * Tries Invidious first, then Piped as fallback.
 * Returns `{ success: false }` for non-YouTube URLs or if all instances fail.
 */
export async function resolveVideoUrl(url: string): Promise<VideoResolveResult> {
  const videoId = extractYouTubeId(url)
  if (!videoId) {
    return { success: false, error: "Not a YouTube URL" }
  }

  // Try Invidious first
  const invResult = await resolveViaInvidious(videoId)
  if (invResult.success) return invResult

  // Try Piped as fallback
  const pipedResult = await resolveViaPiped(videoId)
  if (pipedResult.success) return pipedResult

  return {
    success: false,
    error: `Could not resolve video ${videoId}: ${invResult.error}; ${pipedResult.error}`,
  }
}

