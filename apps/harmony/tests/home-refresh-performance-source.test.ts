import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('AppRepository refreshAllFeeds refreshes feeds in parallel and reports newly discovered entries', () => {
  const source = read('../entry/src/main/ets/common/data/AppRepository.ets')
  const modelsSource = read(
    '../entry/src/main/ets/common/models/LivoModels.ets',
  )

  assert.match(modelsSource, /failedFeedCount\?: number/)
  assert.match(modelsSource, /failedFeedLabels\?: string\[\]/)
  assert.match(modelsSource, /failedFeedDetails\?: string\[\]/)
  assert.match(
    source,
    /onProgress\?: \(completedCount: number, totalCount: number\) => void/,
  )
  assert.match(
    source,
    /const refreshConcurrency = AppRepository\.resolveRefreshConcurrency\(feeds\.length\)/,
  )
  assert.match(
    source,
    /const results = await AppRepository\.refreshFeedsWithPool\(\s*feeds,\s*refreshConcurrency,\s*onProgress,\s*\)/s,
  )
  assert.match(source, /let completedCount = 0/)
  assert.match(source, /onProgress\?\.\(completedCount, feeds\.length\)/)
  assert.match(source, /onProgress\?\.\(0, feeds\.length\)/)
  assert.match(source, /let newEntriesCount = 0/)
  assert.match(
    source,
    /newEntriesCount \+= result\.value\.newEntriesCount \?\? 0/,
  )
  assert.match(
    source,
    /const failedFeedSummary = failedFeedLabels\.slice\(0, 3\)\.join\('、'\)/,
  )
  assert.match(
    source,
    /const failedFeedSuffix = failedFeedSummary[\s\S]*\?\s*`：\$\{failedFeedSummary\}\$\{failedFeedLabels\.length > 3 \? ' 等' : ''\}`/s,
  )
  assert.match(
    source,
    /sourceLabel: `新增 \$\{newEntriesCount\} 条，\$\{failedCount\} 个订阅源刷新失败\$\{failedFeedSuffix\}`/,
  )
  assert.match(source, /failedFeedCount: failedCount/)
  assert.match(source, /failedFeedLabels,/)
  assert.match(source, /failedFeedDetails,/)
})

test('AppRepository refreshFeed reports how many entries were newly added locally', () => {
  const source = read('../entry/src/main/ets/common/data/AppRepository.ets')
  const modelsSource = read(
    '../entry/src/main/ets/common/models/LivoModels.ets',
  )

  assert.match(modelsSource, /newEntriesCount\?: number/)
  assert.match(
    source,
    /static async refreshFeed\(\s*feedId: string,\s*preferFastImageResolve: boolean = false,\s*\): Promise<RemoteFeedResult>/s,
  )
  assert.match(
    source,
    /const nextResolvedImageUrl = preferFastImageResolve\s*\? \(payload\.imageUrl \|\| feed\.imageUrl \|\| ''\)\s*:\s*await SocialFeedAvatarService\.resolveFeedAvatar\(/s,
  )
  assert.match(
    source,
    /const existingEntries = await EntryRepository\.listByFeed\(feedId\)/,
  )
  assert.match(source, /const existingEntryIds = new Set<string>\(\)/)
  assert.match(
    source,
    /const newEntriesCount = payload\.entries\.filter\(\(entry: Entry\) => !existingEntryIds\.has\(entry\.id\)\)\.length/,
  )
  assert.match(
    source,
    /newEntriesCount,\s*failedFeedCount: 0,\s*failedFeedLabels: \[\],\s*failedFeedDetails: \[\],\s*fallbackUsed: false/s,
  )
  assert.match(
    source,
    /newEntriesCount: 0,\s*failedFeedCount: 1,\s*failedFeedLabels: \[feed\.title\],\s*failedFeedDetails: \[`\$\{feed\.title\}：\$\{message\}`\],\s*fallbackUsed: true/s,
  )
})
