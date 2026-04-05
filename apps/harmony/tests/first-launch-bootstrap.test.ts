import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('AppRepository primes theme palette and hydrates built-in feeds during first-launch bootstrap', () => {
  const source = read('../entry/src/main/ets/common/data/AppRepository.ets')

  assert.match(
    source,
    /import \{ ThemeService \} from '\.\.\/services\/ThemeService'/,
  )
  assert.match(
    source,
    /const settings = await AppPreferenceService\.loadSettings\(\)\s*await ThemeService\.resolvePalette\(settings\)/s,
  )
  assert.match(
    source,
    /void AppRepository\.hydrateSeedFeedsOnFirstLaunch\(SEED_FEEDS\)/,
  )
  assert.match(
    source,
    /private static async hydrateSeedFeedsOnFirstLaunch\(feeds: Feed\[\]\): Promise<void>/,
  )
  assert.match(
    source,
    /private static seedFeedHydrationStarted: boolean = false/,
  )
  assert.match(
    source,
    /if \(AppRepository\.seedFeedHydrationStarted\) \{\s*return\s*\}/,
  )
  assert.match(source, /AppRepository\.seedFeedHydrationStarted = true/)
  assert.match(
    source,
    /const payload = await RssFeedService\.fetchFeedEntries\(feed\)/,
  )
  assert.match(source, /await EntryRepository\.upsertMany\(payload\.entries\)/)
  assert.match(source, /await FeedRepository\.updateFetchState\(feed\.id, \{/)
  assert.match(
    source,
    /AppStorage\.setOrCreate\('feedsChangedAt', Date\.now\(\)\)/,
  )
})

test('EntryAbility waits for bootstrap before loading the root page and applying system bar styling', () => {
  const source = read('../entry/src/main/ets/entryability/EntryAbility.ets')

  assert.match(
    source,
    /import \{ ThemeService \} from '\.\.\/common\/services\/ThemeService'/,
  )
  assert.match(source, /await AppRepository\.bootstrap\(\)/)
  assert.match(
    source,
    /const theme = ThemeService\.currentPalette\(\)\s*await this\.applySystemBarStyle\(mainWindow, theme\.isDark\)/s,
  )
  assert.match(source, /windowStage\.loadContent\('pages\/Index'/)
})
