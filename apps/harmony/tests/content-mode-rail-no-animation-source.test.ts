import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('content mode rail mode switching does not trigger extra indicator or emphasis animations', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/ContentModeRail.ets',
      import.meta.url,
    ),
    'utf8',
  )

  const commitStart = source.indexOf(
    'private commitModeSwitch(mode: ContentMode): void {',
  )
  const labelStart = source.indexOf(
    'private labelFor(mode: ContentMode): string {',
  )

  assert.notEqual(commitStart, -1)
  assert.notEqual(labelStart, -1)

  const commitBlock = source.slice(commitStart, labelStart)

  assert.doesNotMatch(commitBlock, /triggerIndicatorBounce/)
  assert.doesNotMatch(commitBlock, /triggerModeEmphasis/)
})
