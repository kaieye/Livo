import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL(
    '../entry/src/main/ets/common/data/FeaturedEntriesQuery.ets',
    import.meta.url,
  ),
  'utf8',
)

test('featured entries mode queries share a per-mode cache across fast and paged paths', () => {
  assert.match(
    source,
    /private static readonly modeEntriesCache: Map<string, FeaturedModeEntriesCacheItem> = new Map\(\)/,
  )
  assert.match(source, /private static cachedModeEntries\(/)
  assert.match(source, /async function recentModeEntries\(/)
  assert.match(
    source,
    /mode === 'articles'\s*\?\s*await recentModeEntries\(mode, feeds, feedMap, safeCandidateLimit, true\)/,
  )
  assert.match(
    source,
    /mode === 'articles'\s*\?\s*await recentModeEntries\(mode, feeds, feedMap, safeCandidateLimit, false\)/,
  )
  assert.match(
    source,
    /FeaturedEntriesQuery\.storeModeEntriesCache\(mode, feeds, result\)/,
  )
  assert.match(
    source,
    /FeaturedEntriesQuery\.storeModeEntriesCache\(mode, feeds, cards\)/,
  )
  assert.match(
    source,
    /featuredEntriesFastPageByMode cache-hit mode=\$\{mode\}/,
  )
})
