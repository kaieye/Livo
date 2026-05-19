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

const railCoordinatorSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/index-home/IndexHomeRailCoordinator.ets',
    import.meta.url,
  ),
  'utf8',
)

test('home rail state and layout logic lives in a dedicated coordinator', () => {
  assert.match(railCoordinatorSource, /export class IndexHomeRailCoordinator/)
  assert.match(railCoordinatorSource, /syncHomeModeRailState/)
  assert.match(railCoordinatorSource, /homeModeRailCollapseProgress/)
  assert.match(railCoordinatorSource, /homeModeRailTopPadding/)
  assert.match(railCoordinatorSource, /homeModeRailDismissTranslateY/)
})

test('HomeFeedSession owns the rail coordinator and index delegates through session', () => {
  // Coordinator instantiation lives in session.
  assert.match(
    sessionSource,
    /readonly homeRailCoordinator: IndexHomeRailCoordinator/,
  )
  // Index delegates through session.
  assert.match(
    indexSource,
    /syncHomeModeRailState\(mode: SubscriptionMode = this\.mode\): void \{\s*this\.session\.homeRailCoordinator\.syncHomeModeRailState\(mode\)\s*\}/s,
  )
  // Rail implementation details do not leak into Index.
  assert.doesNotMatch(indexSource, /private homeFirstCardTopBoundary/)
  assert.doesNotMatch(indexSource, /private homeModeRailTopBoundary/)
  assert.doesNotMatch(indexSource, /private homeModeRailCollapseReady/)
})
