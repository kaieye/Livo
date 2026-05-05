import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const helperSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/data/AppRepositoryEntryHelpers.ets',
    import.meta.url,
  ),
  'utf8',
)
const querySource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/data/FeaturedEntriesQuery.ets',
    import.meta.url,
  ),
  'utf8',
)

test('featured entries fast paths avoid chunked yielding card construction', () => {
  assert.match(
    helperSource,
    /export function buildEntryCards\(\s*entries: Entry\[],\s*resolveFeed: \(entry: Entry\) => Feed \| undefined,\s*\): EntryCardModel\[] \{/s,
  )
  assert.match(
    querySource,
    /const cards = buildEntryCards\(entries, \(entry: Entry\) => feedMap\.get\(entry\.feedId\)\)/,
  )
  assert.match(
    querySource,
    /await balancedModeEntries\(mode, feeds, feedMap, safeCandidateLimit, false\)/,
  )
  assert.match(
    querySource,
    /await balancedModeEntries\(mode, feeds, feedMap, targetVisibleCount, false\)/,
  )
})
