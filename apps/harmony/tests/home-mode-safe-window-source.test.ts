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
