import { describe, expect, it } from 'vitest'
import type { Entry } from '../../shared/types'
import {
  dedupeEntriesForRead,
  dedupeEntriesInPlace,
  mergeEntryData,
} from './entry-dedupe'

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

describe('entry dedupe helpers', () => {
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

  it('removes broken scraper entries during in-place dedupe', () => {
    const now = Date.now()
    const entries = [
      createEntry({
        id: 'good',
        url: 'https://www.instagram.com/p/ABC123/',
        title: 'same title',
        summary: 'good summary',
        publishedAt: now,
      }),
      createEntry({
        id: 'broken',
        url: 'https://www.instagram.com/p/6735542423462773506815/',
        title: 'same title',
        summary: 'better summary',
        publishedAt: now + 10,
      }),
    ]

    const result = dedupeEntriesInPlace(entries, {
      markEntriesOrderDirty: () => {},
    })

    expect(result.changed).toBe(true)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].summary).toBe('better summary')
  })

  it('prefers incoming meaningful titles and author labels when merging existing entries', () => {
    const now = Date.now()
    const existing = createEntry({
      title: '47113427:45',
      author: '月球大叔投稿视频-月球大叔',
      publishedAt: now,
    })
    const incoming = createEntry({
      id: 'incoming',
      title: '2025硅谷 Agent 落地现状',
      author: '月球大叔',
      url: existing.url,
      publishedAt: now - 5 * 60 * 1000,
    })

    const changed = mergeEntryData(existing, incoming, {
      onPublishedAtAdvanced: () => {},
    })

    expect(changed).toBe(true)
    expect(existing.title).toBe('2025硅谷 Agent 落地现状')
    expect(existing.author).toBe('月球大叔')
    expect(existing.publishedAt).toBe(incoming.publishedAt)
  })
})
