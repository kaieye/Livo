import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const paginationSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/coordinators/home/HomeFeedPagination.ets',
    import.meta.url,
  ),
  'utf8',
)

test('home list-end drain treats reaching the tail as an explicit load-more intent', () => {
  assert.match(
    paginationSource,
    /private shouldStartHomeLoadMoreDrain\(mode: SubscriptionMode, totalCount: number\): boolean/,
  )
  assert.match(
    paginationSource,
    /requestLoadMoreForMode\(mode: SubscriptionMode, allowStaleScrollIntent: boolean = false\): boolean/,
  )
  assert.match(
    paginationSource,
    /const handled = this\.requestLoadMoreForMode\(mode, true\)/,
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

test('list-end drain waits for interaction to settle and loads one page', () => {
  assert.match(
    paginationSource,
    /private stepHomeLoadMoreDrain\(mode: SubscriptionMode, token: number, attempt: number\): void/,
  )
  assert.match(paginationSource, /this\.state\.homeScrollIntent\.isInteracting/)
  assert.match(
    paginationSource,
    /drain page-done mode=\$\{mode\} attempts=\$\{attempt \+ 1\}/,
  )
  assert.doesNotMatch(paginationSource, /new HomeFeedLoadMoreDrain/)
})
