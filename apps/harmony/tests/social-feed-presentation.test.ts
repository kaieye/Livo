import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolvePreferredStoredFeedImageUrl,
  resolvePreferredStoredFeedTitle,
} from '../entry/src/main/ets/common/utils/SocialFeedPresentation.ts'

test('resolvePreferredStoredFeedTitle keeps better existing x display name during refresh', () => {
  const resolved = resolvePreferredStoredFeedTitle(
    'Elon Musk',
    '@elonmusk',
    'https://rsshub.pseudoyu.com/x/user/elonmusk',
    'https://x.com/elonmusk',
  )

  assert.equal(resolved, 'Elon Musk')
})

test('resolvePreferredStoredFeedTitle keeps better existing bilibili creator name over generic uid title', () => {
  const resolved = resolvePreferredStoredFeedTitle(
    '影视飓风',
    'Bilibili 946974',
    'https://rsshub.pseudoyu.com/bilibili/user/video/946974',
    'https://space.bilibili.com/946974',
  )

  assert.equal(resolved, '影视飓风')
})

test('resolvePreferredStoredFeedImageUrl keeps existing avatar when refresh only returns generic icon', () => {
  const resolved = resolvePreferredStoredFeedImageUrl(
    'https://unavatar.io/x/elonmusk?fallback=false',
    'https://abs.twimg.com/favicons/twitter.3.ico',
  )

  assert.equal(resolved, 'https://unavatar.io/x/elonmusk?fallback=false')
})

test('resolvePreferredStoredFeedImageUrl accepts richer incoming avatar over placeholder', () => {
  const resolved = resolvePreferredStoredFeedImageUrl(
    'https://www.google.com/s2/favicons?domain=space.bilibili.com&sz=128',
    'https://i0.hdslb.com/bfs/face/c1733474892caa45952b2c09a89323157df7129a.jpg',
  )

  assert.equal(resolved, 'https://i0.hdslb.com/bfs/face/c1733474892caa45952b2c09a89323157df7129a.jpg')
})
