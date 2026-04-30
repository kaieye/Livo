import http from '@ohos.net.http'
import {
  buildInstagramCandidateFromProfile,
  buildInstagramProfileSeedFromProfile,
  dedupeAndLimitDiscoverCandidates,
  DiscoverRemoteProfileSeed,
  DiscoverRemoteViewMapping,
  extractXFollowersFromText,
  parseInstagramProfilesFromSearchHtml,
  parseInstagramProfilesFromTopsearchPayload,
} from '../../utils/DiscoverRemoteSearchParsing'
import { formatInstagramFeedTitle } from '../../utils/SocialFeedTitles'
import { decodeBasicEntities, extractMetaContent, extractMetaNameContent, escapeHtml } from '../../utils/HtmlParser'
import {
  INSTAGRAM_SEARCH_TIMEOUT_MS,
  BASIC_BROWSER_USER_AGENT,
  DEFAULT_ACCEPT_LANGUAGE,
  ACCEPT_HTML,
  ACCEPT_JSON,
  INSTAGRAM_REFERER,
  INSTAGRAM_APP_ID,
} from '../../AppConfig'
import { ResolvedDiscoverCandidate } from '../DiscoverService'
import { FeedViewType } from '../../models/LivoModels'

const SOCIAL_VIEW_MAPPING: DiscoverRemoteViewMapping = {
  x: FeedViewType.SocialMedia,
  instagram: FeedViewType.Pictures,
}

function buildQueryVariants(query: string, maxLength: number): string[] {
  const variants: string[] = []
  const push = (value: string): void => {
    const trimmed = value.trim().replace(/^@+/, '')
    if (!trimmed || trimmed.length > maxLength || variants.includes(trimmed)) return
    variants.push(trimmed)
  }
  push(query)
  push(query.toLowerCase())
  push(query.replace(/\s+/g, ''))
  push(query.replace(/\s+/g, '').toLowerCase())
  return variants
}

function buildProfileAnchorSnippet(profileUrl: string, username: string, title: string, imageUrl: string, followers: string): string {
  const safeUrl = escapeHtml(profileUrl)
  const safeImageUrl = imageUrl ? ` <img src="${escapeHtml(imageUrl)}" />` : ''
  const safeUsername = username ? ` <span>@${escapeHtml(username)}</span>` : ''
  const safeTitle = title ? ` <span>${escapeHtml(title)}</span>` : ''
  const safeFollowers = followers ? ` <span>${escapeHtml(followers)}</span>` : ''
  return `<a href="${safeUrl}">${safeImageUrl}${safeUsername}${safeTitle}${safeFollowers}</a>`
}

function isGenericInstagramHtml(html: string, ogTitle: string): boolean {
  const normalizedTitle = ogTitle.trim().toLowerCase()
  if (!normalizedTitle || normalizedTitle === 'instagram') return true
  return /log into instagram/i.test(html) || /create an account or log in to instagram/i.test(html)
}

function dedupeCandidates(items: ResolvedDiscoverCandidate[]): ResolvedDiscoverCandidate[] {
  const result: ResolvedDiscoverCandidate[] = []
  items.forEach((item) => {
    const idx = result.findIndex((c) => c.targetUrl === item.targetUrl)
    if (idx < 0) {
      result.push(item)
    } else if (scoreCandidateRichness(item) > scoreCandidateRichness(result[idx])) {
      result[idx] = item
    }
  })
  return result
}

function scoreCandidateRichness(candidate: ResolvedDiscoverCandidate): number {
  let score = 0
  if (candidate.imageUrl) score += 4
  if (candidate.description && !/^(?:X|Instagram|YouTube)\s+(?:用户|频道)$/.test(candidate.description)) score += 2
  return score
}

function withConfiguredRssHubCandidate(candidate: ResolvedDiscoverCandidate, rsshubBase: string): ResolvedDiscoverCandidate {
  if (!candidate.targetUrl.includes('/instagram/user/')) return candidate
  const updated: ResolvedDiscoverCandidate = {
    targetUrl: candidate.targetUrl.replace(/^https?:\/\/[^/]+/i, rsshubBase),
    targetTitle: candidate.targetTitle,
    targetView: candidate.targetView,
    description: candidate.description,
    siteUrl: candidate.siteUrl,
    sourceKind: candidate.sourceKind,
    imageUrl: candidate.imageUrl,
  }
  return updated
}

export async function searchInstagramUsers(query: string, rsshubBase: string): Promise<ResolvedDiscoverCandidate[]> {
  const clean = query.trim().replace(/^@+/, '')
  const searchSeeds = await searchInstagramUsersByTopsearch(clean)
  const variants = buildQueryVariants(query, 30)
  const seedResults = await Promise.allSettled(
    variants.map((username) => fetchInstagramProfileSeed(username)),
  )
  const fallbackSeeds: DiscoverRemoteProfileSeed[] = []
  seedResults.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) fallbackSeeds.push(result.value)
  })

  const dedupedSeeds = dedupeAndLimitDiscoverCandidates([...searchSeeds, ...fallbackSeeds], 12)
  return dedupeCandidates(dedupedSeeds.map((seed) => withConfiguredRssHubCandidate(
    buildInstagramCandidateFromProfile(seed, SOCIAL_VIEW_MAPPING) as ResolvedDiscoverCandidate,
    rsshubBase,
  )))
}

async function searchInstagramUsersByTopsearch(query: string): Promise<DiscoverRemoteProfileSeed[]> {
  if (!query) return []
  const request = http.createHttp()
  try {
    const response = await request.request(
      `https://www.instagram.com/web/search/topsearch/?query=${encodeURIComponent(query)}&context=user`,
      {
        method: http.RequestMethod.GET,
        connectTimeout: INSTAGRAM_SEARCH_TIMEOUT_MS,
        readTimeout: INSTAGRAM_SEARCH_TIMEOUT_MS,
        header: {
          'User-Agent': BASIC_BROWSER_USER_AGENT,
          'Accept': ACCEPT_JSON,
          'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
          'Referer': INSTAGRAM_REFERER,
          'X-IG-App-ID': INSTAGRAM_APP_ID,
        },
      },
    )
    if (response.responseCode !== 200) return []
    const profiles = parseInstagramProfilesFromTopsearchPayload(JSON.parse(String(response.result)), query)
    return dedupeAndLimitDiscoverCandidates(profiles.map((p) => buildInstagramProfileSeedFromProfile(p)), 12)
  } catch (_) {
    return []
  } finally {
    request.destroy()
  }
}

async function fetchInstagramProfileSeed(username: string): Promise<DiscoverRemoteProfileSeed | undefined> {
  const request = http.createHttp()
  try {
    const response = await request.request(
      `https://www.instagram.com/${encodeURIComponent(username)}/`,
      {
        method: http.RequestMethod.GET,
        connectTimeout: INSTAGRAM_SEARCH_TIMEOUT_MS,
        readTimeout: INSTAGRAM_SEARCH_TIMEOUT_MS,
        header: {
          'User-Agent': BASIC_BROWSER_USER_AGENT,
          'Accept': ACCEPT_HTML,
          'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
        },
      },
    )
    if (response.responseCode !== 200) return undefined
    const html = String(response.result)
    const ogTitle = extractMetaContent(html, 'og:title')
    if (isGenericInstagramHtml(html, ogTitle)) {
      return await fetchInstagramMirrorProfileSeed(username)
    }
    const rawTitle = (decodeBasicEntities(ogTitle).match(/^(.*?)\s*\(@[^)]+\)/i)?.[1] ?? decodeBasicEntities(ogTitle)).trim()
    const title = formatInstagramFeedTitle(rawTitle, username)
    if (!title) return undefined
    const imageUrl = extractMetaContent(html, 'og:image').trim()
    const followers = extractXFollowersFromText(extractMetaContent(html, 'og:description'))
    const snippet = buildProfileAnchorSnippet(`https://www.instagram.com/${username}/`, username, title, imageUrl, followers)
    const profile = parseInstagramProfilesFromSearchHtml(snippet, username)[0]
    return profile ? buildInstagramProfileSeedFromProfile(profile) : undefined
  } catch (_) {
    return undefined
  } finally {
    request.destroy()
  }
}

async function fetchInstagramMirrorProfileSeed(username: string): Promise<DiscoverRemoteProfileSeed | undefined> {
  const request = http.createHttp()
  try {
    const response = await request.request(
      `https://dumpor.io/v/${encodeURIComponent(username)}/`,
      {
        method: http.RequestMethod.GET,
        connectTimeout: INSTAGRAM_SEARCH_TIMEOUT_MS,
        readTimeout: INSTAGRAM_SEARCH_TIMEOUT_MS,
        header: {
          'User-Agent': BASIC_BROWSER_USER_AGENT,
          'Accept': ACCEPT_HTML,
          'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
        },
      },
    )
    if (response.responseCode !== 200) return undefined
    const html = String(response.result)
    const ogTitle = extractMetaContent(html, 'og:title')
    const metaDescription = extractMetaContent(html, 'og:description') || extractMetaNameContent(html, 'description')
    const title = formatInstagramFeedTitle(ogTitle, username)
    const followers = extractXFollowersFromText(metaDescription)
    const snippet = buildProfileAnchorSnippet(`https://www.instagram.com/${username}/`, username, title, '', followers)
    const profile = parseInstagramProfilesFromSearchHtml(snippet, username)[0]
    return profile ? buildInstagramProfileSeedFromProfile(profile) : undefined
  } catch (_) {
    return undefined
  } finally {
    request.destroy()
  }
}
