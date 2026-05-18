import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

test('index page owns home feed orchestration directly (HomeFeedSession eliminated)', () => {
  assert.match(indexSource, /readonly homeFeedRefresh: HomeFeedRefresh/)
  assert.match(indexSource, /readonly homeFeedPagination: HomeFeedPagination/)
  assert.match(
    indexSource,
    /async loadInitialData\(\): Promise<void> \{\s*await this\.bootstrapHomeFeed\(\)\s*\}/s,
  )
  assert.match(indexSource, /private async bootstrapHomeFeed/)
  assert.match(indexSource, /private resumeHomeFeed/)
  assert.match(indexSource, /private restoreSnapshot/)
  assert.match(indexSource, /private async loadFastLocalEntries/)
  assert.doesNotMatch(indexSource, /import \{ HomeFeedSession \} from/)
})
