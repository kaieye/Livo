import { describe, expect, it } from 'vitest'
import type { Entry } from '../../../shared/types'
import {
  buildEntryByIdMap,
  findEntryById,
  getEntriesAbove,
  getEntriesBelow,
  getEntriesByFeedId,
  patchEntryState,
} from './entry-selectors'

function makeEntry(partial: Partial<Entry> = {}): Entry {
  return {
    id: partial.id ?? 'entry-1',
    feedId: partial.feedId ?? 'feed-1',
    title: partial.title ?? 'Entry title',
    url: partial.url ?? 'https://example.com/entry-1',
    content: partial.content,
    summary: partial.summary,
    author: partial.author,
    imageUrl: partial.imageUrl,
    media: partial.media,
    publishedAt: partial.publishedAt ?? 1000,
    isRead: partial.isRead ?? true,
    isStarred: partial.isStarred ?? false,
    readProgress: partial.readProgress,
    createdAt: partial.createdAt ?? 1000,
  }
}

describe('entry selectors', () => {
  it('builds and reads entry lookup structures', () => {
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })]

    expect(buildEntryByIdMap(entries).get('b')).toBe(entries[1])
    expect(findEntryById(entries, 'a')).toBe(entries[0])
    expect(findEntryById(entries, 'missing')).toBeNull()
    expect(findEntryById(entries, undefined)).toBeNull()
  })

  it('filters entries by feed id', () => {
    const entries = [
      makeEntry({ id: 'a', feedId: 'feed-1' }),
      makeEntry({ id: 'b', feedId: 'feed-2' }),
      makeEntry({ id: 'c', feedId: 'feed-1' }),
    ]

    expect(getEntriesByFeedId(entries, 'feed-1')).toEqual([
      entries[0],
      entries[2],
    ])
    expect(getEntriesByFeedId(entries, null)).toEqual([])
  })

  it('returns entries above and below a selected entry', () => {
    const entries = [
      makeEntry({ id: 'a' }),
      makeEntry({ id: 'b' }),
      makeEntry({ id: 'c' }),
    ]

    expect(getEntriesAbove(entries, 'b')).toEqual([entries[0]])
    expect(getEntriesBelow(entries, 'b')).toEqual([entries[2]])
    expect(getEntriesAbove(entries, 'missing')).toEqual([])
    expect(getEntriesBelow(entries, 'missing')).toEqual([])
  })

  it('patches list and selected entries through one helper', () => {
    const listEntry = makeEntry({
      id: 'entry-1',
      isRead: false,
      readProgress: 10,
    })
    const selectedEntry = makeEntry({
      id: 'entry-1',
      isRead: false,
      readProgress: 10,
    })

    const result = patchEntryState(
      { entries: [listEntry], selectedEntry },
      'entry-1',
      { isRead: true, readProgress: 80 },
    )

    expect(result.entries[0]).toMatchObject({
      isRead: true,
      readProgress: 80,
    })
    expect(result.selectedEntry).toMatchObject({
      isRead: true,
      readProgress: 80,
    })
  })
})
