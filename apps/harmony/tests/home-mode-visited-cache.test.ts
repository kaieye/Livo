import test from 'node:test'
import assert from 'node:assert/strict'
import { rememberVisitedMode } from '../entry/src/main/ets/common/utils/HomeModeVisitedCache.ts'

test('rememberVisitedMode keeps existing visited modes unchanged when revisiting a mode', () => {
  assert.deepEqual(rememberVisitedMode(['articles', 'social'], 'social'), [
    'articles',
    'social',
  ])
})

test('rememberVisitedMode appends a newly visited mode once', () => {
  assert.deepEqual(rememberVisitedMode(['articles', 'social'], 'videos'), [
    'articles',
    'social',
    'videos',
  ])
})

test('rememberVisitedMode keeps the first-visited order stable for later mounts', () => {
  assert.deepEqual(
    rememberVisitedMode(['articles', 'videos', 'social'], 'pictures'),
    ['articles', 'videos', 'social', 'pictures'],
  )
})
