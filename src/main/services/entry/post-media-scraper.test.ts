import { describe, expect, it } from 'vitest'
import { resolveCanonicalPostUrlForEntry } from './post-media-scraper'

type EntryInput = Parameters<typeof resolveCanonicalPostUrlForEntry>[0]

function entry(overrides: Partial<EntryInput>): EntryInput {
  return {
    url: '',
    content: '',
    summary: '',
    imageUrl: '',
    media: [],
    ...overrides,
  }
}

describe('post media scraper', () => {
  it('canonicalizes Instagram post URLs', () => {
    expect(
      resolveCanonicalPostUrlForEntry(
        entry({
          url: 'https://www.instagram.com/Reel/ABC_123/?utm_source=rss#caption',
        }),
      ),
    ).toBe('https://www.instagram.com/reel/ABC_123/')
  })

  it('uses embedded X status URLs instead of direct media URLs', () => {
    expect(
      resolveCanonicalPostUrlForEntry(
        entry({
          url: 'https://pbs.twimg.com/media/photo.jpg',
          summary:
            'Source: https://x.com/openai/status/1234567890123456789?s=20',
        }),
      ),
    ).toBe('https://x.com/openai/status/1234567890123456789?s=20')
  })

  it('converts Instagram mirror numeric post ids to shortcodes', () => {
    expect(
      resolveCanonicalPostUrlForEntry(
        entry({
          url: 'https://picnob.info/post/12345678901234?utm_source=rss',
        }),
      ),
    ).toBe('https://www.instagram.com/p/Czpzzi_y/')
  })

  it('derives Instagram post URLs from ig_cache_key payloads', () => {
    expect(
      resolveCanonicalPostUrlForEntry(
        entry({
          imageUrl:
            'https://scontent.cdninstagram.com/v/t51.82787-15/asset.jpg?ig_cache_key=MTIzNDU2Nzg5MDEyMzQ%3D.2',
        }),
      ),
    ).toBe('https://www.instagram.com/p/Czpzzi_y/')
  })
})
