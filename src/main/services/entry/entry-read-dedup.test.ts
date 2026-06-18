import { describe, expect, it } from 'vitest'
import type { Entry } from '../../../shared/types'
import { dedupeEntriesForRead, getEntryReadDedupKey } from './entry-read-dedup'

function createEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    feedId: 'feed-1',
    title: 'Example',
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

describe('entry read dedup', () => {
  it('prefers richer entries when deduping for read', () => {
    const now = Date.now()
    const entries = [
      createEntry({
        id: 'a',
        url: 'https://www.instagram.com/p/ABC123/',
        content: 'short',
        publishedAt: now,
      }),
      createEntry({
        id: 'b',
        url: 'https://picnob.com/post/ABC123/',
        content: 'much longer content',
        publishedAt: now + 1_000,
      }),
    ]

    const result = dedupeEntriesForRead(entries, () => {})

    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('much longer content')
  })

  it('dedupes near-identical content across feeds for read display', () => {
    const now = Date.now()
    const articleContent =
      'Local-first RSS apps keep articles on the device, make reading reliable offline, reduce server lock-in, and still allow optional sync when a user needs multiple devices. This helps readers search archives quickly and avoid losing saved articles.'
    const entries = [
      createEntry({
        id: 'a',
        feedId: 'feed-a',
        title: 'Why local RSS matters',
        url: 'https://example.com/local-rss',
        content: articleContent,
        isRead: true,
        publishedAt: now,
      }),
      createEntry({
        id: 'b',
        feedId: 'feed-b',
        title: 'Local readers and offline reliability',
        url: 'https://mirror.example.net/offline-reader',
        content: articleContent,
        isStarred: true,
        publishedAt: now + 60_000,
      }),
    ]

    const result = dedupeEntriesForRead(entries, () => {})

    expect(result).toHaveLength(1)
    expect(result[0].isRead).toBe(false)
    expect(result[0].isStarred).toBe(true)
  })

  it('keeps read dedupe keys aligned with canonical urls', () => {
    const direct = getEntryReadDedupKey(
      createEntry({
        url: 'https://www.instagram.com/p/ABC123/',
      }),
    )
    const mirrored = getEntryReadDedupKey(
      createEntry({
        url: 'https://picnob.com/post/ABC123/',
      }),
    )

    expect(direct).toBe(mirrored)
  })
})
