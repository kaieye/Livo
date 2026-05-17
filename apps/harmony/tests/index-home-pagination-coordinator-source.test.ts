import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

const paginationSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/HomeFeedPagination.ets',
    import.meta.url,
  ),
  'utf8',
)

const entriesPageSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/HomeModeEntriesPage.ets',
    import.meta.url,
  ),
  'utf8',
)

test('home pagination module owns load-more trigger queues', () => {
  assert.match(paginationSource, /private homePendingLoadMoreModes/)
  assert.match(paginationSource, /private homeLastItemAppearLoadMoreAt/)
  assert.match(paginationSource, /private homeLastScrollProgressLoadMoreAt/)
  assert.match(paginationSource, /maybeTriggerLoadMoreByScrollProgress/)
  assert.match(paginationSource, /flushPendingLoadMoreForMode/)
  assert.match(paginationSource, /handleHomeEntryAppear/)
})

test('index page delegates load-more trigger behavior to session pagination', () => {
  assert.match(
    indexSource,
    /maybeTriggerLoadMoreByScrollProgress\(mode: SubscriptionMode, currentOffset: number\): void \{\s*this\.homeFeedSession\.pagination\.maybeTriggerLoadMoreByScrollProgress\(mode, currentOffset\)\s*\}/s,
  )
  assert.match(
    indexSource,
    /handleHomeEntryAppear\(mode: SubscriptionMode, index: number, totalCount: number\): void \{\s*this\.homeFeedSession\.pagination\.handleHomeEntryAppear\(mode, index, totalCount\)\s*\}/s,
  )
  assert.doesNotMatch(indexSource, /private homePendingLoadMoreModes/)
  assert.doesNotMatch(indexSource, /private shouldAcceptItemAppearLoadMore/)
  assert.doesNotMatch(indexSource, /private enqueueLoadMoreForMode/)
})

test('home list shows a bottom loading footer only while load-more is actually fetching', () => {
  assert.match(entriesPageSource, /@Prop isLoadingMore: boolean = false/)
  assert.match(entriesPageSource, /private LoadMoreFooter\(\)/)
  assert.match(entriesPageSource, /LoadingProgress\(\)/)
  assert.match(entriesPageSource, /Text\('正在加载更多'\)/)
  assert.match(entriesPageSource, /\.onReachEnd\(\(\) => \{\s*this\.callbacks\.onListEndReach\(this\.dataSource\.totalCount\(\)\)\s*\}\)/)
  assert.match(
    indexSource,
    /isModeLoadingMore: \(_mode: SubscriptionMode\): boolean => false/,
  )
  assert.match(
    paginationSource,
    /const shouldShowLoadMoreFooter = !prefetchedEntries/,
  )
  assert.doesNotMatch(
    paginationSource,
    /this\.homePendingLoadMoreModes = withHomePendingLoadMoreValue\(mode, pending, this\.homePendingLoadMoreModes\)[\s\S]{0,160}this\.session\.bumpHomeContentVersion\(\)/,
  )
})
