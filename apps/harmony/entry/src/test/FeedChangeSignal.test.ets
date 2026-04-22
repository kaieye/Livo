import { describe, it, expect } from '@ohos/hypium'
import { shouldBumpFeedsChangedSignal } from '../main/ets/common/utils/FeedChangeSignal'

export default function feedChangeSignalTest() {
  describe('feedChangeSignalTest', () => {
    it('batches intermediate OPML refresh notifications', 0, () => {
      expect(shouldBumpFeedsChangedSignal(0, 8, 3)).assertEqual(false)
      expect(shouldBumpFeedsChangedSignal(1, 8, 3)).assertEqual(false)
      expect(shouldBumpFeedsChangedSignal(3, 8, 3)).assertEqual(true)
      expect(shouldBumpFeedsChangedSignal(6, 8, 3)).assertEqual(true)
      expect(shouldBumpFeedsChangedSignal(8, 8, 3)).assertEqual(true)
    })
  })
}
