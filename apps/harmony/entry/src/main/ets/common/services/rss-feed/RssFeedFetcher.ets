import http from '@ohos.net.http'
import { expandRssHubFallbackRoutes } from '../../utils/platform/RssHubFallbackRoute'
import {
  RSSHUB_REQUEST_TIMEOUT_MS,
  RSSHUB_INSTAGRAM_REQUEST_TIMEOUT_MS,
  RSS_REQUEST_TIMEOUT_MS,
} from '../../config/NetworkConfig'
import {
  RSSHUB_INSTANCES,
  FALLBACK_NITTER_INSTANCES,
} from '../../config/PlatformInstances'

export interface FeedRequestResult {
  response: http.HttpResponse
  request: http.HttpRequest
  finalUrl: string
}

const LOG_TAG = '[RssFeedFetcher]'
const REQUEST_RETRY_ATTEMPTS: number = 2
const REQUEST_RETRY_DELAY_MS: number = 240

interface RequestAttemptResult {
  response: http.HttpResponse
  request: http.HttpRequest
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve: (value: void) => void) => {
    setTimeout(() => resolve(), ms)
  })
}

function errorMessage(error: Error | string | Object): string {
  return error instanceof Error ? error.message : String(error)
}

function isRetryableNetworkError(error: Error | string | Object): boolean {
  const message = errorMessage(error)
  return message.includes('CURLcode result 28')
    || message.includes('CURLcode result 35')
    || message.includes('CURLcode result 42')
    || message.includes('timeout')
    || message.includes('timed out')
}

async function requestWithRetry(
  url: string,
  options: http.HttpRequestOptions,
  maxAttempts: number = REQUEST_RETRY_ATTEMPTS,
): Promise<RequestAttemptResult> {
  let lastError: Error | string | Object = 'unknown error'
  const attempts = Math.max(1, maxAttempts)
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const request = http.createHttp()
    try {
      const response = await request.request(url, options)
      return { response, request }
    } catch (error) {
      lastError = error
      request.destroy()
      if (attempt >= attempts || !isRetryableNetworkError(error)) {
        break
      }
      console.warn(`${LOG_TAG} Retry ${attempt}/${attempts - 1}: ${url} failed: ${errorMessage(error)}`)
      await sleep(REQUEST_RETRY_DELAY_MS * attempt)
    }
  }
  throw new Error(errorMessage(lastError))
}

function preferredRssHubInstances(route: string): string[] {
  const r = route.toLowerCase()
  // liumingye.cn is the only instance that supports picnob/Instagram routes.
  // It's not in RSSHUB_INSTANCES because it returns 503 for all other routes.
  if (r.includes('/picnob/') || r.includes('/instagram/')) {
    return ['https://rsshub.liumingye.cn'].concat(RSSHUB_INSTANCES)
  }
  return RSSHUB_INSTANCES
}

function rssHubTimeoutMs(route: string): number {
  const r = route.toLowerCase()
  return (r.includes('/picnob/') || r.includes('/instagram/'))
    ? RSSHUB_INSTAGRAM_REQUEST_TIMEOUT_MS
    : RSSHUB_REQUEST_TIMEOUT_MS
}

function withReferer(headers: Record<string, string>, referer: string): Record<string, string> {
  const result: Record<string, string> = {}
  Object.keys(headers).forEach((key: string) => {
    if (key !== 'Accept-Encoding') {
      result[key] = headers[key]
    }
  })
  result['Referer'] = referer
  return result
}

export async function fetchUrl(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<FeedRequestResult> {
  try {
    const result = await requestWithRetry(url, {
      method: http.RequestMethod.GET,
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
      header: headers,
    })
    return { response: result.response, request: result.request, finalUrl: url }
  } catch (error) {
    throw new Error(`RSS request failed: ${errorMessage(error)}`)
  }
}

export async function tryRssHubInstances(
  route: string,
  headers: Record<string, string>,
): Promise<FeedRequestResult | null> {
  const routes = expandRssHubFallbackRoutes(route)
  const instances = preferredRssHubInstances(route)
  const timeoutMs = rssHubTimeoutMs(route)
  const errors: string[] = []

  for (const instance of instances) {
    for (const candidateRoute of routes) {
      const url = `${instance}${candidateRoute}`
      const instanceHeaders = withReferer(headers, instance)
      try {
        const result = await requestWithRetry(url, {
          method: http.RequestMethod.GET,
          connectTimeout: timeoutMs,
          readTimeout: timeoutMs,
          header: instanceHeaders,
        })
        const response = result.response
        if (response.responseCode === 200) {
          console.info(`${LOG_TAG} Success: ${url}`)
          return { response, request: result.request, finalUrl: url }
        }
        errors.push(`${url} -> ${response.responseCode}`)
        result.request.destroy()
      } catch (error) {
        errors.push(`${url} failed: ${errorMessage(error)}`)
      }
    }
  }
  console.warn(`${LOG_TAG} All RSSHub instances failed: ${errors.join('; ')}`)
  return null
}

export async function tryNitterInstances(
  username: string,
  headers: Record<string, string>,
): Promise<FeedRequestResult | null> {
  const normalized = username.trim().toLowerCase()
  if (!normalized) {
    return null
  }
  const errors: string[] = []

  for (const instance of FALLBACK_NITTER_INSTANCES) {
    const url = `${instance.replace(/\/+$/g, '')}/${encodeURIComponent(normalized)}/rss`
    const instanceHeaders = withReferer(headers, instance)
    try {
      const result = await requestWithRetry(url, {
        method: http.RequestMethod.GET,
        connectTimeout: RSS_REQUEST_TIMEOUT_MS,
        readTimeout: RSS_REQUEST_TIMEOUT_MS,
        header: instanceHeaders,
      })
      const response = result.response
      if (response.responseCode === 200) {
        console.info(`${LOG_TAG} Nitter success: ${url}`)
        return { response, request: result.request, finalUrl: url }
      }
      errors.push(`${url} -> ${response.responseCode}`)
      result.request.destroy()
    } catch (error) {
      errors.push(`${url} failed: ${errorMessage(error)}`)
    }
  }
  console.warn(`${LOG_TAG} All Nitter instances failed: ${errors.join('; ')}`)
  return null
}

export function isRssHubUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return RSSHUB_INSTANCES.some((i: string) => lower.startsWith(i.toLowerCase()))
    || lower.includes('rsshub.liumingye.cn')
    || /\/(bilibili|x|twitter|youtube|instagram|picnob)\//.test(lower)
}

export function extractRssHubRoute(url: string): string {
  const KNOWN_INSTANCES = [
    ...RSSHUB_INSTANCES,
    'https://rsshub.liumingye.cn',
  ]
  for (const instance of KNOWN_INSTANCES) {
    const idx = url.toLowerCase().indexOf(instance.toLowerCase())
    if (idx !== -1) {
      const route = url.substring(idx + instance.length)
      if (route.startsWith('/')) {
        return route
      }
    }
  }
  return url.match(/https?:\/\/[^/]+(\/[^?#]+)/)?.[1] ?? ''
}

export function isXRoute(route: string): boolean {
  const r = route.trim().toLowerCase()
  return r.includes('/x/user/') || r.includes('/twitter/user/')
}

export function extractXRouteUsername(route: string): string {
  const matched = route.trim().match(/^\/(?:x|twitter)\/user\/([^/?#]+)/i)
  return matched?.[1] ? decodeURIComponent(matched[1]).replace(/^@+/, '').trim().toLowerCase() : ''
}

export function isNitterFeedUrl(url: string): boolean {
  return /https?:\/\/[^/]*nitter[^/]*\//i.test((url || '').trim())
}
