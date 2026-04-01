import test from 'node:test'
import assert from 'node:assert/strict'

import {
  presentTweetEntryFromEntry,
  presentTweetEntryFromCard,
} from '../entry/src/main/ets/common/utils/TweetEntryPresentation.ts'

test('presentTweetEntryFromEntry extracts x username, text, media, and metrics', () => {
  const presented = presentTweetEntryFromEntry(
    {
      id: 'entry-1',
      title: 'OpenAI shipped Codex',
      summary:
        '<p>Codex is live now.</p><p>12 replies 34 reposts 56 likes 78 views</p>',
      content: '',
      author: 'OpenAI',
      articleUrl: 'https://x.com/OpenAI/status/1234567890',
      publishedLabel: '2024-04-01 00:00',
      imageUrl: 'https://pbs.twimg.com/media/one.jpg',
      mediaUrls: [
        'https://pbs.twimg.com/media/one.jpg',
        'https://pbs.twimg.com/media/two.jpg',
      ],
      publishedAt: 1711920000000,
    } as any,
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
  assert.equal(presented.articleUrl, 'https://x.com/OpenAI/status/1234567890')
  assert.equal(presented.replyCount, '12')
  assert.equal(presented.repostCount, '34')
  assert.equal(presented.likeCount, '56')
  assert.equal(presented.viewCount, '78')
})

test('presentTweetEntryFromCard falls back cleanly when metrics are missing', () => {
  const presented = presentTweetEntryFromCard({
    id: 'card-1',
    title: 'Shipping notes',
    summary: 'Plain text summary only',
    imageUrl: 'https://pbs.twimg.com/media/card.jpg',
    feedImageUrl: 'https://unavatar.io/x/verge',
    author: 'The Verge',
    articleUrl: 'https://x.com/verge/status/999',
    publishedAt: 1711920000000,
    publishedLabel: '3 小时前',
    mediaUrls: [],
    feedTitle: 'The Verge',
  } as any)

  assert.equal(presented.displayName, 'The Verge')
  assert.equal(presented.username, '@verge')
  assert.equal(presented.avatarUrl, 'https://unavatar.io/x/verge')
  assert.equal(presented.text, 'Plain text summary only')
  assert.deepEqual(presented.mediaUrls, [
    'https://pbs.twimg.com/media/card.jpg',
  ])
  assert.equal(presented.publishedLabel, '3 小时前')
  assert.equal(presented.articleUrl, 'https://x.com/verge/status/999')
  assert.equal(presented.replyCount, '')
  assert.equal(presented.repostCount, '')
  assert.equal(presented.likeCount, '')
  assert.equal(presented.viewCount, '')
})
