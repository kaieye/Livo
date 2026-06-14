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
 * layout. A selected narrow (Articles) feed does NOT promote the effective view.
 */
export function resolveEffectiveView(input: {
  activeView: FeedViewType | null
  selectedFeed?: { view?: FeedViewType | null } | null
}): FeedViewType | null {
  if (input.activeView !== null) return input.activeView
  const feedView = input.selectedFeed?.view ?? null
  return isWideLayoutView(feedView) ? feedView : null
}
