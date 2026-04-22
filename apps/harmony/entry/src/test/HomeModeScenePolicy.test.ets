import { describe, it, expect } from '@ohos/hypium'
import { shouldMountHomeModeScene } from '../main/ets/common/utils/HomeModeScenePolicy'

export default function homeModeScenePolicyTest() {
  describe('homeModeScenePolicyTest', () => {
    it('keeps visited home scenes mounted', 0, () => {
      expect(shouldMountHomeModeScene('articles', 'articles', ['articles'])).assertEqual(true)
      expect(shouldMountHomeModeScene('social', 'articles', ['articles'])).assertEqual(false)
      expect(shouldMountHomeModeScene('social', 'social', ['articles', 'social'])).assertEqual(true)
      expect(shouldMountHomeModeScene('articles', 'social', ['articles', 'social'])).assertEqual(true)
    })
  })
}
