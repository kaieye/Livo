import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('content mode rail triggers mode switch from touch up instead of click callback', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/ContentModeRail.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(source, /if \(event\.type === TouchType\.Up[^\)]*\) \{/)
  assert.match(source, /this\.onChange\(mode\)/)
  assert.doesNotMatch(
    source,
    /\.onClick\(\(\) => \{[\s\S]*this\.onChange\(mode\)/,
  )
})
