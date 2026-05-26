import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

const paginationSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/coordinators/home/HomeFeedPagination.ets',
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

test('index page delegates load-more trigger behavior to session-owned HomeFeedPagination', () => {
  assert.match(
    indexSource,
    /maybeTriggerLoadMoreByScrollProgress\(mode: SubscriptionMode, currentOffset: number\): void \{\s*this\.session\.homeFeedPagination\.maybeTriggerLoadMoreByScrollProgress\(mode, currentOffset\)\s*\}/s,
  )
  assert.match(
    indexSource,
    /handleHomeEntryAppear\(mode: SubscriptionMode, index: number, totalCount: number\): void \{\s*this\.session\.homeFeedPagination\.handleHomeEntryAppear\(mode, index, totalCount\)\s*\}/s,
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
  // footer 始终常驻列表末尾,根据三态切换内容(spinner / "没有更多了"):
  //   - modeHasMoreEntriesNow=true → LoadMoreFooter(spinner)
  //   - 否则 → LoadMoreFooterExhausted("没有更多了")
  // 这样既保证用户滑到底自然能看到加载动画,又在没更多时不会一直转 spinner。
  assert.match(
    entriesPageSource,
    /private LoadMoreFooterSlot\(\)[\s\S]*?if \(this\.modeHasMoreEntriesNow\(\)\) \{[\s\S]*?this\.LoadMoreFooter\(\)[\s\S]*?\} else \{[\s\S]*?this\.LoadMoreFooterExhausted\(\)/,
  )
  assert.match(
    entriesPageSource,
    /private LoadMoreFooterExhausted\(\)[\s\S]*?Text\('—— 没有更多了 ——'\)/,
  )
  assert.match(
    entriesPageSource,
    /@StorageProp\(HOME_HAS_MORE_BY_MODE_KEY\) homeHasMoreByMode: HomeHasMoreByMode/,
  )
  assert.doesNotMatch(
    entriesPageSource,
    /\.visibility\(this\.isLoadingMore \? Visibility\.Visible : Visibility\.Hidden\)/,
  )
  assert.match(
    entriesPageSource,
    /if \(this\.dataSource\.totalCount\(\) > 0\) \{\s*ListItem\(\) \{\s*this\.LoadMoreFooterSlot\(\)\s*\}/,
  )
  assert.doesNotMatch(
    entriesPageSource,
    /if \(this\.isLoadingMore\) \{\s*ListItem\(\) \{\s*this\.LoadMoreFooter\(\)/,
  )
  assert.match(
    entriesPageSource,
    /\.onReachEnd\(\(\) => \{\s*this\.callbacks\.onListEndReach\(this\.dataSource\.totalCount\(\)\)\s*\}\)/,
  )
  assert.match(
    indexSource,
    /isModeLoadingMore: \(_mode: SubscriptionMode\): boolean => false/,
  )
  assert.match(
    paginationSource,
    /this\.state\.homeLoadMoreInProgress = true\s*writeHomeLoadMoreInProgress\(true\)/,
  )
  assert.match(
    paginationSource,
    /HOME_LOAD_MORE_FOOTER_MIN_VISIBLE_MS - elapsed/,
  )
  assert.doesNotMatch(
    paginationSource,
    /this\.homePendingLoadMoreModes = withHomePendingLoadMoreValue\(mode, pending, this\.homePendingLoadMoreModes\)[\s\S]{0,160}this\.actions\.bumpHomeContentVersion\(\)/,
  )
})
