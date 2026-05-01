import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

const runtimeSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/IndexHomeRuntimeCoordinator.ets',
    import.meta.url,
  ),
  'utf8',
)

test('home runtime lifecycle flow lives in a dedicated coordinator', () => {
  assert.match(runtimeSource, /export class IndexHomeRuntimeCoordinator/)
  assert.match(runtimeSource, /aboutToAppear/)
  assert.match(runtimeSource, /aboutToDisappear/)
  assert.match(runtimeSource, /resumeLoadedHome/)
  assert.match(runtimeSource, /runManagedTimeout/)
  assert.match(runtimeSource, /clearManagedTimeouts/)
  assert.match(runtimeSource, /private managedTimeoutIds: number\[\] = \[\]/)
  assert.match(runtimeSource, /homeListSwapToken/)
})

test('index page delegates lifecycle hooks to the runtime coordinator', () => {
  assert.match(
    indexSource,
    /private readonly homeRuntimeCoordinator: IndexHomeRuntimeCoordinator =\s*new IndexHomeRuntimeCoordinator\(this\)/s,
  )
  assert.match(
    indexSource,
    /aboutToAppear\(\): void \{\s*this\.homeRuntimeCoordinator\.aboutToAppear\(\)\s*\}/s,
  )
  assert.match(
    indexSource,
    /aboutToDisappear\(\): void \{\s*this\.homeRuntimeCoordinator\.aboutToDisappear\(\)\s*\}/s,
  )
  assert.match(
    indexSource,
    /runManagedTimeout\(callback: \(\) => void, delayMs: number\): void \{\s*this\.homeRuntimeCoordinator\.runManagedTimeout\(callback, delayMs\)\s*\}/s,
  )
  assert.doesNotMatch(indexSource, /managedTimeoutIds/)
  assert.doesNotMatch(
    indexSource,
    /console\.info\('Livo Harmony Index aboutToAppear'\)/,
  )
  assert.doesNotMatch(
    indexSource,
    /this\.homeListSwapToken \+= 1\s*this\.homeListSwapAnimating = false/s,
  )
})
