import { Feed } from '../models/LivoModels'
import { canonicalFeedUrl, normalizeSocialFeedDescription } from '../utils/social/SocialFeedTitles'
import { resolvePreferredStoredFeedImageUrl, resolvePreferredStoredFeedTitle } from '../utils/social/SocialFeedPresentation'

export interface NormalizedFeedMetadata {
  url: string
  siteUrl: string
  title: string
  description: string
}

export function normalizeFeedPayloadMetadata(
  currentFeed: Feed,
  resolvedFeedUrl: string,
  feedTitle: string,
  siteUrl: string,
  imageUrl: string,
  description: string,
): NormalizedFeedMetadata {
  const nextUrl = canonicalFeedUrl(
    resolvedFeedUrl || currentFeed.url,
    siteUrl || currentFeed.siteUrl || '',
  ) || currentFeed.url
  const nextSiteUrl = siteUrl || currentFeed.siteUrl || ''
  const nextTitle = resolvePreferredStoredFeedTitle(
    currentFeed.title,
    feedTitle || '',
    nextUrl,
    nextSiteUrl,
  )
  const nextDescription = normalizeSocialFeedDescription(
    description || currentFeed.description || '',
    nextUrl,
    nextSiteUrl,
  )
  return { url: nextUrl, siteUrl: nextSiteUrl, title: nextTitle, description: nextDescription }
}

export function resolveNormalizedFeedImageUrl(
  currentFeed: Feed,
  resolvedImageUrl: string,
): string {
  return resolvePreferredStoredFeedImageUrl(
    currentFeed.imageUrl || '',
    resolvedImageUrl,
  )
}
