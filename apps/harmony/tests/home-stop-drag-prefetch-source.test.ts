import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

test('home mode stop dragging schedules deferred prefetch after interaction ends', () => {
  assert.match(
    source,
    /onStopDragging: \(mode: SubscriptionMode\): void => \{\s*this\.setHomeScrollInteracting\(false, mode\)\s*this\.flushPendingLoadMoreForMode\(mode\)\s*this\.scheduleHomeLoadMorePrefetch\(160\)/s,
  )
})
