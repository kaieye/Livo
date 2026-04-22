import { describe, it, expect } from '@ohos/hypium'
import { resolveHomeVisibleEntryInitialLimit } from '../main/ets/common/utils/HomeVisibleEntryPolicy'

export default function homeVisibleEntryPolicyTest() {
  describe('homeVisibleEntryPolicyTest', () => {
    it('uses a smaller initial limit for videos', 0, () => {
      expect(resolveHomeVisibleEntryInitialLimit('articles')).assertEqual(48)
      expect(resolveHomeVisibleEntryInitialLimit('social')).assertEqual(48)
      expect(resolveHomeVisibleEntryInitialLimit('pictures')).assertEqual(48)
      expect(resolveHomeVisibleEntryInitialLimit('videos')).assertEqual(24)
    })
  })
}
