import { describe, expect, it } from 'vitest'
import {
  applyActionRulesToEntries,
  filterForeignEntries,
  getNextAutoRefreshDelayMs,
} from './feed-refresh'
import { FeedViewType, type Entry, type Feed } from '../../shared/types'
import type { ActionRule } from '../../shared/actions'

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

function makeFeed(): Feed {
  return {
    id: 'feed-1',
    title: 'Tech Feed',
    url: 'https://example.com/feed.xml',
    category: 'Tech',
    view: FeedViewType.Articles,
    errorCount: 0,
    createdAt: 1,
  }
}

function makeRule(partial: Partial<ActionRule>): ActionRule {
  return {
    id: partial.id || 'rule-1',
    name: partial.name || 'rule',
    enabled: partial.enabled ?? true,
    conditions: partial.conditions || [
      { field: 'entry.title', operator: 'contains', value: 'title' },
    ],
    actions: partial.actions || [],
    createdAt: partial.createdAt || 1,
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

describe('applyActionRulesToEntries', () => {
  it('keeps matched side effects on stored entries', () => {
    const entry = makeEntry('https://blog.example.com/post-1')
    const result = applyActionRulesToEntries([entry], makeFeed(), [
      makeRule({
        actions: [
          { type: 'star' },
          { type: 'mark_read' },
          { type: 'notify' },
          { type: 'readability' },
          { type: 'summarize' },
        ],
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0].entry).toMatchObject({
      isRead: true,
      isStarred: true,
    })
    expect(result[0].effects).toEqual([
      'star',
      'mark_read',
      'notify',
      'readability',
      'summarize',
    ])
  })

  it('drops blocked entries before side effects run', () => {
    const entry = makeEntry('https://blog.example.com/post-1')
    const result = applyActionRulesToEntries([entry], makeFeed(), [
      makeRule({
        actions: [{ type: 'block' }, { type: 'notify' }],
      }),
    ])

    expect(result).toEqual([])
  })

  it('skips text-processing effects for podcast category feeds', () => {
    const entry = makeEntry('https://podcast.example.com/episode-1')
    const feed = { ...makeFeed(), category: 'podcast' }
    const result = applyActionRulesToEntries([entry], feed, [
      makeRule({
        actions: [
          { type: 'star' },
          { type: 'mark_read' },
          { type: 'notify' },
          { type: 'readability' },
          { type: 'summarize' },
        ],
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0].entry).toMatchObject({
      isRead: true,
      isStarred: true,
    })
    expect(result[0].effects).toEqual(['star', 'mark_read', 'notify'])
  })

  it('skips text-processing effects for audio entries', () => {
    const entry: Entry = {
      ...makeEntry('https://media.example.com/episode-1'),
      media: [{ type: 'audio', url: 'https://media.example.com/episode.mp3' }],
    }
    const result = applyActionRulesToEntries([entry], makeFeed(), [
      makeRule({
        actions: [{ type: 'notify' }, { type: 'readability' }],
      }),
    ])

    expect(result[0].effects).toEqual(['notify'])
  })
})

describe('getNextAutoRefreshDelayMs', () => {
  it('disables scheduling when interval is manual', () => {
    expect(getNextAutoRefreshDelayMs([makeFeed()], Date.now(), 0)).toBeNull()
  })

  it('checks again after the configured interval when there are no feeds', () => {
    expect(getNextAutoRefreshDelayMs([], 1000, 15)).toBe(15 * 60 * 1000)
  })

  it('runs immediately when a feed has never been fetched', () => {
    expect(getNextAutoRefreshDelayMs([makeFeed()], 1000, 15)).toBe(0)
  })

  it('uses the earliest due time across feeds', () => {
    const now = 60 * 60 * 1000
    const feeds = [
      { ...makeFeed(), id: 'feed-1', lastFetched: now - 5 * 60 * 1000 },
      { ...makeFeed(), id: 'feed-2', lastFetched: now - 14 * 60 * 1000 },
    ]

    expect(getNextAutoRefreshDelayMs(feeds, now, 15)).toBe(60 * 1000)
  })

  it('respects social feed failure backoff when computing the next run', () => {
    const now = 60 * 60 * 1000
    const feed = {
      ...makeFeed(),
      url: 'https://rsshub.app/instagram/user/example',
      lastFetched: now - 30 * 60 * 1000,
      errorCount: 3,
    }

    expect(getNextAutoRefreshDelayMs([feed], now, 15)).toBe(30 * 60 * 1000)
  })
})
