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
} from '../../coordinators/discover/DiscoverRemoteSearchParsing'
import { formatInstagramFeedTitle } from '../../utils/social/SocialFeedTitles'
import {
  decodeBasicEntities,
  extractMetaContent,
  extractMetaNameContent,
  stripHtml,
} from '../../utils/HtmlParser'
import {
  INSTAGRAM_SEARCH_TIMEOUT_MS,
  BASIC_BROWSER_USER_AGENT,
  DEFAULT_ACCEPT_LANGUAGE,
  ACCEPT_HTML,
  ACCEPT_JSON,
  INSTAGRAM_REFERER,
  INSTAGRAM_APP_ID,
} from '../../AppConfig'
import { ResolvedDiscoverCandidate } from '../discover/DiscoverTypes'
import {
  SOCIAL_VIEW_MAPPING,
  buildProfileAnchorSnippet,
} from './SharedSearchHelpers'
import { runSocialProfileSearch, SocialPrimarySearch, SocialProfileFetch, SocialCandidateBuilder } from './SearchPipeline'

export async function searchInstagramUsers(query: string, rsshubBase: string): Promise<ResolvedDiscoverCandidate[]> {
  return runSocialProfileSearch(
    query,
    rsshubBase,
    searchInstagramUsersByTopsearch,
    fetchInstagramProfileSeed,
    buildInstagramCandidateFromProfile as SocialCandidateBuilder,
    SOCIAL_VIEW_MAPPING,
  )
}

function isGenericInstagramHtml(html: string, ogTitle: string): boolean {
  const normalizedTitle = stripHtml(ogTitle).trim().toLowerCase()
  if (!normalizedTitle || normalizedTitle === 'instagram') {
    return true
  }
  return /log into instagram/i.test(html) || /create an account or log in to instagram/i.test(html)
}

async function searchInstagramUsersByTopsearch(query: string): Promise<DiscoverRemoteProfileSeed[]> {
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
          'User-Agent': BASIC_BROWSER_USER_AGENT,
          'Accept': ACCEPT_JSON,
          'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
          'Referer': INSTAGRAM_REFERER,
          'X-IG-App-ID': INSTAGRAM_APP_ID,
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

    if (response.responseCode !== 200) {
      return undefined
    }

    const html = String(response.result)
    const ogTitle = extractMetaContent(html, 'og:title')
    if (isGenericInstagramHtml(html, ogTitle)) {
      return await fetchInstagramMirrorProfileSeed(username)
    }

    const rawTitle = (decodeBasicEntities(ogTitle).match(/^(.*?)\s*\(@[^)]+\)/i)?.[1] ?? decodeBasicEntities(ogTitle)).trim()
    const title = formatInstagramFeedTitle(rawTitle, username)
    if (!title) {
      return undefined
    }

    const imageUrl = extractMetaContent(html, 'og:image').trim()
    const followers = extractXFollowersFromText(extractMetaContent(html, 'og:description'))
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
