import { describe, expect, it } from 'vitest'
import {
  buildAliasDedupKey,
  dedupeAndSortDiscoverResults,
} from './discover-dedupe'

describe('discover-dedupe', () => {
  it('dedupes x user results by username instead of display title', () => {
    expect(
      buildAliasDedupKey({
        title: 'elonmusk - X',
        url: 'https://rsshub.app/x/user/elonmusk',
        siteUrl: 'https://x.com/elonmusk',
        description: 'X user',
        source: 'rsshub',
        image: 'https://unavatar.io/x/elonmusk',
      }),
    ).toBe('twitter:elonmusk')

    expect(
      buildAliasDedupKey({
        title: '@elonmusk',
        url: 'https://rsshub.app/x/user/elonmusk?limit=120',
        siteUrl: 'https://x.com/elonmusk',
        description: 'RSSHub X/Twitter user route',
        source: 'rsshub',
      }),
    ).toBe('twitter:elonmusk')
  })

  it('keeps only the richer x result when fallback route duplicates it', () => {
    const results = dedupeAndSortDiscoverResults('elonmusk', [
      {
        title: '@elonmusk',
        url: 'https://rsshub.app/x/user/elonmusk?limit=120',
        siteUrl: 'https://x.com/elonmusk',
        description: 'RSSHub X/Twitter user route',
        source: 'rsshub',
      },
      {
        title: 'elonmusk - X',
        url: 'https://rsshub.app/x/user/elonmusk',
        siteUrl: 'https://x.com/elonmusk',
        description: 'X user',
        source: 'rsshub',
        image: 'https://unavatar.io/x/elonmusk',
      },
    ])

    expect(results).toHaveLength(1)
    expect(results[0]?.title).toBe('elonmusk - X')
  })
})
