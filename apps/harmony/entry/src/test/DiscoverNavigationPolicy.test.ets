import { describe, it, expect } from '@ohos/hypium'
import {
  resolveDiscoverOverlayLevelAfterDestinationDisappear,
  resolveDiscoverOverlayReturnLevel,
  shouldShowDiscoverForegroundOverlay,
} from '../main/ets/common/utils/DiscoverNavigationPolicy'

export default function discoverNavigationPolicyTest() {
  describe('discoverNavigationPolicyTest', () => {
    it('returns the correct overlay level for each discover navigation origin', 0, () => {
      expect(resolveDiscoverOverlayReturnLevel('root')).assertEqual(0)
      expect(resolveDiscoverOverlayReturnLevel('browse')).assertEqual(1)
      expect(resolveDiscoverOverlayReturnLevel('preview')).assertEqual(2)
    })

    it('restores overlay level correctly when destination disappears', 0, () => {
      expect(resolveDiscoverOverlayLevelAfterDestinationDisappear(1, 0)).assertEqual(0)
      expect(resolveDiscoverOverlayLevelAfterDestinationDisappear(1, 1)).assertEqual(1)
      expect(resolveDiscoverOverlayLevelAfterDestinationDisappear(2, 0)).assertEqual(2)
    })

    it('maps overlay level to foreground overlay visibility', 0, () => {
      expect(shouldShowDiscoverForegroundOverlay(0)).assertEqual(false)
      expect(shouldShowDiscoverForegroundOverlay(1)).assertEqual(true)
      expect(shouldShowDiscoverForegroundOverlay(2)).assertEqual(true)
    })
  })
}
