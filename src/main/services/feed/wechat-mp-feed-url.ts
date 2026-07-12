import { getBackendBaseUrl } from '../backend/backend-config'

const WECHAT_MP_UPSTREAM_FEED_PATH = /^\/feed\/(MP_WXS_[^/?#]+)\.xml$/i
const WECHAT_MP_BACKEND_FEED_PATH =
  /^\/api\/wechat-rss\/feed\/(MP_WXS_[^/?#]+)\.xml$/i

function decodeFeedId(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function rewriteWechatMpFeedUrlToBackendProxy(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return url

  try {
    const parsed = new URL(trimmed)
    const match = parsed.pathname.match(WECHAT_MP_UPSTREAM_FEED_PATH)
    if (!match?.[1]) return url

    const baseUrl = getBackendBaseUrl().replace(/\/+$/, '')
    const feedId = encodeURIComponent(decodeFeedId(match[1]))
    return `${baseUrl}/api/wechat-rss/feed/${feedId}.xml`
  } catch {
    return url
  }
}

export function isWechatMpBackendFeedUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    return WECHAT_MP_BACKEND_FEED_PATH.test(parsed.pathname)
  } catch {
    return false
  }
}

export function toWechatMpFreshBackendUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim())
    const match = parsed.pathname.match(WECHAT_MP_BACKEND_FEED_PATH)
    if (!match?.[1]) return null
    parsed.pathname = `/api/wechat-rss/feed/${match[1]}/fresh`
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return null
  }
}
