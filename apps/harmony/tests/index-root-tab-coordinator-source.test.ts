import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

const coordinatorSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/IndexRootTabCoordinator.ets',
    import.meta.url,
  ),
  'utf8',
)

test('root tab request and change flow lives in a dedicated coordinator', () => {
  assert.match(coordinatorSource, /export class IndexRootTabCoordinator/)
  assert.match(coordinatorSource, /syncRequestedRootTab/)
  assert.match(coordinatorSource, /handleRootTabChange/)
  assert.match(coordinatorSource, /confirmRootTabSelection/)
  assert.match(coordinatorSource, /activateHomeRootTab/)
  assert.match(coordinatorSource, /resolveHdsBottomTabItems/)
})

test('index page delegates root tab flow and visibility decisions', () => {
  assert.match(
    indexSource,
    /private readonly rootTabCoordinator: IndexRootTabCoordinator = new IndexRootTabCoordinator\(this\)/,
  )
  assert.match(
    indexSource,
    /private handleRootTabChange\(index: number\): void \{\s*this\.rootTabCoordinator\.handleRootTabChange\(index\)\s*\}/s,
  )
  assert.match(
    indexSource,
    /private shouldHideBottomTabs\(\): boolean \{\s*return this\.rootTabCoordinator\.shouldHideBottomTabs\(\)\s*\}/s,
  )
  assert.doesNotMatch(indexSource, /resolveHdsBottomTabItems\(\)\[index\]/)
  assert.doesNotMatch(indexSource, /getRequestedRootTabId\(\)/)
})
