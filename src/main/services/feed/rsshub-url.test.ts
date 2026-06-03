import { describe, expect, it } from 'vitest'
import { normalizeRsshubProtocolUrl, toRsshubProtocolUrl } from './rsshub-url'

describe('rsshub-url', () => {
  it('normalizes xiaoyuzhou rsshub protocol routes to fetchable URLs', () => {
    expect(
      normalizeRsshubProtocolUrl(
        'rsshub://xiaoyuzhou/podcast/640ee2438be5d40013fe4a87',
        'https://rsshub.rssforever.com',
      ),
    ).toBe(
      'https://rsshub.rssforever.com/xiaoyuzhou/podcast/640ee2438be5d40013fe4a87',
    )
  })

  it('stores xiaoyuzhou RSSHub HTTP URLs as rsshub protocol routes', () => {
    expect(
      toRsshubProtocolUrl(
        'https://rsshub.rssforever.com/xiaoyuzhou/podcast/640ee2438be5d40013fe4a87',
      ),
    ).toBe('rsshub://xiaoyuzhou/podcast/640ee2438be5d40013fe4a87')
  })
})
