import type { FeedWithCount } from '../../../shared/types'
import { FeedViewType } from '../../../shared/types'
import { remapBilibiliFeedUrlToView } from '../../../shared/bilibili-feed-url'
import { inferDiscoverFeedViewFromUrl } from './discover-feed'

const RECOMMENDED_CATEGORY = 'Recommended'

export interface DiscoverSubscribeTarget {
  feedId?: string
  url: string
  title?: string
  siteUrl?: string
  imageUrl?: string
  description?: string
  category?: string
  view?: FeedViewType
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
  }
}

export function resolveDiscoverSubscribeView(
  target: DiscoverSubscribeTarget,
  existingFeed?: Pick<FeedWithCount, 'view' | 'url'> | null,
): FeedViewType {
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

export function canonicalizeDiscoverRoute(inputUrl: string): string {
  const raw = (inputUrl || '').trim()
  if (!raw) return ''

  let routeWithQuery = ''
  const rsshubMatch = raw.match(/^rsshub:\/\/+(.+)$/i)
  if (rsshubMatch?.[1]) {
    routeWithQuery = rsshubMatch[1].replace(/^\/+/, '')
  } else {
    try {
      const parsed = new URL(raw)
      routeWithQuery = `${parsed.pathname.replace(/^\/+/, '')}${parsed.search || ''}`
    } catch {
      return raw.toLowerCase()
    }
  }

  const [pathPart = '', queryPart = ''] = routeWithQuery.split('?', 2)
  let path = pathPart.toLowerCase()
  path = path.replace(
    /^(picnob(?:\.info)?|pixnoy|piokok)\/user\//i,
    'instagram/user/',
  )
  path = path.replace(
    /^(?:x|twitter)\/user\/([^/?#]+)/i,
    (_match, user: string) =>
      `twitter/user/${decodeURIComponent(user).replace(/^@/, '').toLowerCase()}`,
  )

  if (/^instagram\/user\//i.test(path) || /^twitter\/user\//i.test(path)) {
    const search = new URLSearchParams(queryPart || '')
    search.delete('limit')
    const query = search.toString()
    return `${path}${query ? `?${query}` : ''}`
  }
  return `${path}${queryPart ? `?${queryPart}` : ''}`
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
