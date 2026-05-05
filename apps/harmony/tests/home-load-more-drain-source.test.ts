import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const drainSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/HomeFeedLoadMoreDrain.ets',
    import.meta.url,
  ),
  'utf8',
)

const paginationSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/HomeFeedPagination.ets',
    import.meta.url,
  ),
  'utf8',
)

test('home list-end drain treats reaching the tail as an explicit load-more intent', () => {
  assert.match(
    drainSource,
    /requestLoadMoreForMode\(mode: SubscriptionMode, allowStaleScrollIntent\?: boolean\): boolean/,
  )
  assert.match(
    drainSource,
    /const handled = this\.owner\.requestLoadMoreForMode\(mode, true\)/,
  )
  assert.match(
    paginationSource,
    /loadMoreBlockedReason\(mode: SubscriptionMode, allowStaleScrollIntent: boolean = false\): string/,
  )
  assert.match(
    paginationSource,
    /if \(!allowStaleScrollIntent && !this\.hasRecentHomeScrollIntent\(\)\) \{ return 'no-recent-scroll-intent' \}/,
  )
})

test('article and social list-end drain loads one page instead of draining to exhaustion', () => {
  assert.match(
    drainSource,
    /private shouldStopAfterHandledStep\(mode: SubscriptionMode\): boolean \{/,
  )
  assert.match(drainSource, /return mode === 'articles' \|\| mode === 'social'/)
  assert.match(
    drainSource,
    /drain page-done mode=\$\{mode\} attempts=\$\{attempt \+ 1\}/,
  )
})
