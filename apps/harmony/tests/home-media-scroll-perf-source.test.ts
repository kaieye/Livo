import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const homeModeEntriesPageSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/HomeModeEntriesPage.ets',
    import.meta.url,
  ),
  'utf8',
)

const pictureEntryCardSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/PictureEntryCard.ets',
    import.meta.url,
  ),
  'utf8',
)

const homeVideoEntryCardSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/HomeVideoEntryCard.ets',
    import.meta.url,
  ),
  'utf8',
)

const paginationSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/home/HomeFeedPagination.ets',
    import.meta.url,
  ),
  'utf8',
)

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

test('video home mode uses row-level lazy list instead of rebuilding the full grid on append', () => {
  assert.match(
    homeModeEntriesPageSource,
    /class VideoRowLazyDataSource implements IDataSource/,
  )
  assert.match(
    homeModeEntriesPageSource,
    /LazyForEach\(this\.videoRowDataSource, \(rowEntries: EntryCardModel\[], rowIndex: number\) => \{/,
  )
  assert.match(
    homeModeEntriesPageSource,
    /this\.videoRowDataSource\.notifyDataAddedByEntryIndex\(index\)/,
  )
  assert.match(
    homeModeEntriesPageSource,
    /if \(safeEntryIndex % columns !== 0\) \{[\s\S]*?listener\.onDataChange\(rowIndex\)/,
  )
  assert.match(
    homeModeEntriesPageSource,
    /for \(let addRowIndex = previousRowCount; addRowIndex < nextRowCount; addRowIndex\+\+\) \{[\s\S]*?listener\.onDataAdd\(addRowIndex\)/,
  )
  assert.match(
    homeModeEntriesPageSource,
    /for \(let addRowIndex = rowIndex; addRowIndex < nextRowCount; addRowIndex\+\+\) \{[\s\S]*?listener\.onDataAdd\(addRowIndex\)/,
  )
  assert.doesNotMatch(
    homeModeEntriesPageSource,
    /onDataAdd: \(index: number\) => notifyVideoRowsReloaded\(\)/,
  )
  assert.doesNotMatch(
    homeModeEntriesPageSource,
    /onDataAdded: \(index: number\) => notifyVideoRowsReloaded\(\)/,
  )
  assert.match(homeModeEntriesPageSource, /HomeVideoEntryCard\(/)
  assert.doesNotMatch(homeModeEntriesPageSource, /HomeVideoGrid\(/)
  assert.doesNotMatch(
    homeModeEntriesPageSource,
    /entries: this\.currentEntries\(\)/,
  )
})

test('video home mode uses social-style early load-more triggers at row granularity', () => {
  assert.doesNotMatch(
    paginationSource,
    /maybeTriggerLoadMoreByScrollProgress\(mode: SubscriptionMode, currentOffset: number\): void \{[\s\S]*?if \(mode === 'videos'\) \{\s*return\s*\}/,
  )
  assert.doesNotMatch(
    paginationSource,
    /handleHomeEntryAppear\(mode: SubscriptionMode, index: number, totalCount: number\): void \{[\s\S]*?if \(mode === 'videos'\) \{ return \}/,
  )
  assert.match(
    homeModeEntriesPageSource,
    /const rowTailIndex = Math\.min\(total - 1, \(\(rowIndex \+ 1\) \* resolveHomeVideoGridColumns\(\)\) - 1\)/,
  )
  assert.match(
    homeModeEntriesPageSource,
    /this\.callbacks\.onItemAppear\(rowTailIndex, total\)/,
  )
})

test('video home mode avoids overlay state writes during ordinary scroll frames', () => {
  // onDidScroll 使用节流机制：32ms 内跳过重复调用，减少每帧 @State 写入
  assert.match(
    indexSource,
    /onDidScroll: \(mode: SubscriptionMode\): void => \{\s*const now = Date\.now\(\)\s*if \(now - this\.homeOnDidScrollLastAt < Index\.HOME_ON_DID_SCROLL_THROTTLE_MS\) \{\s*return\s*\}\s*this\.homeOnDidScrollLastAt = now\s*this\.syncHomeModeRailState\(mode\)\s*this\.flushPendingLoadMoreForMode\(mode\)\s*this\.enforceAtTopChromeState\(this\.readHomeModeScrollOffset\(mode\)\)/,
  )
  // 节流字段声明
  assert.match(indexSource, /private homeOnDidScrollLastAt: number = 0/)
  assert.match(
    indexSource,
    /private static readonly HOME_ON_DID_SCROLL_THROTTLE_MS: number = 32/,
  )
  assert.match(
    indexSource,
    /onStopDragging: \(mode: SubscriptionMode\): void => \{\s*this\.setHomeScrollInteracting\(false, mode\)\s*this\.flushPendingLoadMoreForMode\(mode\)\s*this\.scheduleHomeLoadMorePrefetch\(160\)/,
  )
})

test('picture cards ignore duplicate visible-area callbacks while scrolling', () => {
  assert.doesNotMatch(
    pictureEntryCardSource,
    /private shouldDecodeMedia\(\): boolean/,
  )
  assert.doesNotMatch(
    pictureEntryCardSource,
    /if \(this\.shouldDecodeMedia\(\)\)/,
  )
  assert.match(
    pictureEntryCardSource,
    /Image\(item\.imageUrl \|\| this\.pictureUrl\)\.width\('100%'\)\.height\('100%'\)\.objectFit\(ImageFit\.Contain\)/,
  )
  assert.match(
    pictureEntryCardSource,
    /const nextNearlyVisible = isVisible && currentRatio >= 0\.5/,
  )
  assert.match(
    pictureEntryCardSource,
    /nextNearlyVisible === this\.isNearlyVisible[\s\S]*?nextFullyVisible === this\.isFullyVisible/,
  )
  assert.match(
    pictureEntryCardSource,
    /this\.syncVisibleLivePhotoPlayback\(this\.activeMediaIndex\)/,
  )
})

test('video rows use stable entry keys so duplicate source ids do not leave blank cells', () => {
  assert.match(
    homeModeEntriesPageSource,
    /ForEach\(rowEntries, \(entry: EntryCardModel, entryIndex: number\) => \{[\s\S]*?homeEntryListRenderKey\(entry, \(rowIndex \* resolveHomeVideoGridColumns\(\)\) \+ entryIndex\)/,
  )
  assert.doesNotMatch(
    homeModeEntriesPageSource,
    /\}, \(entry: EntryCardModel\) => entry\.id\)/,
  )
})

test('video entry card stays lean like the social item card path', () => {
  assert.match(homeVideoEntryCardSource, /export struct HomeVideoEntryCard/)
  assert.doesNotMatch(homeVideoEntryCardSource, /@State/)
  assert.doesNotMatch(homeVideoEntryCardSource, /@Watch/)
  assert.doesNotMatch(homeVideoEntryCardSource, /Date\.now\(\)/)
  assert.doesNotMatch(homeVideoEntryCardSource, /ForEach\(/)
})
