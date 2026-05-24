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
    /private readonly modeEntriesCache: Map<string, FeaturedModeEntriesCacheItem> = new Map\(\)/,
  )
  assert.match(source, /private cachedModeEntries\(/)
  assert.match(source, /async function recentModeEntries\(/)
  assert.match(
    source,
    /function shouldUseRecentModeQuery\(mode: HomeEntryMode\): boolean \{\s*return mode === 'articles' \|\| mode === 'social' \|\| mode === 'pictures'\s*\}/,
  )
  assert.match(
    source,
    /shouldUseRecentModeQuery\(mode\)\s*\?\s*await recentModeEntries\(this\.entryRepo, mode, feeds, feedMap, safeCandidateLimit, true\)/,
  )
  assert.match(source, /this\.storeModeEntriesCache\(mode, feeds, result\)/)
  assert.match(source, /this\.storeModeEntriesCache\(mode, feeds, cards\)/)
  assert.match(
    source,
    /featuredEntriesFastPageByMode cache-hit mode=\$\{mode\}/,
  )
})
