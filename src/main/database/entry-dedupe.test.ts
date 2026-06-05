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

  it('upgrades legacy nitter pure retweets to quote-card presentation', () => {
    const existing = createEntry({
      title:
        'RT by @elonmusk: Il y a une chose que peu de gens ont compris, et qui sera pourtant évidente dans dix ans.',
      url: 'https://nitter.net/brivael/status/2062674109574898175#m',
      content:
        '<p>Il y a une chose que peu de gens ont compris, et qui sera pourtant évidente dans dix ans.</p>',
      author: '@brivael',
      authorAvatar: 'https://nitter.net/pic/brivael-avatar.jpg',
    })
    const incoming = createEntry({
      id: 'incoming',
      title: 'RT @brivael',
      url: existing.url,
      content:
        '<blockquote class="social-quote-card"><div class="social-quote-author">@brivael</div></blockquote>',
      author: '@elonmusk',
      authorAvatar: 'https://nitter.net/pic/elonmusk-avatar.jpg',
    })

    const changed = mergeEntryData(existing, incoming)

    expect(changed).toBe(true)
    expect(existing.title).toBe('RT @brivael')
    expect(existing.content).toContain('social-quote-card')
    expect(existing.author).toBe('@elonmusk')
    expect(existing.authorAvatar).toBe(
      'https://nitter.net/pic/elonmusk-avatar.jpg',
    )
  })

  it('replaces stale nitter pure retweet quote-card content', () => {
    const existing = createEntry({
      title: 'RT @brivael',
      url: 'https://nitter.net/brivael/status/2062674109574898175#m',
      content:
        '<blockquote class="social-quote-card"><div class="social-quote-author">@brivael</div><div class="social-quote-body"><p>RT by @elonmusk: stale body</p></div></blockquote>',
      author: '@elonmusk',
      authorAvatar: 'https://nitter.net/pic/elonmusk-avatar.jpg',
    })
    const incoming = createEntry({
      id: 'incoming',
      title: 'RT @brivael',
      url: existing.url,
      content:
        '<blockquote class="social-quote-card"><div class="social-quote-author">@brivael</div><div class="social-quote-body"><p>Il y a une chose que peu de gens ont compris</p></div></blockquote>',
      author: '@elonmusk',
      authorAvatar: 'https://nitter.net/pic/elonmusk-avatar.jpg',
    })

    const changed = mergeEntryData(existing, incoming)

    expect(changed).toBe(true)
    expect(existing.content).toContain(
      'Il y a une chose que peu de gens ont compris',
    )
    expect(existing.content).not.toContain('stale body')
  })
})
