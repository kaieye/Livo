import { describe, expect, it } from 'vitest'
import {
  decodeHtmlEntitiesUrl,
  decodeMediaUrl,
  extractIgCacheKeyFromUrl,
  hasTinyDecorativeDimensions,
  isDecorativeSocialImageUrl,
  isPicnobMirrorHost,
  normalizeNitterImageUrl,
  normalizePicnobMirrorRequestUrl,
} from './entry-media-url'

describe('entry-media-url', () => {
  it('decodes html entities and protocol-relative urls', () => {
    expect(decodeHtmlEntitiesUrl('//example.com/a&amp;b=1')).toBe(
      'https://example.com/a&b=1',
    )
  })

  it('normalizes nitter image urls to pbs.twimg.com', () => {
    expect(
      normalizeNitterImageUrl('https://nitter.net/pic/media%2Fabc123.jpg'),
    ).toBe('https://pbs.twimg.com/media/abc123.jpg')
  })

  it('normalizes picnob mirror requests', () => {
    const raw =
      'https://media.pixnoy.com/get?url=https://cdninstagram.com/photo.jpg?ig_cache_key=abc'
    expect(normalizePicnobMirrorRequestUrl(raw)).toBe(
      'https://media.pixnoy.com/get?url=https%3A%2F%2Fcdninstagram.com%2Fphoto.jpg%3Fig_cache_key%3Dabc',
    )
  })

  it('extracts instagram cache key from nested mirror urls', () => {
    const raw =
      'https://media.pixnoy.com/get?url=https%3A%2F%2Fcdninstagram.com%2Fphoto.jpg%3Fig_cache_key%3Dcache123'
    expect(extractIgCacheKeyFromUrl(raw)).toBe('cache123')
  })

  it('flags decorative social images and tiny dimensions', () => {
    expect(
      isDecorativeSocialImageUrl('https://unavatar.io/instagram/example'),
    ).toBe(true)
    expect(hasTinyDecorativeDimensions(120, 120)).toBe(true)
    expect(hasTinyDecorativeDimensions(640, 360)).toBe(false)
  })

  it('detects picnob mirror hosts and decodes nested media urls', () => {
    expect(isPicnobMirrorHost('media.pixnoy.com')).toBe(true)
    expect(
      decodeMediaUrl(
        'https://media.pixnoy.com/get?url=https%3A%2F%2Fcdninstagram.com%2Fphoto.jpg%3Fig_cache_key%3Dabc',
      ),
    ).toContain('cdninstagram.com/photo.jpg')
  })
})
