import { describe, expect, it } from 'vitest'
import { FeedViewType, type Feed } from '../../shared/types'
import { normalizeExistingFeedTitles } from './feed-normalization'

function makeFeed(partial: Partial<Feed>): Feed {
  return {
    id: 'feed-1',
    title: 'Example',
    url: 'https://example.com/rss',
    view: FeedViewType.Articles,
    errorCount: 0,
    createdAt: Date.now(),
    ...partial,
  }
}

describe('normalizeExistingFeedTitles', () => {
  it('normalizes existing bilibili titles with duplicate separators', () => {
    const feeds = [
      makeFeed({
        url: 'https://rsshub.app/bilibili/user/video/123',
        title: '丁汇实录 - bilibili space',
      }),
    ]

    const changed = normalizeExistingFeedTitles(feeds)

    expect(changed).toBe(true)
    expect(feeds[0].title).toBe('丁汇实录 - Bilibili')
  })

  it('leaves unrelated feed titles unchanged', () => {
    const feeds = [
      makeFeed({
        title: 'OpenAI Blog',
      }),
    ]

    const changed = normalizeExistingFeedTitles(feeds)

    expect(changed).toBe(false)
    expect(feeds[0].title).toBe('OpenAI Blog')
  })
})
