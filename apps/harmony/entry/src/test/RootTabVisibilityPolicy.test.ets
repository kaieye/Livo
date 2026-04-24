import { describe, it, expect } from '@ohos/hypium'
import { shouldHideRootBottomBar, shouldHideRootTitleBar } from '../main/ets/common/utils/RootTabVisibilityPolicy'

export default function rootTabVisibilityPolicyTest() {
  describe('rootTabVisibilityPolicyTest', () => {
    it('hides title bar for non-home root tabs', 0, () => {
      expect(shouldHideRootTitleBar('home')).assertEqual(false)
      expect(shouldHideRootTitleBar('subscriptions')).assertEqual(true)
      expect(shouldHideRootTitleBar('discover')).assertEqual(true)
      expect(shouldHideRootTitleBar('settings')).assertEqual(true)
    })

    it('hides bottom bar only when active tab has overlay', 0, () => {
      const context = {
        discoverHasForegroundOverlay: true,
        subscriptionsOverlayLevel: 2,
        settingsOverlayLevel: 1,
      }

      expect(shouldHideRootBottomBar('home', context)).assertEqual(false)
      expect(shouldHideRootBottomBar('discover', context)).assertEqual(true)
      expect(shouldHideRootBottomBar('subscriptions', context)).assertEqual(true)
      expect(shouldHideRootBottomBar('settings', context)).assertEqual(true)
    })

    it('keeps unrelated tab overlays from hiding current tab bottom bar', 0, () => {
      const context = {
        discoverHasForegroundOverlay: false,
        subscriptionsOverlayLevel: 3,
        settingsOverlayLevel: 2,
      }

      expect(shouldHideRootBottomBar('discover', context)).assertEqual(false)
      expect(shouldHideRootBottomBar('home', context)).assertEqual(false)
    })
  })
}
