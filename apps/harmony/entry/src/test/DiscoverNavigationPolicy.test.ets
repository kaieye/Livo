import { describe, it, expect } from '@ohos/hypium'
import { resolveDiscoverOverlayReturnLevel } from '../main/ets/common/utils/DiscoverNavigationPolicy'

export default function discoverNavigationPolicyTest() {
  describe('discoverNavigationPolicyTest', () => {
    it('returns the correct overlay level for each discover navigation origin', 0, () => {
      expect(resolveDiscoverOverlayReturnLevel('root')).assertEqual(0)
      expect(resolveDiscoverOverlayReturnLevel('browse')).assertEqual(1)
      expect(resolveDiscoverOverlayReturnLevel('preview')).assertEqual(2)
    })
  })
}
