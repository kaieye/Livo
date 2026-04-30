import http from '@ohos.net.http'
import { expandRssHubFallbackRoutes } from '../../utils/RssHubFallbackRoute'
import {
  RSSHUB_INSTANCES,
  RSSHUB_REQUEST_TIMEOUT_MS,
  RSSHUB_INSTAGRAM_REQUEST_TIMEOUT_MS,
  RSS_REQUEST_TIMEOUT_MS,
  FALLBACK_NITTER_INSTANCES,
} from '../../AppConfig'

export interface FeedRequestResult {
  response: http.HttpResponse
  request: http.HttpRequest
  finalUrl: string
}

function preferredRssHubInstances(route: string): string[] {
  const r = route.toLowerCase()
  if (r.includes('/x/') || r.includes('/twitter/')) {
    return ['https://rsshub.pseudoyu.com'].concat(
      RSSHUB_INSTANCES.filter((i: string) => i !== 'https://rsshub.pseudoyu.com'),
    )
  }
  if (r.includes('/bilibili/') || r.includes('/picnob/') || r.includes('/instagram/')) {
    return ['https://rsshub.liumingye.cn'].concat(
      RSSHUB_INSTANCES.filter((i: string) => i !== 'https://rsshub.liumingye.cn'),
    )
  }
  return RSSHUB_INSTANCES
}

function rssHubTimeoutMs(route: string): number {
  const r = route.toLowerCase()
  return (r.includes('/picnob/') || r.includes('/instagram/'))
    ? RSSHUB_INSTAGRAM_REQUEST_TIMEOUT_MS
    : RSSHUB_REQUEST_TIMEOUT_MS
}

function stripAcceptEncoding(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  Object.keys(headers).forEach((key: string) => {
    if (key !== 'Accept-Encoding') {
      result[key] = headers[key]
    }
  })
  return result
}

export async function fetchUrl(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<FeedRequestResult> {
  const request = http.createHttp()
  try {
    const response = await request.request(url, {
      method: http.RequestMethod.GET,
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
      header: headers,
    })
    return { response, request, finalUrl: url }
  } catch (error) {
    request.destroy()
    throw new Error(error instanceof Error ? error.message : 'RSS request failed')
  }
}

export async function tryRssHubInstances(
  route: string,
  headers: Record<string, string>,
): Promise<FeedRequestResult | null> {
  const routes = expandRssHubFallbackRoutes(route)
  const instances = preferredRssHubInstances(route)
  const timeoutMs = rssHubTimeoutMs(route)
  const baseHeaders = stripAcceptEncoding(headers)

  for (const instance of instances) {
    for (const candidateRoute of routes) {
      const url = `${instance}${candidateRoute}`
      const instanceHeaders: Record<string, string> = {}
      Object.keys(baseHeaders).forEach((k: string) => { instanceHeaders[k] = baseHeaders[k] })
      instanceHeaders['Referer'] = instance
      const request = http.createHttp()
      try {
        const response = await request.request(url, {
          method: http.RequestMethod.GET,
          connectTimeout: timeoutMs,
          readTimeout: timeoutMs,
          header: instanceHeaders,
        })
        if (response.responseCode === 200) {
          return { response, request, finalUrl: url }
        }
        request.destroy()
      } catch (_) {
        request.destroy()
      }
    }
  }
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
  const baseHeaders = stripAcceptEncoding(headers)

  for (const instance of FALLBACK_NITTER_INSTANCES) {
    const url = `${instance.replace(/\/+$/g, '')}/${encodeURIComponent(normalized)}/rss`
    const instanceHeaders: Record<string, string> = {}
    Object.keys(baseHeaders).forEach((k: string) => { instanceHeaders[k] = baseHeaders[k] })
    instanceHeaders['Referer'] = instance
    const request = http.createHttp()
    try {
      const response = await request.request(url, {
        method: http.RequestMethod.GET,
        connectTimeout: RSS_REQUEST_TIMEOUT_MS,
        readTimeout: RSS_REQUEST_TIMEOUT_MS,
        header: instanceHeaders,
      })
      if (response.responseCode === 200) {
        return { response, request, finalUrl: url }
      }
      request.destroy()
    } catch (_) {
      request.destroy()
    }
  }
  return null
}

export function isRssHubUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return RSSHUB_INSTANCES.some((i: string) => lower.startsWith(i.toLowerCase()))
    || /\/(bilibili|x|twitter|youtube|instagram)\//.test(lower)
}

export function extractRssHubRoute(url: string): string {
  for (const instance of RSSHUB_INSTANCES) {
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
