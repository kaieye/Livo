import { FeedViewType } from "../../../shared/types"

export function getEntryLoadLimit(view: FeedViewType | null): number {
  // Unified first-page size across all views; subsequent pages are loaded on scroll.
  void view
  return 10
}
