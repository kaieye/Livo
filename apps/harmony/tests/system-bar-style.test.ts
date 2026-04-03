import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveSystemBarStyle } from '../entry/src/main/ets/common/utils/SystemBarStyle.ts'

test('resolveSystemBarStyle keeps status bar transparent in light mode', () => {
  const style = resolveSystemBarStyle({
    isDark: false,
    background: '#F3F5F8',
  })

  assert.equal(style.statusBarColor, '#00000000')
  assert.equal(style.navigationBarColor, '#00000000')
  assert.equal(style.isStatusBarLightIcon, false)
  assert.equal(style.statusBarContentColor, '#000000')
})

test('resolveSystemBarStyle keeps immersive transparent bars in dark mode', () => {
  const style = resolveSystemBarStyle({
    isDark: true,
    background: '#111418',
  })

  assert.equal(style.statusBarColor, '#00000000')
  assert.equal(style.navigationBarColor, '#00000000')
  assert.equal(style.isStatusBarLightIcon, true)
  assert.equal(style.statusBarContentColor, '#FFFFFF')
})
