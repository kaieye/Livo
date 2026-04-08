import http from '@ohos.net.http'
import { FeedViewType } from '../models/LivoModels'
import { DEFAULT_RSSHUB_INSTANCE, DiscoverSearchPlatform, ResolvedDiscoverCandidate } from './DiscoverService'
import { FeedRefreshPayload } from './RssFeedService'
import {
  buildInstagramCandidateFromProfile,
  buildInstagramProfileSeedFromProfile,
  buildXCandidateFromProfile,
  buildXProfileSeedFromProfile,
  dedupeAndLimitDiscoverCandidates,
  DiscoverRemoteProfileSeed,
  DiscoverRemoteViewMapping,
  extractXFollowersFromText,
  parseInstagramProfilesFromSearchHtml,
  parseInstagramProfilesFromTopsearchPayload,
  parseXProfilesFromSearchHtml,
} from '../utils/DiscoverRemoteSearchParsing'
import { formatInstagramFeedTitle } from '../utils/SocialFeedTitles'

interface BilibiliSearchResult {
  mid?: number
  uname?: string
  usign?: string
  upic?: string
  fans?: number | string
}

interface ParsedYouTubeChannel {
  channelId: string
  title: string
  imageUrl: string
}

interface BilibiliSearchPayloadData {
  result?: BilibiliSearchResult[]
}

interface BilibiliSearchPayload {
  code?: number
  data?: BilibiliSearchPayloadData
}

interface RankedBilibiliCandidate {
  candidate: ResolvedDiscoverCandidate
  score: number
}

interface BilibiliHtmlUserCard {
  uid: string
  title: string
  description: string
}

interface BilibiliAvatarPayloadCard {
  face?: string
}

interface BilibiliAvatarPayloadData {
  card?: BilibiliAvatarPayloadCard
}

interface BilibiliAvatarPayload {
  code?: number
  data?: BilibiliAvatarPayloadData
}

const SOCIAL_VIEW_MAPPING: DiscoverRemoteViewMapping = {
  x: FeedViewType.SocialMedia,
  instagram: FeedViewType.Pictures,
}
const RSSHUB_BASE_URL = DEFAULT_RSSHUB_INSTANCE.replace(/\/+$/, '')
const FALLBACK_NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.poast.org',
  'https://nitter.privacydev.net',
  'https://nitter.d420.de',
]
const INSTAGRAM_SEARCH_TIMEOUT_MS = 3500

function decodeNumericEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (matched: string, hex: string) => {
      const code = parseInt(hex, 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : matched
    })
    .replace(/&#([0-9]+);/g, (matched: string, digits: string) => {
      const code = parseInt(digits, 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : matched
    })
}

function decodeBasicEntities(value: string): string {
  return decodeNumericEntities(value)
    .replace(/\\u0026/g, '&')
    .replace(/\\u003d/g, '=')
    .replace(/\\u002F/g, '/')
    .replace(/\\u002f/g, '/')
    .replace(/&#0*64;/gi, '@')
    .replace(/\\"/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
  }

function stripHtml(value: string): string {
  return decodeBasicEntities(value).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function formatFollowers(value: number | string | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  const raw = String(value).trim()
  if (!raw) {
    return ''
  }
  return `${raw} 粉丝`
}

function normalizeMatchValue(value: string): string {
  return stripHtml(value)
    .toLowerCase()
    .replace(/[@\s_.\-|/]+/g, '')
    .trim()
}

function computeMatchTier(query: string, candidate: string): number {
  const q = normalizeMatchValue(query)
  const c = normalizeMatchValue(candidate)
  if (!q || !c) {
    return 0
  }
  if (c === q) {
    return 3
  }
  if (c.startsWith(q)) {
    return 2
  }
  if (c.includes(q)) {
    return 1
  }
  return 0
}

function normalizeImageUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }
  if (trimmed.startsWith('http://')) {
    return `https://${trimmed.substring('http://'.length)}`
  }
  return trimmed
}

function candidateQueryVariants(query: string): string[] {
  const variants: string[] = []
  const pushVariant = (value: string): void => {
    const trimmed = value.trim()
    if (!trimmed || variants.includes(trimmed)) {
      return
    }
    variants.push(trimmed)
  }

  pushVariant(query)
  pushVariant(query.toLowerCase())
  pushVariant(query.replace(/\s+/g, ''))
  pushVariant(query.replace(/\s+/g, '').toLowerCase())
  return variants
}

function fallbackBilibiliQueryVariants(query: string): string[] {
  const variants: string[] = []
  const normalized = query.trim()
  const compact = normalized.replace(/\s+/g, '')
  const pushVariant = (value: string): void => {
    const trimmed = value.trim()
    if (!trimmed || variants.includes(trimmed)) {
      return
    }
    variants.push(trimmed)
  }

  if (compact.length >= 3) {
    pushVariant(compact.substring(0, compact.length - 1))
  }
  if (compact.length >= 5) {
    pushVariant(compact.substring(0, compact.length - 2))
  }
  if (normalized.length >= 3) {
    pushVariant(normalized.substring(0, normalized.length - 1))
  }
  return variants
}

function dedupeCandidates(items: ResolvedDiscoverCandidate[]): ResolvedDiscoverCandidate[] {
  const result: ResolvedDiscoverCandidate[] = []
  items.forEach((item: ResolvedDiscoverCandidate) => {
    const existingIndex = result.findIndex((candidate: ResolvedDiscoverCandidate) => candidate.targetUrl === item.targetUrl)
    if (existingIndex < 0) {
      result.push(item)
      return
    }

    if (scoreCandidateRichness(item) > scoreCandidateRichness(result[existingIndex])) {
      result[existingIndex] = item
    }
  })
  return result
}

function scoreCandidateRichness(candidate: ResolvedDiscoverCandidate): number {
  let score = 0
  if (candidate.imageUrl) {
    score += 4
  }
  if (candidate.description && !/^(?:X|Instagram|YouTube)\s+(?:用户|频道)$/.test(candidate.description)) {
    score += 2
  }
  if (candidate.sourceKind === 'X' && /followers/i.test(candidate.description)) {
    score += 6
  }
  return score
}

function withRssHubBase(route: string): string {
  return `${RSSHUB_BASE_URL}/${route.replace(/^\/+/, '')}`
}

function withConfiguredRssHubCandidate(candidate: ResolvedDiscoverCandidate): ResolvedDiscoverCandidate {
  if (!candidate.targetUrl.includes('/x/user/') && !candidate.targetUrl.includes('/instagram/user/')) {
    return candidate
  }

  return {
    targetUrl: candidate.targetUrl.replace(/^https?:\/\/[^/]+/i, RSSHUB_BASE_URL),
    targetTitle: candidate.targetTitle,
    targetView: candidate.targetView,
    description: candidate.description,
    siteUrl: candidate.siteUrl,
    sourceKind: candidate.sourceKind,
    imageUrl: candidate.imageUrl,
  }
}

function createResolvedCandidate(
  targetUrl: string,
  targetTitle: string,
  targetView: FeedViewType,
  description: string,
  siteUrl: string,
  sourceKind: string,
  imageUrl: string,
): ResolvedDiscoverCandidate {
  return {
    targetUrl,
    targetTitle,
    targetView,
    description,
    siteUrl,
    sourceKind,
    imageUrl,
  }
}

function normalizeFollowerLabel(value: number | string | undefined): string {
  const label = formatFollowers(value)
  return label || 'Bilibili 用户'
}

function buildQueryVariants(query: string, maxLength: number): string[] {
  const variants: string[] = []
  const pushVariant = (value: string): void => {
    const trimmed = value.trim().replace(/^@+/, '')
    if (!trimmed || trimmed.length > maxLength || variants.includes(trimmed)) {
      return
    }
    variants.push(trimmed)
  }

  pushVariant(query)
  pushVariant(query.toLowerCase())
  pushVariant(query.replace(/\s+/g, ''))
  pushVariant(query.replace(/\s+/g, '').toLowerCase())
  return variants
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildProfileAnchorSnippet(
  profileUrl: string,
  username: string,
  title: string,
  imageUrl: string,
  followers: string,
): string {
  const safeUrl = escapeHtml(profileUrl)
  const safeImageUrl = imageUrl ? ` <img src="${escapeHtml(imageUrl)}" />` : ''
  const safeUsername = username ? ` <span>@${escapeHtml(username)}</span>` : ''
  const safeTitle = title ? ` <span>${escapeHtml(title)}</span>` : ''
  const safeFollowers = followers ? ` <span>${escapeHtml(followers)}</span>` : ''
  return `<a href="${safeUrl}">${safeImageUrl}${safeUsername}${safeTitle}${safeFollowers}</a>`
}

function extractMetaContent(html: string, name: string): string {
  const pattern = /<meta\b[^>]*>/gi
  let matched: RegExpExecArray | null = pattern.exec(html)

  while (matched) {
    const tag = matched[0] ?? ''
    if (!new RegExp(`\\bproperty=(["'])${name}\\1`, 'i').test(tag)) {
      matched = pattern.exec(html)
      continue
    }

    const content = tag.match(/\bcontent=(["'])([\s\S]*?)\1/i)
    if (content?.[2]) {
      return decodeBasicEntities(content[2])
    }

    matched = pattern.exec(html)
  }

  return ''
}

function extractMetaNameContent(html: string, name: string): string {
  const pattern = /<meta\b[^>]*>/gi
  let matched: RegExpExecArray | null = pattern.exec(html)

  while (matched) {
    const tag = matched[0] ?? ''
    if (!new RegExp(`\\bname=(["'])${name}\\1`, 'i').test(tag)) {
      matched = pattern.exec(html)
      continue
    }

    const content = tag.match(/\bcontent=(["'])([\s\S]*?)\1/i)
    if (content?.[2]) {
      return decodeBasicEntities(content[2])
    }

    matched = pattern.exec(html)
  }

  return ''
}

function isGenericInstagramHtml(html: string, ogTitle: string): boolean {
  const normalizedTitle = stripHtml(ogTitle).trim().toLowerCase()
  if (!normalizedTitle || normalizedTitle === 'instagram') {
    return true
  }

  return /log into instagram/i.test(html)
    || /create an account or log in to instagram/i.test(html)
}

function createParsedYouTubeChannel(channelId: string, title: string, imageUrl: string): ParsedYouTubeChannel {
  return {
    channelId,
    title,
    imageUrl,
  }
}

function createRankedBilibiliCandidate(candidate: ResolvedDiscoverCandidate, score: number): RankedBilibiliCandidate {
  return {
    candidate,
    score,
  }
}

function extractBilibiliUidFromCandidate(candidate: ResolvedDiscoverCandidate): string {
  const matched = candidate.targetUrl.match(/\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i)
  return matched?.[1] ?? ''
}

function createBilibiliHtmlUserCard(uid: string, title: string, description: string): BilibiliHtmlUserCard {
  return {
    uid,
    title,
    description,
  }
}

export class DiscoverRemoteSearchService {
  private static previewCache: Map<string, FeedRefreshPayload> = new Map<string, FeedRefreshPayload>()

  private static cachePreviewPayload(targetUrl: string, payload: FeedRefreshPayload): void {
    const trimmed = targetUrl.trim()
    if (!trimmed) {
      return
    }
    DiscoverRemoteSearchService.previewCache.set(trimmed, payload)
  }

  static rememberPreviewPayload(targetUrl: string, payload: FeedRefreshPayload): void {
    const trimmed = targetUrl.trim()
    if (!trimmed) {
      return
    }

    DiscoverRemoteSearchService.cachePreviewPayload(trimmed, payload)
    if (payload.resolvedFeedUrl?.trim()) {
      DiscoverRemoteSearchService.cachePreviewPayload(payload.resolvedFeedUrl, payload)
    }
    if (payload.siteUrl?.trim()) {
      DiscoverRemoteSearchService.cachePreviewPayload(payload.siteUrl, payload)
    }
  }

  static cachedPreviewPayload(targetUrl: string): FeedRefreshPayload | undefined {
    const trimmed = targetUrl.trim()
    if (!trimmed) {
      return undefined
    }
    return DiscoverRemoteSearchService.previewCache.get(trimmed)
  }

  static async search(query: string, platform: DiscoverSearchPlatform): Promise<ResolvedDiscoverCandidate[]> {
    const trimmed = query.trim()
    if (!trimmed) {
      return []
    }

    const tasks: Array<Promise<ResolvedDiscoverCandidate[]>> = []

    if (platform === 'all' || platform === 'youtube') {
      tasks.push(DiscoverRemoteSearchService.searchYouTubeChannels(trimmed))
    }

    if (platform === 'all' || platform === 'bilibili') {
      tasks.push(DiscoverRemoteSearchService.searchBilibiliUsers(trimmed))
    }

    if (platform === 'all' || platform === 'x') {
      tasks.push(DiscoverRemoteSearchService.searchXUsers(trimmed))
    }

    if (platform === 'all' || platform === 'instagram') {
      tasks.push(DiscoverRemoteSearchService.searchInstagramUsers(trimmed))
    }

    const groups = await Promise.allSettled(tasks)
    const merged: ResolvedDiscoverCandidate[] = []
    groups.forEach((group: PromiseSettledResult<ResolvedDiscoverCandidate[]>) => {
      if (group.status !== 'fulfilled') {
        return
      }
      group.value.forEach((item: ResolvedDiscoverCandidate) => {
        merged.push(item)
      })
    })
    return dedupeCandidates(merged).slice(0, 12)
  }

  private static async searchXUsers(query: string): Promise<ResolvedDiscoverCandidate[]> {
    const clean = query.trim().replace(/^@+/, '')
    const searchSeeds = await DiscoverRemoteSearchService.searchXUsersByNitter(clean)
    const fallbackSeeds: DiscoverRemoteProfileSeed[] = []
    for (const username of buildQueryVariants(query, 15)) {
      const seed = await DiscoverRemoteSearchService.fetchXProfileSeed(username)
      if (seed) {
        fallbackSeeds.push(seed)
      }
    }

    const dedupedSeeds = dedupeAndLimitDiscoverCandidates(
      [...searchSeeds, ...fallbackSeeds],
      12,
    )

    return dedupedSeeds.map((seed) => withConfiguredRssHubCandidate(
      buildXCandidateFromProfile(seed, SOCIAL_VIEW_MAPPING) as ResolvedDiscoverCandidate,
    ))
  }

  private static async searchXUsersByNitter(query: string): Promise<DiscoverRemoteProfileSeed[]> {
    const clean = query.trim().replace(/^@+/, '')
    if (!clean) {
      return []
    }

    const seeds: DiscoverRemoteProfileSeed[] = []

    for (const nitterInstance of FALLBACK_NITTER_INSTANCES) {
      const request = http.createHttp()
      try {
        const response = await request.request(
          `${nitterInstance}/search?f=users&q=${encodeURIComponent(clean)}`,
          {
            method: http.RequestMethod.GET,
            connectTimeout: 5000,
            readTimeout: 5000,
            header: {
              'User-Agent': 'Mozilla/5.0',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
          },
        )

        if (response.responseCode !== 200) {
          continue
        }

        const html = String(response.result)
        const profiles = parseXProfilesFromSearchHtml(html, clean)
        profiles.forEach((profile) => {
          seeds.push(buildXProfileSeedFromProfile(profile))
        })

        if (seeds.length > 0) {
          break
        }
      } catch (_) {
        // Try the next Nitter instance.
      } finally {
        request.destroy()
      }
    }

    return dedupeAndLimitDiscoverCandidates(seeds, 12)
  }

  private static async fetchXProfileSeed(username: string): Promise<DiscoverRemoteProfileSeed | undefined> {
    const request = http.createHttp()
    try {
      const response = await request.request(
        `https://r.jina.ai/http://x.com/${encodeURIComponent(username)}`,
        {
          method: http.RequestMethod.GET,
          connectTimeout: 8000,
          readTimeout: 8000,
          header: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/plain,text/html;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          },
        },
      )

      if (response.responseCode !== 200) {
        return undefined
      }

      const text = String(response.result)
      if (/Page not found\s*\/\s*X/i.test(text) || /Hmm\.\.\.this page doesn[’']t exist/i.test(text)) {
        return undefined
      }

      const title = (text.match(/Title:\s*([^\n]+?)\s*\(@/i)?.[1] ?? '').trim()
      const imageUrl = (text.match(/https:\/\/pbs\.twimg\.com\/profile_images\/[^\s)\]]+/i)?.[0] ?? '').trim()
      const followers = extractXFollowersFromText(text)
      const snippet = buildProfileAnchorSnippet(
        `https://x.com/${username}`,
        username,
        title,
        imageUrl,
        followers,
      )
      const profile = parseXProfilesFromSearchHtml(snippet, username)[0]
      return profile ? buildXProfileSeedFromProfile(profile) : undefined
    } catch (_) {
      return undefined
    } finally {
      request.destroy()
    }
  }

  private static async searchInstagramUsers(query: string): Promise<ResolvedDiscoverCandidate[]> {
    const clean = query.trim().replace(/^@+/, '')
    const searchSeeds = await DiscoverRemoteSearchService.searchInstagramUsersByTopsearch(clean)
    const variants = buildQueryVariants(query, 30)
    const seedResults = await Promise.allSettled(
      variants.map((username: string) => DiscoverRemoteSearchService.fetchInstagramProfileSeed(username)),
    )
    const fallbackSeeds: DiscoverRemoteProfileSeed[] = []
    seedResults.forEach((result: PromiseSettledResult<DiscoverRemoteProfileSeed | undefined>) => {
      if (result.status === 'fulfilled' && result.value) {
        fallbackSeeds.push(result.value)
      }
    })

    const dedupedSeeds = dedupeAndLimitDiscoverCandidates(
      [...searchSeeds, ...fallbackSeeds],
      12,
    )

    return dedupeCandidates(dedupedSeeds.map((seed: DiscoverRemoteProfileSeed) => withConfiguredRssHubCandidate(
      buildInstagramCandidateFromProfile(seed, SOCIAL_VIEW_MAPPING) as ResolvedDiscoverCandidate,
    )))
  }

  private static async searchInstagramUsersByTopsearch(query: string): Promise<DiscoverRemoteProfileSeed[]> {
    if (!query) {
      return []
    }

    const request = http.createHttp()
    try {
      const response = await request.request(
        `https://www.instagram.com/web/search/topsearch/?query=${encodeURIComponent(query)}&context=user`,
        {
          method: http.RequestMethod.GET,
          connectTimeout: INSTAGRAM_SEARCH_TIMEOUT_MS,
          readTimeout: INSTAGRAM_SEARCH_TIMEOUT_MS,
          header: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://www.instagram.com/',
            'X-IG-App-ID': '936619743392459',
          },
        },
      )

      if (response.responseCode !== 200) {
        return []
      }

      const profiles = parseInstagramProfilesFromTopsearchPayload(JSON.parse(String(response.result)), query)
      return dedupeAndLimitDiscoverCandidates(
        profiles.map((profile) => buildInstagramProfileSeedFromProfile(profile)),
        12,
      )
    } catch (_) {
      return []
    } finally {
      request.destroy()
    }
  }

  private static async fetchInstagramProfileSeed(username: string): Promise<DiscoverRemoteProfileSeed | undefined> {
    const request = http.createHttp()
    try {
      const response = await request.request(
        `https://www.instagram.com/${encodeURIComponent(username)}/`,
        {
          method: http.RequestMethod.GET,
          connectTimeout: INSTAGRAM_SEARCH_TIMEOUT_MS,
          readTimeout: INSTAGRAM_SEARCH_TIMEOUT_MS,
          header: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          },
        },
      )

      if (response.responseCode !== 200) {
        return undefined
      }

      const html = String(response.result)
      const ogTitle = extractMetaContent(html, 'og:title')
      if (isGenericInstagramHtml(html, ogTitle)) {
        return await DiscoverRemoteSearchService.fetchInstagramMirrorProfileSeed(username)
      }

      const rawTitle = (decodeBasicEntities(ogTitle).match(/^(.*?)\s*\(@[^)]+\)/i)?.[1] ?? decodeBasicEntities(ogTitle)).trim()
      const title = formatInstagramFeedTitle(rawTitle, username)
      const imageUrl = extractMetaContent(html, 'og:image').trim()
      const followers = extractXFollowersFromText(extractMetaContent(html, 'og:description'))

      if (!title) {
        return undefined
      }

      const snippet = buildProfileAnchorSnippet(
        `https://www.instagram.com/${username}/`,
        username,
        title,
        imageUrl,
        followers,
      )
      const profile = parseInstagramProfilesFromSearchHtml(snippet, username)[0]
      return profile ? buildInstagramProfileSeedFromProfile(profile) : undefined
    } catch (_) {
      return undefined
    } finally {
      request.destroy()
    }
  }

  private static async fetchInstagramMirrorProfileSeed(username: string): Promise<DiscoverRemoteProfileSeed | undefined> {
    const request = http.createHttp()
    try {
      const response = await request.request(
        `https://dumpor.io/v/${encodeURIComponent(username)}/`,
        {
          method: http.RequestMethod.GET,
          connectTimeout: INSTAGRAM_SEARCH_TIMEOUT_MS,
          readTimeout: INSTAGRAM_SEARCH_TIMEOUT_MS,
          header: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          },
        },
      )

      if (response.responseCode !== 200) {
        return undefined
      }

      const html = String(response.result)
      const ogTitle = extractMetaContent(html, 'og:title')
      const metaDescription = extractMetaContent(html, 'og:description') || extractMetaNameContent(html, 'description')
      const title = formatInstagramFeedTitle(ogTitle, username)
      const followers = extractXFollowersFromText(metaDescription)
      const snippet = buildProfileAnchorSnippet(
        `https://www.instagram.com/${username}/`,
        username,
        title,
        '',
        followers,
      )
      const profile = parseInstagramProfilesFromSearchHtml(snippet, username)[0]
      return profile ? buildInstagramProfileSeedFromProfile(profile) : undefined
    } catch (_) {
      return undefined
    } finally {
      request.destroy()
    }
  }

  private static async searchBilibiliUsers(query: string): Promise<ResolvedDiscoverCandidate[]> {
    const ranked: RankedBilibiliCandidate[] = []
    const seen = new Set<string>()
    const collectByVariants = async (variants: string[]): Promise<void> => {
      for (const variant of variants) {
        const items = await DiscoverRemoteSearchService.searchBilibiliUsersByVariant(variant)
        items.forEach((item: RankedBilibiliCandidate) => {
          const uid = extractBilibiliUidFromCandidate(item.candidate)
          const key = uid || item.candidate.targetUrl
          if (seen.has(key)) {
            return
          }
          seen.add(key)
          ranked.push(item)
        })
      }
    }

    await collectByVariants(candidateQueryVariants(query))

    if (ranked.length === 0) {
      await collectByVariants(fallbackBilibiliQueryVariants(query))
    }

    if (ranked.length === 0) {
      return []
    }

    ranked.sort((left: RankedBilibiliCandidate, right: RankedBilibiliCandidate) => right.score - left.score)
    return ranked.map((item: RankedBilibiliCandidate) => item.candidate).slice(0, 12)
  }

  private static async searchBilibiliUsersByVariant(query: string): Promise<RankedBilibiliCandidate[]> {
    const request = http.createHttp()
    try {
      const response = await request.request(
        `https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${encodeURIComponent(query)}`,
        {
          method: http.RequestMethod.GET,
          connectTimeout: 8000,
          readTimeout: 8000,
          header: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://www.bilibili.com/',
            'Origin': 'https://www.bilibili.com',
          },
        },
      )

      if (response.responseCode !== 200) {
        return await DiscoverRemoteSearchService.searchBilibiliUsersByHtml(query)
      }

      const payload = JSON.parse(String(response.result)) as BilibiliSearchPayload

      if (payload.code === -412) {
        return await DiscoverRemoteSearchService.searchBilibiliUsersByHtml(query)
      }

      if (payload.code !== 0 || !payload.data?.result) {
        return []
      }

      const candidates: RankedBilibiliCandidate[] = []
      payload.data.result.slice(0, 40).forEach((user: BilibiliSearchResult) => {
        const uid = user.mid ? String(user.mid) : ''
        if (!uid) {
          return
        }

        const title = stripHtml(user.uname || `UID ${uid}`)
        const baseDescription = stripHtml(user.usign || '') || normalizeFollowerLabel(user.fans)
        const imageUrl = normalizeImageUrl(typeof user.upic === 'string' ? user.upic : '')
        const titleTier = computeMatchTier(query, title)
        const descriptionTier = computeMatchTier(query, baseDescription)
        const uidTier = computeMatchTier(query, uid)
        const score = titleTier * 1000 + descriptionTier * 180 + uidTier * 80
        if (score <= 0) {
          return
        }

        candidates.push(createRankedBilibiliCandidate(createResolvedCandidate(
          withRssHubBase(`bilibili/user/dynamic/${uid}`),
          title,
          FeedViewType.SocialMedia,
          baseDescription,
          `https://space.bilibili.com/${uid}`,
          'Bilibili',
          imageUrl,
        ), score + 8))
      })

      return candidates
    } catch (_) {
      return await DiscoverRemoteSearchService.searchBilibiliUsersByHtml(query)
    } finally {
      request.destroy()
    }
  }

  private static async searchBilibiliUsersByHtml(query: string): Promise<RankedBilibiliCandidate[]> {
    const request = http.createHttp()
    try {
      const response = await request.request(
        `https://search.bilibili.com/upuser?keyword=${encodeURIComponent(query)}`,
        {
          method: http.RequestMethod.GET,
          connectTimeout: 8000,
          readTimeout: 8000,
          header: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://www.bilibili.com/',
          },
        },
      )

      if (response.responseCode !== 200) {
        return []
      }

      const html = String(response.result)
      const cards = DiscoverRemoteSearchService.parseBilibiliUsersFromHtml(html)
      const candidates: RankedBilibiliCandidate[] = []

      for (const card of cards.slice(0, 12)) {
        const titleTier = computeMatchTier(query, card.title)
        const descriptionTier = computeMatchTier(query, card.description)
        const uidTier = computeMatchTier(query, card.uid)
        const score = titleTier * 1000 + descriptionTier * 180 + uidTier * 80
        if (score <= 0) {
          continue
        }

        const imageUrl = await DiscoverRemoteSearchService.fetchBilibiliAvatarByUid(card.uid)
        candidates.push(createRankedBilibiliCandidate(createResolvedCandidate(
          withRssHubBase(`bilibili/user/dynamic/${card.uid}`),
          card.title,
          FeedViewType.SocialMedia,
          card.description,
          `https://space.bilibili.com/${card.uid}`,
          'Bilibili',
          imageUrl,
        ), score + 8))
      }

      return candidates
    } catch (_) {
      return []
    } finally {
      request.destroy()
    }
  }

  private static parseBilibiliUsersFromHtml(html: string): BilibiliHtmlUserCard[] {
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
        cards.push(createBilibiliHtmlUserCard(uid, title, description))
      }

      matched = regex.exec(html)
    }

    return cards
  }

  private static async fetchBilibiliAvatarByUid(uid: string): Promise<string> {
    const request = http.createHttp()
    try {
      const response = await request.request(
        `https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(uid)}`,
        {
          method: http.RequestMethod.GET,
          connectTimeout: 5000,
          readTimeout: 5000,
          header: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json, text/plain, */*',
            'Referer': `https://space.bilibili.com/${encodeURIComponent(uid)}`,
            'Origin': 'https://www.bilibili.com',
          },
        },
      )

      if (response.responseCode !== 200) {
        return ''
      }

      const payload = JSON.parse(String(response.result)) as BilibiliAvatarPayload

      if (payload.code !== 0) {
        return ''
      }

      return normalizeImageUrl(payload.data?.card?.face ?? '')
    } catch (_) {
      return ''
    } finally {
      request.destroy()
    }
  }

  private static async searchYouTubeChannels(query: string): Promise<ResolvedDiscoverCandidate[]> {
    const request = http.createHttp()
    try {
      const response = await request.request(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%253D%253D`,
        {
          method: http.RequestMethod.GET,
          connectTimeout: 8000,
          readTimeout: 8000,
          header: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          },
        },
      )

      if (response.responseCode !== 200) {
        return []
      }

      const html = String(response.result)
      const channels = DiscoverRemoteSearchService.parseYouTubeChannels(html)
      return channels.slice(0, 8).map((channel: ParsedYouTubeChannel) => createResolvedCandidate(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel.channelId)}`,
        channel.title,
        FeedViewType.Videos,
        'YouTube 频道',
        `https://www.youtube.com/channel/${channel.channelId}`,
        'YouTube',
        channel.imageUrl,
      ))
    } catch (_) {
      return []
    } finally {
      request.destroy()
    }
  }

  private static parseYouTubeChannels(html: string): ParsedYouTubeChannel[] {
    const results: ParsedYouTubeChannel[] = []
    const seen = new Set<string>()
    const regex = /"channelId":"([^"]+)"[\s\S]{0,1800}?"title":\{"simpleText":"([^"]+)"|"title":\{"runs":\[\{"text":"([^"]+)"[\s\S]{0,1600}?"thumbnail":\{"thumbnails":\[(.*?)\]\}/g
    let matched: RegExpExecArray | null = regex.exec(html)

    while (matched) {
      const channelId = matched[1] ?? ''
      const title = decodeBasicEntities(matched[2] || matched[3] || '').trim()
      const thumbBlock = matched[4] || ''
      const thumbMatch = thumbBlock.match(/"url":"([^"]+)"/)
      const imageUrl = thumbMatch?.[1] ? decodeBasicEntities(thumbMatch[1]) : ''

      if (channelId && title && !seen.has(channelId)) {
        seen.add(channelId)
        results.push(createParsedYouTubeChannel(channelId, title, imageUrl))
      }

      matched = regex.exec(html)
    }

    return results
  }
}
