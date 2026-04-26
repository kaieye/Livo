import {
  resolvePreferredStoredFeedImageUrl,
  resolveSocialFeedDisplayImageUrl,
} from './SocialFeedPresentation'

export interface DiscoverAvatarPresentationInput {
  imageUrl: string
  targetUrl: string
  siteUrl: string
  title: string
  cachedImageUrl?: string
  cachedSiteUrl?: string
  cachedTitle?: string
  cachedResolvedFeedUrl?: string
  hydratedImageUrl?: string
}

export function resolveDiscoverAvatarImageUrl(
  input: DiscoverAvatarPresentationInput,
): string {
  const previewImageUrl = resolvePreferredStoredFeedImageUrl(
    input.imageUrl,
    input.cachedImageUrl || '',
  )
  const imageUrl = resolvePreferredStoredFeedImageUrl(
    previewImageUrl,
    input.hydratedImageUrl || '',
  )
  const targetUrl = (
    input.cachedResolvedFeedUrl ||
    input.targetUrl ||
    ''
  ).trim()
  const siteUrl = (input.cachedSiteUrl || input.siteUrl || '').trim()
  const title = (input.cachedTitle || input.title || '').trim()

  return resolveSocialFeedDisplayImageUrl(imageUrl, targetUrl, siteUrl, title)
}
