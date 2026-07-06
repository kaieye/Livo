import { describe, expect, it } from 'vitest'
import { FeedViewType } from '../../../shared/types/index'
import { buildEntriesFromParsedItems } from './entry-builder'

describe('entry builder', () => {
  it('按 nitter 纯转发 item 构建为订阅源作者和原文引用块', async () => {
    const [entry] = await buildEntriesFromParsedItems(
      'feed-1',
      [
        {
          title:
            'RT by @elonmusk: Il y a une chose que peu de gens ont compris',
          link: 'https://nitter.net/brivael/status/2062674109574898175#m',
          guid: '2062674109574898175',
          creator: '@brivael',
          content:
            '<p>Il y a une chose que peu de gens ont compris</p><a href="https://nitter.net/brivael/status/2062674109574898175#m">Video</a>',
          contentSnippet: 'Il y a une chose que peu de gens ont compris',
        },
      ],
      'https://nitter.net/pic/elonmusk-avatar.jpg',
      FeedViewType.SocialMedia,
      1_700_000_000_000,
    )

    expect(entry.title).toBe('RT @brivael')
    expect(entry.author).toBe('@elonmusk')
    expect(entry.url).toBe(
      'https://nitter.net/brivael/status/2062674109574898175#m',
    )
    expect(entry.authorAvatar).toBe(
      'https://nitter.net/pic/elonmusk-avatar.jpg',
    )
    expect(entry.content).toContain('class="social-quote-card"')
    expect(entry.content).toContain(
      '<div class="social-quote-author">@brivael</div>',
    )
    expect(entry.content).toContain(
      'Il y a une chose que peu de gens ont compris',
    )
    expect(entry.content).not.toContain('RT by @elonmusk')
  })

  it('builds podcast content from iTunes summary and audio enclosure', async () => {
    const [entry] = await buildEntriesFromParsedItems(
      'feed-1',
      [
        {
          title: 'Episode 1',
          link: 'https://podcast.example.com/episode-1',
          itunesSummary: { _: '<p>Podcast show notes.</p>' },
          itunesDuration: '10:05',
          enclosure: {
            url: 'https://cdn.example.com/episode-1.mp3',
            type: 'audio/mpeg',
          },
        },
      ],
      undefined,
      FeedViewType.Articles,
      1_700_000_000_000,
    )

    expect(entry.content).toBe('<p>Podcast show notes.</p>')
    expect(entry.summary).toBe('<p>Podcast show notes.</p>')
    expect(entry.media).toEqual([
      {
        url: 'https://cdn.example.com/episode-1.mp3',
        type: 'audio',
        duration: 605,
      },
    ])
  })

  it('keeps audio-only podcast entries displayable when no text content exists', async () => {
    const [entry] = await buildEntriesFromParsedItems(
      'feed-1',
      [
        {
          title: 'Episode 2',
          link: 'https://podcast.example.com/episode-2',
          enclosure: {
            url: 'https://cdn.example.com/episode-2.mp3',
            type: 'audio/mpeg',
          },
        },
      ],
      undefined,
      FeedViewType.Articles,
      1_700_000_000_000,
    )

    expect(entry.content).toBe('https://cdn.example.com/episode-2.mp3')
    expect(entry.media?.[0]).toEqual({
      url: 'https://cdn.example.com/episode-2.mp3',
      type: 'audio',
    })
  })

  it('does not persist unsafe media or use blocked audio as content fallback', async () => {
    const [entry] = await buildEntriesFromParsedItems(
      'feed-1',
      [
        {
          title: 'Episode 3',
          link: 'https://podcast.example.com/episode-3',
          enclosure: {
            url: 'http://127.0.0.1/admin.mp3',
            type: 'audio/mpeg',
          },
          'media:thumbnail': {
            $: { url: 'http://169.254.169.254/latest/meta-data' },
          },
        },
      ],
      undefined,
      FeedViewType.Articles,
      1_700_000_000_000,
    )

    expect(entry.content).toBe('')
    expect(entry.imageUrl).toBe('')
    expect(entry.media).toEqual([])
  })
})
