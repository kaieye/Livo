import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/HomeModeEntriesPage.ets',
    import.meta.url,
  ),
  'utf8',
)

test('home mode entries page renders tweet-like entries with tweet card in articles and social modes', () => {
  assert.match(
    source,
    /private shouldRenderTweetCard\(entry: EntryCardModel\): boolean \{\s*return isTweetLikeEntry\(entry\) && \(this\.mode === 'social' \|\| this\.mode === 'articles'\)\s*\}/s,
  )
  assert.match(
    source,
    /if \(this\.shouldRenderTweetCard\(entry\)\) \{\s*TweetEntryCard\(/s,
  )
  assert.match(source, /List\(\{ space: 0, scroller: this\.scroller \}\)/)
  assert.match(source, /flatMode: true,/)
  assert.match(source, /showBottomDivider: index < this\.totalCount - 1,/)
  assert.match(
    source,
    /\.margin\(\{ bottom: this\.articleListItemBottomGap\(entry, index\) \}\)/,
  )
})
