import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('AppRepository builds entry cards in chunks to avoid refresh-end UI jank', () => {
  const source = read('../entry/src/main/ets/common/data/AppRepository.ets')

  assert.match(source, /const ENTRY_CARD_YIELD_BATCH_SIZE: number = 24/)
  assert.match(source, /function yieldToUiLoop\(\): Promise<void>/)
  assert.match(
    source,
    /async function buildEntryCardsChunked\([\s\S]*if \(\(index \+ 1\) % ENTRY_CARD_YIELD_BATCH_SIZE === 0\) \{[\s\S]*await yieldToUiLoop\(\)/s,
  )
  assert.match(
    source,
    /static async featuredEntries\(candidateLimit: number = HOME_ENTRY_CANDIDATE_LIMIT\): Promise<EntryCardModel\[]> \{[\s\S]*const safeCandidateLimit = Math\.max\(1, candidateLimit\)[\s\S]*return buildEntryCardsChunked\(entries, \(entry: Entry\) => feedMap\.get\(entry\.feedId\)\)/s,
  )
})
