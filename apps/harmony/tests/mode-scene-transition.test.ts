import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveModeSceneRenderState } from '../entry/src/main/ets/common/utils/ModeSceneTransition.ts'

test('resolveModeSceneRenderState only mounts the active scene when not transitioning', () => {
  const state = resolveModeSceneRenderState({
    mode: 'articles',
    renderedMode: 'articles',
    previousMode: 'articles',
    isTransitioning: false,
    direction: 1,
  })

  assert.deepEqual(state, {
    shouldMount: true,
    visibility: 'visible',
    opacity: 1,
    offset: 0,
    zIndex: 2,
  })

  const hiddenState = resolveModeSceneRenderState({
    mode: 'social',
    renderedMode: 'articles',
    previousMode: 'articles',
    isTransitioning: false,
    direction: 1,
  })

  assert.deepEqual(hiddenState, {
    shouldMount: false,
    visibility: 'hidden',
    opacity: 0,
    offset: 0,
    zIndex: 0,
  })
})

test('resolveModeSceneRenderState mounts only current and previous scenes during transition', () => {
  const currentState = resolveModeSceneRenderState({
    mode: 'social',
    renderedMode: 'social',
    previousMode: 'articles',
    isTransitioning: true,
    direction: 1,
  })

  const previousState = resolveModeSceneRenderState({
    mode: 'articles',
    renderedMode: 'social',
    previousMode: 'articles',
    isTransitioning: true,
    direction: 1,
  })

  const unrelatedState = resolveModeSceneRenderState({
    mode: 'videos',
    renderedMode: 'social',
    previousMode: 'articles',
    isTransitioning: true,
    direction: 1,
  })

  assert.equal(currentState.shouldMount, true)
  assert.equal(currentState.visibility, 'visible')
  assert.equal(previousState.shouldMount, true)
  assert.equal(previousState.offset, -16)
  assert.equal(unrelatedState.shouldMount, false)
  assert.equal(unrelatedState.visibility, 'hidden')
})
