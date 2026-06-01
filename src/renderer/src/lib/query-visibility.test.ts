import { describe, expect, it } from 'vitest'
import {
  QUERY_VISIBILITY_INVALIDATE_AFTER_MS,
  shouldInvalidateQueriesAfterRestore,
} from './query-visibility'

describe('query-visibility', () => {
  it('invalidates queries only after the hidden threshold has elapsed', () => {
    const now = 1_000_000
    expect(shouldInvalidateQueriesAfterRestore(null, now)).toBe(false)
    expect(
      shouldInvalidateQueriesAfterRestore(
        now - QUERY_VISIBILITY_INVALIDATE_AFTER_MS + 1,
        now,
      ),
    ).toBe(false)
    expect(
      shouldInvalidateQueriesAfterRestore(
        now - QUERY_VISIBILITY_INVALIDATE_AFTER_MS,
        now,
      ),
    ).toBe(true)
  })
})
