import { describe, expect, it } from 'vitest'
import type { Entry } from '../../../shared/types'
import {
  extractInstagramAssetId,
  makeEntryIdentityKey,
  normalizeIdentityUrl,
  titlesLikelySameForRead,
} from './entry-identity'

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

describe('entry identity helpers', () => {
  it('normalizes instagram mirror URLs to canonical identities', () => {
    const normalized = normalizeIdentityUrl(
      'https://picnob.com/post/ABC123/?utm_source=test&fbclid=1',
    )

    expect(normalized).toBe('https://www.instagram.com/p/ABC123')
  })

  it('extracts instagram asset ids from mirrored media urls', () => {
    const assetId = extractInstagramAssetId(
      'https://media.picnob.info/get?url=https://cdninstagram.com/v/t51.2885-15/123_9876543210123456_1.jpg',
    )

    expect(assetId).toBe('9876543210123456')
  })

  it('builds stable identity keys for media-first entries', () => {
    const identityKey = makeEntryIdentityKey(
      createEntry({
        url: '',
        imageUrl:
          'https://cdninstagram.com/v/t51.2885-15/123_9876543210123456_1.jpg',
      }),
    )

    expect(identityKey).toBe('asset:feed-1:9876543210123456')
  })

  it('matches loosely equivalent titles for mirror dedupe', () => {
    expect(titlesLikelySameForRead('Hello, World!', 'hello world')).toBe(true)
    expect(titlesLikelySameForRead('完全不同', 'another title')).toBe(false)
  })
})
