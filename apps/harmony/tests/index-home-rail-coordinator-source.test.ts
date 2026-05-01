import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

const railCoordinatorSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/IndexHomeRailCoordinator.ets',
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

test('index page delegates home rail orchestration instead of owning the implementation', () => {
  assert.match(
    indexSource,
    /private readonly homeRailCoordinator: IndexHomeRailCoordinator = new IndexHomeRailCoordinator\(this\)/,
  )
  assert.match(
    indexSource,
    /syncHomeModeRailState\(mode: SubscriptionMode = this\.mode\): void \{\s*this\.homeRailCoordinator\.syncHomeModeRailState\(mode\)\s*\}/s,
  )
  assert.doesNotMatch(indexSource, /private homeFirstCardTopBoundary/)
  assert.doesNotMatch(indexSource, /private homeModeRailTopBoundary/)
  assert.doesNotMatch(indexSource, /private homeModeRailCollapseReady/)
})
