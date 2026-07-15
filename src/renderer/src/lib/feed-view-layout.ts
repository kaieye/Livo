import { FeedViewType } from '../../../shared/types'

/**
 * The set of FeedViewTypes that render with the wide 2-column layout
 * (sidebar + full-width content) instead of the article 3-column layout.
 * Articles is narrow; Social/Videos/Pictures are wide.
 */
const WIDE_LAYOUT_VIEWS: readonly FeedViewType[] = [
  FeedViewType.SocialMedia,
  FeedViewType.Videos,
  FeedViewType.Pictures,
]

/**
 * Whether a given view uses the wide 2-column layout.
 * Returns false for null and for Articles.
 */
export function isWideLayoutView(view: FeedViewType | null): boolean {
  return view !== null && WIDE_LAYOUT_VIEWS.includes(view)
}

/**
 * Resolve the effective view used for layout decisions.
 *
 * Rule: when an explicit `activeView` is set, it always wins. When `activeView`
 * is null (the "All" view) but a wide-layout feed (Social/Videos/Pictures) is
 * selected, fall back to that feed's view so it renders with the proper wide
 * layout. Historical X feeds that were saved as Articles are also promoted to
 * the social view when their feed URL identifies a Nitter or RSSHub X user feed.
 */
export function resolveEffectiveView(input: {
  activeView: FeedViewType | null
  selectedFeed?: { view?: FeedViewType | null; url?: string } | null
}): FeedViewType | null {
  if (input.activeView !== null) return input.activeView

  const feedView = input.selectedFeed?.view ?? null
  if (isWideLayoutView(feedView)) return feedView

  return isXSocialFeedUrl(input.selectedFeed?.url)
    ? FeedViewType.SocialMedia
    : null
}

function isXSocialFeedUrl(url?: string): boolean {
  if (!url) return false

  try {
    const { hostname, pathname } = new URL(url)
    const host = hostname.toLowerCase()

    if (host.includes('nitter')) {
      return /^\/[^/]+\/rss\/?$/i.test(pathname)
    }

    return /^\/(?:twitter|x)\/user\/[a-zA-Z0-9_]+\/?$/i.test(pathname)
  } catch {
    return /^.*\/(?:twitter|x)\/user\/[a-zA-Z0-9_]+\/?(?:[?#].*)?$/i.test(url)
  }
}

export function shouldUseSocialDetailOverlay(input: {
  activeView: FeedViewType | null
  selectedFeedId: string | null
  selectedEntryFeedView?: FeedViewType | null
  selectedEntryFeedUrl?: string
}): boolean {
  const isSocialFeed =
    input.selectedEntryFeedView === FeedViewType.SocialMedia ||
    isXSocialFeedUrl(input.selectedEntryFeedUrl)

  return (
    input.activeView === null && input.selectedFeedId === null && isSocialFeed
  )
}
