import { describe, expect, it } from 'vitest'

import {
  canonicalizeSocialUrl,
  extractFirstHttpUrl,
  extractFirstNonMediaUrl,
  normalizeExternalUrl,
} from './social-url'

describe('social-url helpers', () => {
  it('normalizes HTML entities and escaped slashes', () => {
    expect(
      normalizeExternalUrl('https:\\/\\/example.com\\/foo?x=1&amp;y=2'),
    ).toBe('https://example.com/foo?x=1&y=2')
  })

  it('prefers non-media urls when extracting links', () => {
    const text =
      'cover https://cdninstagram.com/a.jpg and post https://example.com/post?id=1'
    expect(extractFirstNonMediaUrl(text)).toBe('https://example.com/post?id=1')
  })

  it('canonicalizes twitter and nitter links to x.com', () => {
    expect(canonicalizeSocialUrl('https://twitter.com/openai/status/1')).toBe(
      'https://x.com/openai/status/1',
    )
    expect(canonicalizeSocialUrl('https://nitter.net/openai/status/1')).toBe(
      'https://x.com/openai/status/1',
    )
  })

  it('extracts first http url from text', () => {
    expect(extractFirstHttpUrl('Go to https://example.com/hello now')).toBe(
      'https://example.com/hello',
    )
  })
})
