import { FeedViewType } from "../../../shared/types"

export function getEntryLoadLimit(view: FeedViewType | null): number {
  // Keep social initial payload small to make tab switching instant.
  if (view === FeedViewType.SocialMedia) return 72
  if (view === FeedViewType.Videos) return 140
  if (view === FeedViewType.Pictures) return 500
  if (view === FeedViewType.Articles) return 360
  return 360
}
