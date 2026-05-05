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
      // visible=24, preloadRemaining=4, visibleItem=3 → preloadStartIndex=17
      // estimatedItemHeight=820 → threshold = 17 * 820 = 13940
      expect(shouldPreloadHomeVisibleEntries('pictures', 13939, 324, 24)).assertEqual(false)
      expect(shouldPreloadHomeVisibleEntries('pictures', 13940, 324, 24)).assertEqual(true)
    })

    it('uses a near-end social preload threshold for tweet-like cards', 0, () => {
      // visible=24, preloadRemaining=2, visibleItem=3 → preloadStartIndex=19
      // estimatedItemHeight=360 → threshold = 19 * 360 = 6840
      expect(shouldPreloadHomeVisibleEntries('social', 6839, 324, 24)).assertEqual(false)
      expect(shouldPreloadHomeVisibleEntries('social', 6840, 324, 24)).assertEqual(true)
    })

    it('uses grid-aware video preloading', 0, () => {
      // visible=24, preloadRemaining=14, visibleItem=6 → preloadStartIndex=4
      // estimatedItemHeight=140 (per-item row equivalent for 2-col grid)
      // → threshold = 4 * 140 = 560
      expect(shouldPreloadHomeVisibleEntries('videos', 559, 324, 24)).assertEqual(false)
      expect(shouldPreloadHomeVisibleEntries('videos', 560, 324, 24)).assertEqual(true)
    })
  })
}
