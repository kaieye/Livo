import type { Feed } from '../../../shared/types'
import { isInstagramUserFeedUrl } from './feed-route-policy'

const INSTAGRAM_FEED_FAILURE_BACKOFF_BASE_MS = 15 * 60 * 1000
const INSTAGRAM_FEED_FAILURE_BACKOFF_MAX_MS = 90 * 60 * 1000

export function shouldBackOffFeed(
  feed: Feed,
  now: number,
  force: boolean,
): boolean {
  if (force) return false
  if (!isInstagramUserFeedUrl(feed.url)) return false
  if (!feed.lastFetched || feed.errorCount <= 0) return false
  const exp = Math.max(0, feed.errorCount - 1)
  const backoffMs = Math.min(
    INSTAGRAM_FEED_FAILURE_BACKOFF_BASE_MS * Math.pow(2, exp),
    INSTAGRAM_FEED_FAILURE_BACKOFF_MAX_MS,
  )
  return now - feed.lastFetched < backoffMs
}

export function getFeedBackoffUntilMs(feed: Feed): number | null {
  if (!isInstagramUserFeedUrl(feed.url)) return null
  if (!feed.lastFetched || feed.errorCount <= 0) return null
  const exp = Math.max(0, feed.errorCount - 1)
  const backoffMs = Math.min(
    INSTAGRAM_FEED_FAILURE_BACKOFF_BASE_MS * Math.pow(2, exp),
    INSTAGRAM_FEED_FAILURE_BACKOFF_MAX_MS,
  )
  return feed.lastFetched + backoffMs
}

export function getNextAutoRefreshDelayMs(
  feeds: Feed[],
  now: number,
  intervalMinutes: number,
): number | null {
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) return null

  const intervalMs = intervalMinutes * 60 * 1000
  if (feeds.length === 0) return intervalMs

  let nextDueAt = Number.POSITIVE_INFINITY
  for (const feed of feeds) {
    if (!feed.lastFetched) return 0
    const dueAt = Math.max(
      feed.lastFetched + intervalMs,
      getFeedBackoffUntilMs(feed) ?? 0,
    )
    nextDueAt = Math.min(nextDueAt, dueAt)
  }

  if (!Number.isFinite(nextDueAt)) return intervalMs
  return Math.max(0, nextDueAt - now)
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  context: string,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    return Promise.reject(
      signal.reason ?? new DOMException('Aborted', 'AbortError'),
    )
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise
  }
  return new Promise<T>((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const cleanup = (): void => {
      if (timer) clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    const rejectOnce = (reason: unknown): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(reason)
    }
    const onAbort = (): void => {
      rejectOnce(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    timer = setTimeout(() => {
      rejectOnce(
        new Error(`[refresh] timeout after ${timeoutMs}ms: ${context}`),
      )
    }, timeoutMs)
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) onAbort()
    promise.then(
      (value) => {
        if (settled) return
        settled = true
        cleanup()
        resolve(value)
      },
      (error) => {
        rejectOnce(error)
      },
    )
  })
}
