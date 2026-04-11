import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canonicalFeedUrl,
  canonicalXFeedUrl,
  extractInstagramUsername,
  extractXUsername,
} from '../entry/src/main/ets/common/utils/SocialFeedTitles.ts'
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

  assert.equal(
    resolved,
    'https://i0.hdslb.com/bfs/face/c1733474892caa45952b2c09a89323157df7129a.jpg',
  )
})

test('canonicalXFeedUrl rewrites x user routes to the more stable twitter route on the same instance', () => {
  const resolved = canonicalXFeedUrl(
    'https://rsshub.pseudoyu.com/x/user/elonmusk',
    'https://x.com/elonmusk',
  )

  assert.equal(resolved, 'https://rsshub.pseudoyu.com/twitter/user/elonmusk')
})

test('extractXUsername does not treat instagram profile urls as x usernames', () => {
  assert.equal(extractXUsername('https://www.instagram.com/du_chenduling/'), '')
})

test('extractInstagramUsername does not treat generic non-instagram urls as instagram usernames', () => {
  assert.equal(extractInstagramUsername('https://www.ruanyifeng.com/blog'), '')
  assert.equal(
    extractInstagramUsername('https://space.bilibili.com/946974'),
    '',
  )
  assert.equal(extractInstagramUsername('https://x.com/elonmusk'), '')
})

test('canonicalFeedUrl recovers instagram feeds even if the stored rss route was previously rewritten to twitter', () => {
  const resolved = canonicalFeedUrl(
    'https://rsshub.pseudoyu.com/twitter/user/du_chenduling',
    'https://www.instagram.com/du_chenduling/',
  )

  assert.equal(
    resolved,
    'https://rsshub.pseudoyu.com/picnob/user/du_chenduling',
  )
})

test('canonicalFeedUrl keeps x feeds on twitter routes instead of rewriting them to instagram mirrors', () => {
  const resolved = canonicalFeedUrl(
    'https://rsshub.pseudoyu.com/twitter/user/elonmusk',
    'https://x.com/elonmusk',
  )

  assert.equal(resolved, 'https://rsshub.pseudoyu.com/twitter/user/elonmusk')
})

test('canonicalFeedUrl leaves regular rss and bilibili urls untouched', () => {
  assert.equal(
    canonicalFeedUrl(
      'https://www.ruanyifeng.com/blog/atom.xml',
      'https://www.ruanyifeng.com/blog',
    ),
    'https://www.ruanyifeng.com/blog/atom.xml',
  )

  assert.equal(
    canonicalFeedUrl(
      'https://rsshub.pseudoyu.com/bilibili/user/video/946974',
      'https://space.bilibili.com/946974',
    ),
    'https://rsshub.pseudoyu.com/bilibili/user/video/946974',
  )
})
