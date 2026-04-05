import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('AppRepository refreshAllFeeds refreshes feeds in parallel and reports newly discovered entries', () => {
  const source = read('../entry/src/main/ets/common/data/AppRepository.ets')

  assert.match(
    source,
    /const refreshTasks = feeds\.map\(\(feed: Feed\) => AppRepository\.refreshFeed\(feed\.id\)\)/,
  )
  assert.match(
    source,
    /const results = await Promise\.allSettled\(refreshTasks\)/,
  )
  assert.match(source, /let newEntriesCount = 0/)
  assert.match(
    source,
    /newEntriesCount \+= result\.value\.newEntriesCount \?\? 0/,
  )
  assert.match(
    source,
    /sourceLabel: `全部订阅：新增 \$\{newEntriesCount\} 条，成功 \$\{refreshedCount\}，失败 \$\{failedCount\}`/,
  )
})

test('AppRepository refreshFeed reports how many entries were newly added locally', () => {
  const source = read('../entry/src/main/ets/common/data/AppRepository.ets')
  const modelsSource = read(
    '../entry/src/main/ets/common/models/LivoModels.ets',
  )

  assert.match(modelsSource, /newEntriesCount\?: number/)
  assert.match(
    source,
    /const existingEntries = await EntryRepository\.listByFeed\(feedId\)/,
  )
  assert.match(source, /const existingEntryIds = new Set<string>\(\)/)
  assert.match(
    source,
    /const newEntriesCount = payload\.entries\.filter\(\(entry: Entry\) => !existingEntryIds\.has\(entry\.id\)\)\.length/,
  )
  assert.match(source, /newEntriesCount,\s*fallbackUsed: false/s)
  assert.match(source, /newEntriesCount: 0,\s*fallbackUsed: true/s)
})
