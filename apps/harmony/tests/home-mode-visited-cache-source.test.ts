import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home mode switching keeps visited scenes mounted after the first switch', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(
    source,
    /@State visitedModes: SubscriptionMode\[] = \['articles'\]/,
  )
  assert.match(
    source,
    /this\.visitedModes = rememberVisitedMode\(this\.visitedModes, nextMode\)/,
  )
  assert.match(
    source,
    /return renderState\.shouldMount \|\| this\.visitedModes\.includes\(mode\)/,
  )
})
