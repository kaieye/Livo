import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/home/HomeFeedLoadMorePrefetch.ets',
    import.meta.url,
  ),
  'utf8',
)

test('home load more prefetch keeps multi-page article buffers and consumes them incrementally', () => {
  assert.match(
    source,
    /private prefetchPageMultiplier\(mode: SubscriptionMode\): number \{/,
  )
  assert.match(source, /&& !this\.session\.homeScrollIntent\.isInteracting/)
  assert.match(
    source,
    /if \(mode === 'articles'\) \{\s*return Math\.max\(2, HOME_LOAD_MORE_FETCH_AHEAD_PAGE_MULTIPLIER\)/s,
  )
  assert.match(
    source,
    /currentLimit \+ step \* this\.prefetchPageMultiplier\(mode\)/,
  )
  assert.match(
    source,
    /const entries = this\.session\.homeLoadMorePrefetchEntries\.slice\(0, nextLimit\)/,
  )
  assert.match(source, /if \(remainingPrefetchedLimit === nextLimit\) \{/)
})
