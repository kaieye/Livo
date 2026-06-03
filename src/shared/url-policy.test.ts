import { describe, expect, it } from 'vitest'
import {
  classifyExternalUrl,
  isAllowedHtmlSrcset,
  isAllowedHtmlUrl,
} from './url-policy'

describe('url policy', () => {
  it('allows normal http and https external URLs', () => {
    expect(classifyExternalUrl('https://example.com/post').allowed).toBe(true)
    expect(classifyExternalUrl('http://localhost:3000/feed').allowed).toBe(true)
  })

  it('blocks non-http external protocols', () => {
    const result = classifyExternalUrl('javascript:alert(1)')
    expect(result.blocked).toBe(true)
    expect(result.blockedReason).toBe('unsupported-protocol')
  })

  it('blocks credential-bearing URLs instead of only warning', () => {
    const result = classifyExternalUrl('https://user:pass@example.com/feed')
    expect(result.blocked).toBe(true)
    expect(result.blockedReason).toBe('credentials')
  })

  it('keeps existing suspicious-link signals for http URLs', () => {
    const result = classifyExternalUrl('https://127.0.0.1/feed')
    expect(result.allowed).toBe(true)
    expect(result.suspicious).toBe(true)
  })

  it('allows relative and mailto URLs in sanitized HTML but blocks active schemes', () => {
    expect(isAllowedHtmlUrl('/relative/article')).toBe(true)
    expect(isAllowedHtmlUrl('mailto:test@example.com')).toBe(true)
    expect(isAllowedHtmlUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedHtmlUrl('data:text/html,<script>x</script>')).toBe(false)
    expect(isAllowedHtmlUrl('https://user:pass@example.com')).toBe(false)
  })

  it('allows image data URLs only when explicitly requested', () => {
    expect(isAllowedHtmlUrl('data:image/png;base64,abc')).toBe(false)
    expect(
      isAllowedHtmlUrl('data:image/png;base64,abc', {
        allowImageDataUrl: true,
      }),
    ).toBe(true)
  })

  it('validates each URL inside srcset', () => {
    expect(
      isAllowedHtmlSrcset(
        'https://example.com/a.png 1x, data:image/png;base64,abc 2x',
      ),
    ).toBe(true)
    expect(
      isAllowedHtmlSrcset(
        'https://example.com/a.png 1x, javascript:alert(1) 2x',
      ),
    ).toBe(false)
  })
})
