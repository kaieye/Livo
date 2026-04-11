import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('default harmony settings disable auto refresh', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/models/LivoModels.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(
    source,
    /DEFAULT_HARMONY_SETTINGS: HarmonySettings = \{[\s\S]*autoRefresh: false,/,
  )
})

test('home loadInitialData does not auto refresh feeds on page entry', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  const loadInitialDataStart = source.indexOf(
    'private async loadInitialData(): Promise<void> {',
  )
  const refreshFeaturedEntriesStart = source.indexOf(
    'private async refreshFeaturedEntries(): Promise<void> {',
  )

  assert.notEqual(loadInitialDataStart, -1)
  assert.notEqual(refreshFeaturedEntriesStart, -1)

  const loadInitialData = source.slice(
    loadInitialDataStart,
    refreshFeaturedEntriesStart,
  )

  assert.doesNotMatch(loadInitialData, /settings\.autoRefresh/)
  assert.doesNotMatch(loadInitialData, /await this\.refreshFeaturedEntries\(\)/)
})

test('home refreshFeaturedEntries prevents reentrant refresh calls', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(
    source,
    /private async refreshFeaturedEntries\(\): Promise<void> \{\s*if \(this\.isRefreshing\) \{\s*return\s*\}\s*this\.isRefreshing = true/s,
  )
})

test('home refreshFeaturedEntries shows the aggregate refresh toast message after updating entries', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(
    source,
    /private showToast\(message: string, duration: number = 2000\): void/,
  )
  assert.match(
    source,
    /const result = await AppRepository\.refreshAllFeeds\([\s\S]*this\.featuredEntries = result\.entries[\s\S]*this\.entryGroups = groupHomeEntriesByMode\(result\.entries\)[\s\S]*this\.feedSourceLabel = result\.sourceLabel[\s\S]*this\.showToast\(result\.sourceLabel\)/s,
  )
})

test('home refreshFeaturedEntries updates refresh button progress while feeds are still refreshing', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /@State refreshCompletedCount: number = 0/)
  assert.match(source, /@State refreshTotalCount: number = 0/)
  assert.match(source, /@State displayRefreshPercent: number = 0/)
  assert.match(
    source,
    /const result = await AppRepository\.refreshAllFeeds\(\(completedCount: number, totalCount: number\) => \{\s*this\.refreshCompletedCount = completedCount\s*this\.refreshTotalCount = totalCount\s*this\.animateRefreshPercentTo\(this\.resolveRefreshPercent\(completedCount, totalCount\)\)\s*\}\)/s,
  )
  assert.match(
    source,
    /this\.refreshCompletedCount = 0[\s\S]*this\.refreshTotalCount = 0[\s\S]*this\.clearRefreshPercentAnimation\(\)[\s\S]*this\.displayRefreshPercent = 0/s,
  )
})
