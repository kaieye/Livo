import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

const bootstrapSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/IndexHomeBootstrapCoordinator.ets',
    import.meta.url,
  ),
  'utf8',
)

test('home startup data flow lives in a dedicated bootstrap coordinator', () => {
  assert.match(bootstrapSource, /export class IndexHomeBootstrapCoordinator/)
  assert.match(bootstrapSource, /loadInitialData/)
  assert.match(bootstrapSource, /restoreSnapshot/)
  assert.match(bootstrapSource, /loadFastLocalEntries/)
  assert.match(bootstrapSource, /resumeLoadedHome/)
  assert.match(bootstrapSource, /AppRepository\.homeEntrySnapshot/)
})

test('index page delegates initial data loading instead of owning the flow', () => {
  assert.match(
    indexSource,
    /private readonly homeBootstrapCoordinator: IndexHomeBootstrapCoordinator =\s*new IndexHomeBootstrapCoordinator\(this\)/s,
  )
  assert.match(
    indexSource,
    /async loadInitialData\(\): Promise<void> \{\s*await this\.homeBootstrapCoordinator\.loadInitialData\(\)\s*\}/s,
  )
  assert.match(
    indexSource,
    /this\.homeBootstrapCoordinator\.resumeLoadedHome\(\)/,
  )
  assert.doesNotMatch(indexSource, /AppRepository\.homeEntrySnapshot/)
  assert.doesNotMatch(
    indexSource,
    /groupHomeEntriesByMode\(this\.featuredEntries\)/,
  )
})
