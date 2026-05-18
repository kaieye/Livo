import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

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
