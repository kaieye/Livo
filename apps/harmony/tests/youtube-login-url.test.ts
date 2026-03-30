import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveYouTubeLoginUrl } from '../entry/src/main/ets/common/utils/YouTubeLoginUrl.ts'

test('resolveYouTubeLoginUrl uses direct Google sign-in entry instead of mobile home page', () => {
  const url = resolveYouTubeLoginUrl()

  assert.equal(url.startsWith('https://accounts.google.com/'), true)
  assert.equal(url.includes('service=youtube'), true)
  assert.equal(url.includes('uilel=3'), true)
  assert.equal(url.includes('passive=true'), true)
  assert.equal(url.includes('continue='), true)
  assert.equal(url.includes('https%3A%2F%2Fm.youtube.com%2F'), true)
  assert.equal(url.includes('https://m.youtube.com/'), false)
})
