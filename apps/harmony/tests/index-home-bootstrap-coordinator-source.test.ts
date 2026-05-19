import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

const sessionSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/home/HomeFeedSession.ets',
    import.meta.url,
  ),
  'utf8',
)

test('index page delegates orchestration to HomeFeedSession', () => {
  // Index holds a single session field that owns all coordinators and logic.
  assert.match(
    indexSource,
    /readonly session: HomeFeedSession = new HomeFeedSession\(this\)/,
  )
  // Index imports the session.
  assert.match(indexSource, /import \{ HomeFeedSession \} from/)
  // Bootstrap is delegated to session.
  assert.match(
    indexSource,
    /async loadInitialData\(\): Promise<void> \{\s*await this\.session\.loadInitialData\(\)\s*\}/s,
  )
  assert.match(
    indexSource,
    /resumeLoadedHome\(\): void \{ this\.session\.resumeHomeFeed\(\) \}/,
  )
  // Private bootstrap methods no longer live on Index.
  assert.doesNotMatch(indexSource, /private async bootstrapHomeFeed/)
  assert.doesNotMatch(indexSource, /private resumeHomeFeed/)
  assert.doesNotMatch(indexSource, /private restoreSnapshot/)
  assert.doesNotMatch(indexSource, /private async loadFastLocalEntries/)
  // Coordinator fields are not declared directly on Index.
  assert.doesNotMatch(indexSource, /readonly homeFeedRefresh: HomeFeedRefresh/)
  assert.doesNotMatch(
    indexSource,
    /readonly homeFeedPagination: HomeFeedPagination/,
  )
})

test('HomeFeedSession owns all coordinator instances and bootstrap logic', () => {
  // HomeFeedSession instantiates home-feed coordinators.
  assert.match(sessionSource, /readonly homeFeedRefresh: HomeFeedRefresh/)
  assert.match(sessionSource, /readonly homeFeedPagination: HomeFeedPagination/)
  assert.match(sessionSource, /readonly homeModeController: HomeModeController/)
  assert.match(
    sessionSource,
    /readonly homeEntryDataManager: HomeEntryDataManager/,
  )
  assert.match(
    sessionSource,
    /readonly homeInlineSearchController: HomeInlineSearchController/,
  )
  // HomeFeedSession instantiates index-home coordinators.
  assert.match(
    sessionSource,
    /readonly homeRuntimeCoordinator: IndexHomeRuntimeCoordinator/,
  )
  assert.match(
    sessionSource,
    /readonly homeRailCoordinator: IndexHomeRailCoordinator/,
  )
  assert.match(
    sessionSource,
    /readonly rootTabCoordinator: IndexRootTabCoordinator/,
  )
  assert.match(
    sessionSource,
    /readonly diagnosticsLogger: IndexHomeDiagnosticsLogger/,
  )
  assert.match(sessionSource, /readonly loadStateGate: IndexHomeLoadStateGate/)
  assert.match(
    sessionSource,
    /readonly modeScenePresenter: IndexHomeModeScenePresenter/,
  )
  assert.match(
    sessionSource,
    /readonly pageLifecycle: IndexPageLifecycleController/,
  )
  // HomeFeedSession owns bootstrap logic.
  assert.match(
    sessionSource,
    /async loadInitialData\(\): Promise<void> \{\s*await this\.bootstrapHomeFeed\(\)\s*\}/s,
  )
  assert.match(sessionSource, /private async bootstrapHomeFeed/)
  assert.match(sessionSource, /resumeHomeFeed\(\): void/)
  assert.match(sessionSource, /private restoreSnapshot/)
  assert.match(sessionSource, /private async loadFastLocalEntries/)
  // HomeFeedSession owns reload and precache logic.
  assert.match(sessionSource, /async reloadFeaturedEntriesFromLocal/)
  assert.match(sessionSource, /async reloadHomeEntriesFromLocal/)
  assert.match(sessionSource, /precacheNonActiveModes\(\): void/)
})
