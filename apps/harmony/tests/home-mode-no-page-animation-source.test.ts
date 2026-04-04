import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home mode switching updates scenes immediately without page transition timer', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  const startModeTransitionStart = source.indexOf(
    'private startModeTransition(nextMode: SubscriptionMode): void {',
  )
  const adjacentModeStart = source.indexOf(
    'private adjacentMode(offsetX: number): SubscriptionMode | undefined {',
  )

  assert.notEqual(startModeTransitionStart, -1)
  assert.notEqual(adjacentModeStart, -1)

  const startModeTransition = source.slice(
    startModeTransitionStart,
    adjacentModeStart,
  )

  assert.match(startModeTransition, /this\.previousMode = nextMode/)
  assert.match(startModeTransition, /this\.renderedMode = nextMode/)
  assert.match(startModeTransition, /this\.isModeTransitioning = false/)
  assert.doesNotMatch(startModeTransition, /setTimeout\(/)
})
