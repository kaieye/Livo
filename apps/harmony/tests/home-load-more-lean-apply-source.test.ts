import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const paginationSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/home/HomeFeedPagination.ets',
    import.meta.url,
  ),
  'utf8',
)

const dataManagerSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/home/HomeEntryDataManager.ets',
    import.meta.url,
  ),
  'utf8',
)

const visibleEntryPolicySource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/home/HomeVisibleEntryPolicy.ts',
    import.meta.url,
  ),
  'utf8',
)

const paginationStateSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/home/HomeFeedPaginationState.ets',
    import.meta.url,
  ),
  'utf8',
)

test('mode load-more avoids global merge and snapshot work on the scroll path', () => {
  assert.match(
    paginationSource,
    /private shouldUseLeanLoadMoreApply\(mode: SubscriptionMode\): boolean \{\s*return mode === 'articles' \|\| mode === 'social' \|\| mode === 'pictures' \|\| mode === 'videos'\s*\}/,
  )
  assert.match(
    paginationSource,
    /this\.actions\.applyEntriesForMode\(mode, entries, true, skipNotify, leanApply, leanApply\)/,
  )
  assert.match(
    paginationSource,
    /private revealLoadedEntriesForLoadMore\([\s\S]*?this\.setVisibleEntryLimitFor\(mode, nextVisibleLimit\)/,
  )
  assert.match(
    paginationStateSource,
    /this\.state\.homeCandidateLimitsByMode\.videos = safeLimit/,
  )
  assert.match(
    paginationStateSource,
    /this\.state\.homeVisibleEntryLimits\.videos = safeLimit/,
  )
  assert.doesNotMatch(
    paginationStateSource,
    /this\.state\.homeCandidateLimit = safeLimit/,
  )
  assert.match(dataManagerSource, /skipPersist: boolean = false/)
  assert.match(dataManagerSource, /if \(!skipPersist && !skipMerge\) \{/)
  assert.match(
    dataManagerSource,
    /const usedInPlaceModeUpdate = skipNotify && skipMerge && skipPersist/,
  )
  assert.match(
    dataManagerSource,
    /if \(usedInPlaceModeUpdate\) \{[\s\S]*?this\.replaceModeEntriesInPlace\(mode, scopedEntries\)/,
  )
  assert.match(
    dataManagerSource,
    /groups\.videos\.splice\(0, groups\.videos\.length, \.\.\.entries\)/,
  )
})

test('load-more page sizes are configured per layout in the visible entry policy', () => {
  assert.match(
    paginationSource,
    /private resolveLoadMoreStepForMode\(mode: SubscriptionMode\): number \{/,
  )
  assert.match(
    paginationSource,
    /return resolveHomeVisibleEntryLoadMoreStep\(mode\)/,
  )
  assert.match(
    visibleEntryPolicySource,
    /const HOME_VISIBLE_ENTRY_DEFAULT_LOAD_MORE_STEP: number = 12/,
  )
  assert.match(
    visibleEntryPolicySource,
    /const HOME_VISIBLE_ENTRY_PICTURE_LOAD_MORE_STEP: number = 8/,
  )
  assert.match(
    visibleEntryPolicySource,
    /const HOME_VISIBLE_ENTRY_VIDEO_LOAD_MORE_STEP: number = 24/,
  )
  assert.match(
    visibleEntryPolicySource,
    /const HOME_VISIBLE_ENTRY_ARTICLE_REVEAL_STEP: number = 10/,
  )
  assert.match(
    visibleEntryPolicySource,
    /const HOME_VISIBLE_ENTRY_PICTURE_REVEAL_STEP: number = 6/,
  )
  assert.match(
    visibleEntryPolicySource,
    /const HOME_VISIBLE_ENTRY_VIDEO_REVEAL_STEP: number = 8/,
  )
  assert.match(paginationSource, /currentModeLimit \+ loadMoreStep/)
})

test('all modes use the fast page append path before falling back to full mode reload', () => {
  assert.doesNotMatch(
    paginationSource,
    /if \(mode === 'pictures' \|\| mode === 'videos'\) \{/,
  )
  assert.match(
    paginationSource,
    /this\.featuredEntriesQuery\.featuredEntriesFastPageByMode\(mode, appendCount, previousTotal\)/,
  )
  assert.match(
    paginationSource,
    /const fallbackEntries = await this\.featuredEntriesQuery\.featuredEntriesByMode\(mode, nextLimit\)/,
  )
})
