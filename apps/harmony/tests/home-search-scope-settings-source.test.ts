import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('harmony settings model persists the home search scope toggle', () => {
  const modelsSource = readFileSync(
    new URL(
      '../entry/src/main/ets/common/models/LivoModels.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(modelsSource, /searchAllHomeCategories: boolean/)
  assert.match(
    modelsSource,
    /DEFAULT_HARMONY_SETTINGS: HarmonySettings = \{[\s\S]*searchAllHomeCategories: true,/s,
  )
})

test('preferences service loads and saves the home search scope toggle', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/services/AppPreferenceService.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(
    source,
    /pref\.get\('searchAllHomeCategories', DEFAULT_HARMONY_SETTINGS\.searchAllHomeCategories\)/,
  )
  assert.match(
    source,
    /searchAllHomeCategories: searchAllHomeCategories as boolean/,
  )
  assert.match(
    source,
    /pref\.put\('searchAllHomeCategories', next\.searchAllHomeCategories\)/,
  )
})

test('general settings panel exposes a cross-category search toggle', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/SettingsSecondaryPanels.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(
    source,
    /private applySearchAllHomeCategories\(enabled: boolean\): void/,
  )
  assert.match(source, /'跨栏目搜索'/)
  assert.match(source, /'开启后，搜索范围包含所有栏目'/)
  assert.match(source, /this\.config\.searchAllHomeCategories/)
  assert.match(source, /\.onChange\(\(isOn: boolean\) => \{/)
  assert.match(source, /onToggle\(isOn\)/)
  assert.match(source, /\.onClick\(\(\) => onToggle\(!checked\)\)/)
})
