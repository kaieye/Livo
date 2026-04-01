import test from 'node:test'
import assert from 'node:assert/strict'

import {
  presentTweetEntryFromEntry,
  presentTweetEntryFromCard,
} from '../entry/src/main/ets/common/utils/TweetEntryPresentation.ts'

type TweetEntryLike = Parameters<typeof presentTweetEntryFromEntry>[0] & {
  id: string
  publishedAt: number
  publishedLabel?: string
}

type TweetCardLike = Parameters<typeof presentTweetEntryFromCard>[0] & {
  id: string
  publishedAt: number
  publishedLabel?: string
  feedTitle: string
}

test('presentTweetEntryFromEntry extracts x username, text, media, and metrics', () => {
  const entry: TweetEntryLike = {
    id: 'entry-1',
    title: 'OpenAI shipped Codex',
    summary:
      '<p>Codex is live now.</p><p>12 replies 34 reposts 56 likes 78 views</p>',
    content: '',
    author: 'OpenAI',
    articleUrl: 'https://example.com/articles/1234567890',
    publishedLabel: '2024-04-01 00:00',
    imageUrl: 'https://pbs.twimg.com/media/one.jpg',
    mediaUrls: [
      'https://pbs.twimg.com/media/one.jpg',
      'https://pbs.twimg.com/media/two.jpg',
    ],
    publishedAt: 1711920000000,
  }

  const presented = presentTweetEntryFromEntry(
    entry,
    'https://unavatar.io/x/OpenAI',
  )

  assert.equal(presented.displayName, 'OpenAI')
  assert.equal(presented.username, '@OpenAI')
  assert.equal(presented.avatarUrl, 'https://unavatar.io/x/OpenAI')
  assert.equal(presented.text, 'Codex is live now.')
  assert.deepEqual(presented.mediaUrls, [
    'https://pbs.twimg.com/media/one.jpg',
    'https://pbs.twimg.com/media/two.jpg',
  ])
  assert.equal(presented.publishedLabel, '2024-04-01 00:00')
  assert.equal(presented.articleUrl, 'https://example.com/articles/1234567890')
  assert.equal(presented.replyCount, '12')
  assert.equal(presented.repostCount, '34')
  assert.equal(presented.likeCount, '56')
  assert.equal(presented.viewCount, '78')
})

test('presentTweetEntryFromCard falls back cleanly when metrics are missing', () => {
  const card: TweetCardLike = {
    id: 'card-1',
    title: 'Shipping notes',
    summary: 'Plain text summary only',
    imageUrl: 'https://pbs.twimg.com/media/card.jpg',
    feedImageUrl: 'https://unavatar.io/x/verge',
    author: 'The Verge',
    articleUrl: 'https://example.com/articles/999',
    publishedAt: 1711920000000,
    publishedLabel: '3 小时前',
    mediaUrls: [],
    feedTitle: 'The Verge',
  }

  const presented = presentTweetEntryFromCard(card)

  assert.equal(presented.displayName, 'The Verge')
  assert.equal(presented.username, '@verge')
  assert.equal(presented.avatarUrl, 'https://unavatar.io/x/verge')
  assert.equal(presented.text, 'Plain text summary only')
  assert.deepEqual(presented.mediaUrls, [
    'https://pbs.twimg.com/media/card.jpg',
  ])
  assert.equal(presented.publishedLabel, '3 小时前')
  assert.equal(presented.articleUrl, 'https://example.com/articles/999')
  assert.equal(presented.replyCount, '')
  assert.equal(presented.repostCount, '')
  assert.equal(presented.likeCount, '')
  assert.equal(presented.viewCount, '')
})

test('presentTweetEntryFromEntry formats published label when absent', () => {
  const entry: TweetEntryLike = {
    id: 'entry-2',
    title: 'Published label fallback',
    summary: '<p>Fallback date path.</p>',
    content: '',
    author: 'Fallback Author',
    articleUrl: 'https://x.com/Fallback/status/42',
    imageUrl: '',
    mediaUrls: [],
    publishedAt: Date.UTC(2024, 3, 1, 0, 0, 0),
  }

  const presented = presentTweetEntryFromEntry(
    entry,
    'https://unavatar.io/x/Fallback',
  )

  assert.equal(presented.publishedLabel, '2024年4月1日 08:00')
  assert.equal(presented.avatarUrl, 'https://unavatar.io/x/Fallback')
  assert.equal(presented.username, '@Fallback')
})
