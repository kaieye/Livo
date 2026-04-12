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
    articleUrl: 'https://example.com/articles/42',
    imageUrl: '',
    mediaUrls: [],
    publishedAt: Date.UTC(2024, 3, 1, 0, 0, 0),
  }

  const presented = presentTweetEntryFromEntry(entry, '')

  assert.equal(presented.publishedLabel, '2024年4月1日 08:00')
  assert.equal(presented.avatarUrl, '')
  assert.equal(presented.username, '')
})

test('presentTweetEntryFromEntry does not infer username from summary mention', () => {
  const entry: TweetEntryLike = {
    id: 'entry-3',
    title: 'Handle mention',
    summary:
      '<p>Thanks <a href="https://x.com/openai">@OpenAI</a> for this.</p>',
    content: '',
    author: 'OpenAI',
    articleUrl: 'https://example.com/articles/handle-mention',
    imageUrl: '',
    mediaUrls: [],
    publishedAt: Date.UTC(2024, 3, 2, 0, 0, 0),
  }

  const presented = presentTweetEntryFromEntry(entry, '')

  assert.equal(presented.username, '')
  assert.equal(presented.displayName, 'OpenAI')
  assert.equal(presented.avatarUrl, '')
})

test('presentTweetEntryFromEntry ignores official x status paths as usernames', () => {
  const entry: TweetEntryLike = {
    id: 'entry-4',
    title: 'Official status path',
    summary: '<p>Plain text body.</p>',
    content: '',
    author: 'OpenAI',
    articleUrl: 'https://x.com/i/web/status/123',
    imageUrl: '',
    mediaUrls: [],
    publishedAt: Date.UTC(2024, 3, 3, 0, 0, 0),
  }

  const presented = presentTweetEntryFromEntry(entry, '')

  assert.equal(presented.username, '')
  assert.equal(presented.articleUrl, 'https://x.com/i/web/status/123')
})

test('presentTweetEntryFromEntry classifies RT prefix content as retweet', () => {
  const entry: TweetEntryLike = {
    id: 'entry-5',
    title: '',
    summary: 'RT @ArthurMacWaters: Western civilization is awesome, actually',
    content: '',
    author: 'Elon Musk',
    articleUrl: 'https://x.com/elonmusk/status/1',
    imageUrl: '',
    mediaUrls: [],
    publishedAt: Date.UTC(2024, 3, 4, 0, 0, 0),
  }

  const presented = presentTweetEntryFromEntry(
    entry,
    'https://unavatar.io/x/elonmusk',
  )

  assert.equal(presented.kind, 'retweet')
  assert.equal(presented.retweetByLabel, 'Elon Musk')
  assert.equal(presented.displayName, 'ArthurMacWaters')
  assert.equal(presented.username, '@ArthurMacWaters')
  assert.equal(
    presented.avatarUrl,
    'https://unavatar.io/x/ArthurMacWaters?fallback=false',
  )
  assert.equal(presented.text, 'Western civilization is awesome, actually')
})

test('presentTweetEntryFromCard classifies RT prefix content as retweet with original avatar', () => {
  const card: TweetCardLike = {
    id: 'card-retweet',
    title: '',
    summary: 'RT @ArthurMacWaters: Western civilization is awesome, actually',
    content: '',
    imageUrl: '',
    feedImageUrl: 'https://unavatar.io/x/elonmusk',
    author: 'Elon Musk',
    articleUrl: 'https://x.com/elonmusk/status/1',
    publishedAt: Date.UTC(2024, 3, 4, 0, 0, 0),
    mediaUrls: [],
    feedTitle: 'Elon Musk',
  }

  const presented = presentTweetEntryFromCard(card)

  assert.equal(presented.kind, 'retweet')
  assert.equal(presented.retweetByLabel, 'Elon Musk')
  assert.equal(presented.displayName, 'ArthurMacWaters')
  assert.equal(presented.username, '@ArthurMacWaters')
  assert.equal(presented.avatarUrl, 'https://unavatar.io/x/elonmusk')
})

test('presentTweetEntryFromCard falls back to source username avatar when feed avatar is missing', () => {
  const card: TweetCardLike = {
    id: 'card-source-avatar',
    title: '',
    summary: '<p>First line</p><p>Second line</p>',
    content: '',
    imageUrl: '',
    feedImageUrl: '',
    author: 'OpenAI',
    articleUrl: 'https://x.com/openai/status/22',
    publishedAt: Date.UTC(2024, 3, 4, 0, 0, 0),
    mediaUrls: [],
    feedTitle: 'OpenAI',
  }

  const presented = presentTweetEntryFromCard(card)

  assert.equal(presented.username, '@openai')
  assert.equal(
    presented.avatarUrl,
    'https://unavatar.io/x/openai?fallback=false',
  )
})

test('presentTweetEntryFromEntry keeps ambiguous RT content as plain tweet', () => {
  const entry: TweetEntryLike = {
    id: 'entry-6',
    title: '',
    summary: 'RT this is still just plain text without a real author split',
    content: '',
    author: 'OpenAI',
    articleUrl: 'https://x.com/openai/status/2',
    imageUrl: '',
    mediaUrls: [],
    publishedAt: Date.UTC(2024, 3, 5, 0, 0, 0),
  }

  const presented = presentTweetEntryFromEntry(
    entry,
    'https://unavatar.io/x/openai',
  )

  assert.equal(presented.kind, 'tweet')
  assert.equal(presented.retweetByLabel, '')
  assert.equal(presented.quotedTweet, undefined)
})

test('presentTweetEntryFromEntry classifies blockquote content as quote tweet', () => {
  const entry: TweetEntryLike = {
    id: 'entry-7',
    title: '',
    summary:
      '<p>Try out self-driving in a Tesla.</p><blockquote><p>Robert Scoble @Scobleizer</p><p>I was on @wholemars space this afternoon while my Model 3 drove me for a couple of hours</p></blockquote>',
    content: '',
    author: 'Elon Musk',
    articleUrl: 'https://x.com/elonmusk/status/3',
    imageUrl: '',
    mediaUrls: [],
    publishedAt: Date.UTC(2024, 3, 6, 0, 0, 0),
  }

  const presented = presentTweetEntryFromEntry(
    entry,
    'https://unavatar.io/x/elonmusk',
  )

  assert.equal(presented.kind, 'quote')
  assert.equal(presented.text, 'Try out self-driving in a Tesla.')
  assert.equal(presented.quotedTweet?.displayName, 'Robert Scoble')
  assert.equal(presented.quotedTweet?.username, '@Scobleizer')
  assert.equal(
    presented.quotedTweet?.avatarUrl,
    'https://unavatar.io/x/Scobleizer?fallback=false',
  )
  assert.equal(
    presented.quotedTweet?.text,
    'I was on @wholemars space this afternoon while my Model 3 drove me for a couple of hours',
  )
})

test('presentTweetEntryFromEntry classifies rsshub quote div content as quote tweet', () => {
  const entry: TweetEntryLike = {
    id: 'entry-rsshub-quote',
    title: '',
    summary:
      'Grok groks<div class="rsshub-quote"><br><br>X Freeze: Elon Musk speaks hard truths on what Nelson Mandela actually stood for<br><br>They are literally shaping humanity\'s future.<br><br><img src="https://pbs.twimg.com/media/HFs6HTKWMAEsorg?format=jpg&amp;name=orig"></div>',
    content: '',
    author: 'Elon Musk',
    articleUrl: 'https://x.com/elonmusk/status/2043293725804421596',
    imageUrl: '',
    mediaUrls: [],
    publishedAt: Date.UTC(2024, 3, 6, 0, 0, 0),
  }

  const presented = presentTweetEntryFromEntry(
    entry,
    'https://unavatar.io/x/elonmusk',
  )

  assert.equal(presented.kind, 'quote')
  assert.equal(presented.text, 'Grok groks')
  assert.equal(presented.quotedTweet?.displayName, 'X Freeze')
  assert.equal(
    presented.quotedTweet?.text,
    "Elon Musk speaks hard truths on what Nelson Mandela actually stood for\n\nThey are literally shaping humanity's future.",
  )
  assert.deepEqual(presented.quotedTweet?.mediaUrls, [
    'https://pbs.twimg.com/media/HFs6HTKWMAEsorg?format=jpg&name=orig',
  ])
})

test('presentTweetEntryFromCard prefers rich content over flattened summary for quote main text', () => {
  const card: TweetCardLike = {
    id: 'card-rsshub-summary-content-split',
    title: 'Grok groks',
    summary: 'Grok groksAlice Smith:',
    content:
      'Grok groks<div class="rsshub-quote"><br><br>Alice Smith:<br><br><img src="https://pbs.twimg.com/media/HFs6HTKWMAEsorg?format=jpg&amp;name=orig"></div>',
    imageUrl: '',
    feedImageUrl: 'https://unavatar.io/x/elonmusk',
    author: 'Elon Musk',
    articleUrl: 'https://x.com/elonmusk/status/2043293725804421596',
    publishedAt: Date.UTC(2024, 3, 6, 0, 0, 0),
    mediaUrls: [],
    feedTitle: 'Elon Musk',
  }

  const presented = presentTweetEntryFromCard(card)

  assert.equal(presented.kind, 'quote')
  assert.equal(presented.text, 'Grok groks')
  assert.equal(presented.quotedTweet?.displayName, 'Alice Smith')
})

test('presentTweetEntryFromCard preserves media order and metrics for timeline actions', () => {
  const card: TweetCardLike = {
    id: 'card-2',
    title: '',
    summary:
      '<p>Hello world.</p><p>12 replies 34 reposts 56 likes 78 views</p>',
    content: '',
    imageUrl: 'https://pbs.twimg.com/media/four.jpg',
    feedImageUrl: 'https://unavatar.io/x/openai',
    author: 'OpenAI',
    articleUrl: 'https://x.com/openai/status/2',
    publishedAt: 1711920000000,
    mediaUrls: [
      'https://pbs.twimg.com/media/one.jpg',
      'https://pbs.twimg.com/media/two.jpg',
      'https://pbs.twimg.com/media/three.jpg',
    ],
    feedTitle: 'OpenAI',
  }

  const presented = presentTweetEntryFromCard(card)

  assert.deepEqual(presented.mediaUrls, [
    'https://pbs.twimg.com/media/one.jpg',
    'https://pbs.twimg.com/media/two.jpg',
    'https://pbs.twimg.com/media/three.jpg',
    'https://pbs.twimg.com/media/four.jpg',
  ])
  assert.equal(presented.replyCount, '12')
  assert.equal(presented.repostCount, '34')
  assert.equal(presented.likeCount, '56')
  assert.equal(presented.viewCount, '78')
})

test('presentTweetEntryFromEntry preserves paragraph breaks from tweet html content', () => {
  const entry: TweetEntryLike = {
    id: 'entry-lines',
    title: '',
    summary: '<p>First line</p><p>Second line</p><p>Third line</p>',
    content: '',
    author: 'OpenAI',
    articleUrl: 'https://x.com/openai/status/4',
    imageUrl: '',
    mediaUrls: [],
    publishedAt: Date.UTC(2024, 3, 7, 0, 0, 0),
  }

  const presented = presentTweetEntryFromEntry(
    entry,
    'https://unavatar.io/x/openai',
  )

  assert.equal(presented.text, 'First line\n\nSecond line\n\nThird line')
})

test('presentTweetEntryFromEntry extracts image urls from tweet html when mediaUrls are absent', () => {
  const entry: TweetEntryLike = {
    id: 'entry-html-image',
    title: '',
    summary:
      '<p>Photo set</p><img src="https://pbs.twimg.com/media/one.jpg" /><img src="https://pbs.twimg.com/media/two.jpg" />',
    content: '',
    author: 'OpenAI',
    articleUrl: 'https://x.com/openai/status/5',
    imageUrl: '',
    mediaUrls: [],
    publishedAt: Date.UTC(2024, 3, 7, 0, 0, 0),
  }

  const presented = presentTweetEntryFromEntry(
    entry,
    'https://unavatar.io/x/openai',
  )

  assert.deepEqual(presented.mediaUrls, [
    'https://pbs.twimg.com/media/one.jpg',
    'https://pbs.twimg.com/media/two.jpg',
  ])
})
