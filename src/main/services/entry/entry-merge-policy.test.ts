import { describe, expect, it } from 'vitest'
import type { Entry } from '../../../shared/types'
import { mergeEntryData } from './entry-merge-policy'

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

describe('entry merge policy', () => {
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
