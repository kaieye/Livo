import { describe, it, expect } from '@ohos/hypium'
import {
  resolveHomeVisibleEntryInitialLimit,
  resolveHomeVisibleEntryLoadMoreStep,
  shouldPreloadHomeVisibleEntries,
} from '../main/ets/common/utils/HomeVisibleEntryPolicy'

export default function homeVisibleEntryPolicyTest() {
  describe('homeVisibleEntryPolicyTest', () => {
    it('uses the same small initial limit for all home modes', 0, () => {
      expect(resolveHomeVisibleEntryInitialLimit('articles')).assertEqual(24)
      expect(resolveHomeVisibleEntryInitialLimit('social')).assertEqual(24)
      expect(resolveHomeVisibleEntryInitialLimit('pictures')).assertEqual(24)
      expect(resolveHomeVisibleEntryInitialLimit('videos')).assertEqual(24)
    })

    it('loads one visible page at a time', 0, () => {
      expect(resolveHomeVisibleEntryLoadMoreStep()).assertEqual(24)
      expect(resolveHomeVisibleEntryLoadMoreStep('pictures')).assertEqual(10)
      expect(resolveHomeVisibleEntryLoadMoreStep('videos')).assertEqual(24)
    })

    it('preloads before the visible rendered page bottom', 0, () => {
      expect(shouldPreloadHomeVisibleEntries('articles', 168, 324, 24)).assertEqual(false)
      expect(shouldPreloadHomeVisibleEntries('articles', 224, 324, 24)).assertEqual(true)
      expect(shouldPreloadHomeVisibleEntries('articles', 1512, 324, 48)).assertEqual(false)
      expect(shouldPreloadHomeVisibleEntries('articles', 1568, 324, 48)).assertEqual(true)
      expect(shouldPreloadHomeVisibleEntries('articles', 224, 24, 24)).assertEqual(false)
    })

    it('uses a near-end picture preload threshold for tall cards', 0, () => {
      expect(shouldPreloadHomeVisibleEntries('pictures', 8959, 324, 24)).assertEqual(false)
      expect(shouldPreloadHomeVisibleEntries('pictures', 8960, 324, 24)).assertEqual(true)
    })

    it('uses grid-aware video preloading', 0, () => {
      expect(shouldPreloadHomeVisibleEntries('videos', 659, 324, 24)).assertEqual(false)
      expect(shouldPreloadHomeVisibleEntries('videos', 660, 324, 24)).assertEqual(true)
    })
  })
}
