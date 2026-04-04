import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldAcceptModeSwitch } from '../entry/src/main/ets/common/utils/ModeSwitchGuard.ts'

test('shouldAcceptModeSwitch rejects switching to the current mode', () => {
  assert.equal(
    shouldAcceptModeSwitch({
      currentMode: 'articles',
      nextMode: 'articles',
      isTransitioning: false,
    }),
    false,
  )
})

test('shouldAcceptModeSwitch rejects rapid repeat switches while transition is in progress', () => {
  assert.equal(
    shouldAcceptModeSwitch({
      currentMode: 'articles',
      nextMode: 'social',
      isTransitioning: true,
    }),
    false,
  )
})

test('shouldAcceptModeSwitch allows switching to a different mode when idle', () => {
  assert.equal(
    shouldAcceptModeSwitch({
      currentMode: 'articles',
      nextMode: 'social',
      isTransitioning: false,
    }),
    true,
  )
})
