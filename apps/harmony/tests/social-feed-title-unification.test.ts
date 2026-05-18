import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  formatXFeedTitle,
  normalizeSocialFeedTitle,
} from '../entry/src/main/ets/common/utils/social/SocialFeedTitles.ts'
import { resolveSocialFeedDisplayTitle } from '../entry/src/main/ets/common/utils/social/SocialFeedPresentation.ts'
import {
  presentTweetEntryFromCard,
  presentTweetEntryFromEntry,
} from '../entry/src/main/ets/common/utils/social/TweetEntryPresentation.ts'

test('x feed titles normalize to one account display name', () => {
  assert.equal(formatXFeedTitle('Twitter @宝玉', 'dotey'), '宝玉 - X')
  assert.equal(
    formatXFeedTitle('The Verge (@verge) / X', 'verge'),
    'The Verge - X',
  )
  assert.equal(formatXFeedTitle('Elon Musk /', 'elonmusk'), 'Elon Musk - X')
  assert.equal(formatXFeedTitle('The Verge @ verge', 'verge'), 'The Verge - X')
  assert.equal(formatXFeedTitle('@sama', 'sama'), 'sama - X')
  assert.equal(formatXFeedTitle('X @sama', 'sama'), 'sama - X')
  assert.equal(
    normalizeSocialFeedTitle('sama', 'https://rsshub.app/twitter/user/sama'),
    'sama - X',
  )
})

test('x feed surfaces and tweet cards use the same display name', () => {
  const feedUrl = 'https://rsshub.pseudoyu.com/twitter/user/verge'
  const siteUrl = 'https://x.com/verge'
  const displayTitle = resolveSocialFeedDisplayTitle(
    'The Verge (@verge) / X',
    feedUrl,
    siteUrl,
  )
  const presentation = presentTweetEntryFromCard({
    title: 'A short post',
    summary: 'A short post',
    content: '',
    author: 'RSSHub',
    articleUrl: 'https://x.com/verge/status/1',
    feedTitle: displayTitle,
    feedImageUrl: 'https://unavatar.io/x/verge',
    publishedAt: 0,
    mediaUrls: [],
  })

  assert.equal(displayTitle, 'The Verge - X')
  assert.equal(presentation.displayName, displayTitle)
})

test('feed detail x preview entries can inherit the feed display name', () => {
  const presentation = presentTweetEntryFromEntry(
    {
      title: 'A short post',
      summary: 'A short post',
      content: '',
      author: 'RSSHub',
      articleUrl: 'https://x.com/verge/status/1',
      publishedAt: 0,
      mediaUrls: [],
    },
    'https://unavatar.io/x/verge',
    'The Verge - X',
  )

  assert.equal(presentation.displayName, 'The Verge - X')
})

test('feed detail x preview passes the hero title into tweet presentation', () => {
  const source = readFileSync(
    'entry/src/main/ets/common/components/FeedDetailView.ets',
    'utf8',
  )

  assert.match(source, /@State resolvedDisplayTitle: string = ''/)
  assert.match(
    source,
    /this\.resolvedDisplayTitle = resolveFeedDetailDisplayTitle\(this\.displaySnapshot\(\)\)/,
  )
  assert.match(
    source,
    /this\.tweetPresentationCache\.get\(entry, this\.resolvedAvatarUrl\(\), this\.heroTitle\(\)\)/,
  )
})

test('model conversion normalizes feed titles before entry and detail rendering', () => {
  const source = readFileSync(
    'entry/src/main/ets/common/models/LivoModels.ets',
    'utf8',
  )

  assert.match(
    source,
    /import \{ resolveSocialFeedDisplayTitle \} from '..\/utils\/SocialFeedPresentation'/,
  )
  assert.match(
    source,
    /const displayFeedTitle = resolveSocialFeedDisplayTitle\(feed\.title, feed\.url, feed\.siteUrl \|\| ''\)/,
  )
  assert.match(source, /feedTitle: displayFeedTitle,/)
})

test('feed detail title resolver normalizes raw x titles from every snapshot source', () => {
  const source = readFileSync(
    'entry/src/main/ets/common/utils/feed-detail/FeedDetailViewModel.ets',
    'utf8',
  )

  assert.match(
    source,
    /resolveSocialFeedDisplayTitle\(\s*snapshot\.previewPayload\?\.feedTitle \|\| snapshot\.targetTitle \|\| snapshot\.existingFeed\?\.title \|\| '',/s,
  )
  assert.match(source, /normalized\.includes\('nitter\.'\)/)
})
