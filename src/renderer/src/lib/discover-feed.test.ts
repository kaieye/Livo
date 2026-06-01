import { describe, expect, it } from 'vitest'
import { FeedViewType } from '../../../shared/types'
import { inferDiscoverFeedViewFromUrl } from './discover-feed'

describe('discover-feed', () => {
  it('infers the preferred column from common discover feed routes', () => {
    expect(
      inferDiscoverFeedViewFromUrl('https://rsshub.app/twitter/user/openai'),
    ).toBe(FeedViewType.SocialMedia)
    expect(
      inferDiscoverFeedViewFromUrl('https://rsshub.app/youtube/channel/UC_x5'),
    ).toBe(FeedViewType.Videos)
    expect(
      inferDiscoverFeedViewFromUrl('https://rsshub.app/instagram/user/openai'),
    ).toBe(FeedViewType.Pictures)
    expect(inferDiscoverFeedViewFromUrl('https://example.com/feed.xml')).toBe(
      FeedViewType.Articles,
    )
  })
})
