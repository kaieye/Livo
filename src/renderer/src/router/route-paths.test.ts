import { describe, expect, it } from 'vitest'
import {
  ROUTES,
  getEntryIdFromSearch,
  withEntrySearchParam,
} from './route-paths'

describe('entry url state helpers', () => {
  it('reads entry id from query string', () => {
    expect(getEntryIdFromSearch('?entry=abc123')).toBe('abc123')
    expect(getEntryIdFromSearch('?view=all&entry=abc123')).toBe('abc123')
    expect(getEntryIdFromSearch('?entry=')).toBeNull()
  })

  it('adds, updates, and removes entry query state', () => {
    expect(withEntrySearchParam('/feed/feed-1', 'entry-1')).toBe(
      '/feed/feed-1?entry=entry-1',
    )
    expect(withEntrySearchParam('/feed/feed-1?entry=old', 'entry-2')).toBe(
      '/feed/feed-1?entry=entry-2',
    )
    expect(withEntrySearchParam('/starred', 'entry-1')).toBe(
      '/starred?entry=entry-1',
    )
    expect(withEntrySearchParam('/feed/feed-1?mode=unread', 'entry-1')).toBe(
      '/feed/feed-1?mode=unread&entry=entry-1',
    )
    expect(withEntrySearchParam('/feed/feed-1?entry=entry-1', null)).toBe(
      '/feed/feed-1',
    )
  })

  it('encodes entry ids used as route path segments', () => {
    const entryId = 'feed/entry ?part#1'

    expect(ROUTES.entry(entryId)).toBe('/entry/feed%2Fentry%20%3Fpart%231')
    expect(ROUTES.video(entryId)).toBe('/video/feed%2Fentry%20%3Fpart%231')
    expect(ROUTES.image(entryId, 2)).toBe('/image/feed%2Fentry%20%3Fpart%231/2')
  })
})
