import { FeedViewType } from '../../../shared/types'

export function getEntryLoadLimit(view: FeedViewType | null): number {
  // Grid views need a larger first batch; otherwise the list may not become scrollable,
  // which prevents infinite loading from ever triggering.
  switch (view) {
    case FeedViewType.Videos:
    case FeedViewType.Pictures:
      return 40
    default:
      return 20
  }
}
