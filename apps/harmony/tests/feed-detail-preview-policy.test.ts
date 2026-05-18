import test from 'node:test'
import assert from 'node:assert/strict'

import {
  feedDetailMatchesTarget,
  latestFeedDetailEntryPublishedAt,
  resolvePreferredFeedDetailPreviewEntries,
  shouldReseedFeedDetailFromCachedPreview,
} from '../entry/src/main/ets/common/utils/feed-detail/FeedDetailPreviewPolicy.ts'

function entry(id: string, publishedAt: number) {
  return {
    id,
    feedId: 'feed-1',
    title: id,
    url: `https://example.com/${id}`,
    summary: '',
    content: '',
    author: '',
    publishedAt,
    readingTimeMinutes: 0,
    tags: [],
    mediaUrls: [],
    isRead: false,
    isStarred: false,
    createdAt: 0,
    updatedAt: 0,
  }
}

test('feed detail preview chooses cached entries only when they are newer', () => {
  const localEntries = [entry('local-new', 200), entry('local-old', 100)]
  const cachedEntries = [entry('cached-old', 150)]
  assert.equal(
    resolvePreferredFeedDetailPreviewEntries(localEntries, cachedEntries),
    localEntries,
  )

  const newerCachedEntries = [entry('cached-new', 300)]
  assert.equal(
    resolvePreferredFeedDetailPreviewEntries(localEntries, newerCachedEntries),
    newerCachedEntries,
  )
  assert.equal(latestFeedDetailEntryPublishedAt(newerCachedEntries), 300)
})

test('feed detail reseeds from cached preview for empty or richer non-stale history', () => {
  const cachedPayload = {
    etag: '',
    lastModified: '',
    feedTitle: 'Feed',
    siteUrl: 'https://example.com',
    imageUrl: '',
    description: '',
    entries: [entry('cached-new', 200), entry('cached-old', 50)],
  }

  assert.equal(shouldReseedFeedDetailFromCachedPreview([], cachedPayload), true)
  assert.equal(
    shouldReseedFeedDetailFromCachedPreview(
      [entry('local', 200)],
      cachedPayload,
    ),
    true,
  )
  assert.equal(
    shouldReseedFeedDetailFromCachedPreview(
      [entry('local-newer', 300)],
      cachedPayload,
    ),
    false,
  )
})

test('feed detail target matching normalizes feed and site urls', () => {
  const feed = {
    id: 'feed-1',
    title: 'Feed',
    url: 'https://rss.example.com/feed/',
    siteUrl: 'https://example.com/',
    view: 0,
    showInAll: true,
    errorCount: 0,
    createdAt: 0,
    updatedAt: 0,
  }

  assert.equal(
    feedDetailMatchesTarget(feed, 'https://rss.example.com/feed', ''),
    true,
  )
  assert.equal(
    feedDetailMatchesTarget(
      feed,
      'https://other.example.com/feed',
      'https://example.com',
    ),
    true,
  )
  assert.equal(
    feedDetailMatchesTarget(
      feed,
      'https://other.example.com/feed',
      'https://other.example.com',
    ),
    false,
  )
})
