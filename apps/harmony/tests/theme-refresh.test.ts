import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldRefreshThemeOnSystemColorModeChange } from '../entry/src/main/ets/common/utils/ThemeRefresh.ts'

test('shouldRefreshThemeOnSystemColorModeChange only refreshes for system theme mode', () => {
  assert.equal(shouldRefreshThemeOnSystemColorModeChange('system'), true)
  assert.equal(shouldRefreshThemeOnSystemColorModeChange('light'), false)
  assert.equal(shouldRefreshThemeOnSystemColorModeChange('dark'), false)
})
