import { describe, expect, it } from 'vitest'
import {
  sanitizeEmbeddedPersistedUrls,
  sanitizePersistedUrl,
} from './persisted-url-policy'

describe('sanitizePersistedUrl', () => {
  it('removes URL userinfo before persistence', () => {
    expect(
      sanitizePersistedUrl('https://user:pass@example.com/rss.xml?ok=1'),
    ).toBe('https://example.com/rss.xml?ok=1')
  })

  it('removes token and signed URL query parameters', () => {
    const result = sanitizePersistedUrl(
      'https://cdn.example.com/image.jpg?token=raw&X-Amz-Signature=sig&Expires=123&ok=1',
    )

    expect(result).toBe('https://cdn.example.com/image.jpg?ok=1')
  })

  it('removes common cloud signed URL parameters and fragments', () => {
    expect(
      sanitizePersistedUrl(
        'https://d111.cloudfront.net/a.jpg?Expires=1&Signature=raw&Key-Pair-Id=key&width=640#access_token=raw',
      ),
    ).toBe('https://d111.cloudfront.net/a.jpg?width=640')

    expect(
      sanitizePersistedUrl(
        'https://storage.googleapis.com/bucket/a.jpg?X-Goog-Signature=raw&GoogleAccessId=raw&ok=1',
      ),
    ).toBe('https://storage.googleapis.com/bucket/a.jpg?ok=1')

    expect(
      sanitizePersistedUrl(
        'https://account.blob.core.windows.net/container/a.jpg?sv=1&sp=r&se=tomorrow&sig=raw&width=640',
      ),
    ).toBe('https://account.blob.core.windows.net/container/a.jpg?width=640')
  })

  it('preserves non-secret identity query parameters', () => {
    expect(
      sanitizePersistedUrl(
        'https://cdninstagram.example/photo.jpg?ig_cache_key=abc&width=640',
      ),
    ).toBe('https://cdninstagram.example/photo.jpg?ig_cache_key=abc&width=640')
  })

  it('returns trimmed malformed values unchanged', () => {
    expect(sanitizePersistedUrl('  not a url  ')).toBe('not a url')
  })
})

describe('sanitizeEmbeddedPersistedUrls', () => {
  it('removes credentials and secret params from embedded URL tokens', () => {
    expect(
      sanitizeEmbeddedPersistedUrls(
        'Read https://user:pass@example.com/a?access_token=raw&ok=1 now',
      ),
    ).toBe('Read https://example.com/a?ok=1 now')
  })

  it('preserves non-secret params, trailing punctuation, and html ampersands', () => {
    expect(
      sanitizeEmbeddedPersistedUrls(
        'See https://cdn.example.com/a.jpg?token=raw&amp;width=640, then continue.',
      ),
    ).toBe('See https://cdn.example.com/a.jpg?width=640, then continue.')

    expect(
      sanitizeEmbeddedPersistedUrls(
        'Keep https://cdn.example.com/a.jpg?ig_cache_key=abc&amp;width=640!',
      ),
    ).toBe('Keep https://cdn.example.com/a.jpg?ig_cache_key=abc&amp;width=640!')
  })
})
