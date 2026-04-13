import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('Index schedules a background refresh on startup and exposes loading placeholders', () => {
  const source = read('../entry/src/main/ets/pages/Index.ets')

  assert.match(source, /@State isHomeStartupRefreshing: boolean = false/)
  assert.match(source, /this\.startStartupRefreshIfNeeded\(\)/)
  assert.match(source, /private startStartupRefreshIfNeeded\(\): void/)
  assert.match(
    source,
    /void this\.refreshFeaturedEntries\(false\)\.finally\(\(\) => \{/,
  )
  assert.match(source, /private isHomeContentLoading\(\): boolean/)
  assert.match(source, /private homeEmptyStateTitle\(\): string/)
  assert.match(source, /isLoading: this\.isHomeContentLoading\(\)/)
})
