import { describe, expect, it } from 'vitest'
import { FeedViewType } from '../../shared/types'
import { detectRouteViewFromUrl, reconcileFeedView } from './feed-view'

describe('feed-view route detection', () => {
  it('keeps bilibili and youtube route-aligned views', () => {
    expect(
      detectRouteViewFromUrl('https://rsshub.app/bilibili/user/video/123'),
    ).toBe(FeedViewType.Videos)
    expect(
      detectRouteViewFromUrl('https://rsshub.app/bilibili/user/dynamic/123'),
    ).toBe(FeedViewType.SocialMedia)
    expect(
      detectRouteViewFromUrl('https://rsshub.app/youtube/channel/UC123'),
    ).toBe(FeedViewType.Videos)
  })

  it('does not force instagram routes into social media view', () => {
    expect(
      detectRouteViewFromUrl('https://rsshub.app/instagram/user/tester'),
    ).toBeNull()
    expect(detectRouteViewFromUrl('rsshub://instagram/user/tester')).toBeNull()
  })

  it('corrects legacy instagram article feeds into pictures view', () => {
    expect(
      reconcileFeedView(
        'https://rsshub.app/instagram/user/tester',
        FeedViewType.Articles,
      ),
    ).toBe(FeedViewType.Pictures)

    expect(
      reconcileFeedView(
        'https://rsshub.app/instagram/user/tester',
        FeedViewType.Pictures,
      ),
    ).toBe(FeedViewType.Pictures)
  })
})
