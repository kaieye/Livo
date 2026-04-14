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
    'private async refreshFeaturedEntries(showResultToast: boolean = true): Promise<void> {',
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
    /private async refreshFeaturedEntries\(showResultToast: boolean = true\): Promise<void> \{\s*if \(this\.isRefreshing\) \{\s*return\s*\}\s*this\.isRefreshing = true/s,
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
    /const result = await AppRepository\.refreshAllFeeds\([\s\S]*this\.feedSourceLabel = result\.sourceLabel[\s\S]*setTimeout\(\(\) => \{[\s\S]*this\.reloadFeaturedEntriesFromLocal\(HOME_INITIAL_CANDIDATE_LIMIT\)[\s\S]*\}, HOME_REFRESH_RESULT_RELOAD_DELAY_MS\)[\s\S]*this\.showToast\(result\.sourceLabel\)/s,
  )
})

test('home reloadFeaturedEntriesFromLocal stages grouping into a deferred frame', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /private homeEntryGroupVersion: number = 0/)
  assert.match(source, /const HOME_ENTRY_GROUP_DEFER_DELAY_MS: number = 32/)
  assert.match(source, /const HOME_INITIAL_CANDIDATE_LIMIT: number = 24/)
  assert.match(source, /const HOME_LAZY_LOAD_PAGE_SIZE: number = 24/)
  assert.match(source, /const HOME_MAX_CANDIDATE_LIMIT: number = 240/)
  assert.match(
    source,
    /private async reloadFeaturedEntriesFromLocal\(candidateLimit: number = HOME_INITIAL_CANDIDATE_LIMIT\): Promise<void> \{[\s\S]*const nextEntries = await AppRepository\.featuredEntries\(candidateLimit\)[\s\S]*this\.featuredEntries = nextEntries[\s\S]*this\.homeLoadedCandidateLimit = candidateLimit[\s\S]*this\.homeHasMoreEntries = nextEntries\.length >= candidateLimit[\s\S]*const currentGroupVersion = this\.homeEntryGroupVersion \+ 1[\s\S]*this\.homeEntryGroupVersion = currentGroupVersion[\s\S]*setTimeout\(\(\) => \{[\s\S]*if \(this\.homeEntryGroupVersion !== currentGroupVersion\) \{[\s\S]*return[\s\S]*\}[\s\S]*this\.entryGroups = groupHomeEntriesByMode\(nextEntries\)[\s\S]*\}, HOME_ENTRY_GROUP_DEFER_DELAY_MS\)/s,
  )
  assert.match(
    source,
    /private tryLoadMoreHomeEntries\(mode: SubscriptionMode\): void/,
  )
  assert.match(source, /private HomeLoadMoreSentinel\(mode: SubscriptionMode\)/)
  assert.match(source, /this\.tryLoadMoreHomeEntries\(mode\)/)
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
