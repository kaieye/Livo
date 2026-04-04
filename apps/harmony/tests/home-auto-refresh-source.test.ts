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
