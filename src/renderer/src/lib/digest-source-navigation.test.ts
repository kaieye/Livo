import { describe, expect, it } from 'vitest'
import { getDigestSourceEntryRoute } from './digest-source-navigation'

describe('getDigestSourceEntryRoute', () => {
  it('returns encoded entry route for available digest sources', () => {
    expect(
      getDigestSourceEntryRoute({
        id: 'feed/entry 1',
        status: 'available',
      }),
    ).toBe('/entry/feed%2Fentry%201')
  })

  it('does not navigate to missing digest sources', () => {
    expect(
      getDigestSourceEntryRoute({
        id: 'missing-entry',
        status: 'missing',
      }),
    ).toBeNull()
  })
})
