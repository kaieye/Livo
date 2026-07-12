import { FeedViewType } from '../../../shared/types'

export type EntryDetailPresentation = 'article' | 'social'

export function resolveEntryDetailPresentation({
  entryFeedView,
}: {
  entryFeedView?: FeedViewType | null
}): EntryDetailPresentation {
  return entryFeedView === FeedViewType.SocialMedia ? 'social' : 'article'
}
