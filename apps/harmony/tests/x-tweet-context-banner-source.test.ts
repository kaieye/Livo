import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const tweetCardSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/TweetEntryCard.ets',
    import.meta.url,
  ),
  'utf8',
)

const articleDetailSource = readFileSync(
  new URL('../entry/src/main/ets/pages/ArticleDetail.ets', import.meta.url),
  'utf8',
)

test('TweetEntryCard keeps quote content separated without top quote banner', () => {
  assert.doesNotMatch(tweetCardSource, /private QuoteBanner\(\)/)
  assert.doesNotMatch(tweetCardSource, /this\.QuoteBanner\(\)/)
  assert.doesNotMatch(tweetCardSource, /引用帖/)
  assert.doesNotMatch(tweetCardSource, /Text\('原文引用'\)/)
  assert.doesNotMatch(tweetCardSource, /Text\('单独展开显示'\)/)
  assert.match(tweetCardSource, /private quotedAuthorLabel\(\): string/)
})

test('ArticleDetail social view shows tweet context label for reposts and quotes', () => {
  assert.match(articleDetailSource, /private tweetContextLabel\(\): string/)
  assert.match(
    articleDetailSource,
    /return `转发自 \$\{presentation\.retweetByLabel\.trim\(\)\}`/,
  )
  assert.match(
    articleDetailSource,
    /return `引用自 \$\{presentation\.quotedTweet\.displayName\.trim\(\)\}`/,
  )
  assert.match(articleDetailSource, /if \(this\.tweetContextLabel\(\)\) \{/)
  assert.match(articleDetailSource, /Text\(this\.tweetContextLabel\(\)\)/)
  assert.doesNotMatch(articleDetailSource, /Text\('原文引用'\)/)
  assert.doesNotMatch(articleDetailSource, /Text\('与正文分开显示'\)/)
})
