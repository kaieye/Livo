import { describe, expect, it } from 'vitest'
import { FeedViewType } from '../../shared/types'
import { buildEntriesFromParsedItems } from './entry-builder'

describe('entry builder', () => {
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
})
