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
      expect(resolveHomeVisibleEntryLoadMoreStep()).assertEqual(20)
      expect(resolveHomeVisibleEntryLoadMoreStep('pictures')).assertEqual(12)
      expect(resolveHomeVisibleEntryLoadMoreStep('videos')).assertEqual(12)
    })

    it('preloads before the visible rendered page bottom', 0, () => {
      expect(shouldPreloadHomeVisibleEntries('articles', 671, 324, 24)).assertEqual(false)
      expect(shouldPreloadHomeVisibleEntries('articles', 672, 324, 24)).assertEqual(true)
      expect(shouldPreloadHomeVisibleEntries('articles', 3135, 324, 48)).assertEqual(false)
      expect(shouldPreloadHomeVisibleEntries('articles', 3136, 324, 48)).assertEqual(true)
      expect(shouldPreloadHomeVisibleEntries('articles', 672, 24, 24)).assertEqual(false)
    })

    it('uses a near-end picture preload threshold for tall cards', 0, () => {
      expect(shouldPreloadHomeVisibleEntries('pictures', 5719, 324, 24)).assertEqual(false)
      expect(shouldPreloadHomeVisibleEntries('pictures', 5720, 324, 24)).assertEqual(true)
    })

    it('uses grid-aware video preloading', 0, () => {
      expect(shouldPreloadHomeVisibleEntries('videos', 1119, 324, 24)).assertEqual(false)
      expect(shouldPreloadHomeVisibleEntries('videos', 1120, 324, 24)).assertEqual(true)
    })
  })
}
