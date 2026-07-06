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

  it('drops unsafe media URLs while preserving public candidates', () => {
    const item = {
      enclosure: {
        url: 'http://localhost/episode.mp3',
        type: 'audio/mpeg',
      },
      'media:content': [
        {
          $: {
            url: 'https://user:pass@cdn.example.com/secret.jpg',
            type: 'image/jpeg',
          },
        },
        {
          $: {
            url: 'https://cdn.example.com/public.jpg',
            type: 'image/jpeg',
          },
        },
      ],
      content:
        '<img src="http://127.0.0.1/private.jpg"><video src="http://[::1]/v.mp4" poster="https://cdn.example.com/poster.jpg"></video>',
    }

    expect(extractMedia(item)).toEqual([
      {
        url: 'https://cdn.example.com/public.jpg',
        type: 'photo',
        width: undefined,
        height: undefined,
        previewUrl: undefined,
      },
    ])
    expect(deriveImageUrl(item)).toBe('https://cdn.example.com/public.jpg')
  })

  it('drops mirror URLs that unwrap to private media targets', () => {
    const unsafeMirror = `https://media.pixnoy.com/get?url=${encodeURIComponent(
      'http://127.0.0.1/private.jpg',
    )}`
    const safeMirror = `https://media.pixnoy.com/get?url=${encodeURIComponent(
      'https://cdn.example.com/public.jpg?sig=1',
    )}`
    const item = {
      'media:content': [
        {
          $: {
            url: unsafeMirror,
            type: 'image/jpeg',
          },
        },
        {
          $: {
            url: safeMirror,
            type: 'image/jpeg',
          },
        },
      ],
    }

    expect(extractMedia(item)).toEqual([
      {
        url: 'https://cdn.example.com/public.jpg?sig=1',
        type: 'photo',
        width: undefined,
        height: undefined,
        previewUrl: safeMirror,
      },
    ])
    expect(deriveImageUrl(item)).toBe(
      'https://cdn.example.com/public.jpg?sig=1',
    )
  })

  it('skips unsafe primary image sources before falling back to safe ones', () => {
    const item = {
      enclosure: {
        url: 'file:///tmp/cover.jpg',
        type: 'image/jpeg',
      },
      itunes: {
        image: 'data:image/png;base64,aaaa',
      },
      'media:thumbnail': [
        { $: { url: 'http://169.254.169.254/latest/meta-data' } },
        { $: { url: 'https://cdn.example.com/thumb.jpg' } },
      ],
    }

    expect(deriveImageUrl(item)).toBe('https://cdn.example.com/thumb.jpg')
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
