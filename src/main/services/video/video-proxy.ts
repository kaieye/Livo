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
 *   5. Falls back gracefully - caller opens browser if resolution fails
 *
 * URL parsing, instance lists, and stream-selection live in `@shared/video-url`
 * (`video-url.ts`) so they stay consistent with the renderer and are unit
 * testable. This module owns the network fallback loop only.
 */

import { net } from 'electron'
import {
  INVIDIOUS_INSTANCES,
  PIPED_INSTANCES,
  extractYouTubeId,
  selectBestInvidiousStream,
  selectPipedStream,
  type InvidiousVideoResponse,
  type PipedVideoResponse,
} from '@shared/video-url'
import { assertNetworkFetchUrl } from '../system/network-url-policy'

export { extractYouTubeId }

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

/** Fetches and parses JSON from a URL. Injectable so the fallback loop is testable. */
export type JsonFetcher = <T>(url: string, timeoutMs?: number) => Promise<T>

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetch JSON using Electron's `net` module (no CORS restrictions).
 * Has a timeout to avoid hanging on unresponsive instances.
 */
async function fetchJSON<T>(url: string, timeoutMs = 8000): Promise<T> {
  const safeUrl = await assertNetworkFetchUrl(url)
  return new Promise((resolve, reject) => {
    const request = net.request(safeUrl)
    let data = ''
    let settled = false

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        request.abort()
        reject(new Error(`Timeout after ${timeoutMs}ms`))
      }
    }, timeoutMs)

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        clearTimeout(timer)
        settled = true
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }
      response.on('data', (chunk) => {
        data += chunk.toString()
      })
      response.on('end', () => {
        clearTimeout(timer)
        if (!settled) {
          settled = true
          try {
            resolve(JSON.parse(data) as T)
          } catch (e) {
            reject(e)
          }
        }
      })
    })

    request.on('error', (err) => {
      clearTimeout(timer)
      if (!settled) {
        settled = true
        reject(err)
      }
    })

    request.end()
  })
}

// ── Invidious strategy ───────────────────────────────────────────────────────

async function resolveViaInvidious(
  videoId: string,
  fetcher: JsonFetcher,
): Promise<VideoResolveResult> {
  const errors: string[] = []

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const apiUrl = `${instance}/api/v1/videos/${videoId}?fields=formatStreams,title`
      const data = await fetcher<InvidiousVideoResponse>(apiUrl)

      const selected = selectBestInvidiousStream(data)
      if (!selected) {
        errors.push(`${instance}: no formatStreams`)
        continue
      }
      const safeStreamUrl = await assertNetworkFetchUrl(selected.url)

      return {
        success: true,
        url: safeStreamUrl,
        quality: selected.quality,
        title: data.title,
      }
    } catch (err) {
      errors.push(`${instance}: ${(err as Error).message}`)
    }
  }

  return {
    success: false,
    error: `All Invidious instances failed: ${errors.join('; ')}`,
  }
}

// ── Piped strategy (secondary fallback) ───────────────────────────────────────

async function resolveViaPiped(
  videoId: string,
  fetcher: JsonFetcher,
): Promise<VideoResolveResult> {
  const errors: string[] = []

  for (const instance of PIPED_INSTANCES) {
    try {
      const apiUrl = `${instance}/streams/${videoId}`
      const data = await fetcher<PipedVideoResponse>(apiUrl)

      const selected = selectPipedStream(data)
      if (!selected) {
        errors.push(`${instance}: no usable streams`)
        continue
      }
      const safeStreamUrl = await assertNetworkFetchUrl(selected.url)

      return {
        success: true,
        url: safeStreamUrl,
        quality: selected.quality,
        title: data.title,
      }
    } catch (err) {
      errors.push(`${instance}: ${(err as Error).message}`)
    }
  }

  return {
    success: false,
    error: `All Piped instances failed: ${errors.join('; ')}`,
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve a YouTube URL to a direct video stream URL.
 * Tries Invidious first, then Piped as fallback.
 * Returns `{ success: false }` for non-YouTube URLs or if all instances fail.
 *
 * `fetcher` defaults to Electron's `net`-backed JSON fetch; tests inject a mock.
 */
export async function resolveVideoUrl(
  url: string,
  fetcher: JsonFetcher = fetchJSON,
): Promise<VideoResolveResult> {
  const videoId = extractYouTubeId(url)
  if (!videoId) {
    return { success: false, error: 'Not a YouTube URL' }
  }

  // Try Invidious first
  const invResult = await resolveViaInvidious(videoId, fetcher)
  if (invResult.success) return invResult

  // Try Piped as fallback
  const pipedResult = await resolveViaPiped(videoId, fetcher)
  if (pipedResult.success) return pipedResult

  return {
    success: false,
    error: `Could not resolve video ${videoId}: ${invResult.error}; ${pipedResult.error}`,
  }
}
