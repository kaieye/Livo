import { describe, it, expect } from '@ohos/hypium'
import {
  canonicalXFeedUrl,
  extractXUsername,
  formatXFeedTitle,
  normalizeSocialFeedTitle,
} from '../main/ets/common/utils/SocialFeedTitles'
import { expandRssHubFallbackRoutes } from '../main/ets/common/utils/RssHubFallbackRoute'

export default function rssFeedServiceSupportTest() {
  describe('rssFeedServiceSupportTest', () => {
    it('canonicalizes x and twitter URLs to the twitter user route', 0, () => {
      expect(canonicalXFeedUrl('https://rsshub.pseudoyu.com/x/user/SomeUser', 'https://x.com/SomeUser'))
        .assertEqual('https://rsshub.pseudoyu.com/twitter/user/someuser')
      expect(canonicalXFeedUrl('https://rsshub.app/twitter/user/SomeUser', 'https://twitter.com/SomeUser'))
        .assertEqual('https://rsshub.app/twitter/user/someuser')
    })

    it('extracts usernames from rsshub and site URLs', 0, () => {
      expect(extractXUsername('https://rsshub.pseudoyu.com/x/user/SomeUser')).assertEqual('someuser')
      expect(extractXUsername('https://x.com/SomeUser')).assertEqual('someuser')
      expect(extractXUsername('https://twitter.com/SomeUser')).assertEqual('someuser')
    })

    it('normalizes x feed titles to a consistent display form', 0, () => {
      expect(formatXFeedTitle('The Verge (@verge) / X', 'verge')).assertEqual('The Verge')
      expect(formatXFeedTitle('The Verge @ verge', 'verge')).assertEqual('The Verge')
      expect(formatXFeedTitle('@sama', 'sama')).assertEqual('@sama')
      expect(formatXFeedTitle('X @sama', 'sama')).assertEqual('@sama')
      expect(normalizeSocialFeedTitle('sama', 'https://rsshub.app/twitter/user/sama')).assertEqual('@sama')
    })

    it('expands twitter and x fallback routes without dropping the username', 0, () => {
      expect(JSON.stringify(expandRssHubFallbackRoutes('/twitter/user/someuser')))
        .assertEqual(JSON.stringify(['/twitter/user/someuser', '/x/user/someuser']))
      expect(JSON.stringify(expandRssHubFallbackRoutes('/x/user/someuser')))
        .assertEqual(JSON.stringify(['/x/user/someuser', '/twitter/user/someuser']))
    })
  })
}
