import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('root HdsTabs disables swipe navigation between bottom tabs', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /HdsTabs\(\{ controller: this\.rootTabsController \}\)/)
  assert.match(source, /\.scrollable\(false\)/)
})
