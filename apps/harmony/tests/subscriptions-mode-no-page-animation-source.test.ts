import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('subscriptions mode switching keeps previous mode semantics without timer delay', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/SubscriptionsContent.ets',
      import.meta.url,
    ),
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

  assert.match(startModeTransition, /this\.previousMode = this\.renderedMode/)
  assert.match(startModeTransition, /this\.renderedMode = nextMode/)
  assert.match(startModeTransition, /this\.isModeTransitioning = false/)
  assert.doesNotMatch(startModeTransition, /setTimeout\(/)
})

test('subscriptions mode scenes do not apply a page animation wrapper', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/SubscriptionsContent.ets',
      import.meta.url,
    ),
    'utf8',
  )

  const modeFeedsSceneStart = source.indexOf(
    'private ModeFeedsScene(mode: SubscriptionMode) {',
  )
  const openFeedDetailStart = source.indexOf(
    'private openFeedDetailPage(feedId: string): void {',
  )

  assert.notEqual(modeFeedsSceneStart, -1)
  assert.notEqual(openFeedDetailStart, -1)

  const modeFeedsScene = source.slice(modeFeedsSceneStart, openFeedDetailStart)

  assert.doesNotMatch(modeFeedsScene, /\.animation\(\{/)
  assert.doesNotMatch(modeFeedsScene, /MODE_SCENE_DURATION/)
})
