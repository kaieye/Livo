import { describe, expect, it } from 'vitest'
import { FeedViewType } from '../../../shared/types'
import { buildEntryWarmupKey, buildEntryWarmupRequests } from './entry-warmup'

describe('entry warmup', () => {
  it('builds visible view-scoped warmup requests', () => {
    const requests = buildEntryWarmupRequests(
      [
        { id: 'article-1', view: FeedViewType.Articles },
        { id: 'article-hidden', view: FeedViewType.Articles, showInAll: false },
        { id: 'social-1', view: FeedViewType.SocialMedia },
        {
          id: 'social-recommended',
          view: FeedViewType.SocialMedia,
          category: 'Recommended',
        },
        { id: 'video-1', view: FeedViewType.Videos },
        { id: 'picture-1', view: FeedViewType.Pictures },
      ],
      'Recommended',
    )

    expect(requests).toEqual([
      {
        key: buildEntryWarmupKey('view:1', ['social-1'], 20),
        options: { feedIds: ['social-1'], limit: 20 },
      },
      {
        key: buildEntryWarmupKey('view:2', ['video-1'], 40),
        options: { feedIds: ['video-1'], limit: 40 },
      },
      {
        key: buildEntryWarmupKey('view:3', ['picture-1'], 40),
        options: { feedIds: ['picture-1'], limit: 40 },
      },
      {
        key: buildEntryWarmupKey('view:0', ['article-1'], 20),
        options: { feedIds: ['article-1'], limit: 20 },
      },
    ])
  })

  it('treats feeds without a view as articles', () => {
    expect(
      buildEntryWarmupRequests([{ id: 'default-view' }]).map(
        (request) => request.options,
      ),
    ).toEqual([{ feedIds: ['default-view'], limit: 20 }])
  })

  it('uses stable keys for feed order changes', () => {
    expect(buildEntryWarmupKey('view:1', ['b', 'a'], 20)).toBe(
      buildEntryWarmupKey('view:1', ['a', 'b'], 20),
    )
  })
})
