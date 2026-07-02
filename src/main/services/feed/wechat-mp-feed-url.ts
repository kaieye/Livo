import { getBackendBaseUrl } from '../backend/backend-config'

const WECHAT_MP_UPSTREAM_FEED_PATH = /^\/feed\/(MP_WXS_[^/?#]+)\.xml$/i

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
