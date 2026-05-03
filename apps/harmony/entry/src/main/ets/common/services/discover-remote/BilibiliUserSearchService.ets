import http from '@ohos.net.http'
import { FeedViewType } from '../../models/LivoModels'
import { stripHtml } from '../../utils/HtmlParser'
import {
  BASIC_BROWSER_USER_AGENT,
  DESKTOP_BROWSER_USER_AGENT,
  DEFAULT_ACCEPT_LANGUAGE,
  ACCEPT_HTML,
  ACCEPT_JSON,
  BILIBILI_REFERER,
  BILIBILI_ORIGIN,
  SHORT_REQUEST_TIMEOUT_MS,
  MEDIUM_REQUEST_TIMEOUT_MS,
  bilibiliSpaceReferer,
} from '../../AppConfig'
import { ResolvedDiscoverCandidate } from '../discover/DiscoverTypes'

interface BilibiliSearchResult {
  mid?: number
  uname?: string
  usign?: string
  upic?: string
  fans?: number | string
}

interface BilibiliSearchData {
  result?: BilibiliSearchResult[]
}

interface BilibiliSearchPayload {
  code?: number
  data?: BilibiliSearchData
}

interface BilibiliAvatarCard {
  face?: string
}

interface BilibiliAvatarData {
  card?: BilibiliAvatarCard
}

interface BilibiliAvatarPayload {
  code?: number
  data?: BilibiliAvatarData
}

interface BilibiliHtmlUserCard {
  uid: string
  title: string
  description: string
}

interface RankedBilibiliCandidate {
  candidate: ResolvedDiscoverCandidate
  score: number
}

function normalizeImageUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  if (trimmed.startsWith('http://')) return `https://${trimmed.substring('http://'.length)}`
  return trimmed
}

function normalizeMatchValue(value: string): string {
  return stripHtml(value).toLowerCase().replace(/[@\s_.\-|/]+/g, '').trim()
}

function computeMatchTier(query: string, candidate: string): number {
  const q = normalizeMatchValue(query)
  const c = normalizeMatchValue(candidate)
  if (!q || !c) return 0
  if (c === q) return 3
  if (c.startsWith(q)) return 2
  if (c.includes(q)) return 1
  return 0
}

function formatFollowers(value: number | string | undefined): string {
  const raw = String(value ?? '').trim()
  return raw ? `${raw} 粉丝` : ''
}

function candidateQueryVariants(query: string): string[] {
  const variants: string[] = []
  const push = (v: string): void => {
    const t = v.trim()
    if (t && !variants.includes(t)) variants.push(t)
  }
  push(query)
  push(query.toLowerCase())
  push(query.replace(/\s+/g, ''))
  push(query.replace(/\s+/g, '').toLowerCase())
  return variants
}

function fallbackBilibiliQueryVariants(query: string): string[] {
  const variants: string[] = []
  const compact = query.trim().replace(/\s+/g, '')
  const push = (v: string): void => {
    const t = v.trim()
    if (t && !variants.includes(t)) variants.push(t)
  }
  if (compact.length >= 3) push(compact.substring(0, compact.length - 1))
  if (compact.length >= 5) push(compact.substring(0, compact.length - 2))
  if (query.trim().length >= 3) push(query.trim().substring(0, query.trim().length - 1))
  return variants
}

function extractUidFromCandidate(candidate: ResolvedDiscoverCandidate): string {
  return candidate.targetUrl.match(/\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i)?.[1] ?? ''
}

function buildCandidate(rsshubBase: string, uid: string, title: string, description: string, imageUrl: string): ResolvedDiscoverCandidate {
  return {
    targetUrl: `${rsshubBase}/bilibili/user/dynamic/${uid}`,
    targetTitle: title,
    targetView: FeedViewType.SocialMedia,
    description,
    siteUrl: `https://space.bilibili.com/${uid}`,
    sourceKind: 'Bilibili',
    imageUrl,
  }
}

async function fetchBilibiliAvatarByUid(uid: string): Promise<string> {
  const request = http.createHttp()
  try {
    const response = await request.request(
      `https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(uid)}`,
      {
        method: http.RequestMethod.GET,
        connectTimeout: SHORT_REQUEST_TIMEOUT_MS,
        readTimeout: SHORT_REQUEST_TIMEOUT_MS,
        header: {
          'User-Agent': BASIC_BROWSER_USER_AGENT,
          'Accept': ACCEPT_JSON,
          'Referer': bilibiliSpaceReferer(uid),
          'Origin': BILIBILI_ORIGIN,
        },
      },
    )
    if (response.responseCode !== 200) return ''
    const payload = JSON.parse(String(response.result)) as BilibiliAvatarPayload
    if (payload.code !== 0) return ''
    return normalizeImageUrl(payload.data?.card?.face ?? '')
  } catch (_) {
    return ''
  } finally {
    request.destroy()
  }
}

function parseBilibiliUsersFromHtml(html: string): BilibiliHtmlUserCard[] {
  const cards: BilibiliHtmlUserCard[] = []
  const seen = new Set<string>()
  const regex = /href="\/\/space\.bilibili\.com\/(\d+)"[\s\S]{0,1200}?title="([^"]+)"[\s\S]{0,600}?title="([^"]*粉丝[^"]*)"/gi
  let matched: RegExpExecArray | null = regex.exec(html)
  while (matched) {
    const uid = matched[1] ?? ''
    const title = stripHtml(matched[2] ?? '')
    const description = stripHtml(matched[3] ?? '')
    if (uid && title && !seen.has(uid)) {
      seen.add(uid)
      cards.push({ uid, title, description })
    }
    matched = regex.exec(html)
  }
  return cards
}

async function searchBilibiliUsersByHtml(query: string, rsshubBase: string): Promise<RankedBilibiliCandidate[]> {
  const request = http.createHttp()
  try {
    const response = await request.request(
      `https://search.bilibili.com/upuser?keyword=${encodeURIComponent(query)}`,
      {
        method: http.RequestMethod.GET,
        connectTimeout: MEDIUM_REQUEST_TIMEOUT_MS,
        readTimeout: MEDIUM_REQUEST_TIMEOUT_MS,
        header: {
          'User-Agent': DESKTOP_BROWSER_USER_AGENT,
          'Accept': ACCEPT_HTML,
          'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
          'Referer': BILIBILI_REFERER,
        },
      },
    )
    if (response.responseCode !== 200) return []
    const cards = parseBilibiliUsersFromHtml(String(response.result))
    const candidates: RankedBilibiliCandidate[] = []
    for (const card of cards.slice(0, 12)) {
      const score = computeMatchTier(query, card.title) * 1000
        + computeMatchTier(query, card.description) * 180
        + computeMatchTier(query, card.uid) * 80
      if (score <= 0) continue
      const imageUrl = await fetchBilibiliAvatarByUid(card.uid)
      candidates.push({ candidate: buildCandidate(rsshubBase, card.uid, card.title, card.description, imageUrl), score: score + 8 })
    }
    return candidates
  } catch (_) {
    return []
  } finally {
    request.destroy()
  }
}

async function searchBilibiliUsersByVariant(query: string, rsshubBase: string): Promise<RankedBilibiliCandidate[]> {
  const request = http.createHttp()
  try {
    const response = await request.request(
      `https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${encodeURIComponent(query)}`,
      {
        method: http.RequestMethod.GET,
        connectTimeout: MEDIUM_REQUEST_TIMEOUT_MS,
        readTimeout: MEDIUM_REQUEST_TIMEOUT_MS,
        header: {
          'User-Agent': BASIC_BROWSER_USER_AGENT,
          'Accept': ACCEPT_JSON,
          'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
          'Referer': BILIBILI_REFERER,
          'Origin': BILIBILI_ORIGIN,
        },
      },
    )
    if (response.responseCode !== 200) return searchBilibiliUsersByHtml(query, rsshubBase)
    const payload = JSON.parse(String(response.result)) as BilibiliSearchPayload
    if (payload.code === -412) return searchBilibiliUsersByHtml(query, rsshubBase)
    if (payload.code !== 0 || !payload.data?.result) return []

    const candidates: RankedBilibiliCandidate[] = []
    payload.data.result.slice(0, 40).forEach((user: BilibiliSearchResult) => {
      const uid = user.mid ? String(user.mid) : ''
      if (!uid) return
      const title = stripHtml(user.uname || `UID ${uid}`)
      const description = stripHtml(user.usign || '') || formatFollowers(user.fans) || 'Bilibili 用户'
      const imageUrl = normalizeImageUrl(typeof user.upic === 'string' ? user.upic : '')
      const score = computeMatchTier(query, title) * 1000
        + computeMatchTier(query, description) * 180
        + computeMatchTier(query, uid) * 80
      if (score <= 0) return
      candidates.push({ candidate: buildCandidate(rsshubBase, uid, title, description, imageUrl), score: score + 8 })
    })
    return candidates
  } catch (_) {
    return searchBilibiliUsersByHtml(query, rsshubBase)
  } finally {
    request.destroy()
  }
}

export async function searchBilibiliUsers(query: string, rsshubBase: string): Promise<ResolvedDiscoverCandidate[]> {
  const ranked: RankedBilibiliCandidate[] = []
  const seen = new Set<string>()

  const collect = async (variants: string[]): Promise<void> => {
    for (const variant of variants) {
      const items = await searchBilibiliUsersByVariant(variant, rsshubBase)
      items.forEach((item) => {
        const key = extractUidFromCandidate(item.candidate) || item.candidate.targetUrl
        if (!seen.has(key)) {
          seen.add(key)
          ranked.push(item)
        }
      })
    }
  }

  await collect(candidateQueryVariants(query))
  if (ranked.length === 0) await collect(fallbackBilibiliQueryVariants(query))
  if (ranked.length === 0) return []

  ranked.sort((a, b) => b.score - a.score)
  return ranked.map((item) => item.candidate).slice(0, 12)
}
