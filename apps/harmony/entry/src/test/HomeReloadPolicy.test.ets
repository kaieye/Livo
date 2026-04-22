import { describe, it, expect } from '@ohos/hypium'
import { shouldRunImmediateHomeTabReload } from '../main/ets/common/utils/HomeReloadPolicy'

export default function homeReloadPolicyTest() {
  describe('homeReloadPolicyTest', () => {
    it('skips immediate reload after a deferred refresh is flushed', 0, () => {
      expect(shouldRunImmediateHomeTabReload(true, true, false, false, false)).assertEqual(false)
      expect(shouldRunImmediateHomeTabReload(false, true, false, false, false)).assertEqual(true)
      expect(shouldRunImmediateHomeTabReload(false, true, true, false, false)).assertEqual(false)
      expect(shouldRunImmediateHomeTabReload(false, true, false, true, false)).assertEqual(false)
      expect(shouldRunImmediateHomeTabReload(false, true, false, false, true)).assertEqual(false)
    })
  })
}
