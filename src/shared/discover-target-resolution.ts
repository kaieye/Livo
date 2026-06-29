import { remapBilibiliFeedUrlToView } from './bilibili-feed-url'
import {
  canonicalizeDiscoverRoute,
  inferDiscoverFeedViewFromUrl,
} from './subscription-intake'
import { FeedViewType, type FeedWithCount } from './types'

const RECOMMENDED_CATEGORY = 'Recommended'

export interface DiscoverSubscribeTargetMetadata {
  fakeId?: string
  source?: 'wechat-rss'
  requiresLogin?: boolean
}

export interface DiscoverSubscribeTarget {
  feedId?: string
  url: string
  title?: string
  siteUrl?: string
  imageUrl?: string
  description?: string
  category?: string
  view?: FeedViewType
  metadata?: DiscoverSubscribeTargetMetadata
}

export interface ResolvedDiscoverSubscribeConfig {
  existingFeed: FeedWithCount | null
  effectiveUrl: string
  effectiveTarget: DiscoverSubscribeTarget
  isEditMode: boolean
  displayTitle: string
  displayHost: string
  categoryOptions: string[]
  initialTitle: string
  initialCategory: string
  initialView: FeedViewType
}

export const DISCOVER_SUBSCRIBE_VIEW_OPTIONS: readonly FeedViewType[] = [
  FeedViewType.Articles,
  FeedViewType.SocialMedia,
  FeedViewType.Videos,
  FeedViewType.Pictures,
]

export function parseDiscoverSubscribeTarget(
  search: string,
): DiscoverSubscribeTarget {
  const params = new URLSearchParams(search)
  const url = params.get('url') || params.get('targetUrl') || ''
  const view = parseFeedViewType(params.get('view'))
  return {
    feedId: params.get('feedId') || undefined,
    url,
    title: params.get('title') || params.get('targetTitle') || undefined,
    siteUrl: params.get('siteUrl') || undefined,
    imageUrl: params.get('imageUrl') || undefined,
    description: params.get('description') || undefined,
    category: params.get('category') || undefined,
    view,
    metadata: {
      fakeId: params.get('fakeId') || undefined,
      source: params.get('source') === 'wechat-rss' ? 'wechat-rss' : undefined,
      requiresLogin: params.get('requiresLogin') === 'true' ? true : undefined,
    },
  }
}

export function resolveDiscoverSubscribeView(
  target: DiscoverSubscribeTarget,
  existingFeed?: Pick<FeedWithCount, 'view' | 'url'> | null,
): FeedViewType {
  if (target.metadata?.source === 'wechat-rss') {
    return FeedViewType.Articles
  }
  return (
    existingFeed?.view ??
    target.view ??
    inferDiscoverFeedViewFromUrl(target.url)
  )
}

export function resolveDiscoverSubscribeTitle(
  target: DiscoverSubscribeTarget,
  existingFeed?: Pick<FeedWithCount, 'title' | 'url'> | null,
): string {
  const title = (existingFeed?.title || target.title || '').trim()
  if (title) return title
  return inferResultTitleFromUrl(existingFeed?.url || target.url)
}

export function resolveDiscoverSubscribeCategory(
  target: DiscoverSubscribeTarget,
  existingFeed?: Pick<FeedWithCount, 'category' | 'folder'> | null,
): string {
  return normalizeDiscoverCategory(
    existingFeed?.folder || existingFeed?.category || target.category || '',
  )
}

export function resolveDiscoverSubscribeUrl(
  target: DiscoverSubscribeTarget,
  selectedView: FeedViewType,
  existingFeed?: Pick<FeedWithCount, 'url'> | null,
): string {
  const sourceUrl = target.url || existingFeed?.url || ''
  return remapBilibiliFeedUrlToView(sourceUrl, selectedView)
}

export function normalizeDiscoverCategory(category: string): string {
  const value = category.trim()
  if (value === RECOMMENDED_CATEGORY) return ''
  return value
}

export function buildDiscoverCategoryOptions(
  feeds: Array<Pick<FeedWithCount, 'category' | 'folder'>>,
): string[] {
  const seen = new Set<string>()
  for (const feed of feeds) {
    const value = normalizeDiscoverCategory(feed.folder || feed.category || '')
    if (value) seen.add(value)
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b))
}

export function resolveDiscoverSubscribeConfig(input: {
  feeds: FeedWithCount[]
  target: DiscoverSubscribeTarget
}): ResolvedDiscoverSubscribeConfig {
  const { feeds, target } = input
  const existingFeed = findDiscoverSubscribeFeed(feeds, target)
  const effectiveUrl = existingFeed?.url || target.url
  const effectiveTarget: DiscoverSubscribeTarget = {
    ...target,
    url: effectiveUrl,
    title: target.title || existingFeed?.title,
    siteUrl: target.siteUrl || existingFeed?.siteUrl,
    imageUrl: target.imageUrl || existingFeed?.imageUrl,
    description: target.description || existingFeed?.description,
    category: target.category || existingFeed?.folder || existingFeed?.category,
    view: target.view ?? existingFeed?.view,
  }

  const displayTitle = resolveDiscoverSubscribeTitle(target, existingFeed)

  return {
    existingFeed,
    effectiveUrl,
    effectiveTarget,
    isEditMode: !!existingFeed,
    displayTitle,
    displayHost: hostOfDiscoverTarget(effectiveTarget),
    categoryOptions: buildDiscoverCategoryOptions(feeds),
    initialTitle: displayTitle,
    initialCategory: resolveDiscoverSubscribeCategory(target, existingFeed),
    initialView: resolveDiscoverSubscribeView(target, existingFeed),
  }
}

export function findDiscoverSubscribeFeed(
  feeds: FeedWithCount[],
  target: DiscoverSubscribeTarget,
): FeedWithCount | null {
  if (target.feedId) {
    const byId = feeds.find((feed) => feed.id === target.feedId)
    if (byId) return byId
  }

  const targetView = target.view ?? inferDiscoverFeedViewFromUrl(target.url)
  return (
    feeds.find((feed) => feedMatchesDiscoverTarget(feed, target, targetView)) ??
    null
  )
}

export function feedMatchesDiscoverTarget(
  feed: Pick<FeedWithCount, 'url' | 'siteUrl'>,
  target: DiscoverSubscribeTarget,
  selectedView: FeedViewType,
): boolean {
  const mappedTargetUrl = resolveDiscoverSubscribeUrl(target, selectedView)
  const targetCandidates = [
    target.url,
    mappedTargetUrl,
    target.siteUrl || '',
  ].map(normalizeFeedUrlForSubscribe)
  const feedCandidates = [feed.url, feed.siteUrl || ''].map(
    normalizeFeedUrlForSubscribe,
  )

  if (
    feedCandidates.some((feedUrl) =>
      feedUrl ? targetCandidates.includes(feedUrl) : false,
    )
  ) {
    return true
  }

  const feedRoute = canonicalizeDiscoverRoute(feed.url)
  const targetRoutes = [
    canonicalizeDiscoverRoute(target.url),
    canonicalizeDiscoverRoute(mappedTargetUrl),
    canonicalizeDiscoverRoute(target.siteUrl || ''),
  ].filter(Boolean)

  return !!feedRoute && targetRoutes.includes(feedRoute)
}

export function hostOfDiscoverTarget(target: DiscoverSubscribeTarget): string {
  return hostOf(target.siteUrl || target.url)
}

function parseFeedViewType(value: string | null): FeedViewType | undefined {
  if (value === null) return undefined
  const parsed = Number(value)
  return DISCOVER_SUBSCRIBE_VIEW_OPTIONS.includes(parsed as FeedViewType)
    ? (parsed as FeedViewType)
    : undefined
}

function normalizeFeedUrlForSubscribe(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase()
}

function inferResultTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname

    const bili = path.match(
      /\/bilibili\/user\/(?:video|dynamic|article)\/(\d+)/i,
    )
    if (bili?.[1]) return `UID ${bili[1]} - Bilibili`

    const x = path.match(/\/twitter\/user\/([a-zA-Z0-9_]+)/i)
    if (x?.[1]) return `@${x[1]} - X`

    const ig = path.match(/\/instagram\/user\/([^/?#]+)/i)
    if (ig?.[1]) return `@${decodeURIComponent(ig[1])} - Instagram`

    return `${parsed.hostname.replace(/^www\./i, '')} - RSS`
  } catch {
    return url
  }
}

function hostOf(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

export { canonicalizeDiscoverRoute }
