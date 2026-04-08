import { describe, expect, it } from 'vitest'
import {
  DISCOVER_SEARCH_DEBOUNCE_MS,
  extractXUsernameFromFeedUrl,
  getDiscoverSearchDebounceMs,
  hasDiscoverSearchQuery,
  hasDiscoverSearchQueryForPlatform,
  parseFollowersFromMirrorText,
  shouldEnrichDiscoverResultsInForeground,
  shouldPreserveExplicitDiscoverView,
  shouldImmediatelySubmitDiscoverSearch,
} from './discover-search'

describe('discover-search', () => {
  it('detects whether a discover search query is usable', () => {
    expect(hasDiscoverSearchQuery('')).toBe(false)
    expect(hasDiscoverSearchQuery('   ')).toBe(false)
    expect(hasDiscoverSearchQuery('rsshub')).toBe(true)
    expect(hasDiscoverSearchQueryForPlatform('el', 'x')).toBe(false)
    expect(hasDiscoverSearchQueryForPlatform('elon', 'x')).toBe(true)
    expect(
      hasDiscoverSearchQueryForPlatform('https://x.com/elonmusk', 'x'),
    ).toBe(true)
  })

  it('extracts x usernames from discover feed urls', () => {
    expect(
      extractXUsernameFromFeedUrl('https://rsshub.app/twitter/user/ElonMusk'),
    ).toBe('elonmusk')
    expect(extractXUsernameFromFeedUrl('rsshub://twitter/user/%40OpenAI')).toBe(
      'openai',
    )
    expect(
      extractXUsernameFromFeedUrl('https://example.com/feed.xml'),
    ).toBeNull()
  })

  it('parses follower counts from mirrored x profile text', () => {
    expect(parseFollowersFromMirrorText('12.3K followers')).toBe(
      '12.3K followers',
    )
    expect(parseFollowersFromMirrorText('followers: 98.5K')).toBe(
      '98.5K followers',
    )
    expect(parseFollowersFromMirrorText('')).toBeUndefined()
  })

  it('only bypasses debounce when the platform changes with a usable query', () => {
    expect(
      shouldImmediatelySubmitDiscoverSearch({
        previousPlatform: 'all',
        nextPlatform: 'all',
        query: 'openai',
      }),
    ).toBe(false)

    expect(
      shouldImmediatelySubmitDiscoverSearch({
        previousPlatform: 'all',
        nextPlatform: 'instagram',
        query: 'openai',
      }),
    ).toBe(true)

    expect(
      shouldImmediatelySubmitDiscoverSearch({
        previousPlatform: 'all',
        nextPlatform: 'instagram',
        query: '   ',
      }),
    ).toBe(false)
  })

  it('uses a short debounce for discover search typing', () => {
    expect(DISCOVER_SEARCH_DEBOUNCE_MS).toBe(150)
    expect(getDiscoverSearchDebounceMs('x')).toBe(500)
    expect(getDiscoverSearchDebounceMs('instagram')).toBe(150)
  })

  it('preserves an explicitly selected discover column when backend returns another one', () => {
    expect(
      shouldPreserveExplicitDiscoverView({
        requestedView: 3,
        persistedView: 1,
      }),
    ).toBe(true)

    expect(
      shouldPreserveExplicitDiscoverView({
        requestedView: 3,
        persistedView: 3,
      }),
    ).toBe(false)
  })

  it('does not block foreground rendering on x follower enrichment', () => {
    expect(shouldEnrichDiscoverResultsInForeground('x')).toBe(false)
    expect(shouldEnrichDiscoverResultsInForeground('instagram')).toBe(false)
  })
})
