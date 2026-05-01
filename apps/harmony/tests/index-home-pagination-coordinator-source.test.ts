import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

const paginationSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/IndexHomePaginationCoordinator.ets',
    import.meta.url,
  ),
  'utf8',
)

test('home pagination coordinator owns load-more trigger queues', () => {
  assert.match(paginationSource, /private homePendingLoadMoreModes/)
  assert.match(paginationSource, /private homeLastItemAppearLoadMoreAt/)
  assert.match(paginationSource, /private homeLastScrollProgressLoadMoreAt/)
  assert.match(paginationSource, /maybeTriggerLoadMoreByScrollProgress/)
  assert.match(paginationSource, /flushPendingLoadMoreForMode/)
  assert.match(paginationSource, /handleHomeEntryAppear/)
})

test('index page delegates load-more trigger behavior to pagination coordinator', () => {
  assert.match(
    indexSource,
    /maybeTriggerLoadMoreByScrollProgress\(mode: SubscriptionMode, currentOffset: number\): void \{\s*this\.homePaginationCoordinator\.maybeTriggerLoadMoreByScrollProgress\(mode, currentOffset\)\s*\}/s,
  )
  assert.match(
    indexSource,
    /handleHomeEntryAppear\(mode: SubscriptionMode, index: number, totalCount: number\): void \{\s*this\.homePaginationCoordinator\.handleHomeEntryAppear\(mode, index, totalCount\)\s*\}/s,
  )
  assert.doesNotMatch(indexSource, /private homePendingLoadMoreModes/)
  assert.doesNotMatch(indexSource, /private shouldAcceptItemAppearLoadMore/)
  assert.doesNotMatch(indexSource, /private enqueueLoadMoreForMode/)
})
