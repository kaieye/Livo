import { describe, it, expect } from '@ohos/hypium'
import { resolveDiscoverAvatarImageUrl } from '../main/ets/common/utils/DiscoverAvatarPresentation'

export default function discoverAvatarPresentationTest() {
  describe('discoverAvatarPresentationTest', () => {
    it('uses preview cache image for discover browse rows after detail preview resolves avatar', 0, () => {
      const imageUrl = resolveDiscoverAvatarImageUrl({
        imageUrl: '',
        targetUrl: 'https://example.com/feed.xml',
        siteUrl: 'https://example.com',
        title: 'Example Feed',
        cachedImageUrl: 'https://cdn.example.com/avatar.png',
        cachedSiteUrl: 'https://example.com',
        cachedTitle: 'Example Feed',
        cachedResolvedFeedUrl: 'https://example.com/feed.xml',
      })

      expect(imageUrl).assertEqual('https://cdn.example.com/avatar.png')
    })

    it('keeps higher quality cached image instead of generic favicon seed image', 0, () => {
      const imageUrl = resolveDiscoverAvatarImageUrl({
        imageUrl: 'https://www.google.com/s2/favicons?domain=example.com&sz=128',
        targetUrl: 'https://example.com/feed.xml',
        siteUrl: 'https://example.com',
        title: 'Example Feed',
        cachedImageUrl: 'https://cdn.example.com/avatar.png',
      })

      expect(imageUrl).assertEqual('https://cdn.example.com/avatar.png')
    })

    it('uses list hydration image before entering detail page', 0, () => {
      const imageUrl = resolveDiscoverAvatarImageUrl({
        imageUrl: '',
        targetUrl: 'https://example.com/feed.xml',
        siteUrl: 'https://example.com',
        title: 'Example Feed',
        hydratedImageUrl: 'https://cdn.example.com/list-avatar.png',
      })

      expect(imageUrl).assertEqual('https://cdn.example.com/list-avatar.png')
    })
  })
}
