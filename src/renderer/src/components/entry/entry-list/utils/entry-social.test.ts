import { describe, expect, it } from 'vitest'

import { resolveSocialAuthorName } from './entry-social'

describe('resolveSocialAuthorName', () => {
  it('uses the X feed display title instead of the entry author', () => {
    expect(
      resolveSocialAuthorName({
        entryAuthor: 'Original Poster',
        entryUrl: 'https://x.com/original/status/1',
        feedTitle: 'Livo Updates - X',
        feedUrl: 'rsshub://twitter/user/livo_updates',
      }),
    ).toBe('Livo Updates')
  })

  it('falls back to entry author for non-X feeds without a display title rule', () => {
    expect(
      resolveSocialAuthorName({
        entryAuthor: '@creator',
        entryUrl: 'https://example.com/posts/1',
        feedTitle: 'Creator Feed',
      }),
    ).toBe('creator')
  })
})
