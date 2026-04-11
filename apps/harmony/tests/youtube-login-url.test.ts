import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveYouTubeLoginUrl } from '../entry/src/main/ets/common/utils/YouTubeLoginUrl.ts'

test('resolveYouTubeLoginUrl points to direct mobile sign-in entry', () => {
  const url = resolveYouTubeLoginUrl()

  assert.equal(
    url.startsWith('https://accounts.google.com/ServiceLogin?'),
    true,
  )
  assert.equal(url.includes('service=youtube'), true)
  assert.equal(url.includes('prompt=select_account'), true)
  assert.equal(url.includes('continue=https%3A%2F%2Fm.youtube.com%2F'), true)
})
