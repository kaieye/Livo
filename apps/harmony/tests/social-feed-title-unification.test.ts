import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  formatXFeedTitle,
  normalizeSocialFeedTitle,
} from '../entry/src/main/ets/common/utils/social/SocialFeedTitles.ts'
import { resolveSocialFeedDisplayTitle } from '../entry/src/main/ets/common/utils/social/SocialFeedPresentation.ts'
import {
  parseNitterRetweetFromTitle,
  parseRetweetAuthorFromTitle,
} from '../entry/src/main/ets/common/utils/social/TweetParsing.ts'
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
    /import \{ (?:resolveSocialFeedDisplayImageUrl,\s*)?resolveSocialFeedDisplayTitle(?:\s*,\s*resolveSocialFeedDisplayImageUrl)? \} from '..\/utils\/social\/SocialFeedPresentation'/,
  )
  assert.match(
    source,
    /const displayFeedTitle = resolveSocialFeedDisplayTitle\(feed\.title, feed\.url, feed\.siteUrl \|\| ''\)/,
  )
  assert.match(source, /feedTitle: displayFeedTitle,/)
})

test('feed detail title resolver normalizes raw x titles from every snapshot source', () => {
  const source = readFileSync(
    'entry/src/main/ets/common/coordinators/feed-detail/FeedDetailViewModel.ets',
    'utf8',
  )

  assert.match(
    source,
    /resolveSocialFeedDisplayTitle\(\s*snapshot\.previewPayload\?\.feedTitle \|\| snapshot\.targetTitle \|\| snapshot\.existingFeed\?\.title \|\| '',/s,
  )
  assert.match(source, /normalized\.includes\('nitter\.'\)/)
})

// ---- Nitter-specific tests ----

test('nitter feed title "Name / @handle" normalizes to "Name - X"', () => {
  assert.equal(
    formatXFeedTitle('Elon Musk / @elonmusk', 'elonmusk'),
    'Elon Musk - X',
  )
  assert.equal(formatXFeedTitle('xAI / @xai', 'xai'), 'xAI - X')
  assert.equal(
    formatXFeedTitle('The Boring Company / @boringcompany', 'boringcompany'),
    'The Boring Company - X',
  )
})

test('nitter feed title resolution via full pipeline', () => {
  const displayTitle = resolveSocialFeedDisplayTitle(
    'Elon Musk / @elonmusk',
    'https://nitter.poast.org/elonmusk/rss',
    'https://x.com/elonmusk',
  )
  assert.equal(displayTitle, 'Elon Musk - X')
})

test('nitter RT by @retweeter title is detected as pure retweet', () => {
  const parsed = parseNitterRetweetFromTitle(
    'RT by @elonmusk: Last year, China added as much energy to its grid as Germany has in total.',
  )
  assert.ok(parsed)
  assert.equal(parsed!.style, 'pure')
  assert.equal(parsed!.commentText, '')
  assert.equal(
    parsed!.originalText,
    'Last year, China added as much energy to its grid as Germany has in total.',
  )
  // originalDisplayName and originalUsername are empty — callers resolve from source.author
  assert.equal(parsed!.originalDisplayName, '')
  assert.equal(parsed!.originalUsername, '')
})

test('nitter RT by @retweeter is parsed by author-from-title (with "by" stripped)', () => {
  const titleAuthor = parseRetweetAuthorFromTitle(
    'RT by @elonmusk: Last year, China added as much energy to its grid as Germany has in total.',
  )
  assert.ok(titleAuthor)
  assert.equal(titleAuthor!.displayName, 'elonmusk')
  assert.equal(titleAuthor!.username, '@elonmusk')
})

test('nitter non-RT title is not detected as retweet', () => {
  const parsed = parseNitterRetweetFromTitle('Vera nice, Vera nice … 🤌')
  assert.equal(parsed, undefined)
})

test('nitter retweet card resolves original author from creator field', () => {
  // Simulates a Nitter RSS item where:
  // - title = "RT by @elonmusk: <tweet text>"
  // - creator (<dc:creator>) = "@cremieuxrecueil" (the original author)
  // - description = "<p><tweet text></p>"
  const presentation = presentTweetEntryFromCard({
    title:
      'RT by @elonmusk: Last year, China added as much energy to its grid as Germany has in total.',
    summary:
      '<p>Last year, China added as much energy to its grid as Germany has in total.</p>',
    content: '',
    author: '@cremieuxrecueil',
    articleUrl: 'https://nitter.net/cremieuxrecueil/status/2056515000823640289',
    feedTitle: 'Elon Musk - X',
    feedImageUrl: 'https://unavatar.io/x/elonmusk',
    publishedAt: 0,
    mediaUrls: [],
  })

  assert.equal(presentation.kind, 'retweet')
  assert.equal(presentation.retweetStyle, 'pure')
  assert.equal(presentation.displayName, 'Elon Musk - X')
  assert.equal(presentation.retweetByLabel, 'Elon Musk - X')
  assert.ok(presentation.quotedTweet)
  assert.equal(presentation.quotedTweet!.displayName, 'cremieuxrecueil')
  assert.equal(presentation.quotedTweet!.username, '@cremieuxrecueil')
  assert.ok(
    presentation.quotedTweet!.text.includes(
      'Last year, China added as much energy to its grid as Germany has in total.',
    ),
  )
})

test('nitter own tweet (creator matches feed owner) is not treated as retweet', () => {
  const presentation = presentTweetEntryFromCard({
    title: 'Vera nice, Vera nice … 🤌',
    summary: '<p>Vera nice, Vera nice … 🤌</p>',
    content: '',
    author: '@elonmusk',
    articleUrl: 'https://nitter.net/elonmusk/status/2056547935752441863',
    feedTitle: 'Elon Musk - X',
    feedImageUrl: 'https://unavatar.io/x/elonmusk',
    publishedAt: 0,
    mediaUrls: [],
  })

  assert.equal(presentation.kind, 'tweet')
  assert.equal(presentation.displayName, 'Elon Musk - X')
})

// ---- Nitter quote tweet tests ----

test('nitter quote tweet (own comment + blockquote with <b> author)', () => {
  // Real data from elonmusk_nitter: "Vera nice, Vera nice … 🤌" quoting @nvidia
  const presentation = presentTweetEntryFromCard({
    title: 'Vera nice, Vera nice … 🤌',
    summary: [
      '<p>Vera nice, Vera nice … 🤌</p>',
      '<hr/>',
      '<blockquote>',
      '<b>NVIDIA (@nvidia)</b>',
      '<p>',
      '<p>Thanks @SpaceX and @elonmusk, excited for you to try out the NVIDIA Vera CPU 🎉</p>',
      '</p>',
      '<footer>— <cite><a href="https://nitter.net/nvidia/status/2056523120652275878#m">link</a></cite></footer>',
      '</blockquote>',
    ].join('\n'),
    content: '',
    author: '@elonmusk',
    articleUrl: 'https://nitter.net/elonmusk/status/2056547935752441863',
    feedTitle: 'Elon Musk - X',
    feedImageUrl: 'https://unavatar.io/x/elonmusk',
    publishedAt: 0,
    mediaUrls: [],
  })

  assert.equal(presentation.kind, 'quote')
  assert.equal(presentation.displayName, 'Elon Musk - X')
  assert.ok(
    presentation.text.includes('Vera nice, Vera nice'),
    `text should contain comment, got: ${presentation.text}`,
  )
  assert.ok(presentation.quotedTweet)
  assert.equal(presentation.quotedTweet!.displayName, 'NVIDIA')
  assert.equal(presentation.quotedTweet!.username, '@nvidia')
  assert.ok(
    presentation.quotedTweet!.text.includes('Thanks'),
    `quoted text should contain NVIDIA tweet, got: ${presentation.quotedTweet!.text}`,
  )
})

test('nitter quote tweet with multi-line comment', () => {
  // Real data: "Please help make Grok Build great!\n\nMuch appreciated, Elon." quoting @morganlinton
  const presentation = presentTweetEntryFromCard({
    title: 'Please help make Grok Build great!\n\nMuch appreciated, Elon.',
    summary: [
      '<p>Please help make Grok Build great!<br>',
      '<br>',
      'Much appreciated, Elon.</p>',
      '<hr/>',
      '<blockquote>',
      '<b>Morgan (@morganlinton)</b>',
      '<p>',
      '<p>Phew, Grok Build is really thorough, pretty incredible.</p>',
      '</p>',
      '<footer>— <cite><a href="https://nitter.net/morganlinton/status/2056395661915148367#m">link</a></cite></footer>',
      '</blockquote>',
    ].join('\n'),
    content: '',
    author: '@elonmusk',
    articleUrl: 'https://nitter.net/elonmusk/status/2056409870262268270',
    feedTitle: 'Elon Musk - X',
    feedImageUrl: 'https://unavatar.io/x/elonmusk',
    publishedAt: 0,
    mediaUrls: [],
  })

  assert.equal(presentation.kind, 'quote')
  assert.ok(presentation.quotedTweet)
  assert.equal(presentation.quotedTweet!.displayName, 'Morgan')
  assert.equal(presentation.quotedTweet!.username, '@morganlinton')
})

test('nitter quote tweet with <b> author containing emoji', () => {
  // Real data: "Insane" quoting @Rothmus with 🏴 emoji in display name
  const presentation = presentTweetEntryFromCard({
    title: 'Insane',
    summary: [
      '<p>Insane</p>',
      '<hr/>',
      '<blockquote>',
      '<b>Rothmus 🏴 (@Rothmus)</b>',
      '<p>',
      '<p>UK primary schools are teaching 7-year-olds...</p>',
      '</p>',
      '<footer>— <cite><a href="https://nitter.net/Rothmus/status/2056474178514010405#m">link</a></cite></footer>',
      '</blockquote>',
    ].join('\n'),
    content: '',
    author: '@elonmusk',
    articleUrl: 'https://nitter.net/elonmusk/status/2056476778953093308',
    feedTitle: 'Elon Musk - X',
    feedImageUrl: 'https://unavatar.io/x/elonmusk',
    publishedAt: 0,
    mediaUrls: [],
  })

  assert.equal(presentation.kind, 'quote')
  assert.ok(presentation.quotedTweet)
  assert.equal(presentation.quotedTweet!.displayName, 'Rothmus 🏴')
  assert.equal(presentation.quotedTweet!.username, '@Rothmus')
})

// ---- Title prefix stripping tests ----

test('nitter "Pinned:" prefix is stripped from display name fallback', () => {
  const presentation = presentTweetEntryFromCard({
    title:
      'Pinned: Regarding the OpenAI case, the judge & jury never actually ruled...',
    summary:
      '<p>Regarding the OpenAI case, the judge & jury never actually ruled on the merits of the case...</p>',
    content: '',
    author: '@elonmusk',
    articleUrl: 'https://nitter.net/elonmusk/status/2056474896641782077',
    feedTitle: 'Elon Musk - X',
    feedImageUrl: 'https://unavatar.io/x/elonmusk',
    publishedAt: 0,
    mediaUrls: [],
  })

  assert.equal(presentation.kind, 'tweet')
  assert.equal(presentation.displayName, 'Elon Musk - X')
})

test('nitter "R to @owner:" prefix is stripped from display name fallback', () => {
  const presentation = presentTweetEntryFromCard({
    title: 'R to @sama: Please get in touch if this sounds interesting!',
    summary: '<p>Please get in touch if this sounds interesting!</p>',
    content: '',
    author: '@sama',
    articleUrl: 'https://nitter.net/sama/status/2053951875654054011',
    feedTitle: 'Sam Altman - X',
    feedImageUrl: 'https://unavatar.io/x/sama',
    publishedAt: 0,
    mediaUrls: [],
  })

  assert.equal(presentation.kind, 'tweet')
  assert.equal(presentation.displayName, 'Sam Altman - X')
})
