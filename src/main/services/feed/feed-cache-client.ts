import { session } from 'electron'
import { getBackendBaseUrl } from '../backend/backend-config'
import { sessionStore } from '../auth/session-store'

export interface FeedCacheEntry {
  guid: string
  title: string
  link: string | null
  author: string | null
  publishedAt: string | null
  contentHtml: string | null
  summary: string | null
}

export interface FeedCacheHit {
  url: string
  sourceId: string
  lastFetchedAt: string
  entries: FeedCacheEntry[]
}

export interface FeedCacheResponse {
  hits: FeedCacheHit[]
  misses: string[]
}

/**
 * 判断当前用户是否有资格使用服务端缓存（admin 或 vip）。
 * 后端会再校验一次；这里只是客户端的提前过滤，避免无谓请求。
 */
export function shouldUseServerFeedCache(): boolean {
  const user = sessionStore.getCurrentUser()
  if (!user) return false
  if (user.role === 'admin') return true
  if (Array.isArray(user.roles) && user.roles.includes('vip')) return true
  return false
}

/**
 * 批量向后端查询是否有已缓存的条目。
 * 后端命中的 url 走 hits，过期/未收录的归 misses，由调用方退回到本地拉取。
 */
export async function queryServerFeedCache(
  urls: string[],
): Promise<FeedCacheResponse> {
  if (urls.length === 0) return { hits: [], misses: [] }
  const token = sessionStore.getValidToken()
  if (!token) return { hits: [], misses: urls }

  const response = await session.defaultSession.fetch(
    `${getBackendBaseUrl()}/api/feed-cache/entries`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ urls }),
    },
  )

  if (!response.ok) {
    // 403/401 不抛错——视作"无后端缓存可用"，让上游回退到本地拉取。
    if (response.status === 401 || response.status === 403) {
      return { hits: [], misses: urls }
    }
    const text = await response.text().catch(() => '')
    throw new Error(
      `Feed cache query failed: ${response.status}${text ? ` ${text}` : ''}`,
    )
  }

  return (await response.json()) as FeedCacheResponse
}
