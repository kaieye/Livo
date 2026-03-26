import { describe, expect, it } from 'vitest'

import {
  detectBilibiliFeedViewFromUrl,
  remapBilibiliFeedUrlToView,
} from './bilibili-feed-url'
import { FeedViewType } from './types'

describe('bilibili feed url helpers', () => {
  it('detects dynamic routes as social media feeds', () => {
    expect(
      detectBilibiliFeedViewFromUrl('rsshub://bilibili/user/dynamic/52502322'),
    ).toBe(FeedViewType.SocialMedia)
  })

  it('detects video routes as video feeds', () => {
    expect(
      detectBilibiliFeedViewFromUrl(
        'https://rsshub.example.com/bilibili/user/video/52502322',
      ),
    ).toBe(FeedViewType.Videos)
  })

  it('remaps routes to the selected bilibili view', () => {
    expect(
      remapBilibiliFeedUrlToView(
        'rsshub://bilibili/user/dynamic/52502322',
        FeedViewType.Videos,
      ),
    ).toBe('rsshub://bilibili/user/video/52502322')

    expect(
      remapBilibiliFeedUrlToView(
        'rsshub://bilibili/user/video/52502322',
        FeedViewType.SocialMedia,
      ),
    ).toBe('rsshub://bilibili/user/dynamic/52502322')
  })
})
