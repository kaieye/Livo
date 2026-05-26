import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

const sessionSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/coordinators/home/HomeFeedSession.ets',
    import.meta.url,
  ),
  'utf8',
)

const coordinatorSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/coordinators/index-home/IndexRootTabCoordinator.ets',
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

test('HomeFeedSession owns the root tab coordinator and index delegates through session', () => {
  // Coordinator instantiation lives in session.
  assert.match(
    sessionSource,
    /readonly rootTabCoordinator: IndexRootTabCoordinator/,
  )
  // Index delegates through session in build().
  assert.match(
    indexSource,
    /session\.rootTabCoordinator\.handleRootTabChange\(index\)/,
  )
  assert.match(
    indexSource,
    /session\.rootTabCoordinator\.shouldHideBottomTabs\(\)/,
  )
  // Implementation details do not leak into Index.
  assert.doesNotMatch(indexSource, /resolveHdsBottomTabItems\(\)\[index\]/)
  assert.doesNotMatch(indexSource, /getRequestedRootTabId\(\)/)
})
