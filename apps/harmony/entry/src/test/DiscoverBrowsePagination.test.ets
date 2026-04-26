import { describe, it, expect } from '@ohos/hypium'
import {
  initialDiscoverBrowseVisibleCount,
  nextDiscoverBrowseVisibleCount,
  shouldPreloadDiscoverBrowseMore,
} from '../main/ets/common/utils/DiscoverBrowsePagination'

export default function discoverBrowsePaginationTest() {
  describe('discoverBrowsePaginationTest', () => {
    it('limits initial render count for large discover browse lists', 0, () => {
      expect(initialDiscoverBrowseVisibleCount(324)).assertEqual(24)
    })

    it('loads one page at a time without exceeding total count', 0, () => {
      expect(nextDiscoverBrowseVisibleCount(24, 324)).assertEqual(48)
      expect(nextDiscoverBrowseVisibleCount(312, 324)).assertEqual(324)
    })

    it('preloads before the visible rendered page bottom', 0, () => {
      expect(shouldPreloadDiscoverBrowseMore(168, 324, 24)).assertEqual(false)
      expect(shouldPreloadDiscoverBrowseMore(224, 324, 24)).assertEqual(true)
      expect(shouldPreloadDiscoverBrowseMore(1512, 324, 48)).assertEqual(false)
      expect(shouldPreloadDiscoverBrowseMore(1568, 324, 48)).assertEqual(true)
      expect(shouldPreloadDiscoverBrowseMore(224, 24, 24)).assertEqual(false)
    })
  })
}
