import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const visibleEntryPolicySource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/HomeVisibleEntryPolicy.ts',
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
    '../entry/src/main/ets/common/utils/HomeFeedPaginationState.ets',
    import.meta.url,
  ),
  'utf8',
)

const homeFeedSessionSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/HomeFeedSession.ets',
    import.meta.url,
  ),
  'utf8',
)

const homeFeedPaginationSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/HomeFeedPagination.ets',
    import.meta.url,
  ),
  'utf8',
)

test('home visible entry policy keeps startup window bounded', () => {
  assert.match(
    visibleEntryPolicySource,
    /const HOME_VISIBLE_ENTRY_INITIAL_LIMIT: number = 24/,
  )
  assert.match(
    visibleEntryPolicySource,
    /const HOME_VISIBLE_ENTRY_ARTICLE_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy =\s*\{\s*[\s\S]*?preloadRemainingCount: 3,\s*estimatedItemHeight: 280,\s*estimatedVisibleItemCount: 3,/,
  )
  assert.match(
    visibleEntryPolicySource,
    /const HOME_VISIBLE_ENTRY_PICTURE_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy =\s*\{\s*[\s\S]*?preloadRemainingCount: 8,\s*estimatedItemHeight: 680,\s*estimatedVisibleItemCount: 2,/,
  )
  assert.match(
    visibleEntryPolicySource,
    /const HOME_VISIBLE_ENTRY_VIDEO_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy = \{\s*preloadRemainingCount: 16,\s*estimatedItemHeight: 80,\s*estimatedVisibleItemCount: 4,/,
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
})

test('home pagination state does not force full render mode at startup', () => {
  assert.match(
    homeFeedPaginationStateSource,
    /shouldRenderAllEntriesForMode\(_mode: SubscriptionMode\): boolean \{\s*return false\s*\}/s,
  )
})

test('home feed session uses bounded by-mode queries for mode reloads', () => {
  assert.match(
    homeFeedSessionSource,
    /FeaturedEntriesQuery\.featuredEntriesByMode\(targetMode, safeCandidateLimit\)/,
  )
  assert.match(
    homeFeedSessionSource,
    /FeaturedEntriesQuery\.featuredEntriesFastByMode\(targetMode, safeCandidateLimit\)/,
  )
  assert.match(
    homeFeedSessionSource,
    /this\.pagination\.ensureModeEntriesLoaded\(currentMode\)/,
  )
})

test('mode ensure flow reloads a bounded active-mode window after a fast first paint', () => {
  assert.match(
    homeFeedPaginationSource,
    /const fullModeReady = !this\.shouldRenderAllEntriesForMode\(mode\)\s*\|\| this\.candidateLimitForMode\(mode\) >= HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT/,
  )
  assert.match(
    homeFeedPaginationSource,
    /this\.session\.reloadFeaturedEntriesFromLocal\(limit, false, true, true, mode\)/,
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
    /else if \(mode === 'pictures'\) \{\s*dynamicThreshold = Math\.max\(6, Math\.min\(8, Math\.floor\(visibleCount \/ 3\)\)\)\s*\} else if \(mode === 'videos'\) \{\s*dynamicThreshold = Math\.max\(14, Math\.min\(16, Math\.floor\(visibleCount \/ 2\)\)\)/,
  )
  assert.match(
    homeFeedPaginationSource,
    /private applyResolvedLoadMoreEntries\([\s\S]*?this\.session\.notifyHomeEntryDataAppendedForMode\(mode, previousTotal\)/,
  )
  assert.doesNotMatch(
    homeFeedPaginationSource,
    /if \(mode === 'articles'\) \{\s*this\.session\.entryGroups = \{/,
  )
  assert.match(
    homeFeedPaginationStateSource,
    /this\.session\.notifyHomeEntryDataAppendedForMode\(mode, currentLimit\)/,
  )
  assert.match(
    homeFeedPaginationStateSource,
    /currentLimit \+ resolveHomeVisibleEntryRevealStep\(mode\)/,
  )
})
