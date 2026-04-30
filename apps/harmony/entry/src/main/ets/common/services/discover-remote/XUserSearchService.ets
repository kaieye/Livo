import http from '@ohos.net.http'
import { FeedViewType } from '../../models/LivoModels'
import {
  buildXCandidateFromProfile,
  buildXProfileSeedFromProfile,
  dedupeAndLimitDiscoverCandidates,
  DiscoverRemoteProfileSeed,
  DiscoverRemoteViewMapping,
  extractXFollowersFromText,
  parseXProfilesFromSearchHtml,
} from '../../utils/DiscoverRemoteSearchParsing'
import { escapeHtml } from '../../utils/HtmlParser'
import {
  FALLBACK_NITTER_INSTANCES,
  BASIC_BROWSER_USER_AGENT,
  DEFAULT_ACCEPT_LANGUAGE,
  ACCEPT_HTML,
  ACCEPT_TEXT_OR_HTML,
  SHORT_REQUEST_TIMEOUT_MS,
  MEDIUM_REQUEST_TIMEOUT_MS,
} from '../../AppConfig'
import { ResolvedDiscoverCandidate } from '../DiscoverService'

const SOCIAL_VIEW_MAPPING: DiscoverRemoteViewMapping = {
  x: FeedViewType.SocialMedia,
  instagram: FeedViewType.Pictures,
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

export async function searchXUsers(query: string, rsshubBase: string): Promise<ResolvedDiscoverCandidate[]> {
  const clean = query.trim().replace(/^@+/, '')
  const searchSeeds = await searchXUsersByNitter(clean)
  const fallbackSeeds: DiscoverRemoteProfileSeed[] = []
  for (const username of buildQueryVariants(query, 15)) {
    const seed = await fetchXProfileSeed(username)
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
    rsshubBase,
  ))
}

async function searchXUsersByNitter(query: string): Promise<DiscoverRemoteProfileSeed[]> {
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
          connectTimeout: SHORT_REQUEST_TIMEOUT_MS,
          readTimeout: SHORT_REQUEST_TIMEOUT_MS,
          header: {
            'User-Agent': BASIC_BROWSER_USER_AGENT,
            'Accept': ACCEPT_HTML,
            'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
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
    } finally {
      request.destroy()
    }
  }

  return dedupeAndLimitDiscoverCandidates(seeds, 12)
}

async function fetchXProfileSeed(username: string): Promise<DiscoverRemoteProfileSeed | undefined> {
  const request = http.createHttp()
  try {
    const response = await request.request(
      `https://r.jina.ai/http://x.com/${encodeURIComponent(username)}`,
      {
        method: http.RequestMethod.GET,
        connectTimeout: MEDIUM_REQUEST_TIMEOUT_MS,
        readTimeout: MEDIUM_REQUEST_TIMEOUT_MS,
        header: {
          'User-Agent': BASIC_BROWSER_USER_AGENT,
          'Accept': ACCEPT_TEXT_OR_HTML,
          'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
        },
      },
    )

    if (response.responseCode !== 200) {
      return undefined
    }

    const text = String(response.result)
    if (/Page not found\s*\/\s*X/i.test(text) || /Hmm\.\.\.this page doesn['']t exist/i.test(text)) {
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

function withConfiguredRssHubCandidate(candidate: ResolvedDiscoverCandidate, rsshubBase: string): ResolvedDiscoverCandidate {
  if (!candidate.targetUrl.includes('/x/user/') && !candidate.targetUrl.includes('/instagram/user/')) {
    return candidate
  }

  return {
    targetUrl: candidate.targetUrl.replace(/^https?:\/\/[^/]+/i, rsshubBase),
    targetTitle: candidate.targetTitle,
    targetView: candidate.targetView,
    description: candidate.description,
    siteUrl: candidate.siteUrl,
    sourceKind: candidate.sourceKind,
    imageUrl: candidate.imageUrl,
  }
}
