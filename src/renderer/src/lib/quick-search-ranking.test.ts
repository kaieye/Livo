import { describe, expect, it } from 'vitest'
import { FeedViewType, type FeedWithCount } from '../../../shared/types'
import { rankFeedsForQuickSearch } from './quick-search-ranking'

function feed(input: Partial<FeedWithCount>): FeedWithCount {
  return {
    id: input.id || input.title || 'feed',
    title: input.title || '',
    url: input.url || '',
    siteUrl: input.siteUrl,
    description: input.description,
    imageUrl: input.imageUrl,
    category: input.category,
    folder: input.folder,
    view: input.view ?? FeedViewType.Articles,
    maxEntries: input.maxEntries,
    showInAll: input.showInAll ?? true,
    provider: input.provider || 'local',
    unreadCount: input.unreadCount ?? 0,
    lastFetched: input.lastFetched,
    etag: input.etag,
    lastModified: input.lastModified,
    fetchSource: input.fetchSource,
    upstreamUrl: input.upstreamUrl,
    remoteFeedId: input.remoteFeedId,
    errorCount: input.errorCount ?? 0,
    lastRefreshStatus: input.lastRefreshStatus,
    lastRefreshAttemptedAt: input.lastRefreshAttemptedAt,
    lastRefreshError: input.lastRefreshError,
    lastRefreshRawError: input.lastRefreshRawError,
    createdAt: input.createdAt ?? 1,
  }
}

describe('quick search feed ranking', () => {
  it('prefers title matches over weaker metadata matches', () => {
    const results = rankFeedsForQuickSearch(
      [
        feed({ id: 'description', title: 'Daily', description: 'React news' }),
        feed({ id: 'title', title: 'React Weekly' }),
        feed({
          id: 'url',
          title: 'Frontend',
          url: 'https://react.example/rss',
        }),
      ],
      'react',
      5,
    )

    expect(results.map((result) => result.id)).toEqual([
      'title',
      'url',
      'description',
    ])
  })

  it('returns an empty list for blank queries', () => {
    expect(rankFeedsForQuickSearch([feed({ title: 'React' })], ' ', 5)).toEqual(
      [],
    )
  })
})
