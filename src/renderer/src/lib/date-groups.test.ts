import { describe, expect, it, vi } from 'vitest'

import { groupEntriesByDate } from './date-groups'
import type { Entry } from '../../../shared/types'

function makeEntry(id: string, publishedAt: number): Entry {
  return {
    id,
    feedId: 'feed-1',
    title: id,
    url: `https://example.com/${id}`,
    publishedAt,
    isRead: false,
    isStarred: false,
    createdAt: publishedAt,
  }
}

describe('groupEntriesByDate', () => {
  it('groups entries into today, yesterday and earlier buckets', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-23T12:00:00+08:00'))

    const result = groupEntriesByDate([
      makeEntry('today', new Date('2026-03-23T08:00:00+08:00').getTime()),
      makeEntry('yesterday', new Date('2026-03-22T08:00:00+08:00').getTime()),
      makeEntry('older', new Date('2026-03-14T08:00:00+08:00').getTime()),
    ])

    expect(result.map((group) => group.labelKey)).toEqual([
      'entryList.today',
      'entryList.yesterday',
      'entryList.earlier',
    ])

    vi.useRealTimers()
  })
})
