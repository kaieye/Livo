import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

const sessionSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/HomeFeedSession.ets',
    import.meta.url,
  ),
  'utf8',
)

test('home startup data flow lives in HomeFeedSession', () => {
  assert.match(sessionSource, /export class HomeFeedSession/)
  assert.match(sessionSource, /bootstrap\(\)/)
  assert.match(sessionSource, /restoreSnapshot/)
  assert.match(sessionSource, /loadFastLocalEntries/)
  assert.match(sessionSource, /resume/)
  assert.match(sessionSource, /AppPreferenceService\.loadHomeEntrySnapshot/)
})

test('index page delegates initial data loading to HomeFeedSession', () => {
  assert.match(indexSource, /readonly homeFeedSession: HomeFeedSession/)
  assert.match(
    indexSource,
    /async loadInitialData\(\): Promise<void> \{\s*await this\.homeFeedSession\.bootstrap\(\)\s*\}/s,
  )
  assert.match(indexSource, /this\.homeFeedSession\.resume/)
  assert.doesNotMatch(
    indexSource,
    /AppPreferenceService\.loadHomeEntrySnapshot/,
  )
  assert.doesNotMatch(
    indexSource,
    /groupHomeEntriesByMode\(this\.featuredEntries\)/,
  )
})
