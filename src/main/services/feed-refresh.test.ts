import { describe, expect, it } from 'vitest'
import { filterForeignEntries } from './feed-refresh'
import type { Entry } from '../../shared/types'

function makeEntry(url: string): Entry {
  return {
    id: 'entry-1',
    feedId: 'feed-1',
    title: 'title',
    content: 'content',
    url,
    publishedAt: Date.now(),
    isRead: false,
    isStarred: false,
    createdAt: Date.now(),
  }
}

describe('filterForeignEntries', () => {
  it('keeps bilibili entries across sibling bilibili subdomains', () => {
    const entries = [
      makeEntry('https://t.bilibili.com/1234567890'),
      makeEntry('https://www.bilibili.com/video/BV1xx411c7mD'),
    ]

    expect(
      filterForeignEntries(
        entries,
        'https://space.bilibili.com/123456',
        'https://space.bilibili.com/123456/dynamic',
        'https://rsshub.app/bilibili/user/dynamic/123456',
      ),
    ).toEqual(entries)
  })

  it('still filters unrelated domains for regular feeds', () => {
    const ownEntry = makeEntry('https://blog.example.com/post-1')
    const foreignEntry = makeEntry('https://another-site.com/post-2')

    expect(
      filterForeignEntries(
        [ownEntry, foreignEntry],
        'https://example.com/feed',
        'https://example.com/feed',
        'https://example.com/feed.xml',
      ),
    ).toEqual([ownEntry])
  })
})
