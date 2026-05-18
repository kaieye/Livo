import { FeedViewType } from '../../models/LivoModels'
import { escapeHtml } from '../../utils/HtmlParser'
import { DiscoverRemoteViewMapping } from '../../utils/discover/DiscoverRemoteSearchParsing'
import { ResolvedDiscoverCandidate } from '../discover/DiscoverTypes'

/**
 * Shared helpers for the social discover-remote search adapters (X / Instagram).
 *
 * Two adapters consuming the same helpers = real seam. The Bilibili / YouTube
 * adapters keep their own helpers because their query-variant and URL-rewrite
 * shapes differ.
 */

export const SOCIAL_VIEW_MAPPING: DiscoverRemoteViewMapping = {
  x: FeedViewType.SocialMedia,
  instagram: FeedViewType.Pictures,
}

/** Generate trimmed/lowercased/space-stripped query variants, capped by maxLength. */
export function buildSocialQueryVariants(query: string, maxLength: number): string[] {
  const variants: string[] = []
  const push = (value: string): void => {
    const trimmed = value.trim().replace(/^@+/, '')
    if (!trimmed || trimmed.length > maxLength || variants.includes(trimmed)) {
      return
    }
    variants.push(trimmed)
  }

  push(query)
  push(query.toLowerCase())
  push(query.replace(/\s+/g, ''))
  push(query.replace(/\s+/g, '').toLowerCase())
  return variants
}

/** Build a synthetic anchor snippet that the social-profile parsers can read back. */
export function buildProfileAnchorSnippet(
  profileUrl: string,
  username: string,
  title: string,
  imageUrl: string,
  followers: string,
): string {
  const safeUrl = escapeHtml(profileUrl)
  const safeImage = imageUrl ? ` <img src="${escapeHtml(imageUrl)}" />` : ''
  const safeUsername = username ? ` <span>@${escapeHtml(username)}</span>` : ''
  const safeTitle = title ? ` <span>${escapeHtml(title)}</span>` : ''
  const safeFollowers = followers ? ` <span>${escapeHtml(followers)}</span>` : ''
  return `<a href="${safeUrl}">${safeImage}${safeUsername}${safeTitle}${safeFollowers}</a>`
}

/** Rewrite an X / Instagram candidate's targetUrl host to the configured RSSHub base. */
export function withConfiguredRssHubCandidate(
  candidate: ResolvedDiscoverCandidate,
  rsshubBase: string,
): ResolvedDiscoverCandidate {
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

function scoreCandidateRichness(candidate: ResolvedDiscoverCandidate): number {
  let score = 0
  if (candidate.imageUrl) {
    score += 4
  }
  if (candidate.description && !/^(?:X|Instagram|YouTube)\s+(?:用户|频道)$/.test(candidate.description)) {
    score += 2
  }
  return score
}

/** Dedupe by targetUrl, keeping the richer (more imagery / more descriptive) candidate. */
export function dedupeCandidates(items: ResolvedDiscoverCandidate[]): ResolvedDiscoverCandidate[] {
  const result: ResolvedDiscoverCandidate[] = []
  items.forEach((item: ResolvedDiscoverCandidate) => {
    const existing = result.findIndex((candidate: ResolvedDiscoverCandidate) => candidate.targetUrl === item.targetUrl)
    if (existing < 0) {
      result.push(item)
      return
    }
    if (scoreCandidateRichness(item) > scoreCandidateRichness(result[existing])) {
      result[existing] = item
    }
  })
  return result
}
