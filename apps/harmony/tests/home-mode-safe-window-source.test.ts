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
    /const HOME_VISIBLE_ENTRY_ARTICLE_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy =\s*\{\s*[\s\S]*?preloadRemainingCount: 2,\s*estimatedItemHeight: 180,\s*estimatedVisibleItemCount: 4,/,
  )
  assert.match(
    visibleEntryPolicySource,
    /if \(visibleCount <= 0 \|\| totalCount <= 0\) \{\s*return false\s*\}/,
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
    /async hydrateCompleteEntriesForMode\(mode: SubscriptionMode\): Promise<void> \{/,
  )
  assert.match(
    homeFeedSessionSource,
    /FeaturedEntriesQuery\.featuredEntriesAllByMode\(mode\)/,
  )
  assert.match(
    homeFeedSessionSource,
    /this\.runManagedTimeout\(\(\) => \{\s*this\.pagination\.ensureModeEntriesLoaded\(currentMode\)\s*\}, 180\)/s,
  )
})

test('mode ensure flow hydrates full entries after a fast first paint', () => {
  assert.match(
    homeFeedPaginationSource,
    /const fullyHydrated = hasModeEntries && !this\.modeHasMoreEntries\(mode\)/,
  )
  assert.match(
    homeFeedPaginationSource,
    /this\.session\.reloadFeaturedEntriesFromLocal\([\s\S]*?\)\.then\(\(\) => \{\s*return this\.session\.hydrateCompleteEntriesForMode\(mode\)\s*\}\)/s,
  )
})

test('article load more follows append-style update path near the end of the list', () => {
  assert.match(
    homeFeedPaginationSource,
    /private effectiveLoadMorePolicyMode\(mode: SubscriptionMode, visibleCount: number\): SubscriptionMode \{/,
  )
  assert.match(
    homeFeedPaginationSource,
    /mode === 'articles' && this\.shouldUseSocialLoadMorePolicyForArticleTail\(mode, visibleCount\)/,
  )
  assert.match(
    homeFeedPaginationSource,
    /if \(policyMode === 'articles'\) \{\s*dynamicThreshold = Math\.max\(2, Math\.min\(3, Math\.floor\(visibleCount \/ 10\)\)\)\s*\} else if \(policyMode === 'social'\)/,
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
})
