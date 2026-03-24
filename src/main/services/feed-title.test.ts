import { describe, expect, it } from 'vitest'
import { formatFeedTitle } from './feed-title'

describe('formatFeedTitle', () => {
  it('normalizes bilibili titles with a dangling separator', () => {
    expect(
      formatFeedTitle(
        'https://rsshub.app/bilibili/user/video/123',
        '丁汇实录 - bilibili space',
      ),
    ).toBe('丁汇实录 - Bilibili')
  })

  it('keeps a single separator for regular bilibili titles', () => {
    expect(
      formatFeedTitle(
        'https://rsshub.app/bilibili/user/video/123',
        '丁汇实录 bilibili space',
      ),
    ).toBe('丁汇实录 - Bilibili')
  })
})
