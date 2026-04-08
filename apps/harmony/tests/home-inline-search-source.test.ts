import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home page defines inline search state and keyboard controller', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /@State searchQuery: string = ''/)
  assert.match(source, /@State showSearch: boolean = false/)
  assert.match(
    source,
    /private searchInputController: TextInputController = new TextInputController\(\)/,
  )
  assert.match(source, /private openHomeInlineSearch\(\): void/)
  assert.match(source, /private closeHomeInlineSearch\(\): void/)
  assert.match(source, /private focusHomeInlineSearch\(\): void/)
})

test('home inline search highlight uses theme accent and current mode entries', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /theme\.accent/)
  assert.match(source, /private currentSearchEntries\(\): EntryCardModel\[\]/)
  assert.match(source, /private hasSearchMatches\(\): boolean/)
})
