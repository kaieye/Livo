export type HomeEntryMode = 'articles' | 'social' | 'pictures' | 'videos'

export const FEED_VIEW_ARTICLES = 0
export const FEED_VIEW_SOCIAL = 1
export const FEED_VIEW_VIDEOS = 2
export const FEED_VIEW_PICTURES = 3

export function modeOfFeedView(view: number): HomeEntryMode {
  switch (view) {
    case FEED_VIEW_SOCIAL:
      return 'social'
    case FEED_VIEW_VIDEOS:
      return 'videos'
    case FEED_VIEW_PICTURES:
      return 'pictures'
    default:
      return 'articles'
  }
}

export function modeMatchesFeedView(
  mode: HomeEntryMode,
  view: number,
): boolean {
  return modeOfFeedView(view) === mode
}
