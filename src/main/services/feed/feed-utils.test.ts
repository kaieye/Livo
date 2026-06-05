import { describe, expect, it } from 'vitest'
import {
  deriveImageUrl,
  extractContent,
  extractMedia,
  getFeedImageUrl,
} from './feed-utils'

describe('feed media extraction', () => {
  it('extracts podcast audio enclosure with iTunes cover and duration', () => {
    const item = {
      enclosure: {
        url: 'https://cdn.example.com/episode.mp3',
        type: 'audio/mpeg',
      },
      itunes: {
        image: 'https://cdn.example.com/cover.jpg',
        duration: '01:02:03',
      },
    }

    expect(extractMedia(item)).toEqual([
      {
        url: 'https://cdn.example.com/episode.mp3',
        type: 'audio',
        duration: 3723,
      },
      {
        url: 'https://cdn.example.com/cover.jpg',
        type: 'photo',
      },
    ])
    expect(deriveImageUrl(item)).toBe('https://cdn.example.com/cover.jpg')
  })

  it('uses iTunes summary as podcast content when standard RSS content is missing', () => {
    const item = {
      itunesSummary: { _: '<p>Episode notes from iTunes.</p>' },
      itunesSubtitle: 'Short episode subtitle',
    }

    expect(extractContent(item)).toBe('<p>Episode notes from iTunes.</p>')
  })

  it('extracts Atom enclosure links captured by the feed parser', () => {
    const item = {
      atomLinks: [
        {
          $: {
            rel: 'alternate',
            href: 'https://example.com/post',
          },
        },
        {
          $: {
            rel: 'enclosure',
            href: 'https://cdn.example.com/video.mp4',
            type: 'video/mp4',
          },
        },
      ],
      itunesImage: { $: { href: 'https://cdn.example.com/poster.jpg' } },
      itunesDuration: '12:34',
    }

    expect(extractMedia(item)).toEqual([
      {
        url: 'https://cdn.example.com/video.mp4',
        type: 'video',
        duration: 754,
      },
      {
        url: 'https://cdn.example.com/poster.jpg',
        type: 'photo',
      },
    ])
    expect(deriveImageUrl(item)).toBe('https://cdn.example.com/poster.jpg')
  })

  it('uses Atom image enclosure as media and primary image', () => {
    const item = {
      atomLinks: [
        {
          $: {
            rel: 'enclosure',
            href: 'https://cdn.example.com/hero.webp',
            type: 'image/webp',
          },
        },
      ],
    }

    expect(extractMedia(item)).toEqual([
      {
        url: 'https://cdn.example.com/hero.webp',
        type: 'photo',
      },
    ])
    expect(deriveImageUrl(item)).toBe('https://cdn.example.com/hero.webp')
  })
})

describe('getFeedImageUrl', () => {
  it('uses only feed-level image metadata for the feed avatar', () => {
    const parsed = {
      items: [
        {
          enclosure: {
            url: 'https://blog.example.com/latest-post-cover.jpg',
            type: 'image/jpeg',
          },
        },
      ],
    }

    expect(getFeedImageUrl(parsed)).toBeUndefined()
  })

  it('keeps RSS channel image as feed avatar', () => {
    expect(
      getFeedImageUrl({
        image: { url: 'https://blog.example.com/avatar.png' },
        items: [
          {
            enclosure: {
              url: 'https://blog.example.com/latest-post-cover.jpg',
              type: 'image/jpeg',
            },
          },
        ],
      }),
    ).toBe('https://blog.example.com/avatar.png')
  })
})
