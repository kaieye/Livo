import { describe, expect, it } from 'vitest'
import { getEntryIdFromSearch, withEntrySearchParam } from './route-paths'

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
})
