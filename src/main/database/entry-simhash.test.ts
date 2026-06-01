import { describe, expect, it } from 'vitest'
import type { Entry } from '../../shared/types'
import {
  areEntrySimHashesNearDuplicate,
  computeEntrySimHash,
  hammingDistance64,
} from './entry-simhash'

function createEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    feedId: 'feed-1',
    title: 'Example title',
    url: 'https://example.com/post',
    content: '',
    summary: '',
    publishedAt: Date.now(),
    isRead: false,
    isStarred: false,
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('entry simhash helpers', () => {
  it('computes near fingerprints for syndicated article text', () => {
    const articleText =
      'Local-first RSS apps keep articles on the device, make reading reliable offline, reduce server lock-in, and still allow optional sync when a user needs multiple devices. This helps readers search archives quickly and avoid losing saved articles.'

    const a = computeEntrySimHash(
      createEntry({ title: 'Why local RSS matters', content: articleText }),
    )
    const b = computeEntrySimHash(
      createEntry({
        title: 'Local readers and offline reliability',
        content: articleText,
      }),
    )

    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(areEntrySimHashesNearDuplicate(a!, b!)).toBe(true)
  })

  it('does not fingerprint very short snippets', () => {
    const hash = computeEntrySimHash(createEntry({ content: 'short text' }))

    expect(hash).toBeNull()
  })

  it('counts hamming distance on 64-bit fingerprints', () => {
    expect(hammingDistance64(0b1010n, 0b0011n)).toBe(2)
  })
})
