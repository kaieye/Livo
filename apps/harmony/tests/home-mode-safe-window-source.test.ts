import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const visibleEntryPolicySource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/home/HomeVisibleEntryPolicy.ts',
    import.meta.url,
  ),
  'utf8',
)

const homeRootConfigSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/HomeRootConfig.ets',
    import.meta.url,
  ),
  'utf8',
)

const homeFeedPaginationStateSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/home/HomeFeedPaginationState.ets',
    import.meta.url,
  ),
  'utf8',
)

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

const homeFeedPaginationSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/home/HomeFeedPagination.ets',
    import.meta.url,
  ),
  'utf8',
)

const homeModeMapHelpersSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/home/HomeModeMapHelpers.ets',
    import.meta.url,
  ),
  'utf8',
)

test('home visible entry policy keeps startup window bounded', () => {
  assert.match(
    visibleEntryPolicySource,
    /const HOME_VISIBLE_ENTRY_INITIAL_LIMIT: number = 18/,
  )
  assert.match(
    visibleEntryPolicySource,
    /const HOME_VISIBLE_ENTRY_VIDEO_INITIAL_LIMIT: number = 36/,
  )
  assert.match(
    visibleEntryPolicySource,
    /if \(mode === 'videos'\) \{\s*return HOME_VISIBLE_ENTRY_VIDEO_INITIAL_LIMIT\s*\}/,
  )
  assert.match(
    visibleEntryPolicySource,
    /const HOME_VISIBLE_ENTRY_ARTICLE_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy =\s*\{\s*[\s\S]*?preloadRemainingCount: 3,\s*estimatedItemHeight: 280,\s*estimatedVisibleItemCount: 3,/,
  )
  assert.match(
    visibleEntryPolicySource,
    /const HOME_VISIBLE_ENTRY_PICTURE_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy =\s*\{\s*[\s\S]*?preloadRemainingCount: 4,\s*estimatedItemHeight: 680,\s*estimatedVisibleItemCount: 2,/,
  )
  assert.match(
    visibleEntryPolicySource,
    /const HOME_VISIBLE_ENTRY_VIDEO_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy = \{\s*preloadRemainingCount: 8,\s*estimatedItemHeight: 88,\s*estimatedVisibleItemCount: 6,/,
  )
  assert.match(
    visibleEntryPolicySource,
    /if \(visibleCount <= 0 \|\| totalCount <= 0 \|\| currentScrollOffset <= 0\) \{\s*return false\s*\}/,
  )
  assert.doesNotMatch(
    visibleEntryPolicySource,
    /if \(visibleCount >= totalCount\) \{/,
  )
  assert.match(
    visibleEntryPolicySource,
    /const preloadStartIndex = Math\.max\([\s\S]*?visibleCount -[\s\S]*?policy\.preloadRemainingCount -[\s\S]*?policy\.estimatedVisibleItemCount,/,
  )
})

test('mode switch candidate limit follows initial bounded window', () => {
  assert.match(
    homeRootConfigSource,
    /export const HOME_MODE_SWITCH_CANDIDATE_LIMIT: number = HOME_MODE_INITIAL_CANDIDATE_LIMIT/,
  )
  assert.match(
    homeModeMapHelpersSource,
    /videos: resolveHomeVisibleEntryInitialLimit\('videos'\)/,
  )
})

test('home pagination state does not force full render mode at startup', () => {
  assert.match(
    homeFeedPaginationStateSource,
    /shouldRenderAllEntriesForMode\(_mode: SubscriptionMode\): boolean \{\s*return false\s*\}/s,
  )
})

test('index page uses bounded by-mode queries for mode reloads', () => {
  assert.match(
    indexSource,
    /FeaturedEntriesQuery\.default\.featuredEntriesByMode\(targetMode, safeCandidateLimit\)/,
  )
  assert.match(
    indexSource,
    /FeaturedEntriesQuery\.default\.featuredEntriesFastByMode\(targetMode, safeCandidateLimit\)/,
  )
  assert.match(
    indexSource,
    /this\.homeFeedPagination\.ensureModeEntriesLoaded\(currentMode\)/,
  )
})

test('mode ensure flow reloads a bounded active-mode window after a fast first paint', () => {
  assert.match(
    homeFeedPaginationSource,
    /const initialModeReady = this\.shouldRenderAllEntriesForMode\(mode\)\s*\?\s*this\.candidateLimitForMode\(mode\) >= HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT\s*: this\.totalEntryCountFor\(mode\) >= resolveHomeVisibleEntryInitialLimit\(mode\)/,
  )
  assert.match(
    homeFeedPaginationStateSource,
    /return Math\.max\(minimumLimit, this\.candidateLimitForMode\(mode\), resolveHomeVisibleEntryInitialLimit\(mode\)\)/,
  )
  assert.match(
    homeFeedPaginationSource,
    /this\.actions\.reloadFeaturedEntriesFromLocal\(limit, false, true, true, mode\)/,
  )
  assert.match(
    homeFeedPaginationSource,
    /this\.scheduleHomeLoadMorePrefetch\(120\)/,
  )
})

test('article load more follows append-style update path near the end of the list', () => {
  assert.match(
    homeFeedPaginationSource,
    /if \(mode === 'articles'\) \{\s*dynamicThreshold = Math\.max\(3, Math\.min\(5, Math\.floor\(visibleCount \/ 8\)\)\)\s*\} else if \(mode === 'social'\)/,
  )
  assert.match(
    homeFeedPaginationSource,
    /else if \(mode === 'pictures'\) \{\s*dynamicThreshold = Math\.max\(3, Math\.min\(4, Math\.floor\(visibleCount \/ 3\)\)\)\s*\} else if \(mode === 'videos'\) \{[\s\S]*?dynamicThreshold = Math\.max\(8, Math\.min\(14, Math\.floor\(visibleCount \/ 3\)\)\)/,
  )
  assert.match(
    homeFeedPaginationSource,
    /private applyResolvedLoadMoreEntries\([\s\S]*?this\.actions\.notifyHomeEntryDataAppendedForMode\(mode, previousTotal\)/,
  )
  assert.doesNotMatch(
    homeFeedPaginationSource,
    /if \(mode === 'articles'\) \{\s*this\.state\.entryGroups = \{/,
  )
  assert.match(
    homeFeedPaginationStateSource,
    /this\.actions\.notifyHomeEntryDataAppendedForMode\(mode, currentLimit\)/,
  )
  assert.match(
    homeFeedPaginationStateSource,
    /currentLimit \+ resolveHomeVisibleEntryRevealStep\(mode\)/,
  )
})
