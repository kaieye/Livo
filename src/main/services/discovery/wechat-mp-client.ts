import { session } from 'electron'
import { getBackendBaseUrl } from '../backend/backend-config'
import type {
  EnsureWechatMpFeedInput,
  EnsureWechatMpFeedResult,
  WechatMpDiscoverResult,
} from '../../../shared/types'

interface SearchWechatMpResponse {
  results: WechatMpDiscoverResult[]
  total: number
  limit: number
  offset: number
}

function buildUrl(path: string): string {
  return `${getBackendBaseUrl()}${path}`
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

async function getValidSessionToken(): Promise<string | null> {
  const { sessionStore } = await import('../auth/session-store')
  return sessionStore.getValidToken()
}

async function throwResponseError(
  response: Response,
  fallback: string,
): Promise<never> {
  const text = await response.text().catch(() => '')
  throw new Error(`${fallback}: ${response.status}${text ? ` ${text}` : ''}`)
}

export async function searchWechatMp(
  query: string,
  options: { limit?: number; offset?: number } = {},
): Promise<SearchWechatMpResponse> {
  const token = await getValidSessionToken()
  if (!token) {
    throw new Error('Please sign in before searching WeChat MP feeds')
  }

  const params = new URLSearchParams({
    query: query.trim(),
  })
  if (typeof options.limit === 'number') {
    params.set('limit', String(options.limit))
  }
  if (typeof options.offset === 'number') {
    params.set('offset', String(options.offset))
  }

  const response = await session.defaultSession.fetch(
    buildUrl(`/api/wechat-rss/search?${params.toString()}`),
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  )

  if (!response.ok) {
    await throwResponseError(response, 'WeChat MP search failed')
  }

  return parseJson<SearchWechatMpResponse>(response)
}

export async function ensureWechatMpFeed(
  input: EnsureWechatMpFeedInput,
): Promise<EnsureWechatMpFeedResult> {
  const token = await getValidSessionToken()
  if (!token) {
    throw new Error('Please sign in before subscribing to WeChat MP feeds')
  }

  const response = await session.defaultSession.fetch(
    buildUrl('/api/wechat-rss/ensure-feed'),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
  )

  if (!response.ok) {
    await throwResponseError(response, 'WeChat MP subscription failed')
  }

  const data =
    await parseJson<Omit<EnsureWechatMpFeedResult, 'success'>>(response)
  return {
    success: true,
    ...data,
  }
}
